package services

import (
	"api/pkg/models"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"reflect"
	"time"

	"gorm.io/gorm"
)

// AuditAction constants for consistent action naming
const (
	AuditActionCreate        = "CREATE"
	AuditActionUpdate        = "UPDATE"
	AuditActionDelete        = "DELETE"
	AuditActionLogin         = "LOGIN"
	AuditActionLogout        = "LOGOUT"
	AuditActionPasswordReset = "PASSWORD_RESET"
	AuditActionActivate      = "ACTIVATE"
	AuditActionDeactivate    = "DEACTIVATE"
	AuditActionTransfer      = "TRANSFER"
	AuditActionPayment       = "PAYMENT"
	AuditActionSettlement    = "SETTLEMENT"
	AuditActionExport        = "EXPORT"
	AuditActionImport        = "IMPORT"
)

// AuditEntityType constants for consistent entity naming
const (
	AuditEntityUser         = "User"
	AuditEntityTenant       = "Tenant"
	AuditEntityLicense      = "License"
	AuditEntityBranch       = "Branch"
	AuditEntityClient       = "Client"
	AuditEntityCustomer     = "Customer"
	AuditEntityTransaction  = "Transaction"
	AuditEntityPayment      = "Payment"
	AuditEntityRemittance   = "Remittance"
	AuditEntitySettlement   = "Settlement"
	AuditEntityExchangeRate = "ExchangeRate"
	AuditEntityCashBalance  = "CashBalance"
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

// ChangedField represents a single field change
type ChangedField struct {
	Field    string      `json:"field"`
	OldValue interface{} `json:"oldValue"`
	NewValue interface{} `json:"newValue"`
}

// AuditSnapshot represents a complete snapshot with metadata
type AuditSnapshot struct {
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
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
	ipAddress := getAuditClientIP(r)
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

// LogActionAsync logs an action asynchronously (non-blocking)
func (as *AuditService) LogActionAsync(
	userID uint,
	tenantID *uint,
	action string,
	entityType string,
	entityID string,
	description string,
	oldValues interface{},
	newValues interface{},
	r *http.Request,
) {
	go func() {
		if err := as.LogAction(userID, tenantID, action, entityType, entityID, description, oldValues, newValues, r); err != nil {
			log.Printf("⚠️  Async audit log failed: %v", err)
		}
	}()
}

// LogCreate is a convenience method for create actions
func (as *AuditService) LogCreate(userID uint, tenantID *uint, entityType string, entityID string, entity interface{}, r *http.Request) error {
	snapshot := as.CreateSnapshot(entity)
	return as.LogAction(userID, tenantID, AuditActionCreate, entityType, entityID, "Created "+entityType, nil, snapshot, r)
}

// LogUpdate is a convenience method for update actions with automatic diff
func (as *AuditService) LogUpdate(userID uint, tenantID *uint, entityType string, entityID string, oldEntity, newEntity interface{}, r *http.Request) error {
	oldSnapshot := as.CreateSnapshot(oldEntity)
	newSnapshot := as.CreateSnapshot(newEntity)
	changes := as.ComputeChanges(oldEntity, newEntity)

	description := "Updated " + entityType
	if len(changes) > 0 {
		description = description + " (" + as.summarizeChanges(changes) + ")"
	}

	return as.LogAction(userID, tenantID, AuditActionUpdate, entityType, entityID, description, oldSnapshot, newSnapshot, r)
}

// LogDelete is a convenience method for delete actions
func (as *AuditService) LogDelete(userID uint, tenantID *uint, entityType string, entityID string, entity interface{}, r *http.Request) error {
	snapshot := as.CreateSnapshot(entity)
	return as.LogAction(userID, tenantID, AuditActionDelete, entityType, entityID, "Deleted "+entityType, snapshot, nil, r)
}

// CreateSnapshot creates a timestamped snapshot of an entity
func (as *AuditService) CreateSnapshot(entity interface{}) *AuditSnapshot {
	if entity == nil {
		return nil
	}

	data := make(map[string]interface{})
	bytes, _ := json.Marshal(entity)
	json.Unmarshal(bytes, &data)

	// Remove sensitive fields
	delete(data, "password")
	delete(data, "passwordHash")
	delete(data, "Password")
	delete(data, "PasswordHash")

	return &AuditSnapshot{
		Timestamp: time.Now(),
		Data:      data,
	}
}

// ComputeChanges computes the difference between two entities
func (as *AuditService) ComputeChanges(oldEntity, newEntity interface{}) []ChangedField {
	var changes []ChangedField

	if oldEntity == nil || newEntity == nil {
		return changes
	}

	// Convert both to maps
	oldData := make(map[string]interface{})
	newData := make(map[string]interface{})

	oldBytes, _ := json.Marshal(oldEntity)
	newBytes, _ := json.Marshal(newEntity)

	json.Unmarshal(oldBytes, &oldData)
	json.Unmarshal(newBytes, &newData)

	// Compare fields
	for key, newVal := range newData {
		// Skip internal/sensitive fields
		if key == "password" || key == "passwordHash" || key == "updatedAt" || key == "UpdatedAt" {
			continue
		}

		oldVal, exists := oldData[key]
		if !exists || !reflect.DeepEqual(oldVal, newVal) {
			changes = append(changes, ChangedField{
				Field:    key,
				OldValue: oldVal,
				NewValue: newVal,
			})
		}
	}

	return changes
}

// summarizeChanges creates a human-readable summary of changes
func (as *AuditService) summarizeChanges(changes []ChangedField) string {
	if len(changes) == 0 {
		return "no changes"
	}

	if len(changes) == 1 {
		return "changed " + changes[0].Field
	}

	if len(changes) <= 3 {
		fields := ""
		for i, c := range changes {
			if i > 0 {
				fields += ", "
			}
			fields += c.Field
		}
		return "changed " + fields
	}

	return "changed " + changes[0].Field + " and " + fmt.Sprintf("%d", len(changes)-1) + " more fields"
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

// GetAuditLogsForEntity retrieves audit logs for a specific entity
func (as *AuditService) GetAuditLogsForEntity(tenantID *uint, entityType string, entityID string, limit int) ([]models.AuditLog, error) {
	var logs []models.AuditLog

	query := as.DB.Preload("User").
		Where("entity_type = ? AND entity_id = ?", entityType, entityID)

	if tenantID != nil {
		query = query.Where("tenant_id = ?", *tenantID)
	}

	if err := query.Order("created_at DESC").Limit(limit).Find(&logs).Error; err != nil {
		return nil, err
	}

	return logs, nil
}

// GetAuditLogsForUser retrieves audit logs for actions by a specific user
func (as *AuditService) GetAuditLogsForUser(userID uint, limit int, offset int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	query := as.DB.Preload("User").Where("user_id = ?", userID)

	query.Model(&models.AuditLog{}).Count(&total)

	if err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&logs).Error; err != nil {
		return nil, 0, err
	}

	return logs, total, nil
}

// getClientIP extracts client IP from request (internal helper)
func getAuditClientIP(r *http.Request) string {
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
