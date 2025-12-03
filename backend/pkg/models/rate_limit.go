package models

import (
	"time"
)

// RateLimitEntry tracks API request counts per user/IP
type RateLimitEntry struct {
	ID          uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Identifier  string    `gorm:"type:varchar(255);not null;index" json:"identifier"` // IP address or user ID
	Endpoint    string    `gorm:"type:varchar(255);not null" json:"endpoint"`
	Count       int       `gorm:"default:0" json:"count"`
	WindowStart time.Time `gorm:"not null" json:"windowStart"`
	CreatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"updatedAt"`
}

// TableName specifies the table name for RateLimitEntry model
func (RateLimitEntry) TableName() string {
	return "rate_limit_entries"
}
