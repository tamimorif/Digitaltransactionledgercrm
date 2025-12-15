package models

import (
	"time"
)

// PasswordResetCode represents a password reset verification code
type PasswordResetCode struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	Email     string    `gorm:"type:varchar(255);index" json:"email"`
	Phone     string    `gorm:"type:varchar(50);index" json:"phone"`
	Code      string    `gorm:"type:varchar(10);not null" json:"code"`
	ExpiresAt time.Time `gorm:"type:timestamp;not null" json:"expiresAt"`
	Used      bool      `gorm:"type:boolean;default:false" json:"used"`
	CreatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
}

// TableName specifies the table name for PasswordResetCode model
func (PasswordResetCode) TableName() string {
	return "password_reset_codes"
}
