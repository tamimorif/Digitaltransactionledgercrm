package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"gorm.io/gorm"
)

// ReceiptService handles receipt template operations
type ReceiptService struct {
	DB *gorm.DB
}

// NewReceiptService creates a new receipt service
func NewReceiptService(db *gorm.DB) *ReceiptService {
	return &ReceiptService{DB: db}
}

// CreateTemplateRequest represents the request to create a template
type CreateTemplateRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	TemplateType string `json:"templateType"`
	HeaderHTML   string `json:"headerHtml"`
	BodyHTML     string `json:"bodyHtml"`
	FooterHTML   string `json:"footerHtml"`
	StyleCSS     string `json:"styleCss"`
	PageSize     string `json:"pageSize"`
	Orientation  string `json:"orientation"`
	MarginTop    int    `json:"marginTop"`
	MarginRight  int    `json:"marginRight"`
	MarginBottom int    `json:"marginBottom"`
	MarginLeft   int    `json:"marginLeft"`
	LogoPath     string `json:"logoPath"`
	LogoPosition string `json:"logoPosition"`
	IsDefault    bool   `json:"isDefault"`
}

// CreateTemplate creates a new receipt template
func (s *ReceiptService) CreateTemplate(tenantID uint, userID uint, req CreateTemplateRequest) (*models.ReceiptTemplate, error) {
	if req.Name == "" {
		return nil, errors.New("template name is required")
	}

	// Set defaults
	if req.TemplateType == "" {
		req.TemplateType = "transaction"
	}
	if req.PageSize == "" {
		req.PageSize = "A4"
	}
	if req.Orientation == "" {
		req.Orientation = "portrait"
	}
	if req.LogoPosition == "" {
		req.LogoPosition = "center"
	}
	if req.MarginTop == 0 {
		req.MarginTop = 20
	}
	if req.MarginRight == 0 {
		req.MarginRight = 20
	}
	if req.MarginBottom == 0 {
		req.MarginBottom = 20
	}
	if req.MarginLeft == 0 {
		req.MarginLeft = 20
	}

	template := &models.ReceiptTemplate{
		TenantID:     tenantID,
		Name:         req.Name,
		Description:  req.Description,
		TemplateType: req.TemplateType,
		HeaderHTML:   req.HeaderHTML,
		BodyHTML:     req.BodyHTML,
		FooterHTML:   req.FooterHTML,
		StyleCSS:     req.StyleCSS,
		PageSize:     req.PageSize,
		Orientation:  req.Orientation,
		MarginTop:    req.MarginTop,
		MarginRight:  req.MarginRight,
		MarginBottom: req.MarginBottom,
		MarginLeft:   req.MarginLeft,
		LogoPath:     req.LogoPath,
		LogoPosition: req.LogoPosition,
		IsDefault:    req.IsDefault,
		IsActive:     true,
		CreatedBy:    &userID,
		UpdatedBy:    &userID,
	}

	// If this is set as default, unset other defaults for this type
	if req.IsDefault {
		s.DB.Model(&models.ReceiptTemplate{}).
			Where("tenant_id = ? AND template_type = ? AND is_default = ?", tenantID, req.TemplateType, true).
			Update("is_default", false)
	}

	if err := s.DB.Create(template).Error; err != nil {
		return nil, err
	}

	return template, nil
}

// GetTemplate retrieves a template by ID
func (s *ReceiptService) GetTemplate(tenantID, templateID uint) (*models.ReceiptTemplate, error) {
	var template models.ReceiptTemplate
	err := s.DB.Where("id = ? AND tenant_id = ?", templateID, tenantID).First(&template).Error
	if err != nil {
		return nil, err
	}
	return &template, nil
}

// GetDefaultTemplate retrieves the default template for a type
func (s *ReceiptService) GetDefaultTemplate(tenantID uint, templateType string) (*models.ReceiptTemplate, error) {
	var template models.ReceiptTemplate
	err := s.DB.Where("tenant_id = ? AND template_type = ? AND is_default = ? AND is_active = ?",
		tenantID, templateType, true, true).First(&template).Error

	if err != nil {
		// If no default, get any active template of this type
		err = s.DB.Where("tenant_id = ? AND template_type = ? AND is_active = ?",
			tenantID, templateType, true).Order("created_at DESC").First(&template).Error
	}

	if err != nil {
		// Return built-in default
		return s.getBuiltInTemplate(templateType), nil
	}

	return &template, nil
}

