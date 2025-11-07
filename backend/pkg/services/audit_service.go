package services

import (
	"api/pkg/models"
	"encoding/json"
	"log"
	"net/http"

	"gorm.io/gorm"
)

// AuditService handles audit logging
type AuditService struct {
	DB *gorm.DB
}

// NewAuditService creates a new audit service instance
func NewAuditService(db *gorm.DB) *AuditService {
	return &AuditService{
		DB: db,
	}
}

// LogAction logs a user action to the audit trail
func (as *AuditService) LogAction(
	userID uint,
	tenantID *uint,
	action string,
	entityType string,
	entityID string,
	description string,
	oldValues interface{},
	newValues interface{},
	r *http.Request,
) error {
	// Convert values to JSON
	var oldJSON, newJSON *string
	if oldValues != nil {
		bytes, _ := json.Marshal(oldValues)
		str := string(bytes)
		oldJSON = &str
	}
	if newValues != nil {
		bytes, _ := json.Marshal(newValues)
		str := string(bytes)
		newJSON = &str
	}

	// Get IP and User-Agent from request
	ipAddress := getClientIP(r)
	userAgent := r.Header.Get("User-Agent")

	auditLog := &models.AuditLog{
		UserID:      userID,
		TenantID:    tenantID,
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityID,
		Description: description,
		OldValues:   oldJSON,
		NewValues:   newJSON,
		IPAddress:   ipAddress,
		UserAgent:   userAgent,
	}

	if err := as.DB.Create(auditLog).Error; err != nil {
		log.Printf("⚠️  Failed to create audit log: %v", err)
		return err
	}

	log.Printf("📝 Audit: User %d - %s %s (ID: %s)", userID, action, entityType, entityID)
	return nil
}

// GetAuditLogs retrieves audit logs with filters
func (as *AuditService) GetAuditLogs(tenantID *uint, limit int, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := as.DB.Preload("User")

	// Apply tenant filter (nil means SuperAdmin viewing all)
	if tenantID != nil {
		query = query.Where("tenant_id = ?", *tenantID)
	}

	// Get total count
	query.Model(&models.AuditLog{}).Count(&total)

	// Get paginated results
	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// getClientIP extracts client IP from request
func getClientIP(r *http.Request) string {
	// Try X-Forwarded-For header first
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return forwarded
	}

	// Try X-Real-IP header
	realIP := r.Header.Get("X-Real-IP")
	if realIP != "" {
		return realIP
	}

	// Fall back to RemoteAddr
	return r.RemoteAddr
}
