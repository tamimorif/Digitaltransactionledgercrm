package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"log"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow connections from anywhere (configure for production)
		return true
	},
}

// WebSocketHandler handles WebSocket connections
type WebSocketHandler struct {
	DB  *gorm.DB
	Hub *services.Hub
}

// NewWebSocketHandler creates a new WebSocket handler
func NewWebSocketHandler(db *gorm.DB) *WebSocketHandler {
	return &WebSocketHandler{
		DB:  db,
		Hub: services.GetHub(),
	}
}

// ServeWS handles WebSocket upgrade requests
// @Summary WebSocket connection
// @Description Establish a WebSocket connection for real-time updates
// @Tags websocket
// @Security BearerAuth
// @Router /ws [get]
func (wsh *WebSocketHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	// Get user from context (auth middleware should have set this)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if user.TenantID == nil {
		http.Error(w, "User must belong to a tenant", http.StatusBadRequest)
		return
	}

	// Upgrade HTTP connection to WebSocket
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	// Create new client
	client := &services.Client{
		ID:       uuid.New().String(),
		TenantID: *user.TenantID,
		Conn:     conn,
		Send:     make(chan []byte, 256),
		Hub:      wsh.Hub,
	}

	// Register client with hub
	wsh.Hub.RegisterClient(client)

	// Start goroutines for reading and writing
	go client.WritePump()
	go client.ReadPump()

	log.Printf("✅ WebSocket connection established for user %d (tenant %d)", user.ID, *user.TenantID)
}
