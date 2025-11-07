package models

import (
	"time"
)

// User represents a user in the system
type User struct {
	ID               uint       `gorm:"primaryKey;autoIncrement" json:"id"`
	Email            string     `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash     string     `gorm:"type:varchar(255);not null" json:"-"` // Never send password in JSON
	EmailVerified    bool       `gorm:"type:boolean;default:false" json:"emailVerified"`
	VerificationCode *string    `gorm:"type:varchar(10)" json:"-"` // 6-digit code
	CodeExpiresAt    *time.Time `gorm:"type:timestamp" json:"-"`
	TenantID         *uint      `gorm:"type:bigint;index" json:"tenantId"` // Nullable for SuperAdmin
	Role             string     `gorm:"type:varchar(50);not null;default:'tenant_user'" json:"role"` // superadmin, tenant_owner, tenant_admin, tenant_user
	TrialEndsAt      *time.Time `gorm:"type:timestamp" json:"trialEndsAt"`
	Status           string     `gorm:"type:varchar(50);not null;default:'active'" json:"status"` // active, suspended, trial_expired, license_expired
	CreatedAt        time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt        time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Tenant *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:SET NULL" json:"tenant,omitempty"`
}

// TableName specifies the table name for User model
func (User) TableName() string {
	return "users"
}

// UserRole constants
const (
	RoleSuperAdmin  = "superadmin"
	RoleTenantOwner = "tenant_owner"
	RoleTenantAdmin = "tenant_admin"
	RoleTenantUser  = "tenant_user"
)

// UserStatus constants
const (
	StatusActive         = "active"
	StatusSuspended      = "suspended"
	StatusTrialExpired   = "trial_expired"
	StatusLicenseExpired = "license_expired"
)
