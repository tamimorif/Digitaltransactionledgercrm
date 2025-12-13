package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type PaymentService struct {
	db                 *gorm.DB
	ledgerService      *LedgerService
	cashBalanceService *CashBalanceService
}

func NewPaymentService(db *gorm.DB, ledgerService *LedgerService, cashBalanceService *CashBalanceService) *PaymentService {
	return &PaymentService{
		db:                 db,
		ledgerService:      ledgerService,
		cashBalanceService: cashBalanceService,
	}
}

// CreatePayment adds a new payment to a transaction and updates totals
func (s *PaymentService) CreatePayment(payment *models.Payment, userID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Load the transaction
		var transaction models.Transaction
		if err := tx.Where("id = ? AND tenant_id = ?", payment.TransactionID, payment.TenantID).
			First(&transaction).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		// 2. Validate transaction allows partial payments
		if !transaction.AllowPartialPayment {
			return errors.New("this transaction does not support partial payments")
		}

		// 3. Validate transaction is not cancelled or already completed
		if transaction.Status == models.StatusCancelled {
			return errors.New("cannot add payment to cancelled transaction")
		}
		if transaction.PaymentStatus == models.PaymentStatusFullyPaid {
			return errors.New("transaction is already fully paid")
		}

		// 4. Convert payment amount to transaction's base currency
		payment.AmountInBase = payment.Amount * payment.ExchangeRate

		// 5. Validate not exceeding total
		newTotalPaid := transaction.TotalPaid + payment.AmountInBase
		if newTotalPaid > transaction.TotalReceived {
			return fmt.Errorf("payment exceeds remaining balance. Remaining: %.2f %s",
				transaction.RemainingBalance, transaction.ReceivedCurrency)
		}

		// 6. Set default values
		if payment.Status == "" {
			payment.Status = models.PaymentStatusCompleted
		}
		if payment.PaidAt.IsZero() {
			payment.PaidAt = time.Now()
		}
		payment.PaidBy = userID

		// 7. Create payment
		if err := tx.Create(payment).Error; err != nil {
			return fmt.Errorf("failed to create payment: %w", err)
		}

		// 8. Update transaction totals
		transaction.TotalPaid = newTotalPaid
		transaction.RemainingBalance = transaction.TotalReceived - newTotalPaid

		// 9. Update payment status
		if transaction.RemainingBalance <= 0.01 { // Allow small floating point differences
			transaction.PaymentStatus = models.PaymentStatusFullyPaid
		} else if transaction.TotalPaid > 0 {
			transaction.PaymentStatus = models.PaymentStatusPartial
		}

		// 10. Save transaction
		if err := tx.Save(&transaction).Error; err != nil {
			return fmt.Errorf("failed to update transaction: %w", err)
		}

		// 11. Create Ledger Entry (Credit Client)
		// We are receiving money from the client, so we CREDIT their account (reduce their debt)
		// Or if we view it as "Client Deposit", it's a credit.
		ledgerEntry := models.LedgerEntry{
			TenantID:      payment.TenantID,
			ClientID:      transaction.ClientID,
			BranchID:      payment.BranchID,
			TransactionID: &transaction.ID,
			Type:          models.LedgerTypeDeposit,
			Currency:      payment.Currency,
			Amount:        payment.Amount, // Positive amount for Deposit/Payment
			Description:   fmt.Sprintf("Payment for Transaction #%s", transaction.ID),
			ExchangeRate:  &payment.ExchangeRate,
			CreatedBy:     userID,
			CreatedAt:     time.Now(),
		}
		// Use the service but with the current transaction context if possible,
		// but LedgerService uses s.db. Since we are in a transaction, we should ideally use tx.
		// However, LedgerService doesn't support passing tx.
		// For now, let's just create it directly using tx to ensure atomicity.
		if err := tx.Create(&ledgerEntry).Error; err != nil {
			return fmt.Errorf("failed to create ledger entry: %w", err)
		}

		// 12. Update Cash Balance (Increase Cash)
		// Only if payment method is CASH
		if payment.PaymentMethod == models.PaymentMethodCash {
			// We need to update the cash balance.
			// Since CashBalanceService uses its own DB instance, we can't easily wrap it in this transaction
			// unless we refactor CashBalanceService to accept a DB instance or we do it manually here.
			// To be safe and atomic, let's do it manually here for now, or accept that it might be slightly decoupled.
			// Ideally, we should refactor services to accept a tx.
			// Let's do it manually here to keep it atomic.

			// Get or create cash balance
			var cashBalance models.CashBalance
			query := tx.Where("tenant_id = ? AND currency = ?", payment.TenantID, payment.Currency)
			if payment.BranchID != nil {
				query = query.Where("branch_id = ?", *payment.BranchID)
			} else {
				query = query.Where("branch_id IS NULL")
			}
			err := query.First(&cashBalance).Error

			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					// Create new
					cashBalance = models.CashBalance{
						TenantID:         payment.TenantID,
						BranchID:         payment.BranchID,
						Currency:         payment.Currency,
						ManualAdjustment: 0,
						FinalBalance:     0,
						LastCalculatedAt: time.Now(),
					}
					if err := tx.Create(&cashBalance).Error; err != nil {
						return fmt.Errorf("failed to create cash balance: %w", err)
					}
				} else {
					return fmt.Errorf("failed to get cash balance: %w", err)
				}
			}

			// Create adjustment
			adjustment := models.CashAdjustment{
				TenantID:      payment.TenantID,
				BranchID:      payment.BranchID,
				Currency:      payment.Currency,
				Amount:        payment.Amount,
				Reason:        fmt.Sprintf("Payment for Transaction #%s", transaction.ID),
				AdjustedBy:    userID,
				BalanceBefore: cashBalance.FinalBalance,
				BalanceAfter:  cashBalance.FinalBalance + payment.Amount,
			}
			if err := tx.Create(&adjustment).Error; err != nil {
				return fmt.Errorf("failed to create cash adjustment: %w", err)
			}

			// Update balance (optimistic lock)
			res := tx.Model(&models.CashBalance{}).
				Where("id = ? AND version = ?", cashBalance.ID, cashBalance.Version).
				Updates(map[string]interface{}{
					"auto_calculated_balance": cashBalance.AutoCalculatedBalance + payment.Amount,
					"final_balance":           cashBalance.FinalBalance + payment.Amount,
					"version":                 gorm.Expr("version + 1"),
					"updated_at":              time.Now(),
				})
			if res.Error != nil {
				return fmt.Errorf("failed to update cash balance: %w", res.Error)
			}
			if res.RowsAffected == 0 {
				return errors.New("cash balance was updated concurrently; please retry")
			}
		}

		return nil
	})
}

