package models

import (
	"time"
)

// PickupTransaction represents a money pickup transaction between branches
type PickupTransaction struct {
	ID                 uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TransactionID      *string    `gorm:"type:text;index" json:"transactionId"` // Link to main transaction (optional)
	TenantID           uint       `gorm:"type:bigint;not null;index" json:"tenantId"`
	PickupCode         string     `gorm:"type:varchar(10);uniqueIndex;not null" json:"pickupCode"` // 6-digit unique code
	SenderBranchID     uint       `gorm:"type:bigint;not null;index" json:"senderBranchId"`
	ReceiverBranchID   uint       `gorm:"type:bigint;not null;index" json:"receiverBranchId"`
	SenderName         string     `gorm:"type:varchar(255);not null" json:"senderName"`
	SenderPhone        string     `gorm:"type:varchar(50)" json:"senderPhone"`
	RecipientName      string     `gorm:"type:varchar(255);not null" json:"recipientName"`
	RecipientPhone     string     `gorm:"type:varchar(50);not null" json:"recipientPhone"`
	Amount             float64    `gorm:"type:real;not null" json:"amount"`
	Currency           string     `gorm:"type:varchar(10);not null" json:"currency"`
	ReceiverCurrency   *string    `gorm:"type:varchar(10)" json:"receiverCurrency"` // Currency receiver will get
	ExchangeRate       *float64   `gorm:"type:real;default:1" json:"exchangeRate"`  // Exchange rate between currencies
	ReceiverAmount     *float64   `gorm:"type:real" json:"receiverAmount"`          // Amount in receiver currency
	Fees               float64    `gorm:"type:real;default:0" json:"fees"`
	Status             string     `gorm:"type:varchar(50);not null;default:'PENDING'" json:"status"` // PENDING, PICKED_UP, CANCELLED
	PickedUpAt         *time.Time `gorm:"type:timestamp" json:"pickedUpAt"`
	PickedUpByUserID   *uint      `gorm:"type:bigint" json:"pickedUpByUserId"`
	CancelledAt        *time.Time `gorm:"type:timestamp" json:"cancelledAt"`
	CancelledByUserID  *uint      `gorm:"type:bigint" json:"cancelledByUserId"`
	CancellationReason *string    `gorm:"type:text" json:"cancellationReason"`
	Notes              *string    `gorm:"type:text" json:"notes"`
	CreatedAt          time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Tenant          *Tenant      `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	SenderBranch    *Branch      `gorm:"foreignKey:SenderBranchID;constraint:OnDelete:RESTRICT" json:"senderBranch,omitempty"`
	ReceiverBranch  *Branch      `gorm:"foreignKey:ReceiverBranchID;constraint:OnDelete:RESTRICT" json:"receiverBranch,omitempty"`
	Transaction     *Transaction `gorm:"foreignKey:TransactionID;constraint:OnDelete:SET NULL" json:"transaction,omitempty"`
	PickedUpByUser  *User        `gorm:"foreignKey:PickedUpByUserID;constraint:OnDelete:SET NULL" json:"pickedUpByUser,omitempty"`
	CancelledByUser *User        `gorm:"foreignKey:CancelledByUserID;constraint:OnDelete:SET NULL" json:"cancelledByUser,omitempty"`
}

// TableName specifies the table name for PickupTransaction model
func (PickupTransaction) TableName() string {
	return "pickup_transactions"
}

// PickupStatus constants
const (
	PickupStatusPending   = "PENDING"
	PickupStatusPickedUp  = "PICKED_UP"
	PickupStatusCancelled = "CANCELLED"
)
