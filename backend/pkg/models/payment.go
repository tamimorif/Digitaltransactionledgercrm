package models

import (
	"time"
)

// Payment represents a partial or full payment for a transaction
type Payment struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID      uint       `gorm:"type:bigint;not null;index" json:"tenantId"`
	TransactionID string     `gorm:"type:text;not null;index" json:"transactionId"` // Foreign Key to Transaction
	BranchID      *uint      `gorm:"type:bigint;index" json:"branchId"`             // Which branch made the payment
	
	// Payment Details
	Amount         float64 `gorm:"type:real;not null" json:"amount"`
	Currency       string  `gorm:"type:varchar(10);not null" json:"currency"`
	ExchangeRate   float64 `gorm:"type:real;default:1" json:"exchangeRate"` // Rate used to convert to transaction currency
	AmountInBase   float64 `gorm:"type:real;not null" json:"amountInBase"`  // Amount converted to transaction's base currency
	
	// Payment Method
	PaymentMethod string  `gorm:"type:varchar(50);not null;default:'CASH'" json:"paymentMethod"` // CASH, BANK_TRANSFER, CARD, CHEQUE, ONLINE
	
	// Tracking & Audit
	PaidBy        uint       `gorm:"type:bigint;not null" json:"paidBy"`         // User ID who recorded the payment
	Notes         *string    `gorm:"type:text" json:"notes"`                     // Optional notes
	ReceiptNumber *string    `gorm:"type:varchar(100)" json:"receiptNumber"`     // Receipt/Reference number
	Status        string     `gorm:"type:varchar(50);not null;default:'COMPLETED'" json:"status"` // PENDING, COMPLETED, FAILED, CANCELLED
	
	// Timestamps
	PaidAt    time.Time  `gorm:"type:timestamp;not null" json:"paidAt"`
	CreatedAt time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	
	// Edit History
	IsEdited      bool       `gorm:"type:boolean;default:false" json:"isEdited"`
	EditedAt      *time.Time `gorm:"type:timestamp" json:"editedAt"`
	EditedBy      *uint      `gorm:"type:bigint" json:"editedBy"` // User ID
	EditReason    *string    `gorm:"type:text" json:"editReason"`
	
	// Cancellation
	CancelledAt *time.Time `gorm:"type:timestamp" json:"cancelledAt"`
	CancelledBy *uint      `gorm:"type:bigint" json:"cancelledBy"`
	CancelReason *string   `gorm:"type:text" json:"cancelReason"`
	
	// Relations
	Tenant      Tenant       `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"-"`
	Transaction Transaction  `gorm:"foreignKey:TransactionID;constraint:OnDelete:CASCADE" json:"transaction,omitempty"`
	Branch      *Branch      `gorm:"foreignKey:BranchID;constraint:OnDelete:SET NULL" json:"branch,omitempty"`
	User        *User        `gorm:"foreignKey:PaidBy;constraint:OnDelete:SET NULL" json:"paidByUser,omitempty"`
	Editor      *User        `gorm:"foreignKey:EditedBy;constraint:OnDelete:SET NULL" json:"editedByUser,omitempty"`
	Canceller   *User        `gorm:"foreignKey:CancelledBy;constraint:OnDelete:SET NULL" json:"cancelledByUser,omitempty"`
}

// TableName specifies the table name for Payment model
func (Payment) TableName() string {
	return "payments"
}

// PaymentMethod constants
const (
	PaymentMethodCash         = "CASH"
	PaymentMethodBankTransfer = "BANK_TRANSFER"
	PaymentMethodCard         = "CARD"
	PaymentMethodCheque       = "CHEQUE"
	PaymentMethodOnline       = "ONLINE"
	PaymentMethodOther        = "OTHER"
)

// PaymentStatus constants
const (
	PaymentStatusPending   = "PENDING"
	PaymentStatusCompleted = "COMPLETED"
	PaymentStatusFailed    = "FAILED"
	PaymentStatusCancelled = "CANCELLED"
)
