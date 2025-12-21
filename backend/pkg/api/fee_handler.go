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

type FeeHandler struct {
	FeeService *services.FeeService
}

func NewFeeHandler(db *gorm.DB) *FeeHandler {
	return &FeeHandler{
		FeeService: services.NewFeeService(db),
	}
}

// GetAllFeeRulesHandler retrieves all fee rules for tenant
// GET /fees/rules?include_inactive=false
func (h *FeeHandler) GetAllFeeRulesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	includeInactive := r.URL.Query().Get("include_inactive") == "true"

	rules, err := h.FeeService.GetAllFeeRules(*tenantID, includeInactive)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, rules)
}

// GetFeeRuleByIDHandler retrieves a specific fee rule
// GET /fees/rules/:id
func (h *FeeHandler) GetFeeRuleByIDHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid rule ID", http.StatusBadRequest)
		return
	}

	rule, err := h.FeeService.GetFeeRuleByID(*tenantID, uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, rule)
}

// CreateFeeRuleHandler creates a new fee rule
// POST /fees/rules
func (h *FeeHandler) CreateFeeRuleHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var rule models.FeeRule
	if err := json.NewDecoder(r.Body).Decode(&rule); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	rule.TenantID = *tenantID

	if err := h.FeeService.CreateFeeRule(&rule); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusCreated, rule)
}

// UpdateFeeRuleHandler updates an existing fee rule
// PUT /fees/rules/:id
func (h *FeeHandler) UpdateFeeRuleHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid rule ID", http.StatusBadRequest)
		return
	}

	// Verify rule belongs to tenant
	existing, err := h.FeeService.GetFeeRuleByID(*tenantID, uint(id))
	if err != nil {
		http.Error(w, "Rule not found", http.StatusNotFound)
		return
	}

	var updates models.FeeRule
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Preserve tenant ID and ID
	updates.ID = existing.ID
	updates.TenantID = *tenantID

	if err := h.FeeService.UpdateFeeRule(&updates); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, updates)
}

// DeleteFeeRuleHandler deletes (deactivates) a fee rule
// DELETE /fees/rules/:id
func (h *FeeHandler) DeleteFeeRuleHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid rule ID", http.StatusBadRequest)
		return
	}

	if err := h.FeeService.DeleteFeeRule(*tenantID, uint(id)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Fee rule deleted successfully"})
}

// CalculateFeeHandler calculates fee for a given transaction
// POST /fees/calculate
func (h *FeeHandler) CalculateFeeHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Amount             float64 `json:"amount"`
		SourceCurrency     string  `json:"sourceCurrency"`
		DestinationCountry string  `json:"destinationCountry"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if req.Amount <= 0 {
		http.Error(w, "Amount must be greater than zero", http.StatusBadRequest)
		return
	}

	result, err := h.FeeService.CalculateFee(*tenantID, req.Amount, req.SourceCurrency, req.DestinationCountry)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, result)
}

// PreviewFeeHandler previews fee without creating a transaction (for UI)
// GET /fees/preview?amount=1000&source_currency=USD&destination_country=IR
func (h *FeeHandler) PreviewFeeHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	amountStr := r.URL.Query().Get("amount")
	amount, err := strconv.ParseFloat(amountStr, 64)
	if err != nil || amount <= 0 {
		http.Error(w, "Invalid amount", http.StatusBadRequest)
		return
	}

	sourceCurrency := r.URL.Query().Get("source_currency")
	destinationCountry := r.URL.Query().Get("destination_country")

	result, err := h.FeeService.PreviewFee(*tenantID, amount, sourceCurrency, destinationCountry)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, result)
}

// CreateDefaultRulesHandler creates default fee rules for tenant
// POST /fees/rules/defaults
func (h *FeeHandler) CreateDefaultRulesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	if err := h.FeeService.CreateDefaultRules(*tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, map[string]string{"message": "Default fee rules created successfully"})
}
