package services

import (
	"api/pkg/models"
	"errors"
	"math"
	"time"

	"gorm.io/gorm"
)

// FeeService handles dynamic fee calculations
type FeeService struct {
	DB *gorm.DB
}

// NewFeeService creates a new FeeService instance
func NewFeeService(db *gorm.DB) *FeeService {
	return &FeeService{DB: db}
}

// CalculateFee calculates the fee for a transaction based on applicable rules
func (s *FeeService) CalculateFee(tenantID uint, amount float64, sourceCurrency, destinationCountry string) (*models.FeeCalculationResult, error) {
	if amount <= 0 {
		return nil, errors.New("amount must be greater than zero")
	}

	// Find the best matching rule
	rule, err := s.FindApplicableRule(tenantID, amount, sourceCurrency, destinationCountry)
	if err != nil {
		return nil, err
	}

	if rule == nil {
		// No rule found - return zero fee (or could return default)
		return &models.FeeCalculationResult{
			TotalFee:       0,
			FlatPortion:    0,
			PercentPortion: 0,
			RuleName:       "No applicable rule",
		}, nil
	}

	// Calculate fee based on rule type
	result := s.calculateFeeFromRule(rule, amount)
	return result, nil
}

// FindApplicableRule finds the most specific applicable rule for a transaction
func (s *FeeService) FindApplicableRule(tenantID uint, amount float64, sourceCurrency, destinationCountry string) (*models.FeeRule, error) {
	var rules []models.FeeRule
	now := time.Now()

	query := s.DB.Where("tenant_id = ? AND is_active = ?", tenantID, true).
		Where("min_amount <= ?", amount).
		Where("max_amount IS NULL OR max_amount >= ?", amount).
		Where("(valid_from IS NULL OR valid_from <= ?)", now).
		Where("(valid_until IS NULL OR valid_until >= ?)", now).
		Order("priority ASC")

	if err := query.Find(&rules).Error; err != nil {
		return nil, err
	}

	if len(rules) == 0 {
		return nil, nil
	}

	// Find the most specific matching rule
	for _, rule := range rules {
		// Check currency match (empty = all currencies)
		currencyMatch := rule.SourceCurrency == "" || rule.SourceCurrency == sourceCurrency
		// Check country match (empty = all countries)
		countryMatch := rule.DestinationCountry == "" || rule.DestinationCountry == destinationCountry

		if currencyMatch && countryMatch {
			return &rule, nil
		}
	}

	return nil, nil
}

// calculateFeeFromRule calculates the fee based on the rule configuration
func (s *FeeService) calculateFeeFromRule(rule *models.FeeRule, amount float64) *models.FeeCalculationResult {
	var flatPortion, percentPortion, totalFee float64

	switch rule.FeeType {
	case models.FeeRuleTypeFlat:
		flatPortion = rule.FlatFee
		totalFee = flatPortion

	case models.FeeRuleTypePercentage:
		percentPortion = amount * rule.PercentageFee
		totalFee = percentPortion

	case models.FeeRuleTypeCombined:
		flatPortion = rule.FlatFee
		percentPortion = amount * rule.PercentageFee
		totalFee = flatPortion + percentPortion

	default:
		// Default to flat fee if type is unknown
		flatPortion = rule.FlatFee
		totalFee = flatPortion
	}

	// Apply minimum fee
	if totalFee < rule.MinFee {
		totalFee = rule.MinFee
	}

	// Apply maximum fee cap
	if rule.MaxFee != nil && totalFee > *rule.MaxFee {
		totalFee = *rule.MaxFee
	}

	// Round to 2 decimal places
	totalFee = math.Round(totalFee*100) / 100
	flatPortion = math.Round(flatPortion*100) / 100
	percentPortion = math.Round(percentPortion*100) / 100

	return &models.FeeCalculationResult{
		TotalFee:       totalFee,
		FlatPortion:    flatPortion,
		PercentPortion: percentPortion,
		RuleApplied:    rule,
		RuleName:       rule.Name,
	}
}

