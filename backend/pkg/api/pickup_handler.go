package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

type PickupHandler struct {
	PickupService *services.PickupService
}

func NewPickupHandler(db *gorm.DB) *PickupHandler {
	return &PickupHandler{
		PickupService: services.NewPickupService(db),
	}
}

// CreatePickupTransactionHandler creates a new pickup transaction
// POST /pickups
func (h *PickupHandler) CreatePickupTransactionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		respondWithError(w, http.StatusBadRequest, "Tenant ID required")
		return
	}

	var req struct {
		TransactionID    *string  `json:"transactionId"`
		SenderBranchID   uint     `json:"senderBranchId"`
		ReceiverBranchID uint     `json:"receiverBranchId"`
		SenderName       string   `json:"senderName"`
		SenderPhone      string   `json:"senderPhone"`
		RecipientName    string   `json:"recipientName"`
		RecipientPhone   *string  `json:"recipientPhone"`  // Optional for bank transfers
		RecipientIBAN    *string  `json:"recipientIban"`   // For bank transfers
		TransactionType  string   `json:"transactionType"` // CASH_PICKUP, CASH_EXCHANGE, BANK_TRANSFER, CARD_SWAP_IRR
		Amount           float64  `json:"amount"`
		Currency         string   `json:"currency"`
		ReceiverCurrency *string  `json:"receiverCurrency"`
		ExchangeRate     *float64 `json:"exchangeRate"`
		ReceiverAmount   *float64 `json:"receiverAmount"`
		Fees             float64  `json:"fees"`
		Notes            *string  `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// Validate required fields
	if req.SenderBranchID == 0 {
		respondWithError(w, http.StatusBadRequest, "Sender branch ID is required")
		return
	}

	// Default transaction type if not provided (treat as in-person pickup)
	if req.TransactionType == "" {
		req.TransactionType = "CASH_PICKUP"
	}

	// If receiver branch is not provided, for in-person transaction types we
	// auto-assign the sender branch as the receiver (no transfer between branches).
	inPersonTypes := map[string]bool{"CASH_PICKUP": true, "CASH_EXCHANGE": true, "CARD_SWAP_IRR": true}
	if req.ReceiverBranchID == 0 {
		if inPersonTypes[req.TransactionType] {
			req.ReceiverBranchID = req.SenderBranchID
		} else {
			respondWithError(w, http.StatusBadRequest, "Receiver branch ID is required")
			return
		}
	}
	if req.SenderName == "" {
		respondWithError(w, http.StatusBadRequest, "Sender name is required")
		return
	}
	if req.SenderPhone == "" {
		respondWithError(w, http.StatusBadRequest, "Sender phone is required")
		return
	}
	// Recipient name is optional for in-person exchanges (CASH_PICKUP, CARD_SWAP_IRR)
	if req.TransactionType != "CASH_PICKUP" && req.TransactionType != "CARD_SWAP_IRR" && req.RecipientName == "" {
		respondWithError(w, http.StatusBadRequest, "Recipient name is required")
		return
	}

	// Validate transaction type
	validTypes := map[string]bool{"CASH_PICKUP": true, "CASH_EXCHANGE": true, "BANK_TRANSFER": true, "CARD_SWAP_IRR": true}
	if !validTypes[req.TransactionType] {
		respondWithError(w, http.StatusBadRequest, "Invalid transaction type")
		return
	}

	// Phone is optional for in-person exchanges (CASH_PICKUP, CARD_SWAP_IRR) and required for transfers (CASH_EXCHANGE, BANK_TRANSFER)
	if req.TransactionType == "CASH_EXCHANGE" {
		if req.RecipientPhone == nil || *req.RecipientPhone == "" {
			respondWithError(w, http.StatusBadRequest, "Recipient phone is required")
			return
		}
	}

	// IBAN is required for BANK_TRANSFER
	if req.TransactionType == "BANK_TRANSFER" {
		if req.RecipientIBAN == nil || *req.RecipientIBAN == "" {
			respondWithError(w, http.StatusBadRequest, "Recipient IBAN is required for bank transfers")
			return
		}
	}

	if req.Amount <= 0 {
		respondWithError(w, http.StatusBadRequest, "Amount must be greater than zero")
		return
	}
	if req.Currency == "" {
		respondWithError(w, http.StatusBadRequest, "Currency is required")
		return
	}

	pickup := &models.PickupTransaction{
		TenantID:         *tenantID,
		TransactionID:    req.TransactionID,
		SenderBranchID:   req.SenderBranchID,
		ReceiverBranchID: req.ReceiverBranchID,
		SenderName:       req.SenderName,
		SenderPhone:      req.SenderPhone,
		RecipientName:    req.RecipientName,
		RecipientPhone:   req.RecipientPhone,
		RecipientIBAN:    req.RecipientIBAN,
		TransactionType:  req.TransactionType,
		Amount:           req.Amount,
		Currency:         req.Currency,
		ReceiverCurrency: req.ReceiverCurrency,
		ExchangeRate:     req.ExchangeRate,
		ReceiverAmount:   req.ReceiverAmount,
		Fees:             req.Fees,
		Notes:            req.Notes,
	}

	if err := h.PickupService.CreatePickupTransaction(pickup); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, pickup)
}

// GetPickupTransactionsHandler retrieves pickup transactions with filters
// GET /pickups?branch_id=1&status=PENDING&page=1&limit=20
func (h *PickupHandler) GetPickupTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	// Parse query parameters
	var branchID *uint
	if branchIDStr := r.URL.Query().Get("branch_id"); branchIDStr != "" {
		if id, err := strconv.ParseUint(branchIDStr, 10, 32); err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	var status *string
	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		status = &statusStr
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	pickups, total, err := h.PickupService.GetPickupTransactions(
		*tenantID,
		branchID,
		status,
		limit,
		offset,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       pickups,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + int64(limit) - 1) / int64(limit),
	})
}

// GetPickupTransactionHandler retrieves a single pickup transaction by ID
// GET /pickups/:id
func (h *PickupHandler) GetPickupTransactionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid pickup ID", http.StatusBadRequest)
		return
	}

	pickup, err := h.PickupService.GetPickupTransactionByID(uint(id), *tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, pickup)
}

// SearchPickupByCodeHandler searches for pickup by code
// GET /pickups/search/:code
func (h *PickupHandler) SearchPickupByCodeHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	code := vars["code"]
	if code == "" {
		http.Error(w, "Pickup code is required", http.StatusBadRequest)
		return
	}

	pickup, err := h.PickupService.SearchPickupByCode(code, *tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, pickup)
}

// SearchPickupsByQueryHandler searches pickups by phone number or name
// GET /pickups/search?q=query
func (h *PickupHandler) SearchPickupsByQueryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" || len(query) < 3 {
		http.Error(w, "Search query must be at least 3 characters", http.StatusBadRequest)
		return
	}

	pickups, err := h.PickupService.SearchPickupsByQuery(query, *tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, pickups)
}

// MarkAsPickedUpHandler marks a pickup as picked up
// POST /pickups/:id/pickup
func (h *PickupHandler) MarkAsPickedUpHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	userVal := r.Context().Value("user")
	if userVal == nil {
		http.Error(w, "User ID required", http.StatusUnauthorized)
		return
	}
	user := userVal.(*models.User)
	userID := user.ID

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid pickup ID", http.StatusBadRequest)
		return
	}

	if err := h.PickupService.MarkAsPickedUp(uint(id), *tenantID, userID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Pickup marked as picked up successfully"})
}

// CancelPickupTransactionHandler cancels a pickup transaction
// POST /pickups/:id/cancel
func (h *PickupHandler) CancelPickupTransactionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	userVal := r.Context().Value("user")
	if userVal == nil {
		http.Error(w, "User ID required", http.StatusUnauthorized)
		return
	}
	user := userVal.(*models.User)
	userID := user.ID

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid pickup ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Cancellation reason is required", http.StatusBadRequest)
		return
	}

	if err := h.PickupService.CancelPickupTransaction(uint(id), *tenantID, userID, req.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Pickup cancelled successfully"})
}

// EditPickupTransactionHandler edits a pickup transaction
// PUT /pickups/:id/edit
func (h *PickupHandler) EditPickupTransactionHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	userVal := r.Context().Value("user")
	if userVal == nil {
		http.Error(w, "User ID required", http.StatusUnauthorized)
		return
	}
	user := userVal.(*models.User)
	userID := user.ID
	branchID := user.PrimaryBranchID // Track which branch is editing

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid pickup ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Amount           *float64 `json:"amount"`
		Currency         *string  `json:"currency"`
		ReceiverCurrency *string  `json:"receiverCurrency"`
		ExchangeRate     *float64 `json:"exchangeRate"`
		ReceiverAmount   *float64 `json:"receiverAmount"`
		Fees             *float64 `json:"fees"`
		EditReason       string   `json:"editReason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.EditReason == "" {
		http.Error(w, "Edit reason is required", http.StatusBadRequest)
		return
	}

	if err := h.PickupService.EditPickupTransaction(uint(id), *tenantID, userID, branchID, req.Amount, req.Currency, req.ReceiverCurrency, req.ExchangeRate, req.ReceiverAmount, req.Fees, req.EditReason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Pickup edited successfully"})
}

// GetPendingPickupsCountHandler returns count of pending pickups for a branch
// GET /pickups/pending/count?branch_id=1
func (h *PickupHandler) GetPendingPickupsCountHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	branchIDStr := r.URL.Query().Get("branch_id")
	if branchIDStr == "" {
		http.Error(w, "branch_id is required", http.StatusBadRequest)
		return
	}

	branchID, err := strconv.ParseUint(branchIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid branch_id", http.StatusBadRequest)
		return
	}

	count, err := h.PickupService.GetPendingPickupsCount(uint(branchID), *tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]int64{"count": count})
}
