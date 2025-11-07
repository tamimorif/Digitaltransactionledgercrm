package models

import (
	"time"
)

// Tenant represents a tenant/organization in the system
type Tenant struct {
	ID               uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	Name             string     `gorm:"type:varchar(255);not null" json:"name"`
	OwnerID          uint       `gorm:"type:bigint;not null;index" json:"ownerId"`
	CurrentLicenseID *uint      `gorm:"type:bigint;index" json:"currentLicenseId"`
	UserLimit        int        `gorm:"type:int;default:1" json:"userLimit"` // Copied from license
	Status           string     `gorm:"type:varchar(50);not null;default:'trial'" json:"status"` // trial, active, suspended, expired
	CreatedAt        time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt        time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Owner          User      `gorm:"foreignKey:OwnerID;constraint:OnDelete:RESTRICT" json:"owner"`
	CurrentLicense *License  `gorm:"foreignKey:CurrentLicenseID;constraint:OnDelete:SET NULL" json:"currentLicense,omitempty"`
	Users          []User    `gorm:"foreignKey:TenantID" json:"users,omitempty"`
	Clients        []Client  `gorm:"foreignKey:TenantID" json:"clients,omitempty"`
	Transactions   []Transaction `gorm:"foreignKey:TenantID" json:"transactions,omitempty"`
}

// TableName specifies the table name for Tenant model
func (Tenant) TableName() string {
	return "tenants"
}

// TenantStatus constants
const (
	TenantStatusTrial     = "trial"
	TenantStatusActive    = "active"
	TenantStatusSuspended = "suspended"
	TenantStatusExpired   = "expired"
)