// CreateFeeRule creates a new fee rule
func (s *FeeService) CreateFeeRule(rule *models.FeeRule) error {
	if rule.Name == "" {
		return errors.New("rule name is required")
	}
	if rule.TenantID == 0 {
		return errors.New("tenant ID is required")
	}

	// Validate fee type
	if rule.FeeType != models.FeeRuleTypeFlat &&
		rule.FeeType != models.FeeRuleTypePercentage &&
		rule.FeeType != models.FeeRuleTypeCombined {
		rule.FeeType = models.FeeRuleTypeFlat
	}

	return s.DB.Create(rule).Error
}

// UpdateFeeRule updates an existing fee rule
func (s *FeeService) UpdateFeeRule(rule *models.FeeRule) error {
	return s.DB.Save(rule).Error
}

// DeleteFeeRule soft-deletes a fee rule by setting IsActive to false
func (s *FeeService) DeleteFeeRule(tenantID, ruleID uint) error {
	return s.DB.Model(&models.FeeRule{}).
		Where("id = ? AND tenant_id = ?", ruleID, tenantID).
		Update("is_active", false).Error
}

// GetAllFeeRules retrieves all fee rules for a tenant
func (s *FeeService) GetAllFeeRules(tenantID uint, includeInactive bool) ([]models.FeeRule, error) {
	var rules []models.FeeRule
	query := s.DB.Where("tenant_id = ?", tenantID)

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	err := query.Order("priority ASC, created_at DESC").Find(&rules).Error
	return rules, err
}

// GetFeeRuleByID retrieves a specific fee rule
func (s *FeeService) GetFeeRuleByID(tenantID, ruleID uint) (*models.FeeRule, error) {
	var rule models.FeeRule
	err := s.DB.Where("id = ? AND tenant_id = ?", ruleID, tenantID).First(&rule).Error
	if err != nil {
		return nil, err
	}
	return &rule, nil
}

// PreviewFee calculates fee without storing anything (for UI preview)
func (s *FeeService) PreviewFee(tenantID uint, amount float64, sourceCurrency, destinationCountry string) (*models.FeeCalculationResult, error) {
	return s.CalculateFee(tenantID, amount, sourceCurrency, destinationCountry)
}

// CreateDefaultRules creates default fee rules for a new tenant
func (s *FeeService) CreateDefaultRules(tenantID uint) error {
	defaultRules := []models.FeeRule{
		{
			TenantID:    tenantID,
			Name:        "Standard Transfer Fee",
			Description: "Default fee for all transfers",
			MinAmount:   0,
			FeeType:     models.FeeRuleTypeFlat,
			FlatFee:     5.00,
			MinFee:      5.00,
			Priority:    1000, // Low priority (fallback)
			IsActive:    true,
		},
		{
			TenantID:    tenantID,
			Name:        "Small Transfer Fee",
			Description: "Lower fee for small transfers under $100",
			MinAmount:   0,
			MaxAmount:   ptrFloat64(99.99),
			FeeType:     models.FeeRuleTypeFlat,
			FlatFee:     2.00,
			MinFee:      2.00,
			Priority:    100,
			IsActive:    true,
		},
		{
			TenantID:      tenantID,
			Name:          "Large Transfer Fee",
			Description:   "Fee for large transfers over $5000",
			MinAmount:     5000,
			FeeType:       models.FeeRuleTypePercentage,
			PercentageFee: 0.005, // 0.5%
			MinFee:        10.00,
			MaxFee:        ptrFloat64(50.00),
			Priority:      50,
			IsActive:      true,
		},
	}

	for _, rule := range defaultRules {
		if err := s.DB.Create(&rule).Error; err != nil {
			return err
		}
	}

	return nil
}

// Helper function to create pointer to float64
func ptrFloat64(f float64) *float64 {
	return &f
}
