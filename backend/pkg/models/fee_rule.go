package models

import (
	"time"
)

// FeeRule represents a dynamic fee rule for transactions
type FeeRule struct {
	ID                 uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID           uint       `gorm:"type:bigint;not null;index" json:"tenantId"`
	Name               string     `gorm:"type:varchar(100);not null" json:"name"`
	Description        string     `gorm:"type:text" json:"description"`
	MinAmount          float64    `gorm:"type:real;default:0" json:"minAmount"`           // Minimum transaction amount
	MaxAmount          *float64   `gorm:"type:real" json:"maxAmount"`                     // Maximum transaction amount (nil = unlimited)
	SourceCurrency     string     `gorm:"type:varchar(3)" json:"sourceCurrency"`          // Empty = all currencies
	DestinationCountry string     `gorm:"type:varchar(2)" json:"destinationCountry"`      // Empty = all countries
	FeeType            string     `gorm:"type:varchar(20);default:'FLAT'" json:"feeType"` // FLAT, PERCENTAGE, COMBINED
	FlatFee            float64    `gorm:"type:real;default:0" json:"flatFee"`             // Flat fee amount
	PercentageFee      float64    `gorm:"type:real;default:0" json:"percentageFee"`       // Percentage fee (e.g., 0.02 = 2%)
	MinFee             float64    `gorm:"type:real;default:0" json:"minFee"`              // Minimum fee to charge
	MaxFee             *float64   `gorm:"type:real" json:"maxFee"`                        // Maximum fee cap (nil = no cap)
	Priority           int        `gorm:"type:int;default:100" json:"priority"`           // Lower = higher priority
	IsActive           bool       `gorm:"type:boolean;default:true" json:"isActive"`
	ValidFrom          *time.Time `gorm:"type:timestamp" json:"validFrom"`  // Optional: start date
	ValidUntil         *time.Time `gorm:"type:timestamp" json:"validUntil"` // Optional: end date
	CreatedAt          time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt          time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Tenant *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
}

// TableName specifies the table name for FeeRule model
func (FeeRule) TableName() string {
	return "fee_rules"
}

// FeeRule FeeType constants
const (
	FeeRuleTypeFlat       = "FLAT"       // Fixed amount fee
	FeeRuleTypePercentage = "PERCENTAGE" // Percentage-based fee
	FeeRuleTypeCombined   = "COMBINED"   // Flat + Percentage
)

// FeeCalculationResult represents the result of a fee calculation
type FeeCalculationResult struct {
	TotalFee       float64  `json:"totalFee"`
	FlatPortion    float64  `json:"flatPortion"`
	PercentPortion float64  `json:"percentPortion"`
	RuleApplied    *FeeRule `json:"ruleApplied,omitempty"`
	RuleName       string   `json:"ruleName"`
}