// GetPayments retrieves all payments for a transaction
func (s *PaymentService) GetPayments(transactionID string, tenantID uint) ([]models.Payment, error) {
	var payments []models.Payment
	err := s.db.Where("transaction_id = ? AND tenant_id = ?", transactionID, tenantID).
		Preload("Branch").
		Preload("User").
		Preload("Editor").
		Preload("Canceller").
		Order("paid_at DESC").
		Find(&payments).Error

	return payments, err
}

// GetPayment retrieves a single payment by ID
func (s *PaymentService) GetPayment(paymentID uint, tenantID uint) (*models.Payment, error) {
	var payment models.Payment
	err := s.db.Where("id = ? AND tenant_id = ?", paymentID, tenantID).
		Preload("Branch").
		Preload("User").
		Preload("Editor").
		Preload("Canceller").
		First(&payment).Error

	if err != nil {
		return nil, err
	}
	return &payment, nil
}

// UpdatePayment updates a payment and recalculates transaction totals
func (s *PaymentService) UpdatePayment(paymentID uint, tenantID uint, updates map[string]interface{}, userID uint, reason string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Load current payment
		var payment models.Payment
		if err := tx.Where("id = ? AND tenant_id = ?", paymentID, tenantID).First(&payment).Error; err != nil {
			return fmt.Errorf("payment not found: %w", err)
		}

		// 2. Don't allow editing cancelled payments
		if payment.Status == models.PaymentStatusCancelled {
			return errors.New("cannot edit cancelled payment")
		}

		oldAmountInBase := payment.AmountInBase
		oldAmount := payment.Amount
		oldCurrency := payment.Currency
		oldPaymentMethod := payment.PaymentMethod

		// 3. Apply updates
		if amount, ok := updates["amount"].(float64); ok {
			payment.Amount = amount
		}
		if currency, ok := updates["currency"].(string); ok {
			payment.Currency = currency
		}
		if rate, ok := updates["exchangeRate"].(float64); ok {
			payment.ExchangeRate = rate
		}
		if method, ok := updates["paymentMethod"].(string); ok {
			payment.PaymentMethod = method
		}
		if notes, ok := updates["notes"].(string); ok {
			payment.Notes = &notes
		}
		if receipt, ok := updates["receiptNumber"].(string); ok {
			payment.ReceiptNumber = &receipt
		}

		// 4. Recalculate amount in base currency
		payment.AmountInBase = payment.Amount * payment.ExchangeRate

		// 5. Set edit tracking
		now := time.Now()
		payment.IsEdited = true
		payment.EditedAt = &now
		payment.EditedBy = &userID
		if reason != "" {
			payment.EditReason = &reason
		}

		// 6. Load transaction to update totals
		var transaction models.Transaction
		if err := tx.Where("id = ? AND tenant_id = ?", payment.TransactionID, payment.TenantID).
			First(&transaction).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		// 7. Recalculate transaction totals
		amountDifferenceInBase := payment.AmountInBase - oldAmountInBase
		transaction.TotalPaid += amountDifferenceInBase
		transaction.RemainingBalance = transaction.TotalReceived - transaction.TotalPaid

		// 8. Validate not exceeding total
		if transaction.TotalPaid > transaction.TotalReceived {
			return fmt.Errorf("updated payment exceeds total. Remaining: %.2f %s",
				transaction.RemainingBalance, transaction.ReceivedCurrency)
		}

		// 9. Update payment status
		if transaction.RemainingBalance <= 0.01 {
			transaction.PaymentStatus = models.PaymentStatusFullyPaid
		} else if transaction.TotalPaid > 0 {
			transaction.PaymentStatus = models.PaymentStatusPartial
		} else {
			transaction.PaymentStatus = models.PaymentStatusOpen
		}

		// 10. Save both
		if err := tx.Save(&payment).Error; err != nil {
			return fmt.Errorf("failed to update payment: %w", err)
		}
		if err := tx.Save(&transaction).Error; err != nil {
			return fmt.Errorf("failed to update transaction: %w", err)
		}

		// 11. Handle Ledger and Cash Balance Adjustments
		// Case A: Amount Changed (Same Currency)
		if payment.Currency == oldCurrency {
			amountDifference := payment.Amount - oldAmount
			if amountDifference != 0 {
				// Create Ledger Entry for the difference
				ledgerType := models.LedgerTypeDeposit
				if amountDifference < 0 {
					ledgerType = models.LedgerTypeWithdrawal // Correction (Debit)
				}

				ledgerEntry := models.LedgerEntry{
					TenantID:      payment.TenantID,
					ClientID:      transaction.ClientID,
					BranchID:      payment.BranchID,
					TransactionID: &transaction.ID,
					Type:          ledgerType,
					Currency:      payment.Currency,
					Amount:        amountDifference,
					Description:   fmt.Sprintf("Adjustment for Payment #%d (Update): %s", payment.ID, reason),
					ExchangeRate:  &payment.ExchangeRate,
					CreatedBy:     userID,
					CreatedAt:     time.Now(),
				}
				if err := tx.Create(&ledgerEntry).Error; err != nil {
					return fmt.Errorf("failed to create ledger adjustment: %w", err)
				}

				// Update Cash Balance if method is Cash
				if payment.PaymentMethod == models.PaymentMethodCash && oldPaymentMethod == models.PaymentMethodCash {
					var cashBalance models.CashBalance
					query := tx.Where("tenant_id = ? AND currency = ?", payment.TenantID, payment.Currency)
					if payment.BranchID != nil {
						query = query.Where("branch_id = ?", *payment.BranchID)
					} else {
						query = query.Where("branch_id IS NULL")
					}
					err := query.First(&cashBalance).Error

					if err == nil {
						adjustment := models.CashAdjustment{
							TenantID:      payment.TenantID,
							BranchID:      payment.BranchID,
							Currency:      payment.Currency,
							Amount:        amountDifference,
							Reason:        fmt.Sprintf("Adjustment for Payment #%d (Update): %s", payment.ID, reason),
							AdjustedBy:    userID,
							BalanceBefore: cashBalance.FinalBalance,
							BalanceAfter:  cashBalance.FinalBalance + amountDifference,
						}
						if err := tx.Create(&adjustment).Error; err != nil {
							return fmt.Errorf("failed to create cash adjustment: %w", err)
						}

						res := tx.Model(&models.CashBalance{}).
							Where("id = ? AND version = ?", cashBalance.ID, cashBalance.Version).
							Updates(map[string]interface{}{
								"auto_calculated_balance": cashBalance.AutoCalculatedBalance + amountDifference,
								"final_balance":           cashBalance.FinalBalance + amountDifference,
								"version":                 gorm.Expr("version + 1"),
								"updated_at":              time.Now(),
							})
						if res.Error != nil {
							return fmt.Errorf("failed to update cash balance: %w", res.Error)
						}
						if res.RowsAffected == 0 {
							return errors.New("cash balance was updated concurrently; please retry")
						}
					}
				}
			}
		} else {
			// Case B: Currency Changed (Complex)
			// Reversing old amount and adding new amount is safer but more complex to track.
			// For now, let's assume currency change is rare or handled by reversing and creating new.
			// But if we must support it:
			// 1. Reverse old amount (Debit Client, Decrease Cash)
			// 2. Add new amount (Credit Client, Increase Cash)

			// Reverse Old
			ledgerEntryReverse := models.LedgerEntry{
				TenantID:      payment.TenantID,
				ClientID:      transaction.ClientID,
				BranchID:      payment.BranchID,
				TransactionID: &transaction.ID,
				Type:          models.LedgerTypeWithdrawal,
				Currency:      oldCurrency,
				Amount:        -oldAmount,
				Description:   fmt.Sprintf("Reversal (Currency Change) for Payment #%d: %s", payment.ID, reason),
				CreatedBy:     userID,
				CreatedAt:     time.Now(),
			}
			if err := tx.Create(&ledgerEntryReverse).Error; err != nil {
				return err
			}

			if oldPaymentMethod == models.PaymentMethodCash {
				// Decrease Cash for old currency
				var oldCashBalance models.CashBalance
				oldQuery := tx.Where("tenant_id = ? AND currency = ?", payment.TenantID, oldCurrency)
				if payment.BranchID != nil {
					oldQuery = oldQuery.Where("branch_id = ?", *payment.BranchID)
				} else {
					oldQuery = oldQuery.Where("branch_id IS NULL")
				}
				err := oldQuery.First(&oldCashBalance).Error
				if err == nil {
					adjustment := models.CashAdjustment{
						TenantID:      payment.TenantID,
						BranchID:      payment.BranchID,
						Currency:      oldCurrency,
						Amount:        -oldAmount,
						Reason:        fmt.Sprintf("Currency change reversal for Payment #%d: %s", payment.ID, reason),
						AdjustedBy:    userID,
						BalanceBefore: oldCashBalance.FinalBalance,
						BalanceAfter:  oldCashBalance.FinalBalance - oldAmount,
					}
					if err := tx.Create(&adjustment).Error; err != nil {
						return fmt.Errorf("failed to create cash adjustment for old currency: %w", err)
					}
					res := tx.Model(&models.CashBalance{}).
						Where("id = ? AND version = ?", oldCashBalance.ID, oldCashBalance.Version).
						Updates(map[string]interface{}{
							"auto_calculated_balance": oldCashBalance.AutoCalculatedBalance - oldAmount,
							"final_balance":           oldCashBalance.FinalBalance - oldAmount,
							"version":                 gorm.Expr("version + 1"),
							"updated_at":              time.Now(),
						})
					if res.Error != nil {
						return fmt.Errorf("failed to update old currency cash balance: %w", res.Error)
					}
					if res.RowsAffected == 0 {
						return errors.New("cash balance was updated concurrently; please retry")
					}
				}
			}

			// Add New
			ledgerEntryNew := models.LedgerEntry{
				TenantID:      payment.TenantID,
				ClientID:      transaction.ClientID,
				BranchID:      payment.BranchID,
				TransactionID: &transaction.ID,
				Type:          models.LedgerTypeDeposit,
				Currency:      payment.Currency,
				Amount:        payment.Amount,
				Description:   fmt.Sprintf("New Entry (Currency Change) for Payment #%d: %s", payment.ID, reason),
				ExchangeRate:  &payment.ExchangeRate,
				CreatedBy:     userID,
				CreatedAt:     time.Now(),
			}
			if err := tx.Create(&ledgerEntryNew).Error; err != nil {
				return err
			}

			if payment.PaymentMethod == models.PaymentMethodCash {
				// Increase Cash for new currency
				var newCashBalance models.CashBalance
				newQuery := tx.Where("tenant_id = ? AND currency = ?", payment.TenantID, payment.Currency)
				if payment.BranchID != nil {
					newQuery = newQuery.Where("branch_id = ?", *payment.BranchID)
				} else {
					newQuery = newQuery.Where("branch_id IS NULL")
				}
				err := newQuery.First(&newCashBalance).Error
				if err != nil {
					if errors.Is(err, gorm.ErrRecordNotFound) {
						// Create new cash balance
						newCashBalance = models.CashBalance{
							TenantID:              payment.TenantID,
							BranchID:              payment.BranchID,
							Currency:              payment.Currency,
							AutoCalculatedBalance: 0,
							ManualAdjustment:      0,
							FinalBalance:          0,
							LastCalculatedAt:      time.Now(),
						}
						if err := tx.Create(&newCashBalance).Error; err != nil {
							return fmt.Errorf("failed to create new currency cash balance: %w", err)
						}
					} else {
						return fmt.Errorf("failed to get new currency cash balance: %w", err)
					}
				}
				adjustment := models.CashAdjustment{
					TenantID:      payment.TenantID,
					BranchID:      payment.BranchID,
					Currency:      payment.Currency,
					Amount:        payment.Amount,
					Reason:        fmt.Sprintf("Currency change credit for Payment #%d: %s", payment.ID, reason),
					AdjustedBy:    userID,
					BalanceBefore: newCashBalance.FinalBalance,
					BalanceAfter:  newCashBalance.FinalBalance + payment.Amount,
				}
				if err := tx.Create(&adjustment).Error; err != nil {
					return fmt.Errorf("failed to create cash adjustment for new currency: %w", err)
				}
				res := tx.Model(&models.CashBalance{}).
					Where("id = ? AND version = ?", newCashBalance.ID, newCashBalance.Version).
					Updates(map[string]interface{}{
						"auto_calculated_balance": newCashBalance.AutoCalculatedBalance + payment.Amount,
						"final_balance":           newCashBalance.FinalBalance + payment.Amount,
						"version":                 gorm.Expr("version + 1"),
						"updated_at":              time.Now(),
					})
				if res.Error != nil {
					return fmt.Errorf("failed to update new currency cash balance: %w", res.Error)
				}
				if res.RowsAffected == 0 {
					return errors.New("cash balance was updated concurrently; please retry")
				}
			}
		}

		return nil
	})
}

