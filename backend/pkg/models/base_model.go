package models

import (
	"time"

	"gorm.io/gorm"
)

// BaseModel contains common fields for all models with soft delete support
type BaseModel struct {
	CreatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`
}

// IsDeleted returns true if the record has been soft deleted
func (b BaseModel) IsDeleted() bool {
	return b.DeletedAt.Valid
}
