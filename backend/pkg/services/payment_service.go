package services

import (
	"api/pkg/models"
	"api/pkg/strategies"
	"api/pkg/utils"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
		return s.CreatePaymentWithTx(tx, payment, userID)
	})
}

// CreatePaymentWithTx internal logic for creating payment within a transaction
func (s *PaymentService) CreatePaymentWithTx(tx *gorm.DB, payment *models.Payment, userID uint) error {
	// 1. Load the transaction with FOR UPDATE lock to prevent race conditions
	var transaction models.Transaction
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND tenant_id = ?", payment.TransactionID, payment.TenantID).
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

	// 4. Validate Payment Details using Strategy
	strategy := strategies.GetPaymentStrategy(payment.PaymentMethod)
	if err := strategy.Validate(payment.Details); err != nil {
		return fmt.Errorf("invalid payment details for %s: %w", payment.PaymentMethod, err)
	}

	// 5. Convert payment amount to transaction's base currency
	// payment.AmountInBase = payment.Amount * payment.ExchangeRate
	payment.AmountInBase = payment.Amount.Mul(payment.ExchangeRate)

	// 5. Validate not exceeding total
	// newTotalPaid := transaction.TotalPaid + payment.AmountInBase
	newTotalPaid := transaction.TotalPaid.Add(payment.AmountInBase)
	// if newTotalPaid > transaction.TotalReceived {
	if newTotalPaid.GreaterThan(transaction.TotalReceived) {
		return fmt.Errorf("payment exceeds remaining balance. Remaining: %s %s",
			transaction.RemainingBalance.String(), transaction.ReceivedCurrency)
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
	// transaction.RemainingBalance = transaction.TotalReceived - newTotalPaid
	transaction.RemainingBalance = transaction.TotalReceived.Sub(newTotalPaid)

	// 9. Update payment status (using currency-aware tolerance for IRR, JPY, etc.)
	tolerance := models.NewDecimal(utils.GetPaymentTolerance(transaction.ReceivedCurrency))
	// if transaction.RemainingBalance <= tolerance {
	if transaction.RemainingBalance.LessThanOrEqual(tolerance) {
		transaction.PaymentStatus = models.PaymentStatusFullyPaid
	} else if transaction.TotalPaid.IsPositive() {
		transaction.PaymentStatus = models.PaymentStatusPartial
	}

	// 10. Save transaction
	if err := tx.Save(&transaction).Error; err != nil {
		return fmt.Errorf("failed to update transaction: %w", err)
	}

	// 11. Create Ledger Entry (Credit Client)
	// Positive amount = credit (client's balance increases)
	ledgerEntry := models.LedgerEntry{
		TenantID:      payment.TenantID,
		ClientID:      transaction.ClientID,
		BranchID:      payment.BranchID,
		TransactionID: &transaction.ID,
		Type:          models.LedgerTypeDeposit,
		Currency:      payment.Currency,
		Amount:        payment.Amount, // Positive = credit to client
		Description:   fmt.Sprintf("Payment for Transaction #%s", transaction.ID),
		ExchangeRate:  &payment.ExchangeRate,
		CreatedBy:     userID,
		CreatedAt:     time.Now(),
	}
	if _, err := s.ledgerService.AddEntryWithTx(tx, ledgerEntry); err != nil {
		return fmt.Errorf("failed to create ledger entry: %w", err)
	}

	// 12. Update Cash Balance (Increase Cash)
	// Only if payment method is CASH
	if payment.PaymentMethod == models.PaymentMethodCash {
		err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, payment.Amount.Float64(), fmt.Sprintf("Payment for Transaction #%s", transaction.ID), userID)
		if err != nil {
			return fmt.Errorf("failed to update cash balance: %w", err)
		}
	}

	return nil
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
			payment.Amount = models.NewDecimal(amount)
		}
		if currency, ok := updates["currency"].(string); ok {
			payment.Currency = currency
		}
		if rate, ok := updates["exchangeRate"].(float64); ok {
			payment.ExchangeRate = models.NewDecimal(rate)
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
		payment.AmountInBase = payment.Amount.Mul(payment.ExchangeRate)

		// 5. Set edit tracking
		now := time.Now()
		payment.IsEdited = true
		payment.EditedAt = &now
		payment.EditedBy = &userID
		if reason != "" {
			payment.EditReason = &reason
		}

		// 6. Load transaction with FOR UPDATE lock to prevent race conditions
		var transaction models.Transaction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND tenant_id = ?", payment.TransactionID, payment.TenantID).
			First(&transaction).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		// 7. Recalculate transaction totals
		amountDifferenceInBase := payment.AmountInBase.Sub(oldAmountInBase)
		transaction.TotalPaid = transaction.TotalPaid.Add(amountDifferenceInBase)
		transaction.RemainingBalance = transaction.TotalReceived.Sub(transaction.TotalPaid)

		// 8. Validate not exceeding total
		if transaction.TotalPaid.GreaterThan(transaction.TotalReceived) {
			return fmt.Errorf("updated payment exceeds total. Remaining: %s %s",
				transaction.RemainingBalance.String(), transaction.ReceivedCurrency)
		}

		// 9. Update payment status (using currency-aware tolerance)
		tolerance := models.NewDecimal(utils.GetPaymentTolerance(transaction.ReceivedCurrency))
		if transaction.RemainingBalance.LessThanOrEqual(tolerance) {
			transaction.PaymentStatus = models.PaymentStatusFullyPaid
		} else if transaction.TotalPaid.IsPositive() {
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
			amountDifference := payment.Amount.Sub(oldAmount)
			if !amountDifference.IsZero() {
				// Create Ledger Entry for the difference
				ledgerType := models.LedgerTypeDeposit
				if amountDifference.IsNegative() {
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

				// --- FIXED CASH BALANCE LOGIC ---
				// 1. If stayed Cash: Adjust by difference
				if payment.PaymentMethod == models.PaymentMethodCash && oldPaymentMethod == models.PaymentMethodCash {
					err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, amountDifference.Float64(), fmt.Sprintf("Adjustment for Payment #%d (Update): %s", payment.ID, reason), userID)
					if err != nil {
						return fmt.Errorf("failed to update cash balance: %w", err)
					}
				} else if oldPaymentMethod == models.PaymentMethodCash && payment.PaymentMethod != models.PaymentMethodCash {
					// 2. Was Cash, became Non-Cash: Reverse OLD amount (remove from cash)
					err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, -oldAmount.Float64(), fmt.Sprintf("Adjustment (Method Change) for Payment #%d: %s", payment.ID, reason), userID)
					if err != nil {
						return fmt.Errorf("failed to reverse old cash balance: %w", err)
					}
				} else if oldPaymentMethod != models.PaymentMethodCash && payment.PaymentMethod == models.PaymentMethodCash {
					// 3. Was Non-Cash, became Cash: Add NEW amount (add to cash)
					err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, payment.Amount.Float64(), fmt.Sprintf("Adjustment (Method Change) for Payment #%d: %s", payment.ID, reason), userID)
					if err != nil {
						return fmt.Errorf("failed to add new cash balance: %w", err)
					}
				}
			} else {
				// Amount didn't change, but Method might have
				if oldPaymentMethod == models.PaymentMethodCash && payment.PaymentMethod != models.PaymentMethodCash {
					// Remove old amount
					err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, -oldAmount.Float64(), fmt.Sprintf("Method Change (Cash->%s) Payment #%d", payment.PaymentMethod, payment.ID), userID)
					if err != nil {
						return err
					}
				} else if oldPaymentMethod != models.PaymentMethodCash && payment.PaymentMethod == models.PaymentMethodCash {
					// Add new amount (same as old amount)
					err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, payment.Amount.Float64(), fmt.Sprintf("Method Change (%s->Cash) Payment #%d", oldPaymentMethod, payment.ID), userID)
					if err != nil {
						return err
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
				Amount:        oldAmount.Neg(),
				Description:   fmt.Sprintf("Reversal (Currency Change) for Payment #%d: %s", payment.ID, reason),
				CreatedBy:     userID,
				CreatedAt:     time.Now(),
			}
			if err := tx.Create(&ledgerEntryReverse).Error; err != nil {
				return err
			}

			if oldPaymentMethod == models.PaymentMethodCash {
				// Decrease Cash for old currency
				err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, oldCurrency, -oldAmount.Float64(), fmt.Sprintf("Currency change reversal for Payment #%d: %s", payment.ID, reason), userID)
				if err != nil {
					return fmt.Errorf("failed to update old currency cash balance: %w", err)
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
				err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, payment.Amount.Float64(), fmt.Sprintf("Currency change credit for Payment #%d: %s", payment.ID, reason), userID)
				if err != nil {
					return fmt.Errorf("failed to update new currency cash balance: %w", err)
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

		// 2. Load transaction with FOR UPDATE lock to prevent race conditions
		var transaction models.Transaction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND tenant_id = ?", payment.TransactionID, tenantID).
			First(&transaction).Error; err != nil {
			return fmt.Errorf("transaction not found: %w", err)
		}

		// 3. Update transaction totals
		// transaction.TotalPaid -= payment.AmountInBase
		transaction.TotalPaid = transaction.TotalPaid.Sub(payment.AmountInBase)
		// transaction.RemainingBalance = transaction.TotalReceived - transaction.TotalPaid
		transaction.RemainingBalance = transaction.TotalReceived.Sub(transaction.TotalPaid)

		// 4. Update payment status (using currency-aware tolerance)
		tolerance := models.NewDecimal(utils.GetPaymentTolerance(transaction.ReceivedCurrency))
		// if transaction.TotalPaid <= 0 {
		if transaction.TotalPaid.IsZero() || transaction.TotalPaid.IsNegative() {
			transaction.PaymentStatus = models.PaymentStatusOpen
		} else if transaction.RemainingBalance.GreaterThan(tolerance) {
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
			Amount:        payment.Amount.Neg(),
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
			err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, -payment.Amount.Float64(), fmt.Sprintf("Reversal (Deletion) of Payment #%d", payment.ID), userID)
			if err != nil {
				return fmt.Errorf("failed to update cash balance reversal: %w", err)
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

		// 2. Load transaction with FOR UPDATE lock to prevent race conditions
		var transaction models.Transaction
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ? AND tenant_id = ?", payment.TransactionID, tenantID).
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
		// transaction.TotalPaid -= payment.AmountInBase
		transaction.TotalPaid = transaction.TotalPaid.Sub(payment.AmountInBase)
		// transaction.RemainingBalance = transaction.TotalReceived - transaction.TotalPaid
		transaction.RemainingBalance = transaction.TotalReceived.Sub(transaction.TotalPaid)

		// 5. Update payment status (using currency-aware tolerance)
		tolerance := models.NewDecimal(utils.GetPaymentTolerance(transaction.ReceivedCurrency))
		// if transaction.TotalPaid <= 0 {
		if transaction.TotalPaid.IsZero() || transaction.TotalPaid.IsNegative() {
			transaction.PaymentStatus = models.PaymentStatusOpen
		} else if transaction.RemainingBalance.GreaterThan(tolerance) {
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
			Amount:        payment.Amount.Neg(), // Negative amount to reverse the deposit
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
			err := s.cashBalanceService.UpdateCashBalance(tx, payment.TenantID, payment.BranchID, payment.Currency, -payment.Amount.Float64(), fmt.Sprintf("Reversal of Payment #%d: %s", payment.ID, reason), userID)
			if err != nil {
				return fmt.Errorf("failed to update cash balance reversal: %w", err)
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

		// Allow completion if remaining is small (using currency-aware tolerance)
		tolerance := models.NewDecimal(utils.GetPaymentTolerance(transaction.ReceivedCurrency))
		// Also allow 1% tolerance for larger transactions
		// percentTolerance := transaction.TotalReceived * 0.01
		percentTolerance := transaction.TotalReceived.Mul(models.NewDecimal(0.01))

		if percentTolerance.GreaterThan(tolerance) {
			tolerance = percentTolerance
		}

		// if transaction.RemainingBalance > tolerance {
		if transaction.RemainingBalance.GreaterThan(tolerance) {
			return fmt.Errorf("cannot complete transaction with remaining balance: %s %s",
				transaction.RemainingBalance.String(), transaction.ReceivedCurrency)
		}

		transaction.PaymentStatus = models.PaymentStatusFullyPaid
		transaction.Status = models.StatusCompleted

		if err := tx.Save(&transaction).Error; err != nil {
			return fmt.Errorf("failed to complete transaction: %w", err)
		}

		return nil
	})
}
