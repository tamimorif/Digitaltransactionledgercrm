package models

import (
	"time"
)

// SavedSearch represents a saved search filter
type SavedSearch struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID      uint      `gorm:"not null;index" json:"userId"`
	TenantID    uint      `gorm:"not null;index" json:"tenantId"`
	Name        string    `gorm:"type:varchar(255);not null" json:"name"`
	Description string    `gorm:"type:text" json:"description"`
	Entity      string    `gorm:"type:varchar(50);not null" json:"entity"` // "customer", "transaction", "remittance", etc.
	Filters     string    `gorm:"type:text;not null" json:"filters"`       // JSON string of filter criteria
	IsPublic    bool      `gorm:"default:false" json:"isPublic"`           // Share with team
	CreatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updatedAt"`

	// Relations
	User   User   `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
	Tenant Tenant `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"-"`
}

// TableName specifies the table name for SavedSearch model
func (SavedSearch) TableName() string {
	return "saved_searches"
}
