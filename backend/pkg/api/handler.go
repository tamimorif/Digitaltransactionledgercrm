package api

import (
	"api/pkg/models"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// Handler struct
type Handler struct {
    db *gorm.DB
}

// NewHandler creates a new handler instance with database connection
func NewHandler(db *gorm.DB) *Handler {
    return &Handler{
        db: db,
    }
}

// Client Handlers

func (h *Handler) GetClients(w http.ResponseWriter, r *http.Request) {
	var clients []models.Client
	result := h.db.Find(&clients)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, clients)
}

func (h *Handler) CreateClient(w http.ResponseWriter, r *http.Request) {
	var client models.Client
	if err := json.NewDecoder(r.Body).Decode(&client); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Generate UUID for the client
	client.ID = uuid.New().String()

	result := h.db.Create(&client)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusCreated, client)
}

func (h *Handler) GetClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var client models.Client
	result := h.db.Preload("Transactions").First(&client, "id = ?", id)
	if result.Error != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}
	respondJSON(w, http.StatusOK, client)
}

func (h *Handler) UpdateClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var client models.Client
	if err := h.db.First(&client, "id = ?", id).Error; err != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&client); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	h.db.Save(&client)
	respondJSON(w, http.StatusOK, client)
}

func (h *Handler) DeleteClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result := h.db.Delete(&models.Client{}, "id = ?", id)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Client deleted successfully"})
}

// Transaction Handlers

func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	var transactions []models.Transaction
	result := h.db.Preload("Client").Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}

func (h *Handler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	var transaction models.Transaction
	if err := json.NewDecoder(r.Body).Decode(&transaction); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Generate UUID for the transaction
	transaction.ID = uuid.New().String()

	result := h.db.Create(&transaction)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusCreated, transaction)
}

func (h *Handler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var transaction models.Transaction
	result := h.db.Preload("Client").First(&transaction, "id = ?", id)
	if result.Error != nil {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}
	respondJSON(w, http.StatusOK, transaction)
}

func (h *Handler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var transaction models.Transaction
	if err := h.db.First(&transaction, "id = ?", id).Error; err != nil {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}

	if err := json.NewDecoder(r.Body).Decode(&transaction); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	h.db.Save(&transaction)
	respondJSON(w, http.StatusOK, transaction)
}

func (h *Handler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result := h.db.Delete(&models.Transaction{}, "id = ?", id)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Transaction deleted successfully"})
}

func (h *Handler) GetClientTransactions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientId := vars["id"]

	var transactions []models.Transaction
	result := h.db.Where("client_id = ?", clientId).Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}

func (h *Handler) SearchClients(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	var clients []models.Client
	result := h.db.Where("name LIKE ? OR email LIKE ? OR phone LIKE ?", 
		"%"+query+"%", "%"+query+"%", "%"+query+"%").Find(&clients)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, clients)
}

func (h *Handler) SearchTransactions(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	var transactions []models.Transaction
	result := h.db.Preload("Client").Where("description LIKE ? OR type LIKE ?", 
		"%"+query+"%", "%"+query+"%").Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}

// Helper function to send JSON response
func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	err := json.NewEncoder(w).Encode(payload)
	if err != nil {
		return
	}
}
