package services

import (
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WSMessage represents a WebSocket message
type WSMessage struct {
	Type      string                 `json:"type"`   // "transaction", "pickup", "cash_balance", "remittance", etc.
	Action    string                 `json:"action"` // "created", "updated", "deleted", "status_changed"
	Data      map[string]interface{} `json:"data"`
	TenantID  uint                   `json:"tenantId"`
	Timestamp time.Time              `json:"timestamp"`
}

// Client represents a WebSocket client
type Client struct {
	ID       string
	TenantID uint
	Conn     *websocket.Conn
	Send     chan []byte
	Hub      *Hub
}

// Hub maintains the set of active clients and broadcasts messages to them
type Hub struct {
	// Registered clients by tenant
	clients map[uint]map[*Client]bool

	// Inbound messages from clients
	broadcast chan WSMessage

	// Register requests from clients
	register chan *Client

	// Unregister requests from clients
	unregister chan *Client

	mu sync.RWMutex
}

var (
	hubInstance *Hub
	hubOnce     sync.Once
)

// GetHub returns the singleton hub instance
func GetHub() *Hub {
	hubOnce.Do(func() {
		hubInstance = &Hub{
			broadcast:  make(chan WSMessage, 256),
			register:   make(chan *Client),
			unregister: make(chan *Client),
			clients:    make(map[uint]map[*Client]bool),
		}
		go hubInstance.run()
	})
	return hubInstance
}

// Run starts the hub
func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if h.clients[client.TenantID] == nil {
				h.clients[client.TenantID] = make(map[*Client]bool)
			}
			h.clients[client.TenantID][client] = true
			h.mu.Unlock()
			log.Printf("✅ WebSocket client registered for tenant %d (total: %d)", client.TenantID, len(h.clients[client.TenantID]))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.TenantID][client]; ok {
				delete(h.clients[client.TenantID], client)
				close(client.Send)
				if len(h.clients[client.TenantID]) == 0 {
					delete(h.clients, client.TenantID)
				}
			}
			h.mu.Unlock()
			log.Printf("🔌 WebSocket client disconnected from tenant %d", client.TenantID)

		case message := <-h.broadcast:
			h.mu.RLock()
			tenantClients := h.clients[message.TenantID]
			h.mu.RUnlock()

			if tenantClients != nil {
				messageJSON, err := json.Marshal(message)
				if err != nil {
					log.Printf("Error marshaling message: %v", err)
					continue
				}

				for client := range tenantClients {
					select {
					case client.Send <- messageJSON:
					default:
						// Client's send channel is full, disconnect
						h.mu.Lock()
						delete(h.clients[message.TenantID], client)
						close(client.Send)
						h.mu.Unlock()
					}
				}
			}
		}
	}
}

// RegisterClient registers a new WebSocket client
func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

// UnregisterClient unregisters a WebSocket client
func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

// Broadcast sends a message to all clients in a tenant
func (h *Hub) Broadcast(message WSMessage) {
	message.Timestamp = time.Now()
	h.broadcast <- message
}

// BroadcastTransactionUpdate broadcasts a transaction update
func (h *Hub) BroadcastTransactionUpdate(tenantID uint, action string, data map[string]interface{}) {
	h.Broadcast(WSMessage{
		Type:     "transaction",
		Action:   action,
		Data:     data,
		TenantID: tenantID,
	})
}

// BroadcastPickupUpdate broadcasts a pickup transaction update
func (h *Hub) BroadcastPickupUpdate(tenantID uint, action string, data map[string]interface{}) {
	h.Broadcast(WSMessage{
		Type:     "pickup",
		Action:   action,
		Data:     data,
		TenantID: tenantID,
	})
}

// BroadcastCashBalanceUpdate broadcasts a cash balance update
func (h *Hub) BroadcastCashBalanceUpdate(tenantID uint, action string, data map[string]interface{}) {
	h.Broadcast(WSMessage{
		Type:     "cash_balance",
		Action:   action,
		Data:     data,
		TenantID: tenantID,
	})
}

// BroadcastRemittanceUpdate broadcasts a remittance update
func (h *Hub) BroadcastRemittanceUpdate(tenantID uint, action string, data map[string]interface{}) {
	h.Broadcast(WSMessage{
		Type:     "remittance",
		Action:   action,
		Data:     data,
		TenantID: tenantID,
	})
}

// BroadcastTicketUpdate broadcasts a ticket update
func (h *Hub) BroadcastTicketUpdate(tenantID uint, action string, data map[string]interface{}) {
	h.Broadcast(WSMessage{
		Type:     "ticket",
		Action:   action,
		Data:     data,
		TenantID: tenantID,
	})
}

// BroadcastTicketMessage broadcasts a new ticket message
func (h *Hub) BroadcastTicketMessage(tenantID uint, data map[string]interface{}) {
	h.Broadcast(WSMessage{
		Type:     "ticket_message",
		Action:   "created",
		Data:     data,
		TenantID: tenantID,
	})
}

// BroadcastTicketAssignment broadcasts a ticket assignment notification
func (h *Hub) BroadcastTicketAssignment(tenantID uint, assignedToUserID uint, data map[string]interface{}) {
	data["assignedToUserId"] = assignedToUserID
	h.Broadcast(WSMessage{
		Type:     "ticket_assignment",
		Action:   "assigned",
		Data:     data,
		TenantID: tenantID,
	})
}

// ReadPump pumps messages from the websocket connection to the hub
func (c *Client) ReadPump() {
	defer func() {
		c.Hub.UnregisterClient(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("WebSocket error: %v", err)
			}
			break
		}
	}
}

// WritePump pumps messages from the hub to the websocket connection
func (c *Client) WritePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
