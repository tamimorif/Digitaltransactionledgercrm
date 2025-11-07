package models

import (
	"time"
)

// Client represents a client in the system
type Client struct {
	ID          string    `gorm:"primaryKey;type:text" json:"id"`
	TenantID    uint      `gorm:"type:bigint;not null;index" json:"tenantId"` // *** ADDED FOR TENANT ISOLATION ***
	Name        string    `gorm:"type:text;not null" json:"name"`
	PhoneNumber string    `gorm:"column:phone_number;type:text;not null" json:"phoneNumber"`
	Email       *string   `gorm:"type:text" json:"email"`
	JoinDate    time.Time `gorm:"column:join_date;type:datetime;default:CURRENT_TIMESTAMP" json:"joinDate"`
	CreatedAt   time.Time `gorm:"column:created_at;type:datetime;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at;type:datetime;autoUpdateTime" json:"updatedAt"`

	Transactions []Transaction `gorm:"foreignKey:ClientID;constraint:OnDelete:CASCADE" json:"transactions"`
	Tenant       Tenant        `gorm:"foreignKey:TenantID;constraint:OnDelete:RESTRICT" json:"tenant,omitempty"`
}

// TableName specifies the table name for a Client model
func (Client) TableName() string {
	return "clients"
}

// Transaction represents a financial transaction
type Transaction struct {
	ID                 string     `gorm:"primaryKey;type:text" json:"id"`
	TenantID           uint       `gorm:"type:bigint;not null;index" json:"tenantId"` // *** ADDED FOR TENANT ISOLATION ***
	ClientID           string     `gorm:"column:client_id;type:text;not null;index" json:"clientId"`
	Type               string     `gorm:"type:text;not null" json:"type"` // "CASH_EXCHANGE" or "BANK_TRANSFER"
	SendCurrency       string     `gorm:"column:send_currency;type:text;not null" json:"sendCurrency"`
	SendAmount         float64    `gorm:"column:send_amount;type:real;not null" json:"sendAmount"`
	ReceiveCurrency    string     `gorm:"column:receive_currency;type:text;not null" json:"receiveCurrency"`
	ReceiveAmount      float64    `gorm:"column:receive_amount;type:real;not null" json:"receiveAmount"`
	RateApplied        float64    `gorm:"column:rate_applied;type:real;not null" json:"rateApplied"`
	FeeCharged         float64    `gorm:"column:fee_charged;type:real;default:0" json:"feeCharged"`
	BeneficiaryName    *string    `gorm:"column:beneficiary_name;type:text" json:"beneficiaryName"`
	BeneficiaryDetails *string    `gorm:"column:beneficiary_details;type:text" json:"beneficiaryDetails"`
	UserNotes          *string    `gorm:"column:user_notes;type:text" json:"userNotes"`
	IsEdited           bool       `gorm:"column:is_edited;type:boolean;default:false" json:"isEdited"`
	LastEditedAt       *time.Time `gorm:"column:last_edited_at;type:datetime" json:"lastEditedAt"`
	EditHistory        *string    `gorm:"column:edit_history;type:text" json:"editHistory"` // JSON string
	TransactionDate    time.Time  `gorm:"column:transaction_date;type:datetime;default:CURRENT_TIMESTAMP;index" json:"transactionDate"`
	CreatedAt          time.Time  `gorm:"column:created_at;type:datetime;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"column:updated_at;type:datetime;autoUpdateTime" json:"updatedAt"`

	Client Client `gorm:"foreignKey:ClientID;constraint:OnDelete:CASCADE" json:"client"`
	Tenant Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:RESTRICT" json:"tenant,omitempty"`
}

// TableName specifies the table name for a Transaction model
func (Transaction) TableName() string {
	return "transactions"
}
