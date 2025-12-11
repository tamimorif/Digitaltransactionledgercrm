package models

import (
	"time"

	"gorm.io/gorm"
)

// Client represents a client in the system
type Client struct {
	ID          string         `gorm:"primaryKey;type:text" json:"id"`
	TenantID    uint           `gorm:"type:bigint;not null;index" json:"tenantId"` // *** ADDED FOR TENANT ISOLATION ***
	Name        string         `gorm:"type:text;not null" json:"name"`
	PhoneNumber string         `gorm:"column:phone_number;type:text;not null" json:"phoneNumber"`
	Email       *string        `gorm:"type:text" json:"email"`
	JoinDate    time.Time      `gorm:"column:join_date;type:datetime;default:CURRENT_TIMESTAMP" json:"joinDate"`
	CreatedAt   time.Time      `gorm:"column:created_at;type:datetime;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time      `gorm:"column:updated_at;type:datetime;autoUpdateTime" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"` // Soft delete support

	Transactions []Transaction `gorm:"foreignKey:ClientID;constraint:OnDelete:CASCADE" json:"transactions"`
	Tenant       Tenant        `gorm:"foreignKey:TenantID;constraint:OnDelete:RESTRICT" json:"tenant,omitempty"`
}

// TableName specifies the table name for a Client model
func (Client) TableName() string {
	return "clients"
}

// Transaction represents a financial transaction
type Transaction struct {
	ID                 string  `gorm:"primaryKey;type:text" json:"id"`
	TenantID           uint    `gorm:"type:bigint;not null;index" json:"tenantId"` // *** ADDED FOR TENANT ISOLATION ***
	BranchID           *uint   `gorm:"type:bigint;index" json:"branchId"`          // Which branch created this transaction
	ClientID           string  `gorm:"column:client_id;type:text;not null;index" json:"clientId"`
	Type               string  `gorm:"type:text;not null" json:"type"` // "CASH_EXCHANGE" or "BANK_TRANSFER"
	SendCurrency       string  `gorm:"column:send_currency;type:text;not null" json:"sendCurrency"`
	SendAmount         float64 `gorm:"column:send_amount;type:real;not null" json:"sendAmount"`
	ReceiveCurrency    string  `gorm:"column:receive_currency;type:text;not null" json:"receiveCurrency"`
	ReceiveAmount      float64 `gorm:"column:receive_amount;type:real;not null" json:"receiveAmount"`
	RateApplied        float64 `gorm:"column:rate_applied;type:real;not null" json:"rateApplied"`
	FeeCharged         float64 `gorm:"column:fee_charged;type:real;default:0" json:"feeCharged"`
	BeneficiaryName    *string `gorm:"column:beneficiary_name;type:text" json:"beneficiaryName"`
	BeneficiaryDetails *string `gorm:"column:beneficiary_details;type:text" json:"beneficiaryDetails"`
	UserNotes          *string `gorm:"column:user_notes;type:text" json:"userNotes"`
	// Profit & Loss Tracking (NEW)
	StandardRate float64 `gorm:"column:standard_rate;type:real;default:0" json:"standardRate"` // Market/Base rate at time of transaction
	Profit       float64 `gorm:"column:profit;type:real;default:0" json:"profit"`              // Calculated profit

	// Multi-Payment Support (NEW)
	TotalReceived       float64    `gorm:"column:total_received;type:real" json:"totalReceived"`                               // Total amount client gave us
	ReceivedCurrency    string     `gorm:"column:received_currency;type:varchar(10)" json:"receivedCurrency"`                  // Currency of total received
	TotalPaid           float64    `gorm:"column:total_paid;type:real;default:0" json:"totalPaid"`                             // Sum of all payments made
	RemainingBalance    float64    `gorm:"column:remaining_balance;type:real;default:0" json:"remainingBalance"`               // Total - Paid
	PaymentStatus       string     `gorm:"column:payment_status;type:varchar(50);default:'SINGLE'" json:"paymentStatus"`       // SINGLE, OPEN, PARTIAL, COMPLETED
	AllowPartialPayment bool       `gorm:"column:allow_partial_payment;type:boolean;default:false" json:"allowPartialPayment"` // Enable multi-payment mode
	IsEdited            bool       `gorm:"column:is_edited;type:boolean;default:false" json:"isEdited"`
	LastEditedAt        *time.Time `gorm:"column:last_edited_at;type:datetime" json:"lastEditedAt"`
	EditedByBranchID    *uint      `gorm:"column:edited_by_branch_id;type:bigint" json:"editedByBranchId"`  // *** ADDED FOR AUDIT ***
	EditHistory         *string    `gorm:"column:edit_history;type:text" json:"editHistory"`                // JSON string
	Status              string     `gorm:"column:status;type:text;default:'COMPLETED';index" json:"status"` // COMPLETED or CANCELLED
	CancellationReason  *string    `gorm:"column:cancellation_reason;type:text" json:"cancellationReason,omitempty"`
	CancelledAt         *time.Time `gorm:"column:cancelled_at;type:datetime" json:"cancelledAt,omitempty"`
	CancelledBy         *uint      `gorm:"column:cancelled_by;type:bigint" json:"cancelledBy,omitempty"` // User ID who cancelled
	TransactionDate     time.Time  `gorm:"column:transaction_date;type:datetime;default:CURRENT_TIMESTAMP;index" json:"transactionDate"`
	CreatedAt           time.Time  `gorm:"column:created_at;type:datetime;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt           time.Time  `gorm:"column:updated_at;type:datetime;autoUpdateTime" json:"updatedAt"`

	Client   Client    `gorm:"foreignKey:ClientID;constraint:OnDelete:CASCADE" json:"client"`
	Tenant   Tenant    `gorm:"foreignKey:TenantID;constraint:OnDelete:RESTRICT" json:"tenant,omitempty"`
	Branch   *Branch   `gorm:"foreignKey:BranchID;constraint:OnDelete:SET NULL" json:"branch,omitempty"`
	Payments []Payment `gorm:"foreignKey:TransactionID;constraint:OnDelete:CASCADE" json:"payments,omitempty"` // NEW: List of partial payments
}

// TableName specifies the table name for a Transaction model
func (Transaction) TableName() string {
	return "transactions"
}

// Transaction Type Constants
const (
	TypeCashExchange   = "CASH_EXCHANGE"
	TypeBankTransfer   = "BANK_TRANSFER"
	TypeMoneyPickup    = "MONEY_PICKUP"
	TypeWalkInCustomer = "WALK_IN_CUSTOMER"
)

// Transaction Status Constants
const (
	StatusCompleted = "COMPLETED"
	StatusCancelled = "CANCELLED"
)

// PaymentStatus constants for multi-payment transactions
const (
	PaymentStatusSingle    = "SINGLE"     // Regular single-payment transaction (default)
	PaymentStatusOpen      = "OPEN"       // Multi-payment: No payments yet
	PaymentStatusPartial   = "PARTIAL"    // Multi-payment: Some payments made
	PaymentStatusFullyPaid = "FULLY_PAID" // Multi-payment: Fully paid
)
