package api

import (
	"api/pkg/middleware"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type ReportHandler struct {
	ReportService *services.ReportService
}

func NewReportHandler(service *services.ReportService) *ReportHandler {
	return &ReportHandler{ReportService: service}
}

// GetDailyReportHandler generates a daily report
func (h *ReportHandler) GetDailyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	dateStr := r.URL.Query().Get("date")
	branchIDStr := r.URL.Query().Get("branchId")

	date := time.Now()
	if dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			date = parsed
		}
	}

	var branchID *uint
	if branchIDStr != "" && branchIDStr != "all" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	report, err := h.ReportService.GenerateDailyReport(*tenantID, branchID, date)
	if err != nil {
		http.Error(w, "Failed to generate daily report", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

// GetMonthlyReportHandler generates a monthly report
func (h *ReportHandler) GetMonthlyReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	yearStr := r.URL.Query().Get("year")
	monthStr := r.URL.Query().Get("month")
	branchIDStr := r.URL.Query().Get("branchId")

	year := time.Now().Year()
	month := int(time.Now().Month())

	if yearStr != "" {
		if y, err := strconv.Atoi(yearStr); err == nil {
			year = y
		}
	}
	if monthStr != "" {
		if m, err := strconv.Atoi(monthStr); err == nil {
			month = m
		}
	}

	var branchID *uint
	if branchIDStr != "" && branchIDStr != "all" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	report, err := h.ReportService.GenerateMonthlyReport(*tenantID, branchID, year, month)
	if err != nil {
		http.Error(w, "Failed to generate monthly report", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}

// GetCustomReportHandler generates a custom date range report
func (h *ReportHandler) GetCustomReportHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	startDateStr := r.URL.Query().Get("startDate")
	endDateStr := r.URL.Query().Get("endDate")
	branchIDStr := r.URL.Query().Get("branchId")

	if startDateStr == "" || endDateStr == "" {
		http.Error(w, "Start and end dates required", http.StatusBadRequest)
		return
	}

	startDate, err := time.Parse("2006-01-02", startDateStr)
	if err != nil {
		http.Error(w, "Invalid start date format", http.StatusBadRequest)
		return
	}

	endDate, err := time.Parse("2006-01-02", endDateStr)
	if err != nil {
		http.Error(w, "Invalid end date format", http.StatusBadRequest)
		return
	}

	var branchID *uint
	if branchIDStr != "" && branchIDStr != "all" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	// Add one day to end date to include the entire day
	endDate = endDate.Add(24 * time.Hour)

	report, err := h.ReportService.GenerateCustomReport(*tenantID, branchID, startDate, endDate)
	if err != nil {
		http.Error(w, "Failed to generate custom report", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(report)
}
