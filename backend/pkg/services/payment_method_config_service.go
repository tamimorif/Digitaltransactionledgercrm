package services

import (
	"api/pkg/models"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

// PaymentMethodConfigService handles payment method configuration
type PaymentMethodConfigService struct {
	db *gorm.DB
}

// NewPaymentMethodConfigService creates a new PaymentMethodConfigService
func NewPaymentMethodConfigService(db *gorm.DB) *PaymentMethodConfigService {
	return &PaymentMethodConfigService{db: db}
}

// GetConfigs retrieves all active payment method configs for a tenant
func (s *PaymentMethodConfigService) GetConfigs(tenantID uint, branchID *uint) ([]models.PaymentMethodConfig, error) {
	var configs []models.PaymentMethodConfig

	query := s.db.Where("tenant_id = ? AND is_active = ?", tenantID, true)

	// Include global configs (branch_id IS NULL) and branch-specific ones
	if branchID != nil {
		query = query.Where("branch_id IS NULL OR branch_id = ?", *branchID)
	} else {
		query = query.Where("branch_id IS NULL")
	}

	err := query.Order("sort_order ASC, method_type ASC").Find(&configs).Error
	return configs, err
}

// GetConfigByMethod retrieves a specific payment method config
func (s *PaymentMethodConfigService) GetConfigByMethod(tenantID uint, methodType string, branchID *uint) (*models.PaymentMethodConfig, error) {
	var config models.PaymentMethodConfig

	query := s.db.Where("tenant_id = ? AND method_type = ? AND is_active = ?", tenantID, methodType, true)

	// Prefer branch-specific config, fall back to global
	if branchID != nil {
		// First try branch-specific
		branchQuery := query.Session(&gorm.Session{}).Where("branch_id = ?", *branchID)
		err := branchQuery.First(&config).Error
		if err == nil {
			return &config, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
	}

	// Fall back to global config
	err := query.Where("branch_id IS NULL").First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

// CreateConfig creates a new payment method configuration
func (s *PaymentMethodConfigService) CreateConfig(config *models.PaymentMethodConfig) error {
	// Validate fee type
	switch config.FeeType {
	case models.FeeTypeNone, models.FeeTypePercent, models.FeeTypeFlat, models.FeeTypePercentPlusFlat:
		// Valid
	default:
		config.FeeType = models.FeeTypeNone
	}

	return s.db.Create(config).Error
}

// UpdateConfig updates an existing payment method configuration
func (s *PaymentMethodConfigService) UpdateConfig(id uint, tenantID uint, updates map[string]interface{}) error {
	result := s.db.Model(&models.PaymentMethodConfig{}).
		Where("id = ? AND tenant_id = ?", id, tenantID).
		Updates(updates)

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("payment method config not found")
	}
	return nil
}

// DeleteConfig soft-deletes a payment method configuration
func (s *PaymentMethodConfigService) DeleteConfig(id uint, tenantID uint) error {
	result := s.db.Where("id = ? AND tenant_id = ?", id, tenantID).
		Delete(&models.PaymentMethodConfig{})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("payment method config not found")
	}
	return nil
}

// SeedDefaultConfigs creates default payment method configurations for a new tenant
func (s *PaymentMethodConfigService) SeedDefaultConfigs(tenantID uint) error {
	defaults := []models.PaymentMethodConfig{
		{
			TenantID:    tenantID,
			MethodType:  models.PaymentMethodCash,
			DisplayName: "Cash",
			FeeType:     models.FeeTypeNone,
			IsActive:    true,
			SortOrder:   1,
		},
		{
			TenantID:          tenantID,
			MethodType:        models.PaymentMethodBankTransfer,
			DisplayName:       "Bank Transfer",
			RequiresReference: true,
			FeeType:           models.FeeTypeNone,
			IsActive:          true,
			SortOrder:         2,
		},
		{
			TenantID:    tenantID,
			MethodType:  models.PaymentMethodCard,
			DisplayName: "Credit/Debit Card",
			FeeType:     models.FeeTypePercent,
			FeePercent:  0.025, // 2.5%
			IsActive:    true,
			SortOrder:   3,
		},
		{
			TenantID:          tenantID,
			MethodType:        models.PaymentMethodCheque,
			DisplayName:       "Cheque",
			RequiresReference: true,
			RequiresApproval:  true,
			FeeType:           models.FeeTypeNone,
			IsActive:          true,
			SortOrder:         4,
		},
		{
			TenantID:    tenantID,
			MethodType:  models.PaymentMethodOnline,
			DisplayName: "E-Transfer",
			FeeType:     models.FeeTypeNone,
			IsActive:    true,
			SortOrder:   5,
		},
	}

	for _, config := range defaults {
		// Check if already exists
		var existing models.PaymentMethodConfig
		err := s.db.Where("tenant_id = ? AND method_type = ? AND branch_id IS NULL", tenantID, config.MethodType).
			First(&existing).Error

		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := s.db.Create(&config).Error; err != nil {
				return fmt.Errorf("failed to create default config for %s: %w", config.MethodType, err)
			}
		}
	}

	return nil
}

// ValidatePayment validates a payment against method configuration
func (s *PaymentMethodConfigService) ValidatePayment(tenantID uint, methodType string, amount float64, branchID *uint) error {
	config, err := s.GetConfigByMethod(tenantID, methodType, branchID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// No config = allow by default
			return nil
		}
		return err
	}

	if !config.IsActive {
		return fmt.Errorf("payment method %s is not available", config.DisplayName)
	}

	if !config.IsAmountValid(amount) {
		if config.MaxAmount != nil {
			return fmt.Errorf("amount must be between %.2f and %.2f", config.MinAmount, *config.MaxAmount)
		}
		return fmt.Errorf("amount must be at least %.2f", config.MinAmount)
	}

	return nil
}

// CalculateFee calculates the fee for a payment
func (s *PaymentMethodConfigService) CalculateFee(tenantID uint, methodType string, amount float64, branchID *uint) (float64, string, error) {
	config, err := s.GetConfigByMethod(tenantID, methodType, branchID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, "", nil
		}
		return 0, "", err
	}

	fee := config.CalculateFee(amount)
	return fee, config.FeeCurrency, nil
}
