package services

import (
	"api/pkg/models"
	"time"

	"gorm.io/gorm"
)

type ReportService struct {
	DB *gorm.DB
}

func NewReportService(db *gorm.DB) *ReportService {
	return &ReportService{DB: db}
}

// ReportData represents aggregated report data
type ReportData struct {
	Period            string             `json:"period"`
	TotalTransactions int64              `json:"totalTransactions"`
	TotalVolume       map[string]float64 `json:"totalVolume"`
	TotalRevenue      float64            `json:"totalRevenue"`
	TotalFees         float64            `json:"totalFees"`
	TopCustomers      []CustomerSummary  `json:"topCustomers"`
	BranchPerformance []BranchSummary    `json:"branchPerformance"`
}

type CustomerSummary struct {
	ClientID   string  `json:"clientId"`
	ClientName string  `json:"clientName"`
	TxCount    int64   `json:"txCount"`
	Volume     float64 `json:"volume"`
}

type BranchSummary struct {
	BranchID   uint    `json:"branchId"`
	BranchName string  `json:"branchName"`
	TxCount    int64   `json:"txCount"`
	Volume     float64 `json:"volume"`
	Revenue    float64 `json:"revenue"`
}

// GenerateDailyReport generates a report for a specific date
func (s *ReportService) GenerateDailyReport(tenantID uint, branchID *uint, date time.Time) (*ReportData, error) {
	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	return s.generateReport(tenantID, branchID, startOfDay, endOfDay, date.Format("2006-01-02"))
}

// GenerateMonthlyReport generates a report for a specific month
func (s *ReportService) GenerateMonthlyReport(tenantID uint, branchID *uint, year int, month int) (*ReportData, error) {
	startOfMonth := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, time.UTC)
	endOfMonth := startOfMonth.AddDate(0, 1, 0)

	period := startOfMonth.Format("January 2006")
	return s.generateReport(tenantID, branchID, startOfMonth, endOfMonth, period)
}

// GenerateCustomReport generates a report for a custom date range
func (s *ReportService) GenerateCustomReport(tenantID uint, branchID *uint, startDate, endDate time.Time) (*ReportData, error) {
	period := startDate.Format("2006-01-02") + " to " + endDate.Format("2006-01-02")
	return s.generateReport(tenantID, branchID, startDate, endDate, period)
}

// generateReport is the core report generation logic
func (s *ReportService) generateReport(tenantID uint, branchID *uint, startDate, endDate time.Time, period string) (*ReportData, error) {
	report := &ReportData{
		Period:      period,
		TotalVolume: make(map[string]float64),
	}

	query := s.DB.Model(&models.Transaction{}).
		Where("tenant_id = ? AND transaction_date >= ? AND transaction_date < ? AND status = ?",
			tenantID, startDate, endDate, models.StatusCompleted)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	// Total transaction count
	query.Count(&report.TotalTransactions)

	// Total volume by currency
	var volumeResults []struct {
		Currency string
		Total    float64
	}
	s.DB.Model(&models.Transaction{}).
		Select("send_currency as currency, SUM(send_amount) as total").
		Where("tenant_id = ? AND transaction_date >= ? AND transaction_date < ? AND status = ?",
			tenantID, startDate, endDate, models.StatusCompleted).
		Group("send_currency").
		Scan(&volumeResults)

	for _, result := range volumeResults {
		report.TotalVolume[result.Currency] = result.Total
	}

	// Total fees (revenue)
	s.DB.Model(&models.Transaction{}).
		Select("SUM(fee_charged) as total_fees").
		Where("tenant_id = ? AND transaction_date >= ? AND transaction_date < ? AND status = ?",
			tenantID, startDate, endDate, models.StatusCompleted).
		Scan(&report.TotalFees)

	report.TotalRevenue = report.TotalFees

	// Top 5 customers by transaction count
	var topCustomers []struct {
		ClientID   string
		ClientName string
		TxCount    int64
		Volume     float64
	}
	s.DB.Model(&models.Transaction{}).
		Select("transactions.client_id, clients.name as client_name, COUNT(*) as tx_count, SUM(transactions.send_amount) as volume").
		Joins("LEFT JOIN clients ON transactions.client_id = clients.id").
		Where("transactions.tenant_id = ? AND transactions.transaction_date >= ? AND transactions.transaction_date < ? AND transactions.status = ?",
			tenantID, startDate, endDate, models.StatusCompleted).
		Group("transactions.client_id, clients.name").
		Order("tx_count DESC").
		Limit(5).
		Scan(&topCustomers)

	for _, customer := range topCustomers {
		report.TopCustomers = append(report.TopCustomers, CustomerSummary{
			ClientID:   customer.ClientID,
			ClientName: customer.ClientName,
			TxCount:    customer.TxCount,
			Volume:     customer.Volume,
		})
	}

	// Branch performance
	var branchPerformance []struct {
		BranchID   uint
		BranchName string
		TxCount    int64
		Volume     float64
		Revenue    float64
	}
	s.DB.Model(&models.Transaction{}).
		Select("transactions.branch_id, branches.name as branch_name, COUNT(*) as tx_count, SUM(transactions.send_amount) as volume, SUM(transactions.fee_charged) as revenue").
		Joins("LEFT JOIN branches ON transactions.branch_id = branches.id").
		Where("transactions.tenant_id = ? AND transactions.transaction_date >= ? AND transactions.transaction_date < ? AND transactions.status = ?",
			tenantID, startDate, endDate, models.StatusCompleted).
		Group("transactions.branch_id, branches.name").
		Order("revenue DESC").
		Scan(&branchPerformance)

	for _, branch := range branchPerformance {
		if branch.BranchID > 0 { // Skip null branches
			report.BranchPerformance = append(report.BranchPerformance, BranchSummary{
				BranchID:   branch.BranchID,
				BranchName: branch.BranchName,
				TxCount:    branch.TxCount,
				Volume:     branch.Volume,
				Revenue:    branch.Revenue,
			})
		}
	}

	return report, nil
}
