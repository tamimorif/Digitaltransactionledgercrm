package models

import (
	"time"

	"gorm.io/gorm"
)

// OutgoingRemittance represents a remittance from Canada to Iran (creates debt for exchange)
// این حواله‌ای است که از کانادا به ایران ارسال می‌شود و بدهی برای صرافی ایجاد می‌کند
type OutgoingRemittance struct {
	ID             uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID       uint   `gorm:"type:bigint;not null;index:idx_outgoing_tenant_status_created" json:"tenantId"`
	BranchID       *uint  `gorm:"type:bigint;index" json:"branchId"`
	RemittanceCode string `gorm:"type:varchar(20);uniqueIndex;not null" json:"remittanceCode"` // Unique code like "OUT-001234"

	// Customer Info (Sender in Canada)
	SenderName  string  `gorm:"type:varchar(255);not null" json:"senderName"`
	SenderPhone string  `gorm:"type:varchar(50);not null;index:idx_outgoing_sender_phone" json:"senderPhone"`
	SenderEmail *string `gorm:"type:varchar(255)" json:"senderEmail"`

	// Recipient Info (Receiver in Iran)
	RecipientName    string  `gorm:"type:varchar(255);not null" json:"recipientName"`
	RecipientPhone   *string `gorm:"type:varchar(50);index:idx_outgoing_recipient_phone" json:"recipientPhone"`
	RecipientIBAN    *string `gorm:"type:varchar(50)" json:"recipientIban"`  // Iranian bank account
	RecipientBank    *string `gorm:"type:varchar(255)" json:"recipientBank"` // Bank name
	RecipientAddress *string `gorm:"type:text" json:"recipientAddress"`

	// Amount Info
	AmountIRR     float64 `gorm:"type:decimal(20,2);not null" json:"amountIrr"`     // Amount in Toman (e.g., 200,000,000)
	BuyRateCAD    float64 `gorm:"type:decimal(20,6);not null" json:"buyRateCad"`    // Exchange buy rate (e.g., 80,000 Toman/CAD)
	EquivalentCAD float64 `gorm:"type:decimal(20,2);not null" json:"equivalentCad"` // CAD equivalent = AmountIRR / BuyRateCAD
	ReceivedCAD   float64 `gorm:"type:decimal(20,2);not null" json:"receivedCad"`   // Amount received from customer in Canada
	FeeCAD        float64 `gorm:"type:decimal(20,2);default:0" json:"feeCAD"`       // Fee charged in CAD

	// Settlement Tracking
	SettledAmountIRR float64 `gorm:"type:decimal(20,2);default:0" json:"settledAmountIrr"`                                               // How much has been settled
	RemainingIRR     float64 `gorm:"type:decimal(20,2);not null;index:idx_outgoing_tenant_remaining" json:"remainingIrr"`                // Remaining debt
	Status           string  `gorm:"type:varchar(50);not null;default:'PENDING';index:idx_outgoing_tenant_status_created" json:"status"` // PENDING, PARTIAL, COMPLETED, CANCELLED

	// Profit Tracking
	TotalProfitCAD float64 `gorm:"type:decimal(20,2);default:0" json:"totalProfitCad"` // Total profit from this remittance
	TotalCostCAD   float64 `gorm:"type:decimal(20,2);not null" json:"totalCostCad"`    // Cost = EquivalentCAD

	// Additional Info
	Notes         *string `gorm:"type:text" json:"notes"`
	InternalNotes *string `gorm:"type:text" json:"internalNotes"` // Private notes for staff

	// Timestamps
	CreatedAt          time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP;index:idx_outgoing_tenant_status_created" json:"createdAt"`
	CreatedBy          uint           `gorm:"type:bigint;not null" json:"createdBy"` // User ID
	UpdatedAt          time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"` // Soft delete support
	CompletedAt        *time.Time     `gorm:"type:timestamp" json:"completedAt"`
	CancelledAt        *time.Time     `gorm:"type:timestamp" json:"cancelledAt"`
	CancelledBy        *uint          `gorm:"type:bigint" json:"cancelledBy"`
	CancellationReason *string        `gorm:"type:text" json:"cancellationReason"`

	// Relations
	Tenant      *Tenant                `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	Branch      *Branch                `gorm:"foreignKey:BranchID;constraint:OnDelete:SET NULL" json:"branch,omitempty"`
	Creator     *User                  `gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL" json:"creator,omitempty"`
	Settlements []RemittanceSettlement `gorm:"foreignKey:OutgoingRemittanceID;constraint:OnDelete:CASCADE" json:"settlements,omitempty"`
}

