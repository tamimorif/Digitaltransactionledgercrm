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

type PaymentHandler struct {
	paymentService *services.PaymentService
	db             *gorm.DB
}

func NewPaymentHandler(db *gorm.DB, paymentService *services.PaymentService) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
		db:             db,
	}
}

// CreatePaymentHandler creates a new payment for a transaction
// POST /api/transactions/{id}/payments
func (h *PaymentHandler) CreatePaymentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	transactionID := vars["id"]
	tenantID := middleware.GetTenantID(r)
	user := r.Context().Value("user").(*models.User)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Amount        float64                `json:"amount"`
		Currency      string                 `json:"currency"`
		ExchangeRate  float64                `json:"exchangeRate"`
		PaymentMethod string                 `json:"paymentMethod"`
		Notes         *string                `json:"notes"`
		ReceiptNumber *string                `json:"receiptNumber"`
		BranchID      *uint                  `json:"branchId"`
		Details       map[string]interface{} `json:"details"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validation
	if req.Amount <= 0 {
		http.Error(w, "Amount must be positive", http.StatusBadRequest)
		return
	}
	if req.Currency == "" {
		http.Error(w, "Currency is required", http.StatusBadRequest)
		return
	}
	if req.ExchangeRate <= 0 {
		http.Error(w, "Exchange rate must be positive", http.StatusBadRequest)
		return
	}
	if req.PaymentMethod == "" {
		req.PaymentMethod = models.PaymentMethodCash
	}

	payment := &models.Payment{
		TenantID:      *tenantID,
		TransactionID: transactionID,
		BranchID:      req.BranchID,
		Amount:        models.NewDecimal(req.Amount),
		Currency:      req.Currency,
		ExchangeRate:  models.NewDecimal(req.ExchangeRate),
		PaymentMethod: req.PaymentMethod,
		Notes:         req.Notes,
		ReceiptNumber: req.ReceiptNumber,
		Details:       req.Details,
	}

	if err := h.paymentService.CreatePayment(payment, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Load the updated transaction
	var transaction models.Transaction
	if err := h.db.Where("id = ? AND tenant_id = ?", transactionID, *tenantID).
		Preload("Payments").
		First(&transaction).Error; err != nil {
		http.Error(w, "Failed to load transaction", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"message":     "Payment created successfully",
		"payment":     payment,
		"transaction": transaction,
	})
}

// GetPaymentsHandler retrieves all payments for a transaction
// GET /api/transactions/{id}/payments
func (h *PaymentHandler) GetPaymentsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	transactionID := vars["id"]
	tenantID := middleware.GetTenantID(r)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	payments, err := h.paymentService.GetPayments(transactionID, *tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, payments)
}

// GetPaymentHandler retrieves a single payment
// GET /api/payments/{id}
func (h *PaymentHandler) GetPaymentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	paymentIDStr := vars["id"]
	tenantID := middleware.GetTenantID(r)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	paymentID, err := strconv.ParseUint(paymentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid payment ID", http.StatusBadRequest)
		return
	}

	payment, err := h.paymentService.GetPayment(uint(paymentID), *tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, payment)
}

// UpdatePaymentHandler updates a payment
// PUT /api/payments/{id}
func (h *PaymentHandler) UpdatePaymentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	paymentIDStr := vars["id"]
	tenantID := middleware.GetTenantID(r)
	user := r.Context().Value("user").(*models.User)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	paymentID, err := strconv.ParseUint(paymentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid payment ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Amount        *float64 `json:"amount"`
		Currency      *string  `json:"currency"`
		ExchangeRate  *float64 `json:"exchangeRate"`
		PaymentMethod *string  `json:"paymentMethod"`
		Notes         *string  `json:"notes"`
		ReceiptNumber *string  `json:"receiptNumber"`
		EditReason    string   `json:"editReason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	updates := make(map[string]interface{})
	if req.Amount != nil {
		if *req.Amount <= 0 {
			http.Error(w, "Amount must be positive", http.StatusBadRequest)
			return
		}
		updates["amount"] = *req.Amount
	}
	if req.Currency != nil {
		updates["currency"] = *req.Currency
	}
	if req.ExchangeRate != nil {
		if *req.ExchangeRate <= 0 {
			http.Error(w, "Exchange rate must be positive", http.StatusBadRequest)
			return
		}
		updates["exchangeRate"] = *req.ExchangeRate
	}
	if req.PaymentMethod != nil {
		updates["paymentMethod"] = *req.PaymentMethod
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}
	if req.ReceiptNumber != nil {
		updates["receiptNumber"] = *req.ReceiptNumber
	}

	if err := h.paymentService.UpdatePayment(uint(paymentID), *tenantID, updates, user.ID, req.EditReason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Load updated payment
	payment, err := h.paymentService.GetPayment(uint(paymentID), *tenantID)
	if err != nil {
		http.Error(w, "Failed to load updated payment", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Payment updated successfully",
		"payment": payment,
	})
}

// DeletePaymentHandler deletes a payment
// DELETE /api/payments/{id}
func (h *PaymentHandler) DeletePaymentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	paymentIDStr := vars["id"]
	tenantID := middleware.GetTenantID(r)
	user := r.Context().Value("user").(*models.User)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	paymentID, err := strconv.ParseUint(paymentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid payment ID", http.StatusBadRequest)
		return
	}

	if err := h.paymentService.DeletePayment(uint(paymentID), *tenantID, user.ID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Payment deleted successfully",
	})
}

// CancelPaymentHandler cancels a payment
// POST /api/payments/{id}/cancel
func (h *PaymentHandler) CancelPaymentHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	paymentIDStr := vars["id"]
	tenantID := middleware.GetTenantID(r)
	user := r.Context().Value("user").(*models.User)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	paymentID, err := strconv.ParseUint(paymentIDStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid payment ID", http.StatusBadRequest)
		return
	}

	var req struct {
		Reason string `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Reason == "" {
		http.Error(w, "Cancellation reason is required", http.StatusBadRequest)
		return
	}

	if err := h.paymentService.CancelPayment(uint(paymentID), *tenantID, user.ID, req.Reason); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{
		"message": "Payment cancelled successfully",
	})
}

// CompleteTransactionHandler marks a transaction as completed
// POST /api/transactions/{id}/complete
func (h *PaymentHandler) CompleteTransactionHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	transactionID := vars["id"]
	tenantID := middleware.GetTenantID(r)

	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	if err := h.paymentService.CompleteTransaction(transactionID, *tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Load updated transaction
	var transaction models.Transaction
	if err := h.db.Where("id = ? AND tenant_id = ?", transactionID, *tenantID).
		Preload("Payments").
		First(&transaction).Error; err != nil {
		http.Error(w, "Failed to load transaction", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"message":     "Transaction completed successfully",
		"transaction": transaction,
	})
}