// DeletePayment removes a payment and recalculates transaction totals
func (s *PaymentService) DeletePayment(paymentID uint, tenantID uint, userID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Load payment
		var payment models.Payment
		if err := tx.Where("id = ? AND tenant_id = ?", paymentID, tenantID).First(&payment).Error; err != nil {
			return fmt.Errorf("payment not found: %w", err)
		}

		// 2. Load transaction
		var transaction models.Transaction
		if err := tx.Where("id = ? AND tenant_id = ?", payment.TransactionID, tenantID).
			First(&transaction).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		// 3. Update transaction totals
		transaction.TotalPaid -= payment.AmountInBase
		transaction.RemainingBalance = transaction.TotalReceived - transaction.TotalPaid

		// 4. Update payment status
		if transaction.TotalPaid <= 0 {
			transaction.PaymentStatus = models.PaymentStatusOpen
		} else if transaction.RemainingBalance > 0.01 {
			transaction.PaymentStatus = models.PaymentStatusPartial
		}

		// 5. Delete payment
		if err := tx.Delete(&payment).Error; err != nil {
			return fmt.Errorf("failed to delete payment: %w", err)
		}

		// 6. Save transaction
		if err := tx.Save(&transaction).Error; err != nil {
			return fmt.Errorf("failed to update transaction: %w", err)
		}

		// 7. Create Ledger Entry (Debit Client - Reversal)
		ledgerEntry := models.LedgerEntry{
			TenantID:      payment.TenantID,
			ClientID:      transaction.ClientID,
			BranchID:      payment.BranchID,
			TransactionID: &transaction.ID,
			Type:          models.LedgerTypeWithdrawal,
			Currency:      payment.Currency,
			Amount:        -payment.Amount,
			Description:   fmt.Sprintf("Reversal (Deletion) of Payment #%d", payment.ID),
			ExchangeRate:  &payment.ExchangeRate,
			CreatedBy:     userID,
			CreatedAt:     time.Now(),
		}
		if err := tx.Create(&ledgerEntry).Error; err != nil {
			return fmt.Errorf("failed to create ledger reversal entry: %w", err)
		}

		// 8. Update Cash Balance (Decrease Cash - Reversal)
		if payment.PaymentMethod == models.PaymentMethodCash {
			var cashBalance models.CashBalance
			query := tx.Where("tenant_id = ? AND currency = ?", payment.TenantID, payment.Currency)
			if payment.BranchID != nil {
				query = query.Where("branch_id = ?", *payment.BranchID)
			} else {
				query = query.Where("branch_id IS NULL")
			}
			err := query.First(&cashBalance).Error

			if err == nil {
				adjustment := models.CashAdjustment{
					TenantID:      payment.TenantID,
					BranchID:      payment.BranchID,
					Currency:      payment.Currency,
					Amount:        -payment.Amount,
					Reason:        fmt.Sprintf("Reversal (Deletion) of Payment #%d", payment.ID),
					AdjustedBy:    userID,
					BalanceBefore: cashBalance.FinalBalance,
					BalanceAfter:  cashBalance.FinalBalance - payment.Amount,
				}
				if err := tx.Create(&adjustment).Error; err != nil {
					return fmt.Errorf("failed to create cash adjustment reversal: %w", err)
				}

				res := tx.Model(&models.CashBalance{}).
					Where("id = ? AND version = ?", cashBalance.ID, cashBalance.Version).
					Updates(map[string]interface{}{
						"auto_calculated_balance": cashBalance.AutoCalculatedBalance - payment.Amount,
						"final_balance":           cashBalance.FinalBalance - payment.Amount,
						"version":                 gorm.Expr("version + 1"),
						"updated_at":              time.Now(),
					})
				if res.Error != nil {
					return fmt.Errorf("failed to update cash balance reversal: %w", res.Error)
				}
				if res.RowsAffected == 0 {
					return errors.New("cash balance was updated concurrently; please retry")
				}
			}
		}

		return nil
	})
}

