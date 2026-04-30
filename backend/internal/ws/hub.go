package ws

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type Hub struct {
	mu      sync.RWMutex
	clients map[*Client]struct{}
	send    chan *Message
}

type Message struct {
	Type string      `json:"type"`
	Data interface{} `json:"data"`
}

type OrderBookUpdate struct {
	TokenIn  string       `json:"tokenIn"`
	TokenOut string       `json:"tokenOut"`
	Bids     []PriceLevel `json:"bids"`
	Asks     []PriceLevel `json:"asks"`
}

type PriceLevel struct {
	Price  string `json:"price"`
	Amount string `json:"amount"`
	Count  int    `json:"count"`
}

type Client struct {
	hub  *Hub
	conn *websocket.Conn
	send chan []byte
}

func NewHub() *Hub {
	return &Hub{
		clients: make(map[*Client]struct{}),
		send:    make(chan *Message, 256),
	}
}

func (h *Hub) Run() {
	for msg := range h.send {
		data, err := json.Marshal(msg)
		if err != nil {
			log.Printf("ws hub marshal error: %v", err)
			continue
		}
		h.mu.RLock()
		for c := range h.clients {
			select {
			case c.send <- data:
			default:
				h.mu.RUnlock()
				h.removeClient(c)
				h.mu.RLock()
			}
		}
		h.mu.RUnlock()
	}
}

func (h *Hub) Broadcast(msg *Message) {
	select {
	case h.send <- msg:
	default:
		log.Println("ws hub broadcast channel full, dropping message")
	}
}

func (h *Hub) BroadcastOrderBook(update *OrderBookUpdate) {
	h.Broadcast(&Message{
		Type: "orderbook",
		Data: update,
	})
}

func (h *Hub) Register(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.clients[client] = struct{}{}
}

func (h *Hub) removeClient(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.clients[client]; ok {
		close(client.send)
		delete(h.clients, client)
	}
}

func NewClient(hub *Hub, conn *websocket.Conn) *Client {
	return &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}
}

func (c *Client) WritePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, msg); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) ReadPump() {
	defer func() {
		c.hub.removeClient(c)
		c.conn.Close()
	}()

	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
