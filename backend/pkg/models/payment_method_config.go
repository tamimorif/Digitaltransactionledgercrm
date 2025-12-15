package models

import (
	"time"

	"gorm.io/gorm"
)

// PaymentMethodConfig allows tenants to configure which payment methods are available
// and set method-specific settings like fees and validation requirements
type PaymentMethodConfig struct {
	ID       uint  `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID uint  `gorm:"type:bigint;not null;uniqueIndex:idx_pmc_tenant_method" json:"tenantId"`
	BranchID *uint `gorm:"type:bigint;uniqueIndex:idx_pmc_tenant_method" json:"branchId"` // nil = applies to all branches

	// Method Configuration
	MethodType  string  `gorm:"type:varchar(50);not null;uniqueIndex:idx_pmc_tenant_method" json:"methodType"` // CASH, CARD, etc.
	DisplayName string  `gorm:"type:varchar(100);not null" json:"displayName"`                                 // Localized display name
	Description *string `gorm:"type:text" json:"description"`                                                  // Optional description

	// Validation Requirements
	RequiresReference bool     `gorm:"type:boolean;default:false" json:"requiresReference"` // Require receipt/reference number
	RequiresApproval  bool     `gorm:"type:boolean;default:false" json:"requiresApproval"`  // Require manager approval
	MinAmount         float64  `gorm:"type:decimal(20,2);default:0" json:"minAmount"`       // Minimum payment amount
	MaxAmount         *float64 `gorm:"type:decimal(20,2)" json:"maxAmount"`                 // Maximum payment amount (null = no limit)

	// Fee Configuration
	FeeType        string  `gorm:"type:varchar(20);default:'NONE'" json:"feeType"` // NONE, PERCENT, FLAT, PERCENT_PLUS_FLAT
	FeePercent     float64 `gorm:"type:decimal(5,4);default:0" json:"feePercent"`  // e.g., 0.0250 for 2.5%
	FlatFee        float64 `gorm:"type:decimal(20,2);default:0" json:"flatFee"`    // e.g., 1.50 CAD
	FeeCurrency    string  `gorm:"type:varchar(10);default:'CAD'" json:"feeCurrency"`
	FeeDescription *string `gorm:"type:text" json:"feeDescription"` // Shown to operator

	// Processing Configuration
	ProcessingNotes   *string `gorm:"type:text" json:"processingNotes"`   // Instructions for operator
	ValidationRules   *string `gorm:"type:json" json:"validationRules"`   // JSON: custom validation rules
	AllowedCurrencies *string `gorm:"type:json" json:"allowedCurrencies"` // JSON array: ["CAD", "USD"]

	// Status
	IsActive  bool `gorm:"type:boolean;default:true;index" json:"isActive"`
	SortOrder int  `gorm:"type:int;default:0" json:"sortOrder"` // Display order in UI

	// Timestamps
	CreatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`

	// Relations
	Tenant *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	Branch *Branch `gorm:"foreignKey:BranchID;constraint:OnDelete:CASCADE" json:"branch,omitempty"`
}

// TableName specifies the table name for PaymentMethodConfig
func (PaymentMethodConfig) TableName() string {
	return "payment_method_configs"
}

// PaymentMethodFeeType constants
const (
	FeeTypeNone            = "NONE"              // No fee
	FeeTypePercent         = "PERCENT"           // Percentage of amount
	FeeTypeFlat            = "FLAT"              // Flat fee
	FeeTypePercentPlusFlat = "PERCENT_PLUS_FLAT" // Both percentage and flat
)

// CalculateFee calculates the fee for a given payment amount
func (pmc *PaymentMethodConfig) CalculateFee(amount float64) float64 {
	switch pmc.FeeType {
	case FeeTypePercent:
		return amount * pmc.FeePercent
	case FeeTypeFlat:
		return pmc.FlatFee
	case FeeTypePercentPlusFlat:
		return (amount * pmc.FeePercent) + pmc.FlatFee
	default:
		return 0
	}
}

// IsAmountValid checks if amount is within allowed limits
func (pmc *PaymentMethodConfig) IsAmountValid(amount float64) bool {
	if amount < pmc.MinAmount {
		return false
	}
	if pmc.MaxAmount != nil && amount > *pmc.MaxAmount {
		return false
	}
	return true
}
