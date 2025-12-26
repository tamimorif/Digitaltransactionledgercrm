package models

import (
	"time"
)

// Disbursement represents a money disbursement/payout transaction between branches.
// This is the core entity for remittance payouts where money is sent from one branch
// and disbursed (picked up or transferred) at another.
//
// Business Context:
//   - Sender initiates transfer at Branch A
//   - Recipient receives funds at Branch B (cash pickup, bank transfer, etc.)
//   - PickupCode (Control Number) tracks the disbursement
//
// Note: Field names are kept for backward compatibility with existing code.
// JSON tags use professional banking terminology for API consumers.
type Disbursement struct {
	ID            uint    `gorm:"primaryKey;autoIncrement" json:"id"`
	TransactionID *string `gorm:"type:text;index" json:"transactionId"`
	TenantID      uint    `gorm:"type:bigint;not null;index" json:"tenantId"`

	// PickupCode is the Remittance Control Number (RCN)
	PickupCode       string `gorm:"type:varchar(10);uniqueIndex;not null" json:"controlNumber"`
	SenderBranchID   uint   `gorm:"type:bigint;not null;index" json:"senderBranchId"`
	ReceiverBranchID uint   `gorm:"type:bigint;not null;index" json:"receiverBranchId"`

	// Sender Details
	SenderName  string `gorm:"type:varchar(255);not null" json:"senderName"`
	SenderPhone string `gorm:"type:varchar(50)" json:"senderPhone"`

	// Recipient/Beneficiary Details
	RecipientName  string  `gorm:"type:varchar(255);not null" json:"recipientName"`
	RecipientPhone *string `gorm:"type:varchar(50)" json:"recipientPhone"`
	RecipientIBAN  *string `gorm:"type:varchar(50)" json:"recipientIban"`

	// TransactionType is the disbursement method (renamed in JSON to disbursementType)
	TransactionType string `gorm:"type:varchar(50);not null;default:'CASH_PAYOUT'" json:"disbursementType"`

	// Amount Details
	Amount           float64  `gorm:"type:real;not null" json:"amount"`
	Currency         string   `gorm:"type:varchar(10);not null" json:"currency"`
	ReceiverCurrency *string  `gorm:"type:varchar(10)" json:"receiverCurrency"`
	ExchangeRate     *float64 `gorm:"type:real;default:1" json:"exchangeRate"`
	ReceiverAmount   *float64 `gorm:"type:real" json:"receiverAmount"`
	Fees             float64  `gorm:"type:real;default:0" json:"fees"`

	// Status: PENDING, DISBURSED (PICKED_UP in DB), CANCELLED
	Status string `gorm:"type:varchar(50);not null;default:'PENDING'" json:"status"`

	// Edit Tracking
	EditedAt         *time.Time `gorm:"type:timestamp" json:"editedAt"`
	EditedByUserID   *uint      `gorm:"type:bigint" json:"editedByUserId"`
	EditedByBranchID *uint      `gorm:"type:bigint" json:"editedByBranchId"`
	EditReason       *string    `gorm:"type:text" json:"editReason"`

	// Disbursement Completion (PickedUp fields kept for DB compatibility)
	PickedUpAt       *time.Time `gorm:"type:timestamp" json:"disbursedAt"`
	PickedUpByUserID *uint      `gorm:"type:bigint" json:"disbursedByUserId"`

	// Cancellation
	CancelledAt        *time.Time `gorm:"type:timestamp" json:"cancelledAt"`
	CancelledByUserID  *uint      `gorm:"type:bigint" json:"cancelledByUserId"`
	CancellationReason *string    `gorm:"type:text" json:"cancellationReason"`

	Notes *string `gorm:"type:text" json:"notes"`

	// Payment fields
	AllowPartialPayment bool     `gorm:"type:boolean;default:false" json:"allowPartialPayment"`
	TotalReceived       *float64 `gorm:"type:real;default:0" json:"totalReceived"`
	ReceivedCurrency    *string  `gorm:"type:varchar(10)" json:"receivedCurrency"`
	TotalPaid           *float64 `gorm:"type:real;default:0" json:"totalPaid"`
	RemainingBalance    *float64 `gorm:"type:real;default:0" json:"remainingBalance"`
	PaymentStatus       *string  `gorm:"type:varchar(20);default:'SINGLE'" json:"paymentStatus"`

	CreatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Tenant          *Tenant      `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	SenderBranch    *Branch      `gorm:"foreignKey:SenderBranchID;constraint:OnDelete:RESTRICT" json:"senderBranch,omitempty"`
	ReceiverBranch  *Branch      `gorm:"foreignKey:ReceiverBranchID;constraint:OnDelete:RESTRICT" json:"receiverBranch,omitempty"`
	EditedByBranch  *Branch      `gorm:"foreignKey:EditedByBranchID;constraint:OnDelete:SET NULL" json:"editedByBranch,omitempty"`
	Transaction     *Transaction `gorm:"foreignKey:TransactionID;constraint:OnDelete:SET NULL" json:"transaction,omitempty"`
	PickedUpByUser  *User        `gorm:"foreignKey:PickedUpByUserID;constraint:OnDelete:SET NULL" json:"disbursedByUser,omitempty"`
	CancelledByUser *User        `gorm:"foreignKey:CancelledByUserID;constraint:OnDelete:SET NULL" json:"cancelledByUser,omitempty"`
	EditedByUser    *User        `gorm:"foreignKey:EditedByUserID;constraint:OnDelete:SET NULL" json:"editedByUser,omitempty"`
}

// TableName keeps the same database table for backward compatibility
func (Disbursement) TableName() string {
	return "pickup_transactions"
}

// DisbursementType constants (professional banking terminology)
const (
	DisbursementTypeCashPayout    = "CASH_PAYOUT"    // Cash pickup at branch
	DisbursementTypeBankTransfer  = "BANK_TRANSFER"  // Wire to bank account
	DisbursementTypeFXConversion  = "FX_CONVERSION"  // Currency exchange
	DisbursementTypeCardCredit    = "CARD_CREDIT"    // Credit to card
	DisbursementTypeIncomingFunds = "INCOMING_FUNDS" // Recording received funds
)

// DisbursementStatus constants
const (
	DisbursementStatusPending   = "PENDING"
	DisbursementStatusDisbursed = "DISBURSED" // New terminology (maps to PICKED_UP in legacy)
	DisbursementStatusCancelled = "CANCELLED"
)

// Legacy aliases for backward compatibility with existing data
const (
	// Legacy type values (for reading old records)
	LegacyTypeCashPickup   = "CASH_PICKUP"
	LegacyTypeCardSwapIRR  = "CARD_SWAP_IRR"
	LegacyTypeCashExchange = "CASH_EXCHANGE"

	// Legacy status values
	LegacyStatusPickedUp = "PICKED_UP"
)

// PickupTransaction is a type alias for backward compatibility
// Deprecated: Use Disbursement instead
type PickupTransaction = Disbursement
