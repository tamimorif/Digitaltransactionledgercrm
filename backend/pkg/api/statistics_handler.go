package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type StatisticsHandler struct {
	StatisticsService *services.StatisticsService
}

func NewStatisticsHandler(service *services.StatisticsService) *StatisticsHandler {
	return &StatisticsHandler{StatisticsService: service}
}

// GetStatisticsHandler retrieves transaction statistics
func (h *StatisticsHandler) GetStatisticsHandler(w http.ResponseWriter, r *http.Request) {
	// Get tenant from context
	tenantID := r.Context().Value("tenantId").(uint)

	// Parse query parameters
	branchIDStr := r.URL.Query().Get("branchId")
	startDateStr := r.URL.Query().Get("startDate")
	endDateStr := r.URL.Query().Get("endDate")

	var branchID *uint
	if branchIDStr != "" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	var startDate, endDate *time.Time
	if startDateStr != "" {
		parsed, err := time.Parse("2006-01-02", startDateStr)
		if err == nil {
			startDate = &parsed
		}
	}
	if endDateStr != "" {
		parsed, err := time.Parse("2006-01-02", endDateStr)
		if err == nil {
			endDate = &parsed
		}
	}

	stats, err := h.StatisticsService.GetTransactionStatistics(tenantID, branchID, startDate, endDate)
	if err != nil {
		http.Error(w, "Failed to retrieve statistics", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ExportCSVHandler exports transactions as CSV
func (h *StatisticsHandler) ExportCSVHandler(w http.ResponseWriter, r *http.Request) {
	// Get tenant from context
	tenantID := r.Context().Value("tenantId").(uint)
	userVal := r.Context().Value("user")
	user := userVal.(*models.User)

	// Parse query parameters
	branchIDStr := r.URL.Query().Get("branchId")
	startDateStr := r.URL.Query().Get("startDate")
	endDateStr := r.URL.Query().Get("endDate")

	var branchID *uint
	if branchIDStr != "" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	var startDate, endDate *time.Time
	if startDateStr != "" {
		parsed, err := time.Parse("2006-01-02", startDateStr)
		if err == nil {
			startDate = &parsed
		}
	}
	if endDateStr != "" {
		parsed, err := time.Parse("2006-01-02", endDateStr)
		if err == nil {
			endDate = &parsed
		}
	}

	// Get transactions for export
	transactions, err := h.StatisticsService.GetTransactionsForExport(tenantID, branchID, startDate, endDate)
	if err != nil {
		http.Error(w, "Failed to retrieve transactions for export", http.StatusInternalServerError)
		return
	}

	// Generate filename
	filename := fmt.Sprintf("transactions_export_%s.csv", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// Create CSV writer
	writer := csv.NewWriter(w)
	defer writer.Flush()

	// Write header
	headers := []string{
		"ID", "Date", "Type", "Send Currency", "Send Amount",
		"Receive Currency", "Receive Amount", "Rate Applied", "Fee Charged",
		"Beneficiary Name", "Branch", "Status", "Notes",
	}
	if err := writer.Write(headers); err != nil {
		http.Error(w, "Failed to write CSV header", http.StatusInternalServerError)
		return
	}

	// Write data rows
	for _, tx := range transactions {
		row := []string{
			tx.ID,
			tx.Date,
			tx.Type,
			tx.SendCurrency,
			fmt.Sprintf("%.2f", tx.SendAmount),
			tx.ReceiveCurrency,
			fmt.Sprintf("%.2f", tx.ReceiveAmount),
			fmt.Sprintf("%.4f", tx.RateApplied),
			fmt.Sprintf("%.2f", tx.FeeCharged),
			tx.BeneficiaryName,
			tx.BranchName,
			tx.Status,
			tx.Notes,
		}
		if err := writer.Write(row); err != nil {
			http.Error(w, "Failed to write CSV row", http.StatusInternalServerError)
			return
		}
	}

	// Log export activity
	fmt.Printf("User %s exported %d transactions to CSV\n", user.Email, len(transactions))
}

// ExportJSONHandler exports transactions as JSON
func (h *StatisticsHandler) ExportJSONHandler(w http.ResponseWriter, r *http.Request) {
	// Get tenant from context
	tenantID := r.Context().Value("tenantId").(uint)
	userVal := r.Context().Value("user")
	user := userVal.(*models.User)

	// Parse query parameters
	branchIDStr := r.URL.Query().Get("branchId")
	startDateStr := r.URL.Query().Get("startDate")
	endDateStr := r.URL.Query().Get("endDate")

	var branchID *uint
	if branchIDStr != "" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	var startDate, endDate *time.Time
	if startDateStr != "" {
		parsed, err := time.Parse("2006-01-02", startDateStr)
		if err == nil {
			startDate = &parsed
		}
	}
	if endDateStr != "" {
		parsed, err := time.Parse("2006-01-02", endDateStr)
		if err == nil {
			endDate = &parsed
		}
	}

	// Get transactions for export
	transactions, err := h.StatisticsService.GetTransactionsForExport(tenantID, branchID, startDate, endDate)
	if err != nil {
		http.Error(w, "Failed to retrieve transactions for export", http.StatusInternalServerError)
		return
	}

	// Generate filename
	filename := fmt.Sprintf("transactions_export_%s.json", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// Write JSON
	if err := json.NewEncoder(w).Encode(transactions); err != nil {
		http.Error(w, "Failed to encode JSON", http.StatusInternalServerError)
		return
	}

	// Log export activity
	fmt.Printf("User %s exported %d transactions to JSON\n", user.Email, len(transactions))
}

// ExportPDFHandler exports transactions as PDF
func (h *StatisticsHandler) ExportPDFHandler(w http.ResponseWriter, r *http.Request) {
	// Get tenant from context
	tenantID := r.Context().Value("tenantId").(uint)
	userVal := r.Context().Value("user")
	user := userVal.(*models.User)

	// Parse query parameters
	branchIDStr := r.URL.Query().Get("branchId")
	startDateStr := r.URL.Query().Get("startDate")
	endDateStr := r.URL.Query().Get("endDate")

	var branchID *uint
	if branchIDStr != "" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			branchIDUint := uint(id)
			branchID = &branchIDUint
		}
	}

	var startDate, endDate *time.Time
	if startDateStr != "" {
		parsed, err := time.Parse("2006-01-02", startDateStr)
		if err == nil {
			startDate = &parsed
		}
	}
	if endDateStr != "" {
		parsed, err := time.Parse("2006-01-02", endDateStr)
		if err == nil {
			endDate = &parsed
		}
	}

	// Get transactions for export
	transactions, err := h.StatisticsService.GetTransactionsForExport(tenantID, branchID, startDate, endDate)
	if err != nil {
		http.Error(w, "Failed to retrieve transactions for export", http.StatusInternalServerError)
		return
	}

	// Determine date range string
	dateRange := "All Time"
	if startDate != nil && endDate != nil {
		dateRange = startDate.Format("2006-01-02") + " to " + endDate.Format("2006-01-02")
	} else if startDate != nil {
		dateRange = "From " + startDate.Format("2006-01-02")
	} else if endDate != nil {
		dateRange = "Until " + endDate.Format("2006-01-02")
	}

	// Generate PDF
	pdf, err := h.StatisticsService.GeneratePDF(transactions, dateRange)
	if err != nil {
		http.Error(w, "Failed to generate PDF", http.StatusInternalServerError)
		return
	}

	// Generate filename
	filename := fmt.Sprintf("transactions_report_%s.pdf", time.Now().Format("20060102_150405"))
	w.Header().Set("Content-Type", "application/pdf")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	// Write PDF
	if err := pdf.Output(w); err != nil {
		fmt.Printf("Error writing PDF: %v\n", err)
	}

	// Log export activity
	fmt.Printf("User %s exported %d transactions to PDF\n", user.Email, len(transactions))
}
