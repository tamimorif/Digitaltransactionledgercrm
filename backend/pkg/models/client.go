package models

import (
	"time"

	"gorm.io/gorm"
)

// Client represents a client/customer in the system
type Client struct {
	ID          string         `gorm:"primaryKey;type:text" json:"id"`
	TenantID    uint           `gorm:"type:bigint;not null;index" json:"tenantId"` // *** ADDED FOR TENANT ISOLATION ***
	Name        string         `gorm:"type:text;not null" json:"name" validate:"required,min=2"`
	PhoneNumber string         `gorm:"column:phone_number;type:text;not null" json:"phoneNumber" validate:"required"`
	Email       *string        `gorm:"type:text" json:"email" validate:"omitempty,email"`
	JoinDate    time.Time      `gorm:"column:join_date;type:datetime;default:CURRENT_TIMESTAMP" json:"joinDate"`
	CreatedAt   time.Time      `gorm:"column:created_at;type:datetime;default:CURRENT_TIMESTAMP;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time      `gorm:"column:updated_at;type:datetime;autoUpdateTime" json:"updatedAt"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"` // Soft delete support

	Transactions []Transaction `gorm:"foreignKey:ClientID;constraint:OnDelete:CASCADE" json:"transactions"`
	Tenant       Tenant        `gorm:"foreignKey:TenantID;constraint:OnDelete:RESTRICT" json:"tenant,omitempty"`
}

// TableName specifies the table name for a Client model
func (Client) TableName() string {
	return "clients"
}