// CancelPayment marks a payment as cancelled
func (s *PaymentService) CancelPayment(paymentID uint, tenantID uint, userID uint, reason string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Load payment
		var payment models.Payment
		if err := tx.Where("id = ? AND tenant_id = ?", paymentID, tenantID).First(&payment).Error; err != nil {
			return fmt.Errorf("payment not found: %w", err)
		}

		if payment.Status == models.PaymentStatusCancelled {
			return errors.New("payment is already cancelled")
		}

		// 2. Load transaction
		var transaction models.Transaction
		if err := tx.Where("id = ? AND tenant_id = ?", payment.TransactionID, tenantID).
			First(&transaction).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		// 3. Update payment
		now := time.Now()
		payment.Status = models.PaymentStatusCancelled
		payment.CancelledAt = &now
		payment.CancelledBy = &userID
		payment.CancelReason = &reason

		// 4. Update transaction totals (subtract cancelled payment)
		transaction.TotalPaid -= payment.AmountInBase
		transaction.RemainingBalance = transaction.TotalReceived - transaction.TotalPaid

		// 5. Update payment status
		if transaction.TotalPaid <= 0 {
			transaction.PaymentStatus = models.PaymentStatusOpen
		} else if transaction.RemainingBalance > 0.01 {
			transaction.PaymentStatus = models.PaymentStatusPartial
		}

		// 6. Save both
		if err := tx.Save(&payment).Error; err != nil {
			return fmt.Errorf("failed to cancel payment: %w", err)
		}
		if err := tx.Save(&transaction).Error; err != nil {
			return fmt.Errorf("failed to update transaction: %w", err)
		}

		// 7. Create Ledger Entry (Debit Client - Reversal)
		// We are reversing a payment, so we DEBIT the client (increase their debt back)
		ledgerEntry := models.LedgerEntry{
			TenantID:      payment.TenantID,
			ClientID:      transaction.ClientID,
			BranchID:      payment.BranchID,
			TransactionID: &transaction.ID,
			Type:          models.LedgerTypeWithdrawal, // Or a specific REVERSAL type
			Currency:      payment.Currency,
			Amount:        -payment.Amount, // Negative amount to reverse the deposit
			Description:   fmt.Sprintf("Reversal of Payment #%d for Transaction #%s: %s", payment.ID, transaction.ID, reason),
			ExchangeRate:  &payment.ExchangeRate,
			CreatedBy:     userID,
			CreatedAt:     time.Now(),
		}
		if err := tx.Create(&ledgerEntry).Error; err != nil {
			return fmt.Errorf("failed to create ledger reversal entry: %w", err)
		}

		// 8. Update Cash Balance (Decrease Cash - Reversal)
		if payment.PaymentMethod == models.PaymentMethodCash {
			var cashBalance models.CashBalance
			query := tx.Where("tenant_id = ? AND currency = ?", payment.TenantID, payment.Currency)
			if payment.BranchID != nil {
				query = query.Where("branch_id = ?", *payment.BranchID)
			} else {
				query = query.Where("branch_id IS NULL")
			}
			err := query.First(&cashBalance).Error

			if err == nil {
				// Create adjustment
				adjustment := models.CashAdjustment{
					TenantID:      payment.TenantID,
					BranchID:      payment.BranchID,
					Currency:      payment.Currency,
					Amount:        -payment.Amount, // Negative amount
					Reason:        fmt.Sprintf("Reversal of Payment #%d: %s", payment.ID, reason),
					AdjustedBy:    userID,
					BalanceBefore: cashBalance.FinalBalance,
					BalanceAfter:  cashBalance.FinalBalance - payment.Amount,
				}
				if err := tx.Create(&adjustment).Error; err != nil {
					return fmt.Errorf("failed to create cash adjustment reversal: %w", err)
				}

				// Update balance (optimistic lock)
				res := tx.Model(&models.CashBalance{}).
					Where("id = ? AND version = ?", cashBalance.ID, cashBalance.Version).
					Updates(map[string]interface{}{
						"auto_calculated_balance": cashBalance.AutoCalculatedBalance - payment.Amount,
						"final_balance":           cashBalance.FinalBalance - payment.Amount,
						"version":                 gorm.Expr("version + 1"),
						"updated_at":              time.Now(),
					})
				if res.Error != nil {
					return fmt.Errorf("failed to update cash balance reversal: %w", res.Error)
				}
				if res.RowsAffected == 0 {
					return errors.New("cash balance was updated concurrently; please retry")
				}
			}
		}

		return nil
	})
}

// CompleteTransaction marks a transaction as completed (manually)
func (s *PaymentService) CompleteTransaction(transactionID string, tenantID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		var transaction models.Transaction
		if err := tx.Where("id = ? AND tenant_id = ?", transactionID, tenantID).
			First(&transaction).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		// Allow completion if remaining is small (less than 1% or 0.01)
		toleranceAmount := transaction.TotalReceived * 0.01
		if toleranceAmount < 0.01 {
			toleranceAmount = 0.01
		}

		if transaction.RemainingBalance > toleranceAmount {
			return fmt.Errorf("cannot complete transaction with remaining balance: %.2f %s",
				transaction.RemainingBalance, transaction.ReceivedCurrency)
		}

		transaction.PaymentStatus = models.PaymentStatusFullyPaid
		transaction.Status = models.StatusCompleted

		if err := tx.Save(&transaction).Error; err != nil {
			return fmt.Errorf("failed to complete transaction: %w", err)
		}

		return nil
	})
}
