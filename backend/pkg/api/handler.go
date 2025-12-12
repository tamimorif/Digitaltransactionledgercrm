package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// Handler struct
type Handler struct {
	db                  *gorm.DB
	auditService        *services.AuditService
	exchangeRateService *services.ExchangeRateService
	transactionService  *services.TransactionService
}

// NewHandler creates a new handler instance with database connection
func NewHandler(db *gorm.DB) *Handler {
	exchangeRateService := services.NewExchangeRateService(db)
	return &Handler{
		db:                  db,
		auditService:        services.NewAuditService(db),
		exchangeRateService: exchangeRateService,
		transactionService:  services.NewTransactionService(db, exchangeRateService),
	}
}

// ... (Client Handlers omitted)

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
	if err := json.NewDecoder(r.Body).Decode(&transaction); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Get tenant ID from context and assign to transaction
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}
	transaction.TenantID = *tenantID

	// Create transaction using service
	if err := h.transactionService.CreateTransaction(&transaction); err != nil {
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

// Client Handlers

// GetClients godoc
// @Summary Get all clients
// @Description Get a list of all clients (filtered by tenant)
// @Tags clients
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.Client
// @Failure 500 {object} map[string]string
// @Router /clients [get]
func (h *Handler) GetClients(w http.ResponseWriter, r *http.Request) {
	var clients []models.Client

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Find(&clients)
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
// @Security BearerAuth
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

	// Get tenant ID from context and assign to client
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}
	client.TenantID = *tenantID

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
// @Security BearerAuth
// @Param id path string true "Client ID"
// @Success 200 {object} models.Client
// @Failure 404 {object} map[string]string
// @Router /clients/{id} [get]
func (h *Handler) GetClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var client models.Client

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Preload("Transactions").First(&client, "id = ?", id)
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
// @Security BearerAuth
// @Param id path string true "Client ID"
// @Param client body models.Client true "Client object"
// @Success 200 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /clients/{id} [put]
func (h *Handler) UpdateClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	var client models.Client
	if err := db.First(&client, "id = ?", id).Error; err != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	// Decode into a separate payload to avoid overwriting protected fields (ID, TenantID)
	var payload struct {
		Name        *string `json:"name"`
		PhoneNumber *string `json:"phoneNumber"`
		Email       *string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	if payload.Name != nil {
		updates["name"] = *payload.Name
	}
	if payload.PhoneNumber != nil {
		updates["phone_number"] = *payload.PhoneNumber
	}
	if payload.Email != nil {
		updates["email"] = payload.Email
	}

	if len(updates) > 0 {
		if err := db.Model(&client).Updates(updates).Error; err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	respondJSON(w, http.StatusOK, client)
}

// DeleteClient godoc
// @Summary Delete a client
// @Description Delete a client by ID
// @Tags clients
// @Produce json
// @Security BearerAuth
// @Param id path string true "Client ID"
// @Success 200 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /clients/{id} [delete]
func (h *Handler) DeleteClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Delete(&models.Client{}, "id = ?", id)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Client deleted successfully"})
}

// Transaction Handlers

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

	var transaction models.Transaction

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Preload("Client").First(&transaction, "id = ?", id)
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
		if err := h.db.First(&branch, *user.PrimaryBranchID).Error; err == nil {
			branchName = branch.Name
		}
	}

	// Save current state to edit history before updating
	editHistoryEntry := map[string]interface{}{
		"editedAt":           existingTransaction.UpdatedAt,
		"editedByBranchId":   user.PrimaryBranchID, // Track which branch made the edit
		"editedByBranchName": branchName,           // Store name for easier display
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

	// Mark as edited and update edit history
	now := time.Now()

	// Prepare update map to avoid tenant_id ambiguity with scoped queries
	updates := map[string]interface{}{
		"type":                  updatedTransaction.Type,
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
	result := h.db.Model(&models.Transaction{}).
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

// SearchClients godoc
// @Summary Search clients
// @Description Search clients by name, email, or phone
// @Tags clients
// @Produce json
// @Security BearerAuth
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

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Where("name LIKE ? OR email LIKE ? OR phone_number LIKE ?",
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

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Preload("Client").Where("send_currency LIKE ? OR receive_currency LIKE ? OR type LIKE ?",
		"%"+query+"%", "%"+query+"%", "%"+query+"%").Find(&transactions)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, transactions)
}

// UpdateTenantName godoc
// @Summary Update tenant organization name
// @Description Update the organization name for the current tenant
// @Tags tenant
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{name=string} true "Update tenant name request"
// @Success 200 {object} models.Tenant
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /tenant/update-name [put]
func (h *Handler) UpdateTenantName(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user := r.Context().Value("user").(*models.User)

	// Only tenant owners can update tenant name
	if user.Role != "tenant_owner" {
		http.Error(w, "Only tenant owners can update organization name", http.StatusForbidden)
		return
	}

	// Parse request body
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate name
	if req.Name == "" {
		http.Error(w, "Organization name cannot be empty", http.StatusBadRequest)
		return
	}

	// Get tenant
	var tenant models.Tenant
	if err := h.db.First(&tenant, "id = ?", user.TenantID).Error; err != nil {
		http.Error(w, "Tenant not found", http.StatusNotFound)
		return
	}

	// Update tenant name
	tenant.Name = req.Name
	if err := h.db.Save(&tenant).Error; err != nil {
		http.Error(w, "Failed to update tenant name", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, tenant)
}

// GetTenantInfo godoc
// @Summary Get tenant information with license
// @Description Get tenant info including active branches and license details
// @Tags tenant
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /tenant/info [get]
func (h *Handler) GetTenantInfo(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	if user.TenantID == nil {
		http.Error(w, "User must belong to a tenant", http.StatusBadRequest)
		return
	}

	// Get tenant
	var tenant models.Tenant
	if err := h.db.Preload("CurrentLicense").First(&tenant, *user.TenantID).Error; err != nil {
		http.Error(w, "Tenant not found", http.StatusNotFound)
		return
	}

	// Count active branches
	var activeBranches int64
	h.db.Model(&models.Branch{}).
		Where("tenant_id = ? AND status = ?", *user.TenantID, models.BranchStatusActive).
		Count(&activeBranches)

	response := map[string]interface{}{
		"id":             tenant.ID,
		"name":           tenant.Name,
		"activeBranches": activeBranches,
	}

	if tenant.CurrentLicense != nil {
		response["license"] = map[string]interface{}{
			"id":          tenant.CurrentLicense.ID,
			"maxBranches": tenant.CurrentLicense.MaxBranches,
			"expiresAt":   tenant.CurrentLicense.ExpiresAt,
			"status":      tenant.CurrentLicense.Status,
		}
	}

	respondJSON(w, http.StatusOK, response)
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
