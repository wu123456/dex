package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/websocket"
	"github.com/wolf/dex-backend/internal/service"
	"github.com/wolf/dex-backend/internal/store"
	"github.com/wolf/dex-backend/internal/ws"
)

type Handler struct {
	svc      *service.Service
	mux      *http.ServeMux
	hub      *ws.Hub
	upgrader websocket.Upgrader
}

func NewHandler(svc *service.Service, hub *ws.Hub) *Handler {
	h := &Handler{
		svc: svc,
		mux: http.NewServeMux(),
		hub: hub,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool { return true },
		},
	}
	h.registerRoutes()
	return h
}

func (h *Handler) registerRoutes() {
	h.mux.HandleFunc("GET /api/pairs", h.handleGetPairs)
	h.mux.HandleFunc("GET /api/pairs/{address}", h.handleGetPair)
	h.mux.HandleFunc("GET /api/tokens", h.handleGetTokens)
	h.mux.HandleFunc("GET /api/tokens/{address}", h.handleGetToken)
	h.mux.HandleFunc("GET /api/quote", h.handleGetQuote)
	h.mux.HandleFunc("GET /api/swaps", h.handleGetSwaps)
	h.mux.HandleFunc("GET /api/klines", h.handleGetKlines)
	h.mux.HandleFunc("POST /api/sync", h.handleSync)

	h.mux.HandleFunc("GET /api/orders", h.handleGetOrders)
	h.mux.HandleFunc("POST /api/orders", h.handleCreateOrder)
	h.mux.HandleFunc("DELETE /api/orders/{id}", h.handleCancelOrder)
	h.mux.HandleFunc("GET /api/orderbook", h.handleGetOrderBook)

	h.mux.HandleFunc("GET /api/proposals", h.handleGetProposals)
	h.mux.HandleFunc("POST /api/proposals", h.handleCreateProposal)
	h.mux.HandleFunc("POST /api/proposals/{id}/vote", h.handleVote)

	if h.hub != nil {
		h.mux.HandleFunc("GET /api/ws", h.handleWebSocket)
	}
}

func (h *Handler) Serve(addr string) error {
	return http.ListenAndServe(addr, corsMiddleware(h.mux))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) handleGetPairs(w http.ResponseWriter, r *http.Request) {
	pairs := h.svc.GetPairs(r.Context())
	writeJSON(w, http.StatusOK, pairs)
}

func (h *Handler) handleGetPair(w http.ResponseWriter, r *http.Request) {
	address := r.PathValue("address")
	pair, err := h.svc.GetPair(r.Context(), address)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, pair)
}

func (h *Handler) handleGetTokens(w http.ResponseWriter, r *http.Request) {
	tokens := h.svc.GetTokens(r.Context())
	writeJSON(w, http.StatusOK, tokens)
}

func (h *Handler) handleGetToken(w http.ResponseWriter, r *http.Request) {
	address := r.PathValue("address")
	token, err := h.svc.GetToken(r.Context(), address)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, token)
}

func (h *Handler) handleGetQuote(w http.ResponseWriter, r *http.Request) {
	amountIn := r.URL.Query().Get("amountIn")
	pathStr := r.URL.Query().Get("path")
	if amountIn == "" || pathStr == "" {
		writeError(w, http.StatusBadRequest, "amountIn and path are required")
		return
	}
	var path []string
	if err := json.Unmarshal([]byte(pathStr), &path); err != nil {
		writeError(w, http.StatusBadRequest, "invalid path format")
		return
	}
	quote, err := h.svc.GetQuote(r.Context(), amountIn, path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, quote)
}

func (h *Handler) handleGetSwaps(w http.ResponseWriter, r *http.Request) {
	pair := r.URL.Query().Get("pair")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	swaps := h.svc.GetSwaps(r.Context(), pair, limit)
	writeJSON(w, http.StatusOK, swaps)
}

func (h *Handler) handleGetKlines(w http.ResponseWriter, r *http.Request) {
	pair := r.URL.Query().Get("pair")
	from, _ := strconv.ParseInt(r.URL.Query().Get("from"), 10, 64)
	to, _ := strconv.ParseInt(r.URL.Query().Get("to"), 10, 64)
	if to == 0 {
		to = 0x7FFFFFFFFFFFFFFF
	}
	klines := h.svc.GetKlines(r.Context(), pair, from, to)
	writeJSON(w, http.StatusOK, klines)
}

func (h *Handler) handleSync(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.SyncPairs(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) handleGetOrders(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	orders := h.svc.GetOrders(status)
	writeJSON(w, http.StatusOK, orders)
}

func (h *Handler) handleCreateOrder(w http.ResponseWriter, r *http.Request) {
	var order store.LimitOrder
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.CreateOrder(&order); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, order)
}

func (h *Handler) handleCancelOrder(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid order id")
		return
	}
	if err := h.svc.CancelOrder(uint(id)); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

func (h *Handler) handleGetOrderBook(w http.ResponseWriter, r *http.Request) {
	tokenIn := r.URL.Query().Get("tokenIn")
	tokenOut := r.URL.Query().Get("tokenOut")
	if tokenIn == "" || tokenOut == "" {
		writeError(w, http.StatusBadRequest, "tokenIn and tokenOut are required")
		return
	}
	orderbook := h.svc.GetOrderBook(tokenIn, tokenOut)
	writeJSON(w, http.StatusOK, orderbook)
}

func (h *Handler) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}
	client := ws.NewClient(h.hub, conn)
	h.hub.Register(client)
	go client.WritePump()
	go client.ReadPump()
}

func (h *Handler) handleGetProposals(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	proposals := h.svc.GetProposals(status)
	writeJSON(w, http.StatusOK, proposals)
}

func (h *Handler) handleCreateProposal(w http.ResponseWriter, r *http.Request) {
	var proposal store.GovernanceProposal
	if err := json.NewDecoder(r.Body).Decode(&proposal); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.CreateProposal(&proposal); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, proposal)
}

func (h *Handler) handleVote(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseUint(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid proposal id")
		return
	}
	var body struct {
		Support bool   `json:"support"`
		Weight  string `json:"weight"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.svc.Vote(uint(id), body.Support, body.Weight); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "voted"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
