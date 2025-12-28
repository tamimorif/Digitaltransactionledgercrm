package services

import (
	"api/pkg/models"
	"context"
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type TransactionService struct {
	db                  *gorm.DB
	exchangeRateService *ExchangeRateService
}

func NewTransactionService(db *gorm.DB, exchangeRateService *ExchangeRateService) *TransactionService {
	return &TransactionService{
		db:                  db,
		exchangeRateService: exchangeRateService,
	}
}

// CreateTransaction creates a new transaction with profit calculation and multi-payment setup
func (s *TransactionService) CreateTransaction(ctx context.Context, transaction *models.Transaction) error {
	// Generate UUID if not present
	if transaction.ID == "" {
		transaction.ID = uuid.New().String()
	}

	// Initialize multi-payment fields if enabled
	if transaction.AllowPartialPayment {
		transaction.TotalReceived = transaction.SendAmount
		transaction.ReceivedCurrency = transaction.SendCurrency
		transaction.RemainingBalance = transaction.SendAmount
		transaction.PaymentStatus = models.PaymentStatusOpen
	}

	// Calculate Profit
	// Try to get the standard market rate for this currency pair
	standardRateObj, err := s.exchangeRateService.GetCurrentRate(transaction.TenantID, transaction.SendCurrency, transaction.ReceiveCurrency)
	if err == nil && standardRateObj != nil && standardRateObj.Rate.IsPositive() {
		transaction.StandardRate = standardRateObj.Rate
		// Profit = (Market Value of Input) - (Actual Output)
		// Profit = (SendAmount * StandardRate) - ReceiveAmount
		// Since ReceiveAmount = SendAmount * RateApplied
		// Profit (ReceiveCurrency) = SendAmount * (StandardRate - RateApplied)

		// To express Profit in Send Currency terms (Base Currency), we divide by StandardRate
		// transaction.Profit = (transaction.SendAmount * (transaction.StandardRate - transaction.RateApplied)) / transaction.StandardRate
		transaction.Profit = transaction.SendAmount.Mul(transaction.StandardRate.Sub(transaction.RateApplied)).Div(transaction.StandardRate)

		transaction.ProfitCalculationStatus = models.ProfitStatusCalculated
	} else {
		// If no standard rate found, mark as PENDING for background job to retry
		if err != nil {
			log.Printf("Warning: Could not fetch standard rate for %s/%s (tenant %d): %v",
				transaction.SendCurrency, transaction.ReceiveCurrency, transaction.TenantID, err)
		}
		transaction.StandardRate = models.Zero()
		transaction.Profit = models.Zero()
		transaction.ProfitCalculationStatus = models.ProfitStatusPending
	}

	// Save to database
	if err := s.db.WithContext(ctx).Create(transaction).Error; err != nil {
		log.Printf("Error creating transaction: %v", err)
		return err
	}

	return nil
}

func (s *TransactionService) GetTransaction(ctx context.Context, id string, tenantID uint) (*models.Transaction, error) {
	var transaction models.Transaction
	if err := s.db.WithContext(ctx).Where("id = ? AND tenant_id = ?", id, tenantID).Preload("Client").First(&transaction).Error; err != nil {
		return nil, err
	}
	return &transaction, nil
}
