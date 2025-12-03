package services

import (
	"api/pkg/models"
	"errors"
	"time"

	"gorm.io/gorm"
)

type CashBalanceService struct {
	DB *gorm.DB
}

func NewCashBalanceService(db *gorm.DB) *CashBalanceService {
	return &CashBalanceService{DB: db}
}

// CalculateBalanceFromTransactions calculates cash balance from transactions
func (s *CashBalanceService) CalculateBalanceFromTransactions(tenantID uint, branchID *uint, currency string) (float64, error) {
	var balance float64

	query := s.DB.Model(&models.Transaction{}).Where("tenant_id = ? AND currency = ?", tenantID, currency)

	// Filter by branch if specified
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	// Sum all transaction amounts
	err := query.Select("COALESCE(SUM(amount), 0)").Scan(&balance).Error
	if err != nil {
		return 0, err
	}

	return balance, nil
}

// GetOrCreateCashBalance gets or creates a cash balance record
func (s *CashBalanceService) GetOrCreateCashBalance(tenantID uint, branchID *uint, currency string) (*models.CashBalance, error) {
	var cashBalance models.CashBalance

	// Try to find existing balance
	query := s.DB.Where("tenant_id = ? AND currency = ?", tenantID, currency)
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	} else {
		query = query.Where("branch_id IS NULL")
	}

	err := query.First(&cashBalance).Error
	if err == nil {
		return &cashBalance, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// Create new balance record
	autoBalance, err := s.CalculateBalanceFromTransactions(tenantID, branchID, currency)
	if err != nil {
		return nil, err
	}

	cashBalance = models.CashBalance{
		TenantID:              tenantID,
		BranchID:              branchID,
		Currency:              currency,
		AutoCalculatedBalance: autoBalance,
		ManualAdjustment:      0,
		FinalBalance:          autoBalance,
		LastCalculatedAt:      time.Now(),
	}

	if err := s.DB.Create(&cashBalance).Error; err != nil {
		return nil, err
	}

	return &cashBalance, nil
}

// RefreshCashBalance recalculates the auto balance and updates final balance
func (s *CashBalanceService) RefreshCashBalance(id uint) (*models.CashBalance, error) {
	var cashBalance models.CashBalance
	if err := s.DB.First(&cashBalance, id).Error; err != nil {
		return nil, err
	}

	// Recalculate from transactions
	autoBalance, err := s.CalculateBalanceFromTransactions(cashBalance.TenantID, cashBalance.BranchID, cashBalance.Currency)
	if err != nil {
		return nil, err
	}

	// Update balance
	now := time.Now()
	updates := map[string]interface{}{
		"auto_calculated_balance": autoBalance,
		"final_balance":           autoBalance + cashBalance.ManualAdjustment,
		"last_calculated_at":      now,
		"updated_at":              now,
	}

	if err := s.DB.Model(&cashBalance).Updates(updates).Error; err != nil {
		return nil, err
	}

	// Reload to get updated values
	if err := s.DB.First(&cashBalance, id).Error; err != nil {
		return nil, err
	}

	return &cashBalance, nil
}

// GetAllBalancesForTenant retrieves all cash balances for a tenant
func (s *CashBalanceService) GetAllBalancesForTenant(tenantID uint, branchID *uint) ([]models.CashBalance, error) {
	var balances []models.CashBalance

	query := s.DB.Where("tenant_id = ?", tenantID)
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	err := query.Preload("Branch").Order("currency ASC").Find(&balances).Error
	return balances, err
}

// GetBalanceByCurrency retrieves a specific currency balance
func (s *CashBalanceService) GetBalanceByCurrency(tenantID uint, branchID *uint, currency string) (*models.CashBalance, error) {
	return s.GetOrCreateCashBalance(tenantID, branchID, currency)
}

