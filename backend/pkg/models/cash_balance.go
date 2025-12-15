package models

import (
	"time"
)

// CashBalance represents the cash balance for a tenant in a specific currency
type CashBalance struct {
	ID                     uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID               uint       `gorm:"type:bigint;not null;index" json:"tenantId"`
	BranchID               *uint      `gorm:"type:bigint;index" json:"branchId"` // NULL for company-wide balance
	Currency               string     `gorm:"type:varchar(10);not null" json:"currency"`
	Version                int        `gorm:"not null;default:0" json:"version"`
	AutoCalculatedBalance  float64    `gorm:"type:real;not null;default:0" json:"autoCalculatedBalance"`
	ManualAdjustment       float64    `gorm:"type:real;not null;default:0" json:"manualAdjustment"`
	FinalBalance           float64    `gorm:"type:real;not null;default:0" json:"finalBalance"` // Auto + Manual
	LastCalculatedAt       time.Time  `gorm:"type:timestamp" json:"lastCalculatedAt"`
	LastManualAdjustmentAt *time.Time `gorm:"type:timestamp" json:"lastManualAdjustmentAt"`
	CreatedAt              time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt              time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Tenant *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	Branch *Branch `gorm:"foreignKey:BranchID;constraint:OnDelete:CASCADE" json:"branch,omitempty"`
}

// TableName specifies the table name for CashBalance model
func (CashBalance) TableName() string {
	return "cash_balances"
}

// CashAdjustment represents manual adjustments to cash balance
type CashAdjustment struct {
	ID            uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID      uint      `gorm:"type:bigint;not null;index" json:"tenantId"`
	BranchID      *uint     `gorm:"type:bigint;index" json:"branchId"`
	Currency      string    `gorm:"type:varchar(10);not null" json:"currency"`
	Amount        float64   `gorm:"type:real;not null" json:"amount"` // Positive or negative
	Reason        string    `gorm:"type:text;not null" json:"reason"`
	AdjustedBy    uint      `gorm:"type:bigint;not null" json:"adjustedBy"`
	BalanceBefore float64   `gorm:"type:real;not null" json:"balanceBefore"`
	BalanceAfter  float64   `gorm:"type:real;not null" json:"balanceAfter"`
	CreatedAt     time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`

	// Relations
	Tenant         *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	Branch         *Branch `gorm:"foreignKey:BranchID;constraint:OnDelete:CASCADE" json:"branch,omitempty"`
	AdjustedByUser *User   `gorm:"foreignKey:AdjustedBy;constraint:OnDelete:SET NULL" json:"adjustedByUser,omitempty"`
}

// TableName specifies the table name for CashAdjustment model
func (CashAdjustment) TableName() string {
	return "cash_adjustments"
}
