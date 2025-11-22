package services

import (
	"errors"
	"time"

	"api/pkg/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AdminService struct {
	db *gorm.DB
}

func NewAdminService(db *gorm.DB) *AdminService {
	return &AdminService{db: db}
}

// GenerateLicense creates a new license key
func (s *AdminService) GenerateLicense(licenseType string, userLimit int, durationType string, durationValue *int, createdBy uint, notes string) (*models.License, error) {
	// Generate a unique license key
	key := uuid.New().String()

	// Calculate expiration if not lifetime
	var expiresAt *time.Time
	if durationType != models.DurationLifetime {
		now := time.Now()
		var exp time.Time
		switch durationType {
		case models.DurationMonthly:
			exp = now.AddDate(0, 1, 0)
		case models.DurationYearly:
			exp = now.AddDate(1, 0, 0)
		case models.DurationCustomDays:
			if durationValue != nil && *durationValue > 0 {
				exp = now.AddDate(0, 0, *durationValue)
			} else {
				return nil, errors.New("duration value required for custom days")
			}
		}
		expiresAt = &exp
	}

	license := &models.License{
		LicenseKey:    key,
		LicenseType:   licenseType,
		UserLimit:     userLimit,
		MaxBranches:   models.GetDefaultUserLimit(licenseType), // Using user limit logic for branches for now, or 1
		DurationType:  durationType,
		DurationValue: durationValue,
		ExpiresAt:     expiresAt,
		Status:        models.LicenseStatusUnused,
		CreatedBy:     createdBy,
		Notes:         notes,
	}

	// Adjust MaxBranches based on type if needed, for now simple logic
	if licenseType == models.LicenseTypeEnterprise {
		license.MaxBranches = -1 // Unlimited
	} else if licenseType == models.LicenseTypeBusiness {
		license.MaxBranches = 10
	} else {
		license.MaxBranches = 3
	}

	if err := s.db.Create(license).Error; err != nil {
		return nil, err
	}

	return license, nil
}

// GetAllTenants returns all tenants with their owner and subscription info
func (s *AdminService) GetAllTenants() ([]models.Tenant, error) {
	var tenants []models.Tenant
	if err := s.db.Preload("Owner").Preload("CurrentLicense").Find(&tenants).Error; err != nil {
		return nil, err
	}
	return tenants, nil
}

// GetTenantUsers returns all users for a specific tenant
func (s *AdminService) GetTenantUsers(tenantID uint) ([]models.User, error) {
	var users []models.User
	if err := s.db.Where("tenant_id = ?", tenantID).Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// DeleteTenant deletes a tenant and all associated data
// This is a destructive operation!
func (s *AdminService) DeleteTenant(tenantID uint) error {
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Delete transactions
		if err := tx.Where("tenant_id = ?", tenantID).Delete(&models.Transaction{}).Error; err != nil {
			return err
		}
		// Delete clients
		if err := tx.Where("tenant_id = ?", tenantID).Delete(&models.Client{}).Error; err != nil {
			return err
		}
		// Delete users
		if err := tx.Where("tenant_id = ?", tenantID).Delete(&models.User{}).Error; err != nil {
			return err
		}
		// Delete tenant
		if err := tx.Delete(&models.Tenant{}, tenantID).Error; err != nil {
			return err
		}
		return nil
	})
}

// GetAllLicenses returns all licenses
func (s *AdminService) GetAllLicenses() ([]models.License, error) {
	var licenses []models.License
	if err := s.db.Preload("Tenant").Preload("CreatedByUser").Order("created_at desc").Find(&licenses).Error; err != nil {
		return nil, err
	}
	return licenses, nil
}

// RevokeLicense changes license status to revoked
func (s *AdminService) RevokeLicense(licenseID uint) error {
	return s.db.Model(&models.License{}).Where("id = ?", licenseID).Update("status", models.LicenseStatusRevoked).Error
}

// GetTenantByID returns a specific tenant
func (s *AdminService) GetTenantByID(id uint) (*models.Tenant, error) {
	var tenant models.Tenant
	if err := s.db.Preload("Owner").Preload("CurrentLicense").First(&tenant, id).Error; err != nil {
		return nil, err
	}
	return &tenant, nil
}

// UpdateTenantStatus updates the status of a tenant
func (s *AdminService) UpdateTenantStatus(id uint, status string) error {
	return s.db.Model(&models.Tenant{}).Where("id = ?", id).Update("status", status).Error
}

// GetTenantCashBalances returns cash balances for a tenant
func (s *AdminService) GetTenantCashBalances(tenantID uint) ([]models.CashBalance, error) {
	var balances []models.CashBalance
	if err := s.db.Where("tenant_id = ?", tenantID).Find(&balances).Error; err != nil {
		return nil, err
	}
	return balances, nil
}

// GetTenantCustomerCount returns the number of customers for a tenant
func (s *AdminService) GetTenantCustomerCount(tenantID uint) (int64, error) {
	var count int64
	if err := s.db.Model(&models.Client{}).Where("tenant_id = ?", tenantID).Count(&count).Error; err != nil {
		return 0, err
	}
	return count, nil
}

// GetAllUsers returns all users in the system
func (s *AdminService) GetAllUsers() ([]models.User, error) {
	var users []models.User
	if err := s.db.Preload("Tenant").Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

// GetAllTransactions returns all transactions in the system (for super admin view)
func (s *AdminService) GetAllTransactions() ([]models.Transaction, error) {
	var transactions []models.Transaction
	if err := s.db.Preload("Tenant").Limit(100).Order("created_at desc").Find(&transactions).Error; err != nil {
		return nil, err
	}
	return transactions, nil
}

// GetDashboardStats returns high-level stats for the dashboard
func (s *AdminService) GetDashboardStats() (map[string]interface{}, error) {
	var totalTenants int64
	var activeLicenses int64
	var totalUsers int64

	s.db.Model(&models.Tenant{}).Count(&totalTenants)
	s.db.Model(&models.License{}).Where("status = ?", models.LicenseStatusActive).Count(&activeLicenses)
	s.db.Model(&models.User{}).Count(&totalUsers)

	return map[string]interface{}{
		"totalTenants":   totalTenants,
		"activeLicenses": activeLicenses,
		"totalUsers":     totalUsers,
	}, nil
}
