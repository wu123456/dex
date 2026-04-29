package api

import (
	"encoding/json"
	"net/http"

	"github.com/wolf/dex-backend/internal/service"
)

type Handler struct {
	svc *service.Service
	mux *http.ServeMux
}

func NewHandler(svc *service.Service) *Handler {
	h := &Handler{
		svc: svc,
		mux: http.NewServeMux(),
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
	h.mux.HandleFunc("POST /api/sync", h.handleSync)
}

func (h *Handler) Serve(addr string) error {
	return http.ListenAndServe(addr, corsMiddleware(h.mux))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) handleGetPairs(w http.ResponseWriter, r *http.Request) {
	pairs, err := h.svc.GetPairs(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
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
	tokens, err := h.svc.GetTokens(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
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
		writeError(w, http.StatusBadRequest, "invalid path format, expected JSON array")
		return
	}

	quote, err := h.svc.GetQuote(r.Context(), amountIn, path)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, quote)
}

func (h *Handler) handleSync(w http.ResponseWriter, r *http.Request) {
	if err := h.svc.SyncPairs(r.Context()); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
