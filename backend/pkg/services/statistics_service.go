package services

import (
	"api/pkg/models"
	"fmt"
	"time"

	"github.com/go-pdf/fpdf"
	"gorm.io/gorm"
)

type StatisticsService struct {
	DB *gorm.DB
}

func NewStatisticsService(db *gorm.DB) *StatisticsService {
	return &StatisticsService{DB: db}
}

// TransactionStatistics represents aggregated transaction data
type TransactionStatistics struct {
	TotalCount            int64              `json:"totalCount"`
	TotalVolumeByCurrency map[string]float64 `json:"totalVolumeByCurrency"`
	CountByType           map[string]int64   `json:"countByType"`
	CountByCurrency       map[string]int64   `json:"countByCurrency"`
	AverageAmount         float64            `json:"averageAmount"`
	DateRange             string             `json:"dateRange"`
}

// GetTransactionStatistics retrieves aggregated statistics for a tenant
func (s *StatisticsService) GetTransactionStatistics(tenantID uint, branchID *uint, startDate, endDate *time.Time) (*TransactionStatistics, error) {
	stats := &TransactionStatistics{
		TotalVolumeByCurrency: make(map[string]float64),
		CountByType:           make(map[string]int64),
		CountByCurrency:       make(map[string]int64),
	}

	query := s.DB.Model(&models.Transaction{}).Where("tenant_id = ?", tenantID)

	// Filter by branch if specified
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	// Filter by date range if specified
	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		// Add 1 day to include the entire end date
		endDateTime := endDate.Add(24 * time.Hour)
		query = query.Where("created_at < ?", endDateTime)
	}

	// Total count
	if err := query.Count(&stats.TotalCount).Error; err != nil {
		return nil, err
	}

	// Total volume by currency
	var volumeResults []struct {
		Currency string
		Total    float64
	}
	if err := query.Select("send_currency as currency, SUM(send_amount) as total").Group("send_currency").Scan(&volumeResults).Error; err != nil {
		return nil, err
	}
	for _, result := range volumeResults {
		stats.TotalVolumeByCurrency[result.Currency] = result.Total
	}

	// Count by type
	var typeResults []struct {
		Type  string
		Count int64
	}
	if err := query.Select("type, COUNT(*) as count").Group("type").Scan(&typeResults).Error; err != nil {
		return nil, err
	}
	for _, result := range typeResults {
		stats.CountByType[result.Type] = result.Count
	}

	// Count by currency
	var currencyResults []struct {
		Currency string
		Count    int64
	}
	if err := query.Select("send_currency as currency, COUNT(*) as count").Group("send_currency").Scan(&currencyResults).Error; err != nil {
		return nil, err
	}
	for _, result := range currencyResults {
		stats.CountByCurrency[result.Currency] = result.Count
	}

	// Average amount
	if stats.TotalCount > 0 {
		var totalAmount float64
		query.Select("SUM(send_amount)").Scan(&totalAmount)
		stats.AverageAmount = totalAmount / float64(stats.TotalCount)
	}

	// Date range string
	if startDate != nil && endDate != nil {
		stats.DateRange = startDate.Format("2006-01-02") + " to " + endDate.Format("2006-01-02")
	} else if startDate != nil {
		stats.DateRange = "From " + startDate.Format("2006-01-02")
	} else if endDate != nil {
		stats.DateRange = "Until " + endDate.Format("2006-01-02")
	} else {
		stats.DateRange = "All time"
	}

	return stats, nil
}

// TransactionExportRow represents a row in the export
type TransactionExportRow struct {
	ID                 string  `json:"id"`
	Date               string  `json:"date"`
	Type               string  `json:"type"`
	SendCurrency       string  `json:"sendCurrency"`
	SendAmount         float64 `json:"sendAmount"`
	ReceiveCurrency    string  `json:"receiveCurrency"`
	ReceiveAmount      float64 `json:"receiveAmount"`
	RateApplied        float64 `json:"rateApplied"`
	FeeCharged         float64 `json:"feeCharged"`
	BeneficiaryName    string  `json:"beneficiaryName"`
	BeneficiaryPhone   string  `json:"beneficiaryPhone"`
	BeneficiaryBank    string  `json:"beneficiaryBank"`
	BeneficiaryAccount string  `json:"beneficiaryAccount"`
	BranchName         string  `json:"branchName"`
	Status             string  `json:"status"`
	Notes              string  `json:"notes"`
}

