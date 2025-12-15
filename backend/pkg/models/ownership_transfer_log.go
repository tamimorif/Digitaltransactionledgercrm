package models

import (
	"time"
)

// OwnershipTransferLog represents a log of tenant ownership transfers
type OwnershipTransferLog struct {
	ID             uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID       uint      `gorm:"type:bigint;not null;index" json:"tenantId"`
	OldOwnerID     uint      `gorm:"type:bigint;not null" json:"oldOwnerId"`
	NewOwnerID     uint      `gorm:"type:bigint;not null" json:"newOwnerId"`
	TransferredBy  uint      `gorm:"type:bigint;not null" json:"transferredBy"` // Who performed the transfer (SuperAdmin or OldOwner)
	TransferredAt  time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"transferredAt"`
	Reason         string    `gorm:"type:text" json:"reason"`

	// Relations
	Tenant       Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	OldOwner     User   `gorm:"foreignKey:OldOwnerID;constraint:OnDelete:RESTRICT" json:"oldOwner,omitempty"`
	NewOwner     User   `gorm:"foreignKey:NewOwnerID;constraint:OnDelete:RESTRICT" json:"newOwner,omitempty"`
	TransferredByUser User `gorm:"foreignKey:TransferredBy;constraint:OnDelete:RESTRICT" json:"transferredByUser,omitempty"`
}

// TableName specifies the table name for OwnershipTransferLog model
func (OwnershipTransferLog) TableName() string {
	return "ownership_transfer_logs"
}
