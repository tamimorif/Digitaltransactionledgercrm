package api

import (
	"api/pkg/middleware"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"gorm.io/gorm"
)

// ProfitAnalysisHandler handles profit analysis API requests
type ProfitAnalysisHandler struct {
	profitService *services.ProfitAnalysisService
}

// NewProfitAnalysisHandler creates a new ProfitAnalysisHandler
func NewProfitAnalysisHandler(db *gorm.DB) *ProfitAnalysisHandler {
	return &ProfitAnalysisHandler{
		profitService: services.NewProfitAnalysisService(db),
	}
}

// GetProfitAnalysisHandler returns comprehensive profit analysis
// @Summary Get profit analysis
// @Description Returns detailed profit breakdown by period, branch, currency, and customer segment
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param startDate query string false "Start date (YYYY-MM-DD)"
// @Param endDate query string false "End date (YYYY-MM-DD)"
// @Success 200 {object} services.ProfitAnalysisResult
// @Router /analytics/profit [get]
func (h *ProfitAnalysisHandler) GetProfitAnalysisHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse dates
	startDate := time.Now().AddDate(0, -1, 0) // Default: last month
	endDate := time.Now()

	if startStr := r.URL.Query().Get("startDate"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = parsed
		}
	}

	if endStr := r.URL.Query().Get("endDate"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = parsed.Add(24*time.Hour - time.Second) // End of day
		}
	}

	result, err := h.profitService.GetProfitAnalysis(*tenantID, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetDailyProfitHandler returns daily profit for the last N days
// @Summary Get daily profit
// @Description Returns daily profit breakdown
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param days query int false "Number of days" default(30)
// @Success 200 {array} services.ProfitByPeriod
// @Router /analytics/profit/daily [get]
func (h *ProfitAnalysisHandler) GetDailyProfitHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	days := 30
	if daysStr := r.URL.Query().Get("days"); daysStr != "" {
		if parsed, err := strconv.Atoi(daysStr); err == nil && parsed > 0 {
			days = parsed
		}
	}

	result, err := h.profitService.GetDailyProfit(*tenantID, days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetMonthlyProfitHandler returns monthly profit summary
// @Summary Get monthly profit
// @Description Returns monthly profit summary
// @Tags Analytics
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param months query int false "Number of months" default(12)
// @Success 200 {array} services.ProfitByPeriod
// @Router /analytics/profit/monthly [get]
func (h *ProfitAnalysisHandler) GetMonthlyProfitHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	months := 12
	if monthsStr := r.URL.Query().Get("months"); monthsStr != "" {
		if parsed, err := strconv.Atoi(monthsStr); err == nil && parsed > 0 {
			months = parsed
		}
	}

	result, err := h.profitService.GetMonthlyProfit(*tenantID, months)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetProfitByBranchHandler returns profit analysis by branch
func (h *ProfitAnalysisHandler) GetProfitByBranchHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	startDate, endDate := parseDateRange(r)

	// We need total profit for percentage calculation, so we get the full analysis or just sum it up
	// For efficiency, we could just get branch data, but percentage requires total.
	// Let's just get branch data and sum it up for total.

	// Note: The service method requires totalProfit to calculate percentages.
	// We can pass 0 for now if we don't want to calculate it separately, or calculate it first.
	// Let's calculate total profit first.
	summary, err := h.profitService.GetProfitAnalysis(*tenantID, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	result := h.profitService.GetProfitByBranch(*tenantID, startDate, endDate, summary.TotalProfitCAD)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetProfitTrendHandler returns profit trend
func (h *ProfitAnalysisHandler) GetProfitTrendHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	startDate, endDate := parseDateRange(r)
	// groupBy := r.URL.Query().Get("groupBy") // Currently service only supports daily via GetProfitByPeriod

	result := h.profitService.GetProfitByPeriod(*tenantID, startDate, endDate)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// GetTopCustomersHandler returns top profitable customers
func (h *ProfitAnalysisHandler) GetTopCustomersHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	startDate, endDate := parseDateRange(r)

	limit := 10
	if limitStr := r.URL.Query().Get("limit"); limitStr != "" {
		if parsed, err := strconv.Atoi(limitStr); err == nil && parsed > 0 {
			limit = parsed
		}
	}

	result, err := h.profitService.GetTopCustomers(*tenantID, limit, startDate, endDate)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func parseDateRange(r *http.Request) (time.Time, time.Time) {
	startDate := time.Now().AddDate(0, -1, 0) // Default: last month
	endDate := time.Now()

	if startStr := r.URL.Query().Get("startDate"); startStr != "" {
		if parsed, err := time.Parse("2006-01-02", startStr); err == nil {
			startDate = parsed
		}
	}

	if endStr := r.URL.Query().Get("endDate"); endStr != "" {
		if parsed, err := time.Parse("2006-01-02", endStr); err == nil {
			endDate = parsed.Add(24*time.Hour - time.Second) // End of day
		}
	}
	return startDate, endDate
}
