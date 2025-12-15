package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gorilla/mux"
)

// CreateTransaction godoc
// @Summary Create a new transaction
// @Description Create a new transaction (CASH_EXCHANGE or BANK_TRANSFER)
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param transaction body models.Transaction true "Transaction object"
// @Success 201 {object} models.Transaction
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /transactions [post]
func (h *Handler) CreateTransaction(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	var transaction models.Transaction

	// Check if already validated by middleware
	if val := middleware.GetValidatedData(r); val != nil {
		if t, ok := val.(*models.Transaction); ok {
			transaction = *t
		} else {
			http.Error(w, "Internal validation error", http.StatusInternalServerError)
			return
		}
	} else {
		if err := json.NewDecoder(r.Body).Decode(&transaction); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	// Get tenant ID from context and assign to transaction
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}
	transaction.TenantID = *tenantID

	// Create transaction using service
	if err := h.transactionService.CreateTransaction(r.Context(), &transaction); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Audit log
	h.auditService.LogAction(
		user.ID,
		user.TenantID,
		models.ActionCreateTransaction,
		"Transaction",
		transaction.ID,
		"Created new transaction",
		nil,
		transaction,
		r,
	)

	respondJSON(w, http.StatusCreated, transaction)
}

// GetTransactions godoc
// @Summary Get all transactions
// @Description Get a list of all transactions with client details (filtered by tenant). Supports date filtering via query params: ?startDate=2024-01-01&endDate=2024-12-31&branchId=1
// @Tags transactions
// @Produce json
// @Security BearerAuth
// @Param startDate query string false "Start date (YYYY-MM-DD)"
// @Param endDate query string false "End date (YYYY-MM-DD)"
// @Param branchId query int false "Branch ID"
// @Success 200 {array} models.Transaction
// @Failure 500 {object} map[string]string
// @Router /transactions [get]
func (h *Handler) GetTransactions(w http.ResponseWriter, r *http.Request) {
	var transactions []models.Transaction

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	// Filter out cancelled transactions for regular users (not SuperAdmin)
	db = db.Where("status != ?", models.StatusCancelled)

	// Parse date filters from query params
	startDate := r.URL.Query().Get("startDate")
	endDate := r.URL.Query().Get("endDate")
	branchID := r.URL.Query().Get("branchId")

	// Apply date filters if provided
	if startDate != "" {
		parsedStart, err := time.Parse("2006-01-02", startDate)
		if err == nil {
			db = db.Where("transaction_date >= ?", parsedStart)
		}
	}

	if endDate != "" {
		parsedEnd, err := time.Parse("2006-01-02", endDate)
		if err == nil {
			// Add one day to include the entire end date
			parsedEnd = parsedEnd.Add(24 * time.Hour)
			db = db.Where("transaction_date < ?", parsedEnd)
		}
	}

	// Apply branch filter if provided
	if branchID != "" && branchID != "all" {
		db = db.Where("branch_id = ?", branchID)
	}

	result := db.Preload("Client").Preload("Branch").Order("transaction_date DESC, created_at DESC").Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}

