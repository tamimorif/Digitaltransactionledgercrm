package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"math"
	"time"

	"gorm.io/gorm"
)

// BatchPaymentService handles batch payment processing
type BatchPaymentService struct {
	db             *gorm.DB
	paymentService *PaymentService
}

// NewBatchPaymentService creates a new BatchPaymentService
func NewBatchPaymentService(db *gorm.DB, paymentService *PaymentService) *BatchPaymentService {
	return &BatchPaymentService{
		db:             db,
		paymentService: paymentService,
	}
}

// BatchPaymentRequest represents a request to pay multiple transactions
type BatchPaymentRequest struct {
	TransactionIDs []string `json:"transactionIds"`
	TotalAmount    float64  `json:"totalAmount"`
	Currency       string   `json:"currency"`
	ExchangeRate   float64  `json:"exchangeRate"`
	PaymentMethod  string   `json:"paymentMethod"`
	Strategy       string   `json:"strategy"` // "FIFO", "PROPORTIONAL", "CUSTOM"
	Notes          string   `json:"notes"`
}

// BatchPaymentAllocation represents how payment is allocated per transaction
type BatchPaymentAllocation struct {
	TransactionID    string  `json:"transactionId"`
	ClientName       string  `json:"clientName"`
	RemainingBalance float64 `json:"remainingBalance"`
	AllocatedAmount  float64 `json:"allocatedAmount"`
	Currency         string  `json:"currency"`
	IsFullPayment    bool    `json:"isFullPayment"`
}

// BatchPaymentPreview represents a preview of batch payment allocation
type BatchPaymentPreview struct {
	Allocations      []BatchPaymentAllocation `json:"allocations"`
	TotalAllocated   float64                  `json:"totalAllocated"`
	Unallocated      float64                  `json:"unallocated"`
	TransactionsPaid int                      `json:"transactionsPaid"`
	Strategy         string                   `json:"strategy"`
}

// BatchPaymentResult represents the result of a batch payment
type BatchPaymentResult struct {
	PaymentsCreated int                      `json:"paymentsCreated"`
	TotalPaid       float64                  `json:"totalPaid"`
	Allocations     []BatchPaymentAllocation `json:"allocations"`
	FailedPayments  []string                 `json:"failedPayments,omitempty"`
	ProcessedAt     time.Time                `json:"processedAt"`
}

// PreviewBatchPayment calculates how a payment would be allocated
func (s *BatchPaymentService) PreviewBatchPayment(tenantID uint, request BatchPaymentRequest) (*BatchPaymentPreview, error) {
	// Load transactions
	var transactions []models.Transaction
	if err := s.db.Where("id IN ? AND tenant_id = ?", request.TransactionIDs, tenantID).
		Preload("Client").
		Find(&transactions).Error; err != nil {
		return nil, fmt.Errorf("failed to load transactions: %w", err)
	}

	if len(transactions) == 0 {
		return nil, errors.New("no transactions found")
	}

	// Filter to only pending/partial transactions
	var validTransactions []models.Transaction
	for _, t := range transactions {
		if t.AllowPartialPayment && t.PaymentStatus != models.PaymentStatusFullyPaid {
			validTransactions = append(validTransactions, t)
		}
	}

	if len(validTransactions) == 0 {
		return nil, errors.New("no transactions eligible for payment")
	}

	// Calculate allocations based on strategy
	allocations := s.calculateAllocations(validTransactions, request.TotalAmount, request.Strategy)

	totalAllocated := 0.0
	paidCount := 0
	for _, a := range allocations {
		totalAllocated += a.AllocatedAmount
		if a.AllocatedAmount > 0 {
			paidCount++
		}
	}

	return &BatchPaymentPreview{
		Allocations:      allocations,
		TotalAllocated:   totalAllocated,
		Unallocated:      request.TotalAmount - totalAllocated,
		TransactionsPaid: paidCount,
		Strategy:         request.Strategy,
	}, nil
}

