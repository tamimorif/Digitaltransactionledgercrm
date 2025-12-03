package models

import (
	"time"
)

// RefreshToken represents a refresh token for extended authentication
type RefreshToken struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint      `gorm:"not null;index" json:"userId"`
	Token     string    `gorm:"type:varchar(500);uniqueIndex;not null" json:"token"`
	ExpiresAt time.Time `gorm:"not null" json:"expiresAt"`
	IsRevoked bool      `gorm:"default:false" json:"isRevoked"`
	CreatedAt time.Time `gorm:"default:CURRENT_TIMESTAMP" json:"createdAt"`

	// Relations
	User User `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"-"`
}

// TableName specifies the table name for RefreshToken model
func (RefreshToken) TableName() string {
	return "refresh_tokens"
}
