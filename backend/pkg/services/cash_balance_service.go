package services

import (
	"api/pkg/models"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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

	// NOTE: transactions table does not have generic (currency, amount) columns.
	// Cash balances are primarily affected by CASH payments.
	query := s.DB.Model(&models.Payment{}).
		Where("tenant_id = ? AND currency = ? AND payment_method = ? AND status = ?",
			tenantID, currency, models.PaymentMethodCash, models.PaymentStatusCompleted)

	// Filter by branch, including NULL branch balances
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	} else {
		query = query.Where("branch_id IS NULL")
	}

	// Sum all completed cash payments
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
// This operation is wrapped in a transaction to ensure atomicity
func (s *CashBalanceService) CreateManualAdjustment(tenantID uint, branchID *uint, currency string, amount float64, reason string, adjustedBy uint) (*models.CashAdjustment, error) {
	var adjustment *models.CashAdjustment

	err := s.DB.Transaction(func(tx *gorm.DB) error {
		// Get or create cash balance within transaction
		var cashBalance models.CashBalance

		query := tx.Where("tenant_id = ? AND currency = ?", tenantID, currency)
		if branchID != nil {
			query = query.Where("branch_id = ?", *branchID)
		} else {
			query = query.Where("branch_id IS NULL")
		}

		err := query.First(&cashBalance).Error
		if err != nil {
			if !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			// Create new balance record
			autoBalance, err := s.calculateBalanceWithTx(tx, tenantID, branchID, currency)
			if err != nil {
				return err
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
			if err := tx.Create(&cashBalance).Error; err != nil {
				return err
			}
		}

		balanceBefore := cashBalance.FinalBalance

		// Create adjustment record
		adjustment = &models.CashAdjustment{
			TenantID:      tenantID,
			BranchID:      branchID,
			Currency:      currency,
			Amount:        amount,
			Reason:        reason,
			AdjustedBy:    adjustedBy,
			BalanceBefore: balanceBefore,
			BalanceAfter:  balanceBefore + amount,
		}

		if err := tx.Create(adjustment).Error; err != nil {
			return err
		}

		// Update cash balance
		now := time.Now()

		// Lock row version for optimistic update
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&cashBalance, cashBalance.ID).Error; err != nil {
			return err
		}

		updates := map[string]interface{}{
			"manual_adjustment":         cashBalance.ManualAdjustment + amount,
			"final_balance":             cashBalance.FinalBalance + amount,
			"last_manual_adjustment_at": &now,
			"updated_at":                now,
			"version":                   gorm.Expr("version + 1"),
		}

		res := tx.Model(&models.CashBalance{}).
			Where("id = ? AND version = ?", cashBalance.ID, cashBalance.Version).
			Updates(updates)
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return errors.New("cash balance was updated concurrently; please retry")
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return adjustment, nil
}

// calculateBalanceWithTx calculates balance within a transaction
func (s *CashBalanceService) calculateBalanceWithTx(tx *gorm.DB, tenantID uint, branchID *uint, currency string) (float64, error) {
	var balance float64

	query := tx.Model(&models.Payment{}).
		Where("tenant_id = ? AND currency = ? AND payment_method = ? AND status = ?",
			tenantID, currency, models.PaymentMethodCash, models.PaymentStatusCompleted)
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	} else {
		query = query.Where("branch_id IS NULL")
	}

	err := query.Select("COALESCE(SUM(amount), 0)").Scan(&balance).Error
	if err != nil {
		return 0, err
	}

	return balance, nil
}

// UpdateCashBalance updates the cash balance transactionally
func (s *CashBalanceService) UpdateCashBalance(tx *gorm.DB, tenantID uint, branchID *uint, currency string, amount float64, reason string, adjustedBy uint) error {
	// Get or create cash balance within transaction
	var cashBalance models.CashBalance

	query := tx.Where("tenant_id = ? AND currency = ?", tenantID, currency)
	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	} else {
		query = query.Where("branch_id IS NULL")
	}

	err := query.First(&cashBalance).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		// Create new balance record
		autoBalance, err := s.calculateBalanceWithTx(tx, tenantID, branchID, currency)
		if err != nil {
			return err
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
		if err := tx.Create(&cashBalance).Error; err != nil {
			return err
		}
	}

	// Create adjustment record
	adjustment := models.CashAdjustment{
		TenantID:      tenantID,
		BranchID:      branchID,
		Currency:      currency,
		Amount:        amount,
		Reason:        reason,
		AdjustedBy:    adjustedBy,
		BalanceBefore: cashBalance.FinalBalance,
		BalanceAfter:  cashBalance.FinalBalance + amount,
	}

	if err := tx.Create(&adjustment).Error; err != nil {
		return err
	}

	// Update cash balance
	now := time.Now()

	// Lock row version for optimistic update
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&cashBalance, cashBalance.ID).Error; err != nil {
		return err
	}

	// Determine what field to update based on context?
	// Actually, payments affect "auto_calculated_balance" (implicitly, if we re-summed) AND "final_balance".
	// AND manual adjustments affect "manual_adjustment" and "final_balance".
	//
	// Wait. `CalculateBalanceFromTransactions` sums up ALL payments.
	// If we increment `auto_calculated_balance` here manually, we sustain the state.
	// But if we someday re-run `CalculateBalanceFromTransactions`, it will sum up the payments table.
	//
	// The current logic in `PaymentService` (lines 170-174) updates `auto_calculated_balance` + amount.
	// This is correct for PAYMENTs.
	//
	// However, `CreateManualAdjustment` (Line 209) updates `manual_adjustment` + amount.
	//
	// So `UpdateCashBalance` needs to know if it's a structural payment or a manual tweak?
	//
	// Actually, `PaymentService` is handling *Payments*. Payments are "Auto Calculated" sources.
	// Manual adjustments are different.
	//
	// Let's add a parameter `isManual bool` or separate methods.
	// `PaymentService` deals with `Payments`.

	// Let's rename this to `RecordPaymentImpact` or `UpdateBalanceForPayment`?
	// Or just generic `UpdateCashBalance` with `isManual` flag.
	//
	// Let's look at `PaymentService`:
	// It updates `auto_calculated_balance`.

	// So let's add `UpdateAutoBalance` specifically for payments.

	updates := map[string]interface{}{
		"auto_calculated_balance": cashBalance.AutoCalculatedBalance + amount,
		"final_balance":           cashBalance.FinalBalance + amount,
		"updated_at":              now,
		"version":                 gorm.Expr("version + 1"),
	}

	res := tx.Model(&models.CashBalance{}).
		Where("id = ? AND version = ?", cashBalance.ID, cashBalance.Version).
		Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return errors.New("cash balance was updated concurrently; please retry")
	}

	return nil
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
