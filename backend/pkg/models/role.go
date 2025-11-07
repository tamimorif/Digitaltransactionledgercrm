package models

import (
	"time"
)

// Role represents a user role in the system
type Role struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"type:varchar(50);uniqueIndex;not null" json:"name"` // tenant_owner, tenant_admin, tenant_user
	DisplayName string    `gorm:"type:varchar(100);not null" json:"displayName"`
	Description string    `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Permissions []RolePermission `gorm:"foreignKey:RoleID" json:"permissions,omitempty"`
}

// TableName specifies the table name for Role model
func (Role) TableName() string {
	return "roles"
}

// RolePermission represents the mapping between roles and features
type RolePermission struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	RoleID    uint      `gorm:"type:bigint;not null;index" json:"roleId"`
	Feature   string    `gorm:"type:varchar(100);not null" json:"feature"` // From Feature constants
	CanAccess bool      `gorm:"type:boolean;default:true" json:"canAccess"`
	CreatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Role Role `gorm:"foreignKey:RoleID;constraint:OnDelete:CASCADE" json:"role,omitempty"`
}

// TableName specifies the table name for RolePermission model
func (RolePermission) TableName() string {
	return "role_permissions"
}

// Feature constants - Hard-coded features in the system
const (
	FeatureViewTransactions      = "VIEW_TRANSACTIONS"
	FeatureCreateTransaction     = "CREATE_TRANSACTION"
	FeatureEditTransaction       = "EDIT_TRANSACTION"
	FeatureDeleteTransaction     = "DELETE_TRANSACTION"
	FeatureViewClients           = "VIEW_CLIENTS"
	FeatureManageClients         = "MANAGE_CLIENTS"
	FeatureViewReports           = "VIEW_REPORTS"
	FeatureManageUsers           = "MANAGE_USERS"
	FeatureManageTenantSettings  = "MANAGE_TENANT_SETTINGS"
	FeatureSuperAdminPanel       = "SUPER_ADMIN_PANEL"
	FeatureManageLicenses        = "MANAGE_LICENSES"
	FeatureViewAllTenants        = "VIEW_ALL_TENANTS"
)

// AllFeatures returns a list of all available features
func AllFeatures() []string {
	return []string{
		FeatureViewTransactions,
		FeatureCreateTransaction,
		FeatureEditTransaction,
		FeatureDeleteTransaction,
		FeatureViewClients,
		FeatureManageClients,
		FeatureViewReports,
		FeatureManageUsers,
		FeatureManageTenantSettings,
		FeatureSuperAdminPanel,
		FeatureManageLicenses,
		FeatureViewAllTenants,
	}
}