// GetTransaction godoc
// @Summary Get a transaction by ID
// @Description Get a specific transaction by ID with client details
// @Tags transactions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Transaction ID"
// @Success 200 {object} models.Transaction
// @Failure 404 {object} map[string]string
// @Router /transactions/{id} [get]
func (h *Handler) GetTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Apply tenant isolation
	// Note: For GetTransaction by ID, the service handles the query.
	// We should probably rely on the service to be consistent with CreateTransaction.
	// But sticking to the original implementation which used direct DB access for now, to replicate original behavior.
	// However, since we updated the Service to take Context, if we ever switch to using Service here, we are ready.

	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID not found in context", http.StatusUnauthorized)
		return
	}

	// Use the service to get the transaction, which uses the updated signature with Context
	transaction, err := h.transactionService.GetTransaction(r.Context(), id, *tenantID)
	if err != nil {
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
// @Security BearerAuth
// @Param id path string true "Transaction ID"
// @Param transaction body models.Transaction true "Transaction object"
// @Success 200 {object} models.Transaction
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /transactions/{id} [put]
func (h *Handler) UpdateTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Get existing transaction with tenant isolation
	var existingTransaction models.Transaction
	db := middleware.ApplyTenantScope(h.db, r)

	if err := db.First(&existingTransaction, "id = ?", id).Error; err != nil {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}

	// Get user from context to track who edited
	userVal := r.Context().Value("user")
	user := userVal.(*models.User)

	var branchName string
	if user.PrimaryBranchID != nil {
		var branch models.Branch
		if err := h.db.WithContext(r.Context()).First(&branch, *user.PrimaryBranchID).Error; err == nil {
			branchName = branch.Name
		}
	}

	// Save current state to edit history before updating
	editHistoryEntry := map[string]interface{}{
		"editedAt":           existingTransaction.UpdatedAt,
		"editedByBranchId":   user.PrimaryBranchID, // Track which branch made the edit
		"editedByBranchName": branchName,           // Store name for easier display

		"paymentMethod":      existingTransaction.PaymentMethod,
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

	// Mark as edited and update edit history
	now := time.Now()

	// Prepare update map to avoid tenant_id ambiguity with scoped queries
	updates := map[string]interface{}{
		"payment_method":        updatedTransaction.PaymentMethod,
		"send_currency":         updatedTransaction.SendCurrency,
		"send_amount":           updatedTransaction.SendAmount,
		"receive_currency":      updatedTransaction.ReceiveCurrency,
		"receive_amount":        updatedTransaction.ReceiveAmount,
		"rate_applied":          updatedTransaction.RateApplied,
		"fee_charged":           updatedTransaction.FeeCharged,
		"beneficiary_name":      updatedTransaction.BeneficiaryName,
		"beneficiary_details":   updatedTransaction.BeneficiaryDetails,
		"user_notes":            updatedTransaction.UserNotes,
		"allow_partial_payment": updatedTransaction.AllowPartialPayment, // Allow updating this flag
		"is_edited":             true,
		"last_edited_at":        now,
		"edited_by_branch_id":   user.PrimaryBranchID, // Set the current branch as editor
		"edit_history":          historyStr,
		"updated_at":            now,
	}

	// If enabling partial payments for the first time, initialize tracking fields
	if updatedTransaction.AllowPartialPayment && !existingTransaction.AllowPartialPayment {
		updates["total_received"] = updatedTransaction.SendAmount // Assuming we receive the SendAmount
		updates["received_currency"] = updatedTransaction.SendCurrency
		updates["remaining_balance"] = updatedTransaction.SendAmount
		updates["payment_status"] = models.PaymentStatusOpen
	}

	// Update the transaction - use base db to avoid scope ambiguity, add WHERE manually
	result := h.db.WithContext(r.Context()).Model(&models.Transaction{}).
		Where("id = ? AND tenant_id = ?", existingTransaction.ID, existingTransaction.TenantID).
		Updates(updates)

	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}

	if result.RowsAffected == 0 {
		http.Error(w, "Transaction not found or access denied", http.StatusNotFound)
		return
	}

	// Reload the transaction to get the updated data with tenant scope
	if err := db.First(&existingTransaction, "id = ?", existingTransaction.ID).Error; err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, existingTransaction)
}

// CancelTransaction godoc
// @Summary Cancel a transaction
// @Description Mark a transaction as cancelled with a reason
// @Tags transactions
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Transaction ID"
// @Param request body map[string]string true "Cancellation reason"
// @Success 200 {object} models.Transaction
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /transactions/{id}/cancel [post]
func (h *Handler) CancelTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Parse cancellation reason from request body
	var request struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if request.Reason == "" {
		http.Error(w, "Cancellation reason is required", http.StatusBadRequest)
		return
	}

	// Get user from context
	userVal := r.Context().Value("user")
	user := userVal.(*models.User)

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	// Find the transaction
	var transaction models.Transaction
	if err := db.Where("id = ?", id).First(&transaction).Error; err != nil {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}

	// Check if already cancelled
	if transaction.Status == models.StatusCancelled {
		http.Error(w, "Transaction is already cancelled", http.StatusBadRequest)
		return
	}

	// Update transaction status
	now := time.Now()
	transaction.Status = models.StatusCancelled
	transaction.CancellationReason = &request.Reason
	transaction.CancelledAt = &now
	transaction.CancelledBy = &user.ID

	if err := db.Save(&transaction).Error; err != nil {
		http.Error(w, "Failed to cancel transaction", http.StatusInternalServerError)
		return
	}

	// Log audit
	h.auditService.LogAction(
		user.ID,
		user.TenantID,
		"CANCEL",
		"TRANSACTION",
		transaction.ID,
		"Transaction cancelled: "+request.Reason,
		map[string]interface{}{"status": "COMPLETED"},
		map[string]interface{}{"status": "CANCELLED", "reason": request.Reason},
		r,
	)

	respondJSON(w, http.StatusOK, transaction)
}

// DeleteTransaction godoc
// @Summary Delete a transaction
// @Description Delete a transaction by ID (permanent deletion, use cancel instead)
// @Tags transactions
// @Produce json
// @Security BearerAuth
// @Param id path string true "Transaction ID"
// @Success 200 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /transactions/{id} [delete]
func (h *Handler) DeleteTransaction(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Delete(&models.Transaction{}, "id = ?", id)
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
// @Security BearerAuth
// @Param id path string true "Client ID"
// @Success 200 {array} models.Transaction
// @Failure 500 {object} map[string]string
// @Router /clients/{id}/transactions [get]
func (h *Handler) GetClientTransactions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	clientId := vars["id"]

	var transactions []models.Transaction

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Where("client_id = ?", clientId).Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}

func (h *Handler) SearchTransactions(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	var transactions []models.Transaction

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	// Updated search to include user_notes and beneficiary_name
	result := db.Preload("Client").Where("send_currency LIKE ? OR receive_currency LIKE ? OR payment_method LIKE ? OR user_notes LIKE ? OR beneficiary_name LIKE ?",
		"%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%", "%"+query+"%").Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}
