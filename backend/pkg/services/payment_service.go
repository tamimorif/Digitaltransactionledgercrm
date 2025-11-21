package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type PaymentService struct {
	db *gorm.DB
}

func NewPaymentService(db *gorm.DB) *PaymentService {
	return &PaymentService{db: db}
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
func (s *PaymentService) UpdatePayment(paymentID uint, updates map[string]interface{}, userID uint, reason string) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// 1. Load current payment
		var payment models.Payment
		if err := tx.Where("id = ?", paymentID).First(&payment).Error; err != nil {
			return fmt.Errorf("payment not found: %w", err)
		}

		// 2. Don't allow editing cancelled payments
		if payment.Status == models.PaymentStatusCancelled {
			return errors.New("cannot edit cancelled payment")
		}

		oldAmountInBase := payment.AmountInBase

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
		amountDifference := payment.AmountInBase - oldAmountInBase
		transaction.TotalPaid += amountDifference
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

		return nil
	})
}

// DeletePayment removes a payment and recalculates transaction totals
func (s *PaymentService) DeletePayment(paymentID uint, tenantID uint) error {
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
