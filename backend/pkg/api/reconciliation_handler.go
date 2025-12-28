package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type ReconciliationHandler struct {
	ReconciliationService *services.ReconciliationService
}

func NewReconciliationHandler(service *services.ReconciliationService) *ReconciliationHandler {
	return &ReconciliationHandler{ReconciliationService: service}
}

// CreateReconciliationHandler creates a new daily reconciliation record
func (h *ReconciliationHandler) CreateReconciliationHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	user := r.Context().Value("user").(*models.User)

	var req struct {
		BranchID          uint               `json:"branchId"`
		Date              string             `json:"date"`
		OpeningBalance    float64            `json:"openingBalance"`
		ClosingBalance    float64            `json:"closingBalance"`
		CurrencyBreakdown map[string]float64 `json:"currencyBreakdown"`
		Notes             string             `json:"notes"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	date, err := time.Parse("2006-01-02", req.Date)
	if err != nil {
		http.Error(w, "Invalid date format", http.StatusBadRequest)
		return
	}

	// Convert currency breakdown to JSON string
	currencyJSON, _ := json.Marshal(req.CurrencyBreakdown)

	reconciliation := &models.DailyReconciliation{
		TenantID:          *tenantID,
		BranchID:          req.BranchID,
		Date:              date,
		OpeningBalance:    req.OpeningBalance,
		ClosingBalance:    req.ClosingBalance,
		CurrencyBreakdown: string(currencyJSON),
		CreatedByUserID:   user.ID,
	}

	if req.Notes != "" {
		reconciliation.Notes = &req.Notes
	}

	if err := h.ReconciliationService.CreateReconciliation(reconciliation); err != nil {
		http.Error(w, "Failed to create reconciliation: "+err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusCreated, reconciliation)
}

// GetReconciliationHistoryHandler retrieves reconciliation history
func (h *ReconciliationHandler) GetReconciliationHistoryHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	branchIDStr := r.URL.Query().Get("branchId")
	startDateStr := r.URL.Query().Get("startDate")
	endDateStr := r.URL.Query().Get("endDate")

	var branchID *uint
	if branchIDStr != "" {
		var id uint
		if _, err := fmt.Sscanf(branchIDStr, "%d", &id); err == nil {
			branchID = &id
		}
	}

	var startDate, endDate *time.Time
	if startDateStr != "" {
		if parsed, err := time.Parse("2006-01-02", startDateStr); err == nil {
			startDate = &parsed
		}
	}
	if endDateStr != "" {
		if parsed, err := time.Parse("2006-01-02", endDateStr); err == nil {
			endDate = &parsed
		}
	}

	reconciliations, err := h.ReconciliationService.GetReconciliationHistory(*tenantID, branchID, startDate, endDate)
	if err != nil {
		http.Error(w, "Failed to retrieve reconciliation history", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reconciliations)
}

// GetVarianceReportHandler gets branches with cash discrepancies
func (h *ReconciliationHandler) GetVarianceReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	reconciliations, err := h.ReconciliationService.GetVarianceReport(*tenantID)
	if err != nil {
		http.Error(w, "Failed to retrieve variance report", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reconciliations)
}

// GetSystemStateHandler returns the expected system balances for a branch
func (h *ReconciliationHandler) GetSystemStateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	branchIDStr := r.URL.Query().Get("branchId")
	if branchIDStr == "" {
		http.Error(w, "Branch ID required", http.StatusBadRequest)
		return
	}

	var branchID uint
	if _, err := fmt.Sscanf(branchIDStr, "%d", &branchID); err != nil {
		http.Error(w, "Invalid Branch ID", http.StatusBadRequest)
		return
	}

	systemState, err := h.ReconciliationService.GetSystemState(*tenantID, branchID)
	if err != nil {
		http.Error(w, "Failed to get system state: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(systemState)
}