// CreateManualAdjustment creates a manual adjustment to the cash balance
func (s *CashBalanceService) CreateManualAdjustment(tenantID uint, branchID *uint, currency string, amount float64, reason string, adjustedBy uint) (*models.CashAdjustment, error) {
	if reason == "" {
		return nil, errors.New("reason is required")
	}

	// Get or create cash balance
	cashBalance, err := s.GetOrCreateCashBalance(tenantID, branchID, currency)
	if err != nil {
		return nil, err
	}

	balanceBefore := cashBalance.FinalBalance

	// Create adjustment record
	adjustment := models.CashAdjustment{
		TenantID:      tenantID,
		BranchID:      branchID,
		Currency:      currency,
		Amount:        amount,
		Reason:        reason,
		AdjustedBy:    adjustedBy,
		BalanceBefore: balanceBefore,
		BalanceAfter:  balanceBefore + amount,
	}

	if err := s.DB.Create(&adjustment).Error; err != nil {
		return nil, err
	}

	// Update cash balance
	now := time.Now()
	updates := map[string]interface{}{
		"manual_adjustment":         cashBalance.ManualAdjustment + amount,
		"final_balance":             cashBalance.FinalBalance + amount,
		"last_manual_adjustment_at": &now,
		"updated_at":                now,
	}

	if err := s.DB.Model(&cashBalance).Updates(updates).Error; err != nil {
		return nil, err
	}

	return &adjustment, nil
}

// GetAdjustmentHistory retrieves adjustment history for a tenant
func (s *CashBalanceService) GetAdjustmentHistory(tenantID uint, branchID *uint, currency *string, limit, offset int) ([]models.CashAdjustment, int64, error) {
	var adjustments []models.CashAdjustment
	var total int64

	query := s.DB.Model(&models.CashAdjustment{}).Where("tenant_id = ?", tenantID)

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	if currency != nil && *currency != "" {
		query = query.Where("currency = ?", *currency)
	}

	// Count total
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// Get paginated results
	err := query.
		Preload("Branch").
		Preload("AdjustedByUser").
		Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&adjustments).Error

	return adjustments, total, err
}

// RefreshAllBalancesForTenant recalculates all balances for a tenant
func (s *CashBalanceService) RefreshAllBalancesForTenant(tenantID uint) error {
	var balances []models.CashBalance
	if err := s.DB.Where("tenant_id = ?", tenantID).Find(&balances).Error; err != nil {
		return err
	}

	for _, balance := range balances {
		if _, err := s.RefreshCashBalance(balance.ID); err != nil {
			return err
		}
	}

	return nil
}

// GetActiveCurrencies retrieves all active currencies with transactions for a tenant
func (s *CashBalanceService) GetActiveCurrencies(tenantID uint, branchID *uint) ([]string, error) {
	var sendCurrencies []string
	var receiveCurrencies []string

	// Query send currencies
	querySend := s.DB.Model(&models.Transaction{}).
		Where("tenant_id = ?", tenantID).
		Distinct("send_currency")

	if branchID != nil {
		querySend = querySend.Where("branch_id = ?", *branchID)
	}

	if err := querySend.Pluck("send_currency", &sendCurrencies).Error; err != nil {
		return nil, err
	}

	// Query receive currencies
	queryReceive := s.DB.Model(&models.Transaction{}).
		Where("tenant_id = ?", tenantID).
		Distinct("receive_currency")

	if branchID != nil {
		queryReceive = queryReceive.Where("branch_id = ?", *branchID)
	}

	if err := queryReceive.Pluck("receive_currency", &receiveCurrencies).Error; err != nil {
		return nil, err
	}

	// Combine and deduplicate
	currencyMap := make(map[string]bool)
	for _, c := range sendCurrencies {
		currencyMap[c] = true
	}
	for _, c := range receiveCurrencies {
		currencyMap[c] = true
	}

	var currencies []string
	for c := range currencyMap {
		if c != "" {
			currencies = append(currencies, c)
		}
	}

	return currencies, nil
}
