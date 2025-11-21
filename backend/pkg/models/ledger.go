package models

import (
	"time"
)

// LedgerEntry represents a single entry in the client's multi-currency ledger
type LedgerEntry struct {
	ID            uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID      uint    `gorm:"type:bigint;not null;index" json:"tenantId"`
	ClientID      string  `gorm:"type:text;not null;index" json:"clientId"`
	BranchID      *uint   `gorm:"type:bigint;index" json:"branchId"`              // Branch that performed the action
	TransactionID *string `gorm:"type:text;index" json:"transactionId,omitempty"` // Optional link to a main transaction

	Type     string  `gorm:"type:varchar(50);not null" json:"type"` // DEPOSIT, WITHDRAWAL, EXCHANGE_IN, EXCHANGE_OUT, SETTLEMENT
	Currency string  `gorm:"type:varchar(10);not null" json:"currency"`
	Amount   float64 `gorm:"type:decimal(20,2);not null" json:"amount"` // Positive for credit (we owe client), Negative for debit (client owes us)

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

// Ledger Entry Types
const (
	LedgerTypeDeposit     = "DEPOSIT"
	LedgerTypeWithdrawal  = "WITHDRAWAL"
	LedgerTypeExchangeIn  = "EXCHANGE_IN"  // Buying currency from client (Credit client)
	LedgerTypeExchangeOut = "EXCHANGE_OUT" // Selling currency to client (Debit client)
	LedgerTypeSettlement  = "SETTLEMENT"
)
