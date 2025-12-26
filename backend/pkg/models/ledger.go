package models

import (
	"time"
)

// LedgerEntry represents a single entry in the client's multi-currency ledger.
//
// SIGN CONVENTION (Critical for Integrity):
//   - Positive Amount (+): CREDIT - increases client's balance (we owe the client)
//   - Negative Amount (-): DEBIT - decreases client's balance (client owes us)
//
// Examples:
//   - Client pays $100:     Amount = +100 (credit, client has $100 balance)
//   - Payment reversed:     Amount = -100 (debit, reverses the credit)
//   - FX: Client sells USD: Amount = -500 USD (debit, client gives us USD)
//   - FX: Client buys CAD:  Amount = +650 CAD (credit, client receives CAD)
type LedgerEntry struct {
	ID            uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID      uint    `gorm:"type:bigint;not null;index" json:"tenantId"`
	ClientID      string  `gorm:"type:text;not null;index" json:"clientId"`
	BranchID      *uint   `gorm:"type:bigint;index" json:"branchId"`              // Branch that performed the action
	TransactionID *string `gorm:"type:text;index" json:"transactionId,omitempty"` // Optional link to a main transaction

	Type     string  `gorm:"type:varchar(50);not null" json:"type"` // See LedgerType* constants
	Currency string  `gorm:"type:varchar(10);not null" json:"currency"`
	Amount   float64 `gorm:"type:decimal(20,4);not null" json:"amount"` // Positive=Credit, Negative=Debit

	Description    string   `gorm:"type:text" json:"description"`
	ExchangeRate   *float64 `gorm:"type:decimal(20,6)" json:"exchangeRate,omitempty"`  // Rate used if part of exchange
	RelatedEntryID *uint    `gorm:"type:bigint;index" json:"relatedEntryId,omitempty"` // Link to the other side of an exchange/settlement

	CreatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	CreatedBy uint      `gorm:"type:bigint" json:"createdBy"` // User ID

	// Relations
	Client Client  `gorm:"foreignKey:ClientID;constraint:OnDelete:CASCADE" json:"-"`
	Tenant Tenant  `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"-"`
	Branch *Branch `gorm:"foreignKey:BranchID;constraint:OnDelete:SET NULL" json:"branch,omitempty"`
}

// Ledger Entry Types - describe the business context of the entry.
// The Amount sign determines whether it's a credit (+) or debit (-).
const (
	// LedgerTypeDeposit - Client deposits funds (Amount should be positive = credit)
	LedgerTypeDeposit = "DEPOSIT"

	// LedgerTypeWithdrawal - Client withdraws funds (Amount should be negative = debit)
	LedgerTypeWithdrawal = "WITHDRAWAL"

	// LedgerTypeExchangeIn - Client receives currency from FX (Amount positive = credit)
	// Example: Client buys 650 CAD, Amount = +650 CAD
	LedgerTypeExchangeIn = "FX_BUY"

	// LedgerTypeExchangeOut - Client gives currency in FX (Amount negative = debit)
	// Example: Client sells 500 USD, Amount = -500 USD
	LedgerTypeExchangeOut = "FX_SELL"

	// LedgerTypeSettlement - Settlement between parties
	LedgerTypeSettlement = "SETTLEMENT"

	// LedgerTypeReversal - Reversal of a previous entry (cancelled payment, etc.)
	// Amount sign is opposite of the original entry being reversed
	LedgerTypeReversal = "REVERSAL"

	// LedgerTypeAdjustment - Manual adjustment by operator
	LedgerTypeAdjustment = "ADJUSTMENT"
)

// Legacy aliases for backward compatibility
const (
	LedgerTypeExchangeInLegacy  = "EXCHANGE_IN"
	LedgerTypeExchangeOutLegacy = "EXCHANGE_OUT"
)
