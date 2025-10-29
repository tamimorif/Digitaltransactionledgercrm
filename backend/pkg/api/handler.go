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

// GetClients godoc
// @Summary Get all clients
// @Description Get a list of all clients
// @Tags clients
// @Produce json
// @Success 200 {array} models.Client
// @Failure 500 {object} map[string]string
// @Router /clients [get]
func (h *Handler) GetClients(w http.ResponseWriter, r *http.Request) {
	var clients []models.Client
	result := h.db.Find(&clients)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, clients)
}

// CreateClient godoc
// @Summary Create a new client
// @Description Create a new client with the provided information
// @Tags clients
// @Accept json
// @Produce json
// @Param client body models.Client true "Client object"
// @Success 201 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /clients [post]
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

// GetClient godoc
// @Summary Get a client by ID
// @Description Get a specific client by their ID with transactions
// @Tags clients
// @Produce json
// @Param id path string true "Client ID"
// @Success 200 {object} models.Client
// @Failure 404 {object} map[string]string
// @Router /clients/{id} [get]
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

// UpdateClient godoc
// @Summary Update a client
// @Description Update an existing client's information
// @Tags clients
// @Accept json
// @Produce json
// @Param id path string true "Client ID"
// @Param client body models.Client true "Client object"
// @Success 200 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /clients/{id} [put]
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

// DeleteClient godoc
// @Summary Delete a client
// @Description Delete a client by ID
// @Tags clients
// @Produce json
// @Param id path string true "Client ID"
// @Success 200 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /clients/{id} [delete]
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

// GetTransactions godoc
// @Summary Get all transactions
// @Description Get a list of all transactions with client details
// @Tags transactions
// @Produce json
// @Success 200 {array} models.Transaction
// @Failure 500 {object} map[string]string
// @Router /transactions [get]
func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	var transactions []models.Transaction
	result := h.db.Preload("Client").Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}

// CreateTransaction godoc
// @Summary Create a new transaction
// @Description Create a new transaction (CASH_EXCHANGE or BANK_TRANSFER)
// @Tags transactions
// @Accept json
// @Produce json
// @Param transaction body models.Transaction true "Transaction object"
// @Success 201 {object} models.Transaction
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /transactions [post]
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

// GetTransaction godoc
// @Summary Get a transaction by ID
// @Description Get a specific transaction by ID with client details
// @Tags transactions
// @Produce json
// @Param id path string true "Transaction ID"
// @Success 200 {object} models.Transaction
// @Failure 404 {object} map[string]string
// @Router /transactions/{id} [get]
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

// UpdateTransaction godoc
// @Summary Update a transaction
// @Description Update an existing transaction
// @Tags transactions
// @Accept json
// @Produce json
// @Param id path string true "Transaction ID"
// @Param transaction body models.Transaction true "Transaction object"
// @Success 200 {object} models.Transaction
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /transactions/{id} [put]
func (h *Handler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Get existing transaction
	var existingTransaction models.Transaction
	if err := h.db.First(&existingTransaction, "id = ?", id).Error; err != nil {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}

	// Save current state to edit history before updating
	editHistoryEntry := map[string]interface{}{
		"editedAt":           existingTransaction.UpdatedAt,
		"type":               existingTransaction.Type,
		"sendCurrency":       existingTransaction.SendCurrency,
		"sendAmount":         existingTransaction.SendAmount,
		"receiveCurrency":    existingTransaction.ReceiveCurrency,
		"receiveAmount":      existingTransaction.ReceiveAmount,
		"rateApplied":        existingTransaction.RateApplied,
		"feeCharged":         existingTransaction.FeeCharged,
		"beneficiaryName":    existingTransaction.BeneficiaryName,
		"beneficiaryDetails": existingTransaction.BeneficiaryDetails,
		"userNotes":          existingTransaction.UserNotes,
	}

	// Parse existing edit history
	var editHistory []map[string]interface{}
	if existingTransaction.EditHistory != nil && *existingTransaction.EditHistory != "" {
		if err := json.Unmarshal([]byte(*existingTransaction.EditHistory), &editHistory); err != nil {
			// If parsing fails, start with empty history
			editHistory = []map[string]interface{}{}
		}
	}

	// Append new entry to history
	editHistory = append(editHistory, editHistoryEntry)
	historyJSON, _ := json.Marshal(editHistory)
	historyStr := string(historyJSON)

	// Decode the update request
	var updatedTransaction models.Transaction
	if err := json.NewDecoder(r.Body).Decode(&updatedTransaction); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Keep the original ID and timestamps
	updatedTransaction.ID = existingTransaction.ID
	updatedTransaction.ClientID = existingTransaction.ClientID
	updatedTransaction.CreatedAt = existingTransaction.CreatedAt
	updatedTransaction.TransactionDate = existingTransaction.TransactionDate
	
	// Mark as edited and update edit history
	updatedTransaction.IsEdited = true
	now := existingTransaction.UpdatedAt
	updatedTransaction.LastEditedAt = &now
	updatedTransaction.EditHistory = &historyStr

	// Save the updated transaction
	if err := h.db.Save(&updatedTransaction).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, updatedTransaction)
}

// DeleteTransaction godoc
// @Summary Delete a transaction
// @Description Delete a transaction by ID
// @Tags transactions
// @Produce json
// @Param id path string true "Transaction ID"
// @Success 200 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /transactions/{id} [delete]
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

// GetClientTransactions godoc
// @Summary Get transactions for a client
// @Description Get all transactions for a specific client
// @Tags transactions
// @Produce json
// @Param id path string true "Client ID"
// @Success 200 {array} models.Transaction
// @Failure 500 {object} map[string]string
// @Router /clients/{id}/transactions [get]
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

// SearchClients godoc
// @Summary Search clients
// @Description Search clients by name, email, or phone
// @Tags clients
// @Produce json
// @Param q query string true "Search query"
// @Success 200 {array} models.Client
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /clients/search [get]
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