// GetTransactionsForExport retrieves transactions formatted for export
func (s *StatisticsService) GetTransactionsForExport(tenantID uint, branchID *uint, startDate, endDate *time.Time) ([]TransactionExportRow, error) {
	var transactions []models.Transaction

	query := s.DB.Preload("Branch").Where("tenant_id = ?", tenantID)

	// Filter by branch if specified
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	// Filter by date range if specified
	if startDate != nil {
		query = query.Where("created_at >= ?", *startDate)
	}
	if endDate != nil {
		endDateTime := endDate.Add(24 * time.Hour)
		query = query.Where("created_at < ?", endDateTime)
	}

	if err := query.Order("created_at DESC").Find(&transactions).Error; err != nil {
		return nil, err
	}

	// Convert to export format
	exportRows := make([]TransactionExportRow, len(transactions))
	for i, tx := range transactions {
		branchName := ""
		if tx.Branch != nil {
			branchName = tx.Branch.Name
		}

		var paymentMethod string
		switch tx.PaymentMethod {
		case models.TransactionMethodCash:
			paymentMethod = "Cash"
		case models.TransactionMethodBank:
			paymentMethod = "Bank Transfer"
		default:
			paymentMethod = string(tx.PaymentMethod) // Fallback to raw value
		}

		exportRows[i] = TransactionExportRow{
			ID:                 tx.ID,
			Date:               tx.CreatedAt.Format("2006-01-02 15:04:05"),
			Type:               paymentMethod, // Assign the derived payment method to the 'Type' field
			SendCurrency:       tx.SendCurrency,
			SendAmount:         tx.SendAmount.Float64(),
			ReceiveCurrency:    tx.ReceiveCurrency,
			ReceiveAmount:      tx.ReceiveAmount.Float64(),
			RateApplied:        tx.RateApplied.Float64(),
			FeeCharged:         tx.FeeCharged.Float64(),
			BeneficiaryName:    stringValue(tx.BeneficiaryName),
			BeneficiaryPhone:   "", // Not in model
			BeneficiaryBank:    "", // Part of BeneficiaryDetails
			BeneficiaryAccount: "", // Part of BeneficiaryDetails
			BranchName:         branchName,
			Status:             "COMPLETED", // Default status
			Notes:              stringValue(tx.UserNotes),
		}
	}

	return exportRows, nil
}

// Helper function to safely get string value from pointer
func stringValue(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// GeneratePDF creates a PDF report from transaction data
func (s *StatisticsService) GeneratePDF(transactions []TransactionExportRow, dateRange string) (*fpdf.Fpdf, error) {
	pdf := fpdf.New("L", "mm", "A4", "") // Landscape
	pdf.AddPage()
	pdf.SetFont("Arial", "B", 16)
	pdf.Cell(40, 10, "Transaction Report")
	pdf.Ln(8)
	pdf.SetFont("Arial", "", 10)
	pdf.Cell(40, 10, "Generated: "+time.Now().Format("2006-01-02 15:04:05"))
	pdf.Ln(6)
	pdf.Cell(40, 10, "Date Range: "+dateRange)
	pdf.Ln(12)

	// Table Header
	pdf.SetFillColor(240, 240, 240)
	pdf.SetFont("Arial", "B", 9)

	headers := []string{"Date", "Type", "Send", "Receive", "Rate", "Beneficiary", "Branch", "Status"}
	widths := []float64{35, 30, 35, 35, 20, 50, 35, 25}

	for i, h := range headers {
		pdf.CellFormat(widths[i], 8, h, "1", 0, "C", true, 0, "")
	}
	pdf.Ln(-1)

	// Table Body
	pdf.SetFont("Arial", "", 8)
	pdf.SetFillColor(255, 255, 255)

	for _, tx := range transactions {
		pdf.CellFormat(widths[0], 8, tx.Date, "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[1], 8, tx.Type, "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[2], 8, fmt.Sprintf("%.2f %s", tx.SendAmount, tx.SendCurrency), "1", 0, "R", false, 0, "")
		pdf.CellFormat(widths[3], 8, fmt.Sprintf("%.2f %s", tx.ReceiveAmount, tx.ReceiveCurrency), "1", 0, "R", false, 0, "")
		pdf.CellFormat(widths[4], 8, fmt.Sprintf("%.4f", tx.RateApplied), "1", 0, "R", false, 0, "")

		// Truncate beneficiary if too long
		beneficiary := tx.BeneficiaryName
		if len(beneficiary) > 25 {
			beneficiary = beneficiary[:22] + "..."
		}
		pdf.CellFormat(widths[5], 8, beneficiary, "1", 0, "L", false, 0, "")

		pdf.CellFormat(widths[6], 8, tx.BranchName, "1", 0, "L", false, 0, "")
		pdf.CellFormat(widths[7], 8, tx.Status, "1", 0, "C", false, 0, "")
		pdf.Ln(-1)
	}

	return pdf, nil
}
