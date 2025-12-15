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

type CashBalanceHandler struct {
	CashBalanceService *services.CashBalanceService
}

func NewCashBalanceHandler(db *gorm.DB) *CashBalanceHandler {
	return &CashBalanceHandler{
		CashBalanceService: services.NewCashBalanceService(db),
	}
}

// GetAllBalancesHandler retrieves all cash balances for tenant
// GET /cash-balances?branch_id=1
func (h *CashBalanceHandler) GetAllBalancesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var branchID *uint
	if branchIDStr := r.URL.Query().Get("branch_id"); branchIDStr != "" {
		if id, err := strconv.ParseUint(branchIDStr, 10, 64); err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	balances, err := h.CashBalanceService.GetAllBalancesForTenant(*tenantID, branchID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, balances)
}

// GetBalanceByCurrencyHandler retrieves balance for specific currency
// GET /cash-balances/:currency?branch_id=1
func (h *CashBalanceHandler) GetBalanceByCurrencyHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	currency := vars["currency"]
	if currency == "" {
		http.Error(w, "Currency is required", http.StatusBadRequest)
		return
	}

	var branchID *uint
	if branchIDStr := r.URL.Query().Get("branch_id"); branchIDStr != "" {
		if id, err := strconv.ParseUint(branchIDStr, 10, 64); err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	balance, err := h.CashBalanceService.GetBalanceByCurrency(*tenantID, branchID, currency)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, balance)
}

// RefreshBalanceHandler recalculates balance from transactions
// POST /cash-balances/:id/refresh
func (h *CashBalanceHandler) RefreshBalanceHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid balance ID", http.StatusBadRequest)
		return
	}

	balance, err := h.CashBalanceService.RefreshCashBalance(uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, balance)
}

// CreateAdjustmentHandler creates a manual cash adjustment
// POST /cash-balances/adjust
func (h *CashBalanceHandler) CreateAdjustmentHandler(w http.ResponseWriter, r *http.Request) {
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

	var req struct {
		BranchID *uint   `json:"branchId"`
		Currency string  `json:"currency"`
		Amount   float64 `json:"amount"`
		Reason   string  `json:"reason"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	adjustment, err := h.CashBalanceService.CreateManualAdjustment(
		*tenantID,
		req.BranchID,
		req.Currency,
		req.Amount,
		req.Reason,
		userID,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusCreated, adjustment)
}

// GetAdjustmentHistoryHandler retrieves adjustment history
// GET /cash-balances/adjustments?branch_id=1&currency=USD&page=1&limit=20
func (h *CashBalanceHandler) GetAdjustmentHistoryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var branchID *uint
	if branchIDStr := r.URL.Query().Get("branch_id"); branchIDStr != "" {
		if id, err := strconv.ParseUint(branchIDStr, 10, 64); err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	var currency *string
	if currencyStr := r.URL.Query().Get("currency"); currencyStr != "" {
		currency = &currencyStr
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

	adjustments, total, err := h.CashBalanceService.GetAdjustmentHistory(
		*tenantID,
		branchID,
		currency,
		limit,
		offset,
	)

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"data":       adjustments,
		"total":      total,
		"page":       page,
		"limit":      limit,
		"totalPages": (total + int64(limit) - 1) / int64(limit),
	})
}

// RefreshAllBalancesHandler recalculates all balances for tenant
// POST /cash-balances/refresh-all
func (h *CashBalanceHandler) RefreshAllBalancesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	if err := h.CashBalanceService.RefreshAllBalancesForTenant(*tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "All balances refreshed successfully"})
}

// GetActiveCurrenciesHandler retrieves all active currencies
// GET /cash-balances/currencies?branch_id=1
func (h *CashBalanceHandler) GetActiveCurrenciesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var branchID *uint
	if branchIDStr := r.URL.Query().Get("branch_id"); branchIDStr != "" {
		if id, err := strconv.ParseUint(branchIDStr, 10, 64); err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	currencies, err := h.CashBalanceService.GetActiveCurrencies(*tenantID, branchID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{"currencies": currencies})
}