// ListTemplates lists all templates for a tenant
func (s *ReceiptService) ListTemplates(tenantID uint, includeInactive bool) ([]models.ReceiptTemplate, error) {
	query := s.DB.Where("tenant_id = ?", tenantID)

	if !includeInactive {
		query = query.Where("is_active = ?", true)
	}

	var templates []models.ReceiptTemplate
	err := query.Order("template_type, is_default DESC, name").Find(&templates).Error
	return templates, err
}

// UpdateTemplate updates a template
func (s *ReceiptService) UpdateTemplate(tenantID, templateID uint, userID uint, req CreateTemplateRequest) (*models.ReceiptTemplate, error) {
	var template models.ReceiptTemplate
	if err := s.DB.Where("id = ? AND tenant_id = ?", templateID, tenantID).First(&template).Error; err != nil {
		return nil, err
	}

	// Update fields
	if req.Name != "" {
		template.Name = req.Name
	}
	template.Description = req.Description
	template.HeaderHTML = req.HeaderHTML
	template.BodyHTML = req.BodyHTML
	template.FooterHTML = req.FooterHTML
	template.StyleCSS = req.StyleCSS
	template.PageSize = req.PageSize
	template.Orientation = req.Orientation
	template.MarginTop = req.MarginTop
	template.MarginRight = req.MarginRight
	template.MarginBottom = req.MarginBottom
	template.MarginLeft = req.MarginLeft
	template.LogoPath = req.LogoPath
	template.LogoPosition = req.LogoPosition
	template.UpdatedBy = &userID
	template.Version++

	// Handle default flag
	if req.IsDefault && !template.IsDefault {
		s.DB.Model(&models.ReceiptTemplate{}).
			Where("tenant_id = ? AND template_type = ? AND is_default = ?", tenantID, template.TemplateType, true).
			Update("is_default", false)
		template.IsDefault = true
	}

	if err := s.DB.Save(&template).Error; err != nil {
		return nil, err
	}

	return &template, nil
}

// SetDefaultTemplate sets a template as the default for its type
func (s *ReceiptService) SetDefaultTemplate(tenantID, templateID uint) error {
	var template models.ReceiptTemplate
	if err := s.DB.Where("id = ? AND tenant_id = ?", templateID, tenantID).First(&template).Error; err != nil {
		return err
	}

	// Unset other defaults
	s.DB.Model(&models.ReceiptTemplate{}).
		Where("tenant_id = ? AND template_type = ? AND is_default = ?", tenantID, template.TemplateType, true).
		Update("is_default", false)

	// Set this as default
	return s.DB.Model(&template).Update("is_default", true).Error
}

// DeleteTemplate soft-deletes a template
func (s *ReceiptService) DeleteTemplate(tenantID, templateID uint) error {
	return s.DB.Where("id = ? AND tenant_id = ?", templateID, tenantID).Delete(&models.ReceiptTemplate{}).Error
}

// ActivateTemplate activates/deactivates a template
func (s *ReceiptService) ActivateTemplate(tenantID, templateID uint, active bool) error {
	return s.DB.Model(&models.ReceiptTemplate{}).
		Where("id = ? AND tenant_id = ?", templateID, tenantID).
		Update("is_active", active).Error
}

// DuplicateTemplate creates a copy of a template
func (s *ReceiptService) DuplicateTemplate(tenantID, templateID uint, userID uint, newName string) (*models.ReceiptTemplate, error) {
	var orig models.ReceiptTemplate
	if err := s.DB.Where("id = ? AND tenant_id = ?", templateID, tenantID).First(&orig).Error; err != nil {
		return nil, err
	}

	if newName == "" {
		newName = orig.Name + " (Copy)"
	}

	copyTemplate := &models.ReceiptTemplate{
		TenantID:     tenantID,
		Name:         newName,
		Description:  orig.Description,
		TemplateType: orig.TemplateType,
		HeaderHTML:   orig.HeaderHTML,
		BodyHTML:     orig.BodyHTML,
		FooterHTML:   orig.FooterHTML,
		StyleCSS:     orig.StyleCSS,
		PageSize:     orig.PageSize,
		Orientation:  orig.Orientation,
		MarginTop:    orig.MarginTop,
		MarginRight:  orig.MarginRight,
		MarginBottom: orig.MarginBottom,
		MarginLeft:   orig.MarginLeft,
		LogoPath:     orig.LogoPath,
		LogoPosition: orig.LogoPosition,
		IsDefault:    false,
		IsActive:     true,
		CreatedBy:    &userID,
		UpdatedBy:    &userID,
	}

	if err := s.DB.Create(copyTemplate).Error; err != nil {
		return nil, err
	}

	return copyTemplate, nil
}

