package services

import (
	"api/pkg/models"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type LedgerService struct {
	db *gorm.DB
}

func NewLedgerService(db *gorm.DB) *LedgerService {
	return &LedgerService{db: db}
}

// GetClientBalances calculates the current balance for each currency for a client.
// Uses FOR SHARE lock to prevent concurrent modifications during read.
func (s *LedgerService) GetClientBalances(clientID string, tenantID uint) (map[string]models.Decimal, error) {
	type Result struct {
		Currency string
		Total    models.Decimal
	}

	var results []Result
	err := s.db.Model(&models.LedgerEntry{}).
		Clauses(clause.Locking{Strength: "SHARE"}).
		Select("currency, sum(amount) as total").
		Where("client_id = ? AND tenant_id = ?", clientID, tenantID).
		Group("currency").
		Scan(&results).Error

	if err != nil {
		return nil, err
	}

	balances := make(map[string]models.Decimal)
	for _, r := range results {
		balances[r.Currency] = r.Total
	}

	return balances, nil
}

// GetClientBalanceForCurrency gets the balance for a specific currency with row locking.
// This is safer for withdrawal checks as it uses FOR UPDATE to prevent race conditions.
func (s *LedgerService) GetClientBalanceForCurrency(tx *gorm.DB, clientID string, tenantID uint, currency string) (models.Decimal, error) {
	var total models.Decimal
	err := tx.Model(&models.LedgerEntry{}).
		Clauses(clause.Locking{Strength: "UPDATE"}).
		Select("COALESCE(sum(amount), 0)").
		Where("client_id = ? AND tenant_id = ? AND currency = ?", clientID, tenantID, currency).
		Scan(&total).Error

	if err != nil {
		return models.Zero(), err
	}
	return total, nil
}

// AddEntry adds a single ledger entry (e.g. Deposit or Withdrawal)
// Note: This uses its own database connection. For atomic operations within
// an existing transaction, use AddEntryWithTx instead.
func (s *LedgerService) AddEntry(entry models.LedgerEntry) (*models.LedgerEntry, error) {
	return s.AddEntryWithTx(s.db, entry)
}

// AddEntryWithTx adds a single ledger entry within an existing transaction context.
// This ensures atomicity when creating ledger entries as part of a larger operation
// (e.g., when recording a payment).
//
// Sign Convention:
//   - Positive Amount (+): Credit - increases client's balance (client is owed money)
//   - Negative Amount (-): Debit - decreases client's balance (client owes money)
//
// Example:
//   - Payment received: +100 (we owe client $100 credit)
//   - Payment reversed: -100 (removes the credit)
//   - FX Sell (client gives USD): -100 USD
//   - FX Buy (client receives CAD): +130 CAD
func (s *LedgerService) AddEntryWithTx(tx *gorm.DB, entry models.LedgerEntry) (*models.LedgerEntry, error) {
	if entry.Amount.IsZero() {
		return nil, errors.New("amount cannot be zero")
	}

	if err := tx.Create(&entry).Error; err != nil {
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

	amountDec := models.NewDecimal(amount)
	rateDec := models.NewDecimal(rate)

	// Calculate converted amount
	convertedAmount := amountDec.Mul(rateDec)

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
		Amount:       amountDec.Neg(), // Negative because client is using it
		Description:  description + " (Sold)",
		ExchangeRate: &rateDec,
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
		Type:         models.LedgerTypeExchangeIn,
		Currency:       toCurrency,
		Amount:         convertedAmount, // Positive
		Description:    description + " (Bought)",
		ExchangeRate:   &rateDec,
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
