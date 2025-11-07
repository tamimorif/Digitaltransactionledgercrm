package services

import (
	"api/pkg/models"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

// LicenseService handles license operations
type LicenseService struct {
	DB *gorm.DB
}

// NewLicenseService creates a new license service instance
func NewLicenseService(db *gorm.DB) *LicenseService {
	return &LicenseService{
		DB: db,
	}
}

// GenerateLicenseRequest represents a request to generate a license
type GenerateLicenseRequest struct {
	LicenseType   string `json:"licenseType"` // trial, starter, professional, business, enterprise, custom
	UserLimit     *int   `json:"userLimit"`   // Optional, uses default if not provided
	DurationType  string `json:"durationType"` // lifetime, monthly, yearly, custom_days
	DurationValue *int   `json:"durationValue"` // Number of days for custom duration
	Notes         string `json:"notes"`       // Custom notes for custom licenses
}

// ActivateLicenseRequest represents a request to activate a license
type ActivateLicenseRequest struct {
	LicenseKey string `json:"licenseKey"`
	TenantID   uint   `json:"tenantId"`
}

// GenerateLicenseKey generates a unique license key
func GenerateLicenseKey() (string, error) {
	// Generate 24 random bytes
	bytes := make([]byte, 24)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	// Encode to base64 and format as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX
	encoded := base64.URLEncoding.EncodeToString(bytes)
	
	// Take first 24 characters and format
	key := encoded[:24]
	formatted := fmt.Sprintf("%s-%s-%s-%s-%s-%s",
		key[0:4], key[4:8], key[8:12], key[12:16], key[16:20], key[20:24])
	
	return formatted, nil
}

// GenerateLicense creates a new license (SuperAdmin only)
func (ls *LicenseService) GenerateLicense(req GenerateLicenseRequest, createdBy uint) (*models.License, error) {
	// Validate license type
	validTypes := map[string]bool{
		models.LicenseTypeTrial:        true,
		models.LicenseTypeStarter:      true,
		models.LicenseTypeProfessional: true,
		models.LicenseTypeBusiness:     true,
		models.LicenseTypeEnterprise:   true,
		models.LicenseTypeCustom:       true,
	}

	if !validTypes[req.LicenseType] {
		return nil, errors.New("invalid license type")
	}

	// Generate unique license key
	licenseKey, err := GenerateLicenseKey()
	if err != nil {
		return nil, fmt.Errorf("failed to generate license key: %w", err)
	}

	// Set user limit (default or custom)
	userLimit := models.GetDefaultUserLimit(req.LicenseType)
	if req.UserLimit != nil && *req.UserLimit > 0 {
		userLimit = *req.UserLimit
	}

	// Set duration type
	durationType := models.DurationLifetime // Default
	if req.DurationType != "" {
		durationType = req.DurationType
	}

	// Calculate expiration date
	var expiresAt *time.Time
	if durationType != models.DurationLifetime {
		expiration := calculateExpiration(durationType, req.DurationValue)
		expiresAt = &expiration
	}

	// Create license
	license := &models.License{
		LicenseKey:    licenseKey,
		LicenseType:   req.LicenseType,
		UserLimit:     userLimit,
		DurationType:  durationType,
		DurationValue: req.DurationValue,
		ExpiresAt:     expiresAt,
		Status:        models.LicenseStatusUnused,
		CreatedBy:     createdBy,
		Notes:         req.Notes,
	}

	if err := ls.DB.Create(license).Error; err != nil {
		return nil, fmt.Errorf("failed to create license: %w", err)
	}

	log.Printf("✅ License generated: %s (Type: %s, UserLimit: %d)", license.LicenseKey, license.LicenseType, license.UserLimit)
	return license, nil
}

// ActivateLicense activates a license for a tenant
func (ls *LicenseService) ActivateLicense(licenseKey string, tenantID uint) error {
	// Start transaction
	tx := ls.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Find license
	var license models.License
	if err := tx.Where("license_key = ?", licenseKey).First(&license).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("invalid license key")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if license is already used
	if license.Status != models.LicenseStatusUnused {
		tx.Rollback()
		return errors.New("license has already been used")
	}

	// Check if license is expired (for non-lifetime licenses)
	if license.ExpiresAt != nil && time.Now().After(*license.ExpiresAt) {
		tx.Rollback()
		return errors.New("license has expired")
	}

	// Get tenant
	var tenant models.Tenant
	if err := tx.First(&tenant, tenantID).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("tenant not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Update license
	now := time.Now()
	license.Status = models.LicenseStatusActive
	license.TenantID = &tenantID
	license.ActivatedAt = &now
	
	// Calculate new expiration if it's a time-based license
	if license.DurationType != models.DurationLifetime {
		expiration := calculateExpiration(license.DurationType, license.DurationValue)
		license.ExpiresAt = &expiration
	}

	if err := tx.Save(&license).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update license: %w", err)
	}

	// Update tenant
	tenant.CurrentLicenseID = &license.ID
	tenant.UserLimit = license.UserLimit
	tenant.Status = models.TenantStatusActive

	if err := tx.Save(&tenant).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update tenant: %w", err)
	}

	// Update all users in tenant
	if err := tx.Model(&models.User{}).Where("tenant_id = ?", tenantID).
		Update("status", models.StatusActive).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to update users: %w", err)
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("✅ License activated: %s for Tenant ID: %d", license.LicenseKey, tenantID)
	return nil
}