// RenderReceipt renders a receipt using a template and data
func (s *ReceiptService) RenderReceipt(tenantID uint, templateType string, data map[string]interface{}) (string, error) {
	template, err := s.GetDefaultTemplate(tenantID, templateType)
	if err != nil {
		return "", err
	}

	return s.RenderWithTemplate(template, data), nil
}

// RenderWithTemplate renders content using a specific template
func (s *ReceiptService) RenderWithTemplate(template *models.ReceiptTemplate, data map[string]interface{}) string {
	fullHTML := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Receipt</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: Arial, sans-serif; 
            padding: %dpx %dpx %dpx %dpx;
        }
        .receipt-header { margin-bottom: 20px; }
        .receipt-body { margin-bottom: 20px; }
        .receipt-footer { margin-top: 20px; border-top: 1px solid #ccc; padding-top: 10px; }
        %s
    </style>
</head>
<body>
    <div class="receipt-header">
        %s
    </div>
    <div class="receipt-body">
        %s
    </div>
    <div class="receipt-footer">
        %s
    </div>
</body>
</html>`,
		template.MarginTop, template.MarginRight, template.MarginBottom, template.MarginLeft,
		template.StyleCSS,
		s.replaceVariables(template.HeaderHTML, data),
		s.replaceVariables(template.BodyHTML, data),
		s.replaceVariables(template.FooterHTML, data),
	)

	return fullHTML
}

// replaceVariables replaces template variables with actual values
func (s *ReceiptService) replaceVariables(content string, data map[string]interface{}) string {
	result := content

	// Replace all {{variable.path}} patterns
	re := regexp.MustCompile(`\{\{([a-zA-Z0-9_.]+)\}\}`)
	result = re.ReplaceAllStringFunc(result, func(match string) string {
		// Extract variable name (remove {{ and }})
		varName := match[2 : len(match)-2]

		// Look up value in data map
		if value, exists := data[varName]; exists {
			return fmt.Sprintf("%v", value)
		}

		// Try nested lookup
		parts := strings.Split(varName, ".")
		if len(parts) == 2 {
			key := parts[0] + "." + parts[1]
			if value, exists := data[key]; exists {
				return fmt.Sprintf("%v", value)
			}
		}

		return ""
	})

	return result
}

// GetAvailableVariables returns available template variables
func (s *ReceiptService) GetAvailableVariables(templateType string) []models.ReceiptVariable {
	switch templateType {
	case "remittance":
		return models.GetRemittanceVariables()
	default:
		return models.GetTransactionVariables()
	}
}

// ValidateTemplate checks if a template is valid
func (s *ReceiptService) ValidateTemplate(template *models.ReceiptTemplate) []string {
	var errs []string

	if template.Name == "" {
		errs = append(errs, "Template name is required")
	}

	re := regexp.MustCompile(`\{\{[^}]*$`)
	if re.MatchString(template.HeaderHTML) || re.MatchString(template.BodyHTML) || re.MatchString(template.FooterHTML) {
		errs = append(errs, "Unclosed variable detected")
	}

	return errs
}

// PreviewReceipt generates a preview with sample data
func (s *ReceiptService) PreviewReceipt(tenantID uint, templateID uint) (string, error) {
	template, err := s.GetTemplate(tenantID, templateID)
	if err != nil {
		return "", err
	}

	sampleData := s.getSampleData(template.TemplateType)
	return s.RenderWithTemplate(template, sampleData), nil
}

func (s *ReceiptService) getSampleData(templateType string) map[string]interface{} {
	now := time.Now()

	data := map[string]interface{}{
		"business.name":      "Torontex Exchange",
		"business.address":   "123 King Street West, Toronto, ON",
		"business.phone":     "+1 416-555-1234",
		"business.email":     "info@torontex.com",
		"business.license":   "MSB-12345-ON",
		"transaction.id":     "TXN-20231220-0001",
		"transaction.date":   now.Format("January 2, 2006"),
		"transaction.time":   now.Format("3:04 PM"),
		"transaction.type":   "Currency Exchange",
		"transaction.status": "Completed",
		"send.amount":        "1,000.00",
		"send.currency":      "CAD",
		"receive.amount":     "42,500,000",
		"receive.currency":   "IRR",
		"exchange.rate":      "42,500",
		"fee.amount":         "15.00",
		"fee.currency":       "CAD",
		"total.amount":       "1,015.00",
		"customer.name":      "John Doe",
		"customer.phone":     "+1 416-555-9999",
		"customer.email":     "john@example.com",
		"customer.id":        "C-001234",
		"agent.name":         "Jane Smith",
		"branch.name":        "Downtown Branch",
		"branch.address":     "456 Bay Street",
		"reference.number":   "REF-2023122001234",
		"confirmation.code":  "ABCD1234",
		"current.date":       now.Format("2006-01-02"),
		"current.datetime":   now.Format("2006-01-02 15:04:05"),
	}

	if templateType == "remittance" {
		data["beneficiary.name"] = "Ali Mohammadi"
		data["beneficiary.phone"] = "+98 912-345-6789"
		data["beneficiary.bank"] = "Bank Melli"
		data["beneficiary.account"] = "IR12 0170 0000 0012 3456 7890"
		data["beneficiary.country"] = "Iran"
		data["remittance.status"] = "Processing"
		data["remittance.eta"] = "1-2 business days"
		data["pickup.location"] = "Bank Mellat - Vanak Branch"
		data["pickup.code"] = "PU1234567890"
	}

	return data
}

func (s *ReceiptService) getBuiltInTemplate(templateType string) *models.ReceiptTemplate {
	return &models.ReceiptTemplate{
		Name:         "Default " + templateType + " Receipt",
		TemplateType: templateType,
		HeaderHTML: `<div style="text-align: center; margin-bottom: 20px;">
    <h1 style="font-size: 24px; margin-bottom: 5px;">{{business.name}}</h1>
    <p style="font-size: 12px; color: #666;">{{business.address}}</p>
    <p style="font-size: 12px; color: #666;">{{business.phone}} | {{business.email}}</p>
</div>`,
		BodyHTML: `<div style="margin: 20px 0;">
    <h2 style="font-size: 18px; margin-bottom: 15px;">Transaction Receipt</h2>
    <table style="width: 100%; border-collapse: collapse;">
        <tr><td style="padding: 8px 0;"><strong>Transaction ID:</strong></td><td style="text-align: right;">{{transaction.id}}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Date:</strong></td><td style="text-align: right;">{{transaction.date}}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Customer:</strong></td><td style="text-align: right;">{{customer.name}}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Amount Sent:</strong></td><td style="text-align: right;">{{send.currency}} {{send.amount}}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Exchange Rate:</strong></td><td style="text-align: right;">{{exchange.rate}}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Amount Received:</strong></td><td style="text-align: right;">{{receive.currency}} {{receive.amount}}</td></tr>
        <tr><td style="padding: 8px 0;"><strong>Total Paid:</strong></td><td style="text-align: right; font-weight: bold;">{{send.currency}} {{total.amount}}</td></tr>
    </table>
</div>`,
		FooterHTML: `<div style="margin-top: 30px; font-size: 11px; color: #888; text-align: center;">
    <p>Reference: {{reference.number}}</p>
    <p>Thank you for choosing {{business.name}}</p>
</div>`,
		PageSize:     "A4",
		Orientation:  "portrait",
		MarginTop:    20,
		MarginRight:  20,
		MarginBottom: 20,
		MarginLeft:   20,
		LogoPosition: "center",
		IsDefault:    true,
		IsActive:     true,
	}
}

// CreateDefaultTemplates creates initial templates for a new tenant
func (s *ReceiptService) CreateDefaultTemplates(tenantID uint, userID uint) error {
	types := []string{"transaction", "remittance", "pickup"}

	for _, t := range types {
		template := s.getBuiltInTemplate(t)
		template.TenantID = tenantID
		template.CreatedBy = &userID
		template.UpdatedBy = &userID

		if err := s.DB.Create(template).Error; err != nil {
			return err
		}
	}

	return nil
}
