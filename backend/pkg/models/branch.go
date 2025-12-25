package models

import (
	"time"
)

// Branch represents a physical branch/location of a tenant's business
type Branch struct {
	ID         uint   `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID   uint   `gorm:"type:bigint;not null;index;uniqueIndex:idx_tenant_branch_code;uniqueIndex:idx_tenant_username" json:"tenantId"`
	Name       string `gorm:"type:varchar(255);not null" json:"name"`                                // e.g., "Toronto Downtown"
	Location   string `gorm:"type:text" json:"location"`                                             // Address (optional)
	BranchCode string `gorm:"type:varchar(50);uniqueIndex:idx_tenant_branch_code" json:"branchCode"` // Unique within tenant
	IsPrimary  bool   `gorm:"type:boolean;default:false" json:"isPrimary"`                           // Main branch
	Status     string `gorm:"type:varchar(50);not null;default:'active'" json:"status"`              // active or inactive

	// Branch Login Credentials (optional - can be NULL)
	Username     *string `gorm:"type:varchar(100);uniqueIndex:idx_tenant_username" json:"username,omitempty"` // Branch login username (unique within tenant)
	PasswordHash *string `gorm:"type:varchar(255)" json:"-"`                                                  // Hashed password (hidden from JSON, nullable)

	CreatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Tenant       *Tenant       `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	Transactions []Transaction `gorm:"foreignKey:BranchID" json:"transactions,omitempty"`
	Users        []User        `gorm:"many2many:user_branches" json:"users,omitempty"`
}

// TableName specifies the table name for Branch model
func (Branch) TableName() string {
	return "branches"
}

// BranchStatus constants
const (
	BranchStatusActive   = "active"
	BranchStatusInactive = "inactive"
)

// UserBranch represents the junction table for user-branch relationship
type UserBranch struct {
	UserID      uint      `gorm:"primaryKey;type:bigint" json:"userId"`
	BranchID    uint      `gorm:"primaryKey;type:bigint" json:"branchId"`
	AccessLevel string    `gorm:"type:varchar(50);default:'staff'" json:"accessLevel"` // manager or staff
	CreatedAt   time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`

	// Relations
	User   *User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"user,omitempty"`
	Branch *Branch `gorm:"foreignKey:BranchID;constraint:OnDelete:CASCADE" json:"branch,omitempty"`
}

// TableName specifies the table name for UserBranch model
func (UserBranch) TableName() string {
	return "user_branches"
}

// UserBranch AccessLevel constants
const (
	AccessLevelManager = "manager"
	AccessLevelStaff   = "staff"
)