// GetLicenseByKey retrieves a license by its key
func (ls *LicenseService) GetLicenseByKey(licenseKey string) (*models.License, error) {
	var license models.License
	if err := ls.DB.Preload("Tenant").Where("license_key = ?", licenseKey).First(&license).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("license not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}
	return &license, nil
}

// GetAllLicenses retrieves all licenses (SuperAdmin only)
func (ls *LicenseService) GetAllLicenses() ([]models.License, error) {
	var licenses []models.License
	if err := ls.DB.Preload("Tenant").Preload("CreatedByUser").Find(&licenses).Error; err != nil {
		return nil, fmt.Errorf("database error: %w", err)
	}
	return licenses, nil
}

// RevokeLicense revokes a license (SuperAdmin only)
func (ls *LicenseService) RevokeLicense(licenseID uint) error {
	tx := ls.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var license models.License
	if err := tx.First(&license, licenseID).Error; err != nil {
		tx.Rollback()
		return errors.New("license not found")
	}

	// Update license status
	license.Status = models.LicenseStatusRevoked
	if err := tx.Save(&license).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to revoke license: %w", err)
	}

	// If license is associated with a tenant, suspend the tenant
	if license.TenantID != nil {
		var tenant models.Tenant
		if err := tx.First(&tenant, license.TenantID).Error; err == nil {
			tenant.Status = models.TenantStatusSuspended
			tenant.CurrentLicenseID = nil
			tx.Save(&tenant)

			// Suspend all users in tenant
			tx.Model(&models.User{}).Where("tenant_id = ?", license.TenantID).
				Update("status", models.StatusLicenseExpired)
		}
	}

	if err := tx.Commit().Error; err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	log.Printf("⚠️  License revoked: ID %d", licenseID)
	return nil
}

// CheckExpiredLicenses checks for expired licenses and updates status
func (ls *LicenseService) CheckExpiredLicenses() error {
	var licenses []models.License
	
	// Find all active licenses that have expired
	if err := ls.DB.Where("status = ? AND expires_at IS NOT NULL AND expires_at < ?", 
		models.LicenseStatusActive, time.Now()).Find(&licenses).Error; err != nil {
		return fmt.Errorf("failed to query licenses: %w", err)
	}

	for _, license := range licenses {
		tx := ls.DB.Begin()
		
		// Update license status
		license.Status = models.LicenseStatusExpired
		tx.Save(&license)

		// Suspend tenant
		if license.TenantID != nil {
			var tenant models.Tenant
			if err := tx.First(&tenant, license.TenantID).Error; err == nil {
				tenant.Status = models.TenantStatusExpired
				tx.Save(&tenant)

				// Update users
				tx.Model(&models.User{}).Where("tenant_id = ?", license.TenantID).
					Update("status", models.StatusLicenseExpired)
			}
		}

		tx.Commit()
		log.Printf("⚠️  License expired: %s", license.LicenseKey)
	}

	return nil
}

// calculateExpiration calculates the expiration date based on duration type
func calculateExpiration(durationType string, durationValue *int) time.Time {
	now := time.Now()
	
	switch durationType {
	case models.DurationMonthly:
		return now.AddDate(0, 1, 0) // Add 1 month
	case models.DurationYearly:
		return now.AddDate(1, 0, 0) // Add 1 year
	case models.DurationCustomDays:
		if durationValue != nil {
			return now.AddDate(0, 0, *durationValue) // Add custom days
		}
		return now.AddDate(0, 1, 0) // Default to 1 month
	default:
		return now.AddDate(100, 0, 0) // Lifetime: 100 years
	}
}
