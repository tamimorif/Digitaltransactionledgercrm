package services

import (
	"api/pkg/models"
	"errors"
	"time"

	"gorm.io/gorm"
)

type LedgerService struct {
	db *gorm.DB
}

func NewLedgerService(db *gorm.DB) *LedgerService {
	return &LedgerService{db: db}
}

// GetClientBalances calculates the current balance for each currency for a client
func (s *LedgerService) GetClientBalances(clientID string, tenantID uint) (map[string]float64, error) {
	type Result struct {
		Currency string
		Total    float64
	}

	var results []Result
	err := s.db.Model(&models.LedgerEntry{}).
		Select("currency, sum(amount) as total").
		Where("client_id = ? AND tenant_id = ?", clientID, tenantID).
		Group("currency").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	balances := make(map[string]float64)
	for _, r := range results {
		balances[r.Currency] = r.Total
	}

	return balances, nil
}

// AddEntry adds a single ledger entry (e.g. Deposit or Withdrawal)
func (s *LedgerService) AddEntry(entry models.LedgerEntry) (*models.LedgerEntry, error) {
	if entry.Amount == 0 {
		return nil, errors.New("amount cannot be zero")
	}

	if err := s.db.Create(&entry).Error; err != nil {
		return nil, err
	}

	return &entry, nil
}

// Exchange performs a currency exchange for a client
// fromCurrency: Currency client is giving (or using from balance)
// toCurrency: Currency client is receiving
// amount: Amount of 'fromCurrency' to exchange
// rate: Exchange rate (1 unit of fromCurrency = rate units of toCurrency)
func (s *LedgerService) Exchange(
	tenantID uint,
	clientID string,
	branchID *uint,
	userID uint,
	fromCurrency string,
	toCurrency string,
	amount float64,
	rate float64,
	description string,
) ([]models.LedgerEntry, error) {

	if amount <= 0 {
		return nil, errors.New("amount must be positive")
	}
	if rate <= 0 {
		return nil, errors.New("rate must be positive")
	}

	// Calculate converted amount
	convertedAmount := amount * rate

	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	// Entry 1: Debit the source currency (Client is "spending" this)
	// If client gives cash, this might be a credit instead?
	// Requirement: "Exchange a client's held currency into another".
	// So client HAS Toman, wants CAD.
	// We Debit Toman (reduce balance), Credit CAD (increase balance).

	debitEntry := models.LedgerEntry{
		TenantID:     tenantID,
		ClientID:     clientID,
		BranchID:     branchID,
		Type:         models.LedgerTypeExchangeOut,
		Currency:     fromCurrency,
		Amount:       -amount, // Negative because client is using it
		Description:  description + " (Sold)",
		ExchangeRate: &rate,
		CreatedBy:    userID,
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(&debitEntry).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Entry 2: Credit the target currency (Client receives this)
	creditEntry := models.LedgerEntry{
		TenantID:       tenantID,
		ClientID:       clientID,
		BranchID:       branchID,
		Type:           models.LedgerTypeExchangeIn,
		Currency:       toCurrency,
		Amount:         convertedAmount, // Positive
		Description:    description + " (Bought)",
		ExchangeRate:   &rate,
		RelatedEntryID: &debitEntry.ID,
		CreatedBy:      userID,
		CreatedAt:      time.Now(),
	}

	if err := tx.Create(&creditEntry).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Link first entry to second
	if err := tx.Model(&debitEntry).Update("related_entry_id", creditEntry.ID).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return []models.LedgerEntry{debitEntry, creditEntry}, nil
}

// GetEntries retrieves ledger entries for a client
func (s *LedgerService) GetEntries(clientID string, tenantID uint, limit int, offset int) ([]models.LedgerEntry, error) {
	var entries []models.LedgerEntry
	err := s.db.Where("client_id = ? AND tenant_id = ?", clientID, tenantID).
		Order("created_at desc").
		Limit(limit).
		Offset(offset).
		Find(&entries).Error
	return entries, err
}