func (OutgoingRemittance) TableName() string {
	return "outgoing_remittances"
}

// IncomingRemittance represents a remittance from Iran to Canada (settles debt)
// این حواله‌ای است که از ایران به کانادا می‌آید و بدهی را تسویه می‌کند
type IncomingRemittance struct {
	ID             uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID       uint   `gorm:"type:bigint;not null;index:idx_incoming_tenant_status_created" json:"tenantId"`
	BranchID       *uint  `gorm:"type:bigint;index" json:"branchId"`
	RemittanceCode string `gorm:"type:varchar(20);uniqueIndex;not null" json:"remittanceCode"` // Unique code like "IN-001234"

	// Customer Info (Sender in Iran)
	SenderName  string  `gorm:"type:varchar(255);not null" json:"senderName"`
	SenderPhone string  `gorm:"type:varchar(50);not null;index:idx_incoming_sender_phone" json:"senderPhone"`
	SenderIBAN  *string `gorm:"type:varchar(50)" json:"senderIban"`
	SenderBank  *string `gorm:"type:varchar(255)" json:"senderBank"`

	// Recipient Info (Receiver in Canada)
	RecipientName    string  `gorm:"type:varchar(255);not null" json:"recipientName"`
	RecipientPhone   *string `gorm:"type:varchar(50)" json:"recipientPhone"`
	RecipientEmail   *string `gorm:"type:varchar(255)" json:"recipientEmail"`
	RecipientAddress *string `gorm:"type:text" json:"recipientAddress"`

	// Amount Info
	AmountIRR     float64 `gorm:"type:decimal(20,2);not null" json:"amountIrr"`     // Total sent from Iran (e.g., 80,000,000)
	SellRateCAD   float64 `gorm:"type:decimal(20,6);not null" json:"sellRateCad"`   // Exchange sell rate (e.g., 81,000 Toman/CAD)
	EquivalentCAD float64 `gorm:"type:decimal(20,2);not null" json:"equivalentCad"` // CAD to pay = AmountIRR / SellRateCAD
	PaidCAD       float64 `gorm:"type:decimal(20,2);default:0" json:"paidCad"`      // Amount paid to recipient
	FeeCAD        float64 `gorm:"type:decimal(20,2);default:0" json:"feeCAD"`       // Fee charged

	// Settlement Tracking
	AllocatedIRR float64 `gorm:"type:decimal(20,2);default:0" json:"allocatedIrr"`                                                   // How much allocated to settlements
	RemainingIRR float64 `gorm:"type:decimal(20,2);not null;index:idx_incoming_tenant_remaining" json:"remainingIrr"`                // Remaining to allocate
	Status       string  `gorm:"type:varchar(50);not null;default:'PENDING';index:idx_incoming_tenant_status_created" json:"status"` // PENDING, PARTIAL, COMPLETED, PAID, CANCELLED

	// Payment Info
	PaymentMethod    string  `gorm:"type:varchar(50);default:'CASH'" json:"paymentMethod"` // CASH, E_TRANSFER, BANK_TRANSFER, CHEQUE
	PaymentReference *string `gorm:"type:varchar(255)" json:"paymentReference"`

	// Additional Info
	Notes         *string `gorm:"type:text" json:"notes"`
	InternalNotes *string `gorm:"type:text" json:"internalNotes"`

	// Timestamps
	CreatedAt          time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP;index:idx_incoming_tenant_status_created" json:"createdAt"`
	CreatedBy          uint           `gorm:"type:bigint;not null" json:"createdBy"`
	UpdatedAt          time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt          gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"` // Soft delete support
	PaidAt             *time.Time     `gorm:"type:timestamp" json:"paidAt"`
	PaidBy             *uint          `gorm:"type:bigint" json:"paidBy"`
	CancelledAt        *time.Time     `gorm:"type:timestamp" json:"cancelledAt"`
	CancelledBy        *uint          `gorm:"type:bigint" json:"cancelledBy"`
	CancellationReason *string        `gorm:"type:text" json:"cancellationReason"`

	// Relations
	Tenant      *Tenant                `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	Branch      *Branch                `gorm:"foreignKey:BranchID;constraint:OnDelete:SET NULL" json:"branch,omitempty"`
	Creator     *User                  `gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL" json:"creator,omitempty"`
	Settlements []RemittanceSettlement `gorm:"foreignKey:IncomingRemittanceID;constraint:OnDelete:CASCADE" json:"settlements,omitempty"`
}