// ProcessBatchPayment processes a batch payment
func (s *BatchPaymentService) ProcessBatchPayment(tenantID uint, userID uint, request BatchPaymentRequest) (*BatchPaymentResult, error) {
	// Get preview first
	preview, err := s.PreviewBatchPayment(tenantID, request)
	if err != nil {
		return nil, err
	}

	result := &BatchPaymentResult{
		Allocations: preview.Allocations,
		ProcessedAt: time.Now(),
	}

	// Process each allocation in a transaction
	err = s.db.Transaction(func(tx *gorm.DB) error {
		for _, allocation := range preview.Allocations {
			if allocation.AllocatedAmount <= 0 {
				continue
			}

			// Create payment
			payment := &models.Payment{
				TenantID:      tenantID,
				TransactionID: allocation.TransactionID,
				Amount:        allocation.AllocatedAmount,
				Currency:      request.Currency,
				ExchangeRate:  request.ExchangeRate,
				PaymentMethod: request.PaymentMethod,
				Status:        models.PaymentStatusCompleted,
				PaidAt:        time.Now(),
			}

			if request.Notes != "" {
				notes := fmt.Sprintf("Batch Payment: %s", request.Notes)
				payment.Notes = &notes
			}

			// Use payment service to create (handles ledger + cash balance)
			if err := s.paymentService.CreatePayment(payment, userID); err != nil {
				result.FailedPayments = append(result.FailedPayments, allocation.TransactionID)
				continue
			}

			result.PaymentsCreated++
			result.TotalPaid += allocation.AllocatedAmount
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return result, nil
}

// calculateAllocations allocates payment amount across transactions
func (s *BatchPaymentService) calculateAllocations(
	transactions []models.Transaction,
	totalAmount float64,
	strategy string,
) []BatchPaymentAllocation {
	allocations := make([]BatchPaymentAllocation, len(transactions))

	switch strategy {
	case "FIFO":
		// Sort by created_at (oldest first) - already sorted by DB
		remaining := totalAmount
		for i, t := range transactions {
			allocations[i] = BatchPaymentAllocation{
				TransactionID:    t.ID,
				ClientName:       t.Client.Name,
				RemainingBalance: t.RemainingBalance,
				Currency:         t.ReceivedCurrency,
			}

			if remaining <= 0 {
				allocations[i].AllocatedAmount = 0
				continue
			}

			// Allocate up to remaining balance
			toAllocate := math.Min(remaining, t.RemainingBalance)
			allocations[i].AllocatedAmount = toAllocate
			allocations[i].IsFullPayment = toAllocate >= t.RemainingBalance*0.99 // 99% threshold

			remaining -= toAllocate
		}

	case "PROPORTIONAL":
		// Allocate proportionally based on remaining balances
		totalRemaining := 0.0
		for _, t := range transactions {
			totalRemaining += t.RemainingBalance
		}

		for i, t := range transactions {
			proportion := t.RemainingBalance / totalRemaining
			allocated := math.Min(totalAmount*proportion, t.RemainingBalance)
			// Round to 2 decimal places
			allocated = math.Round(allocated*100) / 100

			allocations[i] = BatchPaymentAllocation{
				TransactionID:    t.ID,
				ClientName:       t.Client.Name,
				RemainingBalance: t.RemainingBalance,
				AllocatedAmount:  allocated,
				Currency:         t.ReceivedCurrency,
				IsFullPayment:    allocated >= t.RemainingBalance*0.99,
			}
		}

	default: // "FIFO" as default
		return s.calculateAllocations(transactions, totalAmount, "FIFO")
	}

	return allocations
}

// GetPendingTransactions returns all transactions eligible for batch payment
func (s *BatchPaymentService) GetPendingTransactions(tenantID uint) ([]models.Transaction, error) {
	var transactions []models.Transaction

	err := s.db.Where(
		"tenant_id = ? AND allow_partial_payment = ? AND payment_status IN ?",
		tenantID, true, []string{models.PaymentStatusOpen, models.PaymentStatusPartial},
	).
		Preload("Client").
		Order("created_at ASC"). // Oldest first for FIFO
		Find(&transactions).Error

	return transactions, err
}
