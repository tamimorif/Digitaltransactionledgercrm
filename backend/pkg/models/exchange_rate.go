package models

import (
	"time"
)

// ExchangeRate represents an exchange rate between two currencies
type ExchangeRate struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	TenantID       uint      `gorm:"type:bigint;not null;index" json:"tenantId"`
	BaseCurrency   string    `gorm:"type:varchar(10);not null" json:"baseCurrency"`
	TargetCurrency string    `gorm:"type:varchar(10);not null" json:"targetCurrency"`
	Rate           Decimal   `gorm:"type:decimal(20,6);not null" json:"rate"`
	Source         string    `gorm:"type:varchar(20);not null" json:"source"` // "API" or "MANUAL"
	CreatedAt      time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt      time.Time `gorm:"type:timestamp;autoUpdateTime" json:"updatedAt"`

	Tenant Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
}

// TableName specifies the table name for ExchangeRate model
func (ExchangeRate) TableName() string {
	return "exchange_rates"
}

// Source constants
const (
	RateSourceAPI    = "API"
	RateSourceManual = "MANUAL"
)
