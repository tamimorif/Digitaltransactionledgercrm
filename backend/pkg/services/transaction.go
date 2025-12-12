package services

import (
	"api/pkg/models"
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
func (s *TransactionService) CreateTransaction(transaction *models.Transaction) error {
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
	if err == nil && standardRateObj != nil {
		transaction.StandardRate = standardRateObj.Rate
		// Profit = (Market Value of Input) - (Actual Output)
		// Profit = (SendAmount * StandardRate) - ReceiveAmount
		// Since ReceiveAmount = SendAmount * RateApplied
		// Profit = SendAmount * (StandardRate - RateApplied)
		transaction.Profit = transaction.SendAmount * (transaction.StandardRate - transaction.RateApplied)
		transaction.ProfitCalculationStatus = models.ProfitStatusCalculated
	} else {
		// If no standard rate found, mark as PENDING for background job to retry
		if err != nil {
			log.Printf("Warning: Could not fetch standard rate for %s/%s (tenant %d): %v",
				transaction.SendCurrency, transaction.ReceiveCurrency, transaction.TenantID, err)
		}
		transaction.StandardRate = 0
		transaction.Profit = 0
		transaction.ProfitCalculationStatus = models.ProfitStatusPending
	}

	// Save to database
	if err := s.db.Create(transaction).Error; err != nil {
		log.Printf("Error creating transaction: %v", err)
		return err
	}

	return nil
}

func (s *TransactionService) GetTransaction(id string, tenantID uint) (*models.Transaction, error) {
	var transaction models.Transaction
	if err := s.db.Where("id = ? AND tenant_id = ?", id, tenantID).Preload("Client").First(&transaction).Error; err != nil {
		return nil, err
	}
	return &transaction, nil
}
