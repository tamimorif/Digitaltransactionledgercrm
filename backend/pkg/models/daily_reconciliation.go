package models

import (
	"time"
)

// DailyReconciliation represents the daily cash count and reconciliation for a branch
type DailyReconciliation struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	TenantID          uint      `gorm:"type:bigint;not null;index" json:"tenantId"`
	BranchID          uint      `gorm:"type:bigint;not null;index" json:"branchId"`
	Date              time.Time `gorm:"type:date;not null;index" json:"date"`
	OpeningBalance    float64   `gorm:"type:real;not null" json:"openingBalance"`
	ClosingBalance    float64   `gorm:"type:real;not null" json:"closingBalance"`
	ExpectedBalance   float64   `gorm:"type:real;not null" json:"expectedBalance"`
	Variance          float64   `gorm:"type:real;not null" json:"variance"` // Closing - Expected
	CurrencyBreakdown string    `gorm:"type:text" json:"currencyBreakdown"` // JSON: {"USD": 5000, "CAD": 3000}
	Notes             *string   `gorm:"type:text" json:"notes,omitempty"`
	CreatedByUserID   uint      `gorm:"type:bigint;not null" json:"createdByUserId"`
	CreatedAt         time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt         time.Time `gorm:"type:timestamp;autoUpdateTime" json:"updatedAt"`

	Tenant Tenant  `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	Branch *Branch `gorm:"foreignKey:BranchID;constraint:OnDelete:CASCADE" json:"branch,omitempty"`
	User   *User   `gorm:"foreignKey:CreatedByUserID;constraint:OnDelete:SET NULL" json:"createdBy,omitempty"`
}

// TableName specifies the table name for DailyReconciliation model
func (DailyReconciliation) TableName() string {
	return "daily_reconciliations"
}