func (IncomingRemittance) TableName() string {
	return "incoming_remittances"
}

// RemittanceSettlement links incoming remittances to outgoing remittances
// این جدول حواله‌های ورودی را به حواله‌های خروجی متصل می‌کند (تسویه)
type RemittanceSettlement struct {
	ID                   uint `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID             uint `gorm:"type:bigint;not null;index" json:"tenantId"`
	OutgoingRemittanceID uint `gorm:"type:bigint;not null;index" json:"outgoingRemittanceId"` // The debt being settled
	IncomingRemittanceID uint `gorm:"type:bigint;not null;index" json:"incomingRemittanceId"` // The incoming used for settlement

	// Settlement Amount
	SettledAmountIRR float64 `gorm:"type:decimal(20,2);not null" json:"settledAmountIrr"` // Amount in Toman used for settlement

	// Rate Difference & Profit
	OutgoingBuyRate  float64 `gorm:"type:decimal(20,6);not null" json:"outgoingBuyRate"`  // Buy rate of outgoing
	IncomingSellRate float64 `gorm:"type:decimal(20,6);not null" json:"incomingSellRate"` // Sell rate of incoming
	ProfitCAD        float64 `gorm:"type:decimal(20,2);not null" json:"profitCad"`        // Profit from this settlement

	// Metadata
	Notes     *string   `gorm:"type:text" json:"notes"`
	CreatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	CreatedBy uint      `gorm:"type:bigint;not null" json:"createdBy"`

	// Relations
	Tenant             *Tenant             `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	OutgoingRemittance *OutgoingRemittance `gorm:"foreignKey:OutgoingRemittanceID;constraint:OnDelete:CASCADE" json:"outgoingRemittance,omitempty"`
	IncomingRemittance *IncomingRemittance `gorm:"foreignKey:IncomingRemittanceID;constraint:OnDelete:CASCADE" json:"incomingRemittance,omitempty"`
	Creator            *User               `gorm:"foreignKey:CreatedBy;constraint:OnDelete:SET NULL" json:"creator,omitempty"`
}

func (RemittanceSettlement) TableName() string {
	return "remittance_settlements"
}

// Remittance Status Constants
const (
	RemittanceStatusPending   = "PENDING"   // Not yet settled/paid
	RemittanceStatusPartial   = "PARTIAL"   // Partially settled/paid
	RemittanceStatusCompleted = "COMPLETED" // Fully settled (outgoing) or allocated (incoming)
	RemittanceStatusPaid      = "PAID"      // Payment made to recipient (incoming only)
	RemittanceStatusCancelled = "CANCELLED" // Cancelled
)
