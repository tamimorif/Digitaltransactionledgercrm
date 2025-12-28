package services

import (
	"api/pkg/models"
	"sort"
	"time"

	"gorm.io/gorm"
)

type ReconciliationService struct {
	DB *gorm.DB
}

func NewReconciliationService(db *gorm.DB) *ReconciliationService {
	return &ReconciliationService{DB: db}
}

// ExpectedBalanceBreakdown represents the system's expected state
type ExpectedBalanceBreakdown struct {
	Currency string  `json:"currency"`
	Cash     float64 `json:"cash"` // From CashBalance
	Bank     float64 `json:"bank"` // Calculated from Bank transactions? Or 0 if not tracked.
	Total    float64 `json:"total"`
}

// GetSystemState returns the expected balances by currency for a branch
func (s *ReconciliationService) GetSystemState(tenantID, branchID uint) ([]ExpectedBalanceBreakdown, error) {
	breakdowns := make(map[string]*ExpectedBalanceBreakdown)

	// 1. Get Cash Balances (The "System" count for physical cash)
	var cashBalances []models.CashBalance
	if err := s.DB.Where("branch_id = ? AND tenant_id = ?", branchID, tenantID).Find(&cashBalances).Error; err != nil {
		return nil, err
	}

	for _, cb := range cashBalances {
		entry := breakdowns[cb.Currency]
		if entry == nil {
			entry = &ExpectedBalanceBreakdown{Currency: cb.Currency}
			breakdowns[cb.Currency] = entry
		}
		entry.Cash = cb.FinalBalance.Float64()
	}

	// 2. Estimate Bank balances from non-cash payments
	var bankTotals []struct {
		Currency string
		Total    float64
	}

	if err := s.DB.Model(&models.Payment{}).
		Select("currency, COALESCE(SUM(amount), 0) as total").
		Where("tenant_id = ? AND branch_id = ? AND status = ? AND payment_method != ?",
			tenantID, branchID, models.PaymentStatusCompleted, models.PaymentMethodCash).
		Group("currency").
		Scan(&bankTotals).Error; err != nil {
		return nil, err
	}

	for _, bank := range bankTotals {
		entry := breakdowns[bank.Currency]
		if entry == nil {
			entry = &ExpectedBalanceBreakdown{Currency: bank.Currency}
			breakdowns[bank.Currency] = entry
		}
		entry.Bank = bank.Total
	}

	results := make([]ExpectedBalanceBreakdown, 0, len(breakdowns))
	for _, entry := range breakdowns {
		entry.Total = entry.Cash + entry.Bank
		results = append(results, *entry)
	}

	sort.Slice(results, func(i, j int) bool {
		return results[i].Currency < results[j].Currency
	})

	return results, nil
}

// CreateReconciliation creates a new daily reconciliation record
func (s *ReconciliationService) CreateReconciliation(reconciliation *models.DailyReconciliation) error {
	// Calculate expected balance based on transactions for the day
	expectedBalance, err := s.CalculateExpectedBalance(reconciliation.BranchID, reconciliation.Date)
	if err != nil {
		return err
	}

	reconciliation.ExpectedBalance = expectedBalance
	reconciliation.Variance = reconciliation.ClosingBalance - expectedBalance

	return s.DB.Create(reconciliation).Error
}

// CalculateExpectedBalance calculates the expected cash balance based on transactions
func (s *ReconciliationService) CalculateExpectedBalance(branchID uint, date time.Time) (float64, error) {
	// Get the previous day's closing balance (if exists)
	var previousReconciliation models.DailyReconciliation
	previousDate := date.AddDate(0, 0, -1)

	err := s.DB.Where("branch_id = ? AND date = ?", branchID, previousDate).
		Order("created_at DESC").
		First(&previousReconciliation).Error

	previousClosing := 0.0
	if err == nil {
		previousClosing = previousReconciliation.ClosingBalance
	}

	// Sum all transactions for the branch on this date
	// Positive: money received (cash exchange receive amount, bank transfers received)
	// Negative: money paid out (cash exchange send amount, fees)

	var transactionSum struct {
		TotalReceive float64
		TotalSend    float64
		TotalFees    float64
	}

	startOfDay := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	s.DB.Model(&models.Transaction{}).
		Select("SUM(receive_amount) as total_receive, SUM(send_amount) as total_send, SUM(fee_charged) as total_fees").
		Where("branch_id = ? AND transaction_date >= ? AND transaction_date < ? AND status = ?",
			branchID, startOfDay, endOfDay, models.StatusCompleted).
		Scan(&transactionSum)

	// Expected = Previous Closing + Money In - Money Out - Fees
	expected := previousClosing + transactionSum.TotalReceive - transactionSum.TotalSend - transactionSum.TotalFees

	return expected, nil
}

// GetReconciliationHistory retrieves past reconciliation records
func (s *ReconciliationService) GetReconciliationHistory(tenantID uint, branchID *uint, startDate, endDate *time.Time) ([]models.DailyReconciliation, error) {
	var reconciliations []models.DailyReconciliation

	query := s.DB.Where("tenant_id = ?", tenantID).Preload("Branch").Preload("User")

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	if startDate != nil {
		query = query.Where("date >= ?", *startDate)
	}

	if endDate != nil {
		query = query.Where("date <= ?", *endDate)
	}

	err := query.Order("date DESC").Find(&reconciliations).Error
	return reconciliations, err
}

// GetVarianceReport gets branches with cash discrepancies
func (s *ReconciliationService) GetVarianceReport(tenantID uint) ([]models.DailyReconciliation, error) {
	var reconciliations []models.DailyReconciliation

	// Get reconciliations where variance is not zero (within last 30 days)
	thirtyDaysAgo := time.Now().AddDate(0, 0, -30)

	err := s.DB.Where("tenant_id = ? AND date >= ? AND variance != 0", tenantID, thirtyDaysAgo).
		Preload("Branch").
		Order("date DESC").
		Find(&reconciliations).Error

	return reconciliations, err
}
