package models

import (
	"time"

	"gorm.io/gorm"
)

// TransferStatus defines the status of a transfer
type TransferStatus string

const (
	TransferStatusPending   TransferStatus = "PENDING"
	TransferStatusCompleted TransferStatus = "COMPLETED"
	TransferStatusCancelled TransferStatus = "CANCELLED"
	TransferStatusRejected  TransferStatus = "REJECTED"
)

// Transfer represents a cash transfer between branches
type Transfer struct {
	ID        uint           `gorm:"primarykey" json:"id"`
	CreatedAt time.Time      `json:"createdAt"`
	UpdatedAt time.Time      `json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	TenantID uint `gorm:"index" json:"tenantId"`

	SourceBranchID uint   `gorm:"index" json:"sourceBranchId"`
	SourceBranch   Branch `gorm:"foreignKey:SourceBranchID" json:"sourceBranch"`

	DestinationBranchID uint   `gorm:"index" json:"destinationBranchId"`
	DestinationBranch   Branch `gorm:"foreignKey:DestinationBranchID" json:"destinationBranch"`

	Amount   float64 `gorm:"type:decimal(20,2);not null" json:"amount"`
	Currency string  `gorm:"size:3;not null" json:"currency"`

	Status      TransferStatus `gorm:"size:20;default:'PENDING'" json:"status"`
	Description string         `json:"description"`

	CreatedByID uint `json:"createdById"`
	CreatedBy   User `gorm:"foreignKey:CreatedByID" json:"createdBy"`

	AcceptedByID *uint `json:"acceptedById"`
	AcceptedBy   *User `gorm:"foreignKey:AcceptedByID" json:"acceptedBy"`

	AcceptedAt *time.Time `json:"acceptedAt"`
}
