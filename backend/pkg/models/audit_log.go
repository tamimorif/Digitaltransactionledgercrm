package models

import (
	"time"
)

// AuditLog represents an audit trail of user actions
type AuditLog struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      uint      `gorm:"type:bigint;not null;index" json:"userId"`
	TenantID    *uint     `gorm:"type:bigint;index" json:"tenantId"`              // Nullable for SuperAdmin actions
	Action      string    `gorm:"type:varchar(100);not null;index" json:"action"` // CREATE, UPDATE, DELETE, LOGIN, etc.
	EntityType  string    `gorm:"type:varchar(50);not null" json:"entityType"`    // Transaction, Client, License, etc.
	EntityID    string    `gorm:"type:varchar(255)" json:"entityId"`              // ID of the affected entity
	Description string    `gorm:"type:text" json:"description"`                   // Human-readable description
	OldValues   *string   `gorm:"type:text" json:"oldValues"`                     // JSON string of old values (for updates)
	NewValues   *string   `gorm:"type:text" json:"newValues"`                     // JSON string of new values
	IPAddress   string    `gorm:"type:varchar(50)" json:"ipAddress"`
	UserAgent   string    `gorm:"type:varchar(500)" json:"userAgent"`
	CreatedAt   time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP;index" json:"createdAt"`

	// Relations
	User   User    `gorm:"foreignKey:UserID;constraint:OnDelete:RESTRICT" json:"user,omitempty"`
	Tenant *Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
}

// TableName specifies the table name for AuditLog model
func (AuditLog) TableName() string {
	return "audit_logs"
}

// AuditAction constants
const (
	ActionLogin             = "LOGIN"
	ActionLogout            = "LOGOUT"
	ActionRegister          = "REGISTER"
	ActionVerifyEmail       = "VERIFY_EMAIL"
	ActionCreateTransaction = "CREATE_TRANSACTION"
	ActionUpdateTransaction = "UPDATE_TRANSACTION"
	ActionDeleteTransaction = "DELETE_TRANSACTION"
	ActionCancelTransaction = "CANCEL_TRANSACTION"
	ActionCreateClient      = "CREATE_CLIENT"
	ActionUpdateClient      = "UPDATE_CLIENT"
	ActionDeleteClient      = "DELETE_CLIENT"
	ActionActivateLicense   = "ACTIVATE_LICENSE"
	ActionGenerateLicense   = "GENERATE_LICENSE"
	ActionRevokeLicense     = "REVOKE_LICENSE"
	ActionSuspendTenant     = "SUSPEND_TENANT"
	ActionActivateTenant    = "ACTIVATE_TENANT"
	ActionUpdateUser        = "UPDATE_USER"
	ActionDeleteUser        = "DELETE_USER"
	// Payment audit actions
	ActionCreatePayment = "CREATE_PAYMENT"
	ActionUpdatePayment = "UPDATE_PAYMENT"
	ActionDeletePayment = "DELETE_PAYMENT"
	ActionCancelPayment = "CANCEL_PAYMENT"
	// Remittance audit actions
	ActionCreateRemittance = "CREATE_REMITTANCE"
	ActionUpdateRemittance = "UPDATE_REMITTANCE"
	ActionSettleRemittance = "SETTLE_REMITTANCE"
	ActionCancelRemittance = "CANCEL_REMITTANCE"
)
