package models

import (
	"time"

	"gorm.io/gorm"
)

// Customer represents a global customer across all tenants
// This is intentionally NOT tenant-scoped to enable cross-tenant customer identification
type Customer struct {
	ID        uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	Phone     string         `gorm:"type:varchar(50);uniqueIndex;not null" json:"phone"` // Primary identifier
	FullName  string         `gorm:"type:varchar(255);not null" json:"fullName"`
	Email     *string        `gorm:"type:varchar(255)" json:"email"` // Optional
	CreatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"` // Soft delete support

	// Relations
	TenantLinks []CustomerTenantLink `gorm:"foreignKey:CustomerID;constraint:OnDelete:CASCADE" json:"tenantLinks,omitempty"`
}

// TableName specifies the table name for Customer model
func (Customer) TableName() string {
	return "customers"
}

// CustomerTenantLink represents the many-to-many relationship between customers and tenants
// Tracks which tenants have interacted with which customers
type CustomerTenantLink struct {
	ID                 uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	CustomerID         uint      `gorm:"type:bigint;not null;index" json:"customerId"`
	TenantID           uint      `gorm:"type:bigint;not null;index" json:"tenantId"`
	FirstTransactionAt time.Time `gorm:"type:timestamp;not null" json:"firstTransactionAt"`
	LastTransactionAt  time.Time `gorm:"type:timestamp;not null" json:"lastTransactionAt"`
	TotalTransactions  int       `gorm:"type:integer;default:0" json:"totalTransactions"`
	CreatedAt          time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt          time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	Customer *Customer `gorm:"foreignKey:CustomerID;constraint:OnDelete:CASCADE" json:"customer,omitempty"`
	Tenant   *Tenant   `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
}

// TableName specifies the table name for CustomerTenantLink model
func (CustomerTenantLink) TableName() string {
	return "customer_tenant_links"
}

// Unique constraint: one link per customer per tenant
func (CustomerTenantLink) UniqueConstraints() [][]string {
	return [][]string{
		{"customer_id", "tenant_id"},
	}
}
