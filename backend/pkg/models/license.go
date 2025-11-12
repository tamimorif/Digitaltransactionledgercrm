package models

import (
	"time"
)

// License represents a software license in the system
type License struct {
	ID            uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	LicenseKey    string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"licenseKey"`
	LicenseType   string     `gorm:"type:varchar(50);not null" json:"licenseType"` // trial, starter, professional, business, enterprise, custom
	UserLimit     int        `gorm:"type:int;not null" json:"userLimit"`
	MaxBranches   int        `gorm:"type:int;not null;default:1" json:"maxBranches"`                   // 1, 3, or -1 for unlimited
	DurationType  string     `gorm:"type:varchar(50);not null;default:'lifetime'" json:"durationType"` // lifetime, monthly, yearly, custom_days
	DurationValue *int       `gorm:"type:int" json:"durationValue"`                                    // Number of days for custom duration
	ExpiresAt     *time.Time `gorm:"type:timestamp" json:"expiresAt"`                                  // NULL for lifetime licenses
	Status        string     `gorm:"type:varchar(50);not null;default:'unused'" json:"status"`         // unused, active, expired, revoked
	TenantID      *uint      `gorm:"type:bigint;index" json:"tenantId"`                                // NULL until activated
	ActivatedAt   *time.Time `gorm:"type:timestamp" json:"activatedAt"`
	CreatedBy     uint       `gorm:"type:bigint;not null" json:"createdBy"` // SuperAdmin who created it
	Notes         string     `gorm:"type:text" json:"notes"`                // Custom notes for custom licenses
	CreatedAt     time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt     time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Tenant        *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:SET NULL" json:"tenant,omitempty"`
	CreatedByUser User    `gorm:"foreignKey:CreatedBy;constraint:OnDelete:RESTRICT" json:"createdByUser,omitempty"`
}

// TableName specifies the table name for License model
func (License) TableName() string {
	return "licenses"
}

// LicenseType constants
const (
	LicenseTypeTrial        = "trial"
	LicenseTypeStarter      = "starter"
	LicenseTypeProfessional = "professional"
	LicenseTypeBusiness     = "business"
	LicenseTypeEnterprise   = "enterprise"
	LicenseTypeCustom       = "custom"
)

// DurationType constants
const (
	DurationLifetime   = "lifetime"
	DurationMonthly    = "monthly"
	DurationYearly     = "yearly"
	DurationCustomDays = "custom_days"
)

// LicenseStatus constants
const (
	LicenseStatusUnused  = "unused"
	LicenseStatusActive  = "active"
	LicenseStatusExpired = "expired"
	LicenseStatusRevoked = "revoked"
)

// GetDefaultUserLimit returns the default user limit for a license type
func GetDefaultUserLimit(licenseType string) int {
	switch licenseType {
	case LicenseTypeTrial:
		return 1
	case LicenseTypeStarter:
		return 5
	case LicenseTypeProfessional:
		return 20
	case LicenseTypeBusiness:
		return 50
	case LicenseTypeEnterprise:
		return 999999 // Effectively unlimited
	default:
		return 1
	}
}
