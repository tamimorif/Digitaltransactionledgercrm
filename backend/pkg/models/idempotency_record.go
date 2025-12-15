package models

import "time"

// IdempotencyRecord stores the result of an idempotent request.
// This prevents duplicate creations on client retries/timeouts.
//
// Uniqueness is scoped by tenant + key + route template + method.
// Route should be a stable mux path template when available.
type IdempotencyRecord struct {
	ID uint `gorm:"primaryKey;autoIncrement" json:"id"`

	TenantID uint  `gorm:"type:bigint;not null;uniqueIndex:uidx_idem" json:"tenantId"`
	UserID   *uint `gorm:"type:bigint;index" json:"userId,omitempty"`

	Key    string `gorm:"type:varchar(128);not null;uniqueIndex:uidx_idem" json:"key"`
	Route  string `gorm:"type:varchar(255);not null;uniqueIndex:uidx_idem" json:"route"`
	Method string `gorm:"type:varchar(10);not null;uniqueIndex:uidx_idem" json:"method"`

	RequestHash string `gorm:"type:varchar(64);not null" json:"requestHash"`

	State      string `gorm:"type:varchar(20);not null;default:'IN_PROGRESS';index" json:"state"` // IN_PROGRESS, COMPLETED
	StatusCode int    `gorm:"not null;default:0" json:"statusCode"`
	// ResponseBody stores the raw response bytes (typically JSON).
	ResponseBody []byte `gorm:"type:bytea" json:"-"`

	CreatedAt   time.Time  `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	ExpiresAt   time.Time  `gorm:"type:timestamp;index" json:"expiresAt"`
	CompletedAt *time.Time `gorm:"type:timestamp" json:"completedAt,omitempty"`
}

func (IdempotencyRecord) TableName() string {
	return "idempotency_records"
}

const (
	IdemStateInProgress = "IN_PROGRESS"
	IdemStateCompleted  = "COMPLETED"
)
