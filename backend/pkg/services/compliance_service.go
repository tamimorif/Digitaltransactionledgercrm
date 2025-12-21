package services

import (
	"api/pkg/models"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// ComplianceService handles KYC/AML verification operations
type ComplianceService struct {
	DB *gorm.DB
}

// NewComplianceService creates a new ComplianceService
func NewComplianceService(db *gorm.DB) *ComplianceService {
	return &ComplianceService{DB: db}
}

// ComplianceCheckResult represents the result of a compliance check
type ComplianceCheckResult struct {
	Passed         bool    `json:"passed"`
	Status         string  `json:"status"`
	RiskLevel      string  `json:"riskLevel"`
	BlockedReason  string  `json:"blockedReason,omitempty"`
	RequiresReview bool    `json:"requiresReview"`
	DailyUsage     float64 `json:"dailyUsage"`
	MonthlyUsage   float64 `json:"monthlyUsage"`
	DailyLimit     float64 `json:"dailyLimit"`
	MonthlyLimit   float64 `json:"monthlyLimit"`
}

// GetOrCreateCompliance gets or creates a compliance record for a customer
func (s *ComplianceService) GetOrCreateCompliance(tenantID, customerID uint) (*models.CustomerCompliance, error) {
	var compliance models.CustomerCompliance
	err := s.DB.Where("tenant_id = ? AND customer_id = ?", tenantID, customerID).First(&compliance).Error

	if err == gorm.ErrRecordNotFound {
		compliance = models.CustomerCompliance{
			TenantID:   tenantID,
			CustomerID: customerID,
			Status:     models.ComplianceStatusPending,
			RiskLevel:  models.RiskLevelLow,
		}
		if err := s.DB.Create(&compliance).Error; err != nil {
			return nil, err
		}
		// Log creation
		s.logAction(compliance.ID, tenantID, "CREATED", "", string(models.ComplianceStatusPending), nil, false)
	} else if err != nil {
		return nil, err
	}

	return &compliance, nil
}

// GetComplianceByCustomer retrieves compliance record for a customer
func (s *ComplianceService) GetComplianceByCustomer(tenantID, customerID uint) (*models.CustomerCompliance, error) {
	var compliance models.CustomerCompliance
	err := s.DB.Where("tenant_id = ? AND customer_id = ?", tenantID, customerID).First(&compliance).Error
	if err != nil {
		return nil, err
	}
	return &compliance, nil
}

// CheckTransactionCompliance performs compliance checks before allowing a transaction
func (s *ComplianceService) CheckTransactionCompliance(tenantID, customerID uint, amount float64, currency string) (*ComplianceCheckResult, error) {
	compliance, err := s.GetOrCreateCompliance(tenantID, customerID)
	if err != nil {
		return nil, err
	}

	result := &ComplianceCheckResult{
		Passed:    true,
		Status:    string(compliance.Status),
		RiskLevel: string(compliance.RiskLevel),
	}

	// Check 1: Compliance Status
	if compliance.Status == models.ComplianceStatusSuspended {
		result.Passed = false
		result.BlockedReason = "Customer account is suspended"
		return result, nil
	}

	if compliance.Status == models.ComplianceStatusRejected {
		result.Passed = false
		result.BlockedReason = "KYC verification was rejected"
		return result, nil
	}

	// Check 2: Expiration
	if compliance.ExpiresAt != nil && time.Now().After(*compliance.ExpiresAt) {
		// Update status to expired
		s.DB.Model(&compliance).Update("status", models.ComplianceStatusExpired)
		result.Status = string(models.ComplianceStatusExpired)
		result.RequiresReview = true
		// Allow but flag for review
	}

	// Check 3: Daily limit
	if compliance.DailyLimit > 0 {
		dailyUsage, _ := s.getDailyUsage(tenantID, customerID)
		result.DailyUsage = dailyUsage
		result.DailyLimit = compliance.DailyLimit

		if dailyUsage+amount > compliance.DailyLimit {
			result.Passed = false
			result.BlockedReason = fmt.Sprintf("Daily limit exceeded: %.2f + %.2f > %.2f", dailyUsage, amount, compliance.DailyLimit)
			return result, nil
		}
	}

	// Check 4: Monthly limit
	if compliance.MonthlyLimit > 0 {
		monthlyUsage, _ := s.getMonthlyUsage(tenantID, customerID)
		result.MonthlyUsage = monthlyUsage
		result.MonthlyLimit = compliance.MonthlyLimit

		if monthlyUsage+amount > compliance.MonthlyLimit {
			result.Passed = false
			result.BlockedReason = fmt.Sprintf("Monthly limit exceeded: %.2f + %.2f > %.2f", monthlyUsage, amount, compliance.MonthlyLimit)
			return result, nil
		}
	}

	// Check 5: Per-transaction limit
	if compliance.PerTransactionLimit > 0 && amount > compliance.PerTransactionLimit {
		result.Passed = false
		result.BlockedReason = fmt.Sprintf("Transaction amount %.2f exceeds per-transaction limit %.2f", amount, compliance.PerTransactionLimit)
		return result, nil
	}

	// Check 6: High-risk requires approved status for large transactions
	if compliance.RiskLevel == models.RiskLevelHigh && compliance.Status != models.ComplianceStatusApproved {
		if amount > 500 { // Threshold for high-risk customers
			result.RequiresReview = true
		}
	}

	// Check 7: PEP/Sanctions flags require approved status
	if (compliance.PEPMatch || compliance.SanctionsMatch) && compliance.Status != models.ComplianceStatusApproved {
		result.Passed = false
		result.RequiresReview = true
		result.BlockedReason = "Customer flagged in compliance screening - manual review required"
		return result, nil
	}

	return result, nil
}

// UpdateComplianceStatus updates the compliance status with audit logging
func (s *ComplianceService) UpdateComplianceStatus(complianceID uint, newStatus models.ComplianceStatus, userID *uint, reason string) error {
	var compliance models.CustomerCompliance
	if err := s.DB.First(&compliance, complianceID).Error; err != nil {
		return err
	}

	oldStatus := compliance.Status
	updates := map[string]interface{}{
		"status": newStatus,
	}

	now := time.Now()
	switch newStatus {
	case models.ComplianceStatusApproved:
		updates["approved_at"] = now
		updates["approved_by_user_id"] = userID
		// Set expiration (e.g., 1 year from approval)
		expiresAt := now.AddDate(1, 0, 0)
		updates["expires_at"] = expiresAt
	case models.ComplianceStatusRejected:
		updates["rejected_at"] = now
		updates["rejected_by_user_id"] = userID
		updates["rejection_reason"] = reason
	}

	if err := s.DB.Model(&compliance).Updates(updates).Error; err != nil {
		return err
	}

	// Audit log
	s.logAction(complianceID, compliance.TenantID, "STATUS_CHANGE", string(oldStatus), string(newStatus), userID, false)

	return nil
}

// UploadDocument records a compliance document upload
func (s *ComplianceService) UploadDocument(complianceID uint, tenantID uint, docType, fileName, filePath string, fileSize int64, mimeType string) (*models.ComplianceDocument, error) {
	doc := &models.ComplianceDocument{
		CustomerComplianceID: complianceID,
		TenantID:             tenantID,
		DocumentType:         docType,
		FileName:             fileName,
		FilePath:             filePath,
		FileSize:             fileSize,
		MimeType:             mimeType,
		Status:               "PENDING",
	}

	if err := s.DB.Create(doc).Error; err != nil {
		return nil, err
	}

	// Update compliance status to IN_REVIEW if still PENDING
	s.DB.Model(&models.CustomerCompliance{}).
		Where("id = ? AND status = ?", complianceID, models.ComplianceStatusPending).
		Update("status", models.ComplianceStatusInReview)

	// Audit log
	s.logAction(complianceID, tenantID, "DOCUMENT_UPLOAD", "", docType, nil, false)

	return doc, nil
}

// ReviewDocument reviews an uploaded document
func (s *ComplianceService) ReviewDocument(docID uint, approved bool, notes string, userID *uint) error {
	var doc models.ComplianceDocument
	if err := s.DB.First(&doc, docID).Error; err != nil {
		return err
	}

	status := "APPROVED"
	if !approved {
		status = "REJECTED"
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":              status,
		"reviewed_at":         now,
		"reviewed_by_user_id": userID,
		"review_notes":        notes,
	}

	if err := s.DB.Model(&doc).Updates(updates).Error; err != nil {
		return err
	}

	// Audit log
	s.logAction(doc.CustomerComplianceID, doc.TenantID, "DOCUMENT_REVIEW", "PENDING", status, userID, false)

	return nil
}

// SetRiskLevel updates the risk level for a customer
func (s *ComplianceService) SetRiskLevel(complianceID uint, riskLevel models.RiskLevel, userID *uint, reason string) error {
	var compliance models.CustomerCompliance
	if err := s.DB.First(&compliance, complianceID).Error; err != nil {
		return err
	}

	oldRisk := compliance.RiskLevel
	if err := s.DB.Model(&compliance).Update("risk_level", riskLevel).Error; err != nil {
		return err
	}

	s.logAction(complianceID, compliance.TenantID, "RISK_LEVEL_CHANGE", string(oldRisk), string(riskLevel), userID, false)

	return nil
}

// SetTransactionLimits updates transaction limits for a customer
func (s *ComplianceService) SetTransactionLimits(complianceID uint, dailyLimit, monthlyLimit, perTxLimit float64, userID *uint) error {
	updates := map[string]interface{}{
		"daily_limit":           dailyLimit,
		"monthly_limit":         monthlyLimit,
		"per_transaction_limit": perTxLimit,
	}

	if err := s.DB.Model(&models.CustomerCompliance{}).Where("id = ?", complianceID).Updates(updates).Error; err != nil {
		return err
	}

	s.logAction(complianceID, 0, "LIMITS_UPDATE", "", fmt.Sprintf("D:%.0f M:%.0f T:%.0f", dailyLimit, monthlyLimit, perTxLimit), userID, false)

	return nil
}

// GetPendingReviews returns compliance records pending review
func (s *ComplianceService) GetPendingReviews(tenantID uint, limit int) ([]models.CustomerCompliance, error) {
	var records []models.CustomerCompliance
	query := s.DB.Where("status IN (?, ?)", models.ComplianceStatusPending, models.ComplianceStatusInReview)
	if tenantID > 0 {
		query = query.Where("tenant_id = ?", tenantID)
	}
	if err := query.Order("created_at ASC").Limit(limit).Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// GetExpiringCompliance returns records expiring within the specified days
func (s *ComplianceService) GetExpiringCompliance(tenantID uint, days int) ([]models.CustomerCompliance, error) {
	expiryThreshold := time.Now().AddDate(0, 0, days)

	var records []models.CustomerCompliance
	query := s.DB.Where("status = ? AND expires_at IS NOT NULL AND expires_at <= ?",
		models.ComplianceStatusApproved, expiryThreshold)
	if tenantID > 0 {
		query = query.Where("tenant_id = ?", tenantID)
	}
	if err := query.Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// RecordTransactionCheck records a compliance check performed on a transaction
func (s *ComplianceService) RecordTransactionCheck(tenantID, transactionID uint, checkType, result, details string, blockedReason string) (*models.TransactionComplianceCheck, error) {
	check := &models.TransactionComplianceCheck{
		TransactionID: transactionID,
		TenantID:      tenantID,
		CheckType:     checkType,
		Result:        result,
		Details:       details,
		BlockedReason: blockedReason,
	}

	if err := s.DB.Create(check).Error; err != nil {
		return nil, err
	}

	return check, nil
}

// GetAuditLog returns compliance audit logs
func (s *ComplianceService) GetAuditLog(complianceID uint, limit int) ([]models.ComplianceAuditLog, error) {
	var logs []models.ComplianceAuditLog
	if err := s.DB.Where("customer_compliance_id = ?", complianceID).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs).Error; err != nil {
		return nil, err
	}
	return logs, nil
}

// Helper functions

func (s *ComplianceService) getDailyUsage(tenantID, customerID uint) (float64, error) {
	today := time.Now().Truncate(24 * time.Hour)

	var result struct {
		Total float64
	}

	// Sum transactions for today
	s.DB.Model(&models.Transaction{}).
		Select("COALESCE(SUM(send_amount), 0) as total").
		Where("tenant_id = ? AND client_id = ? AND transaction_date >= ?", tenantID, customerID, today).
		Scan(&result)

	return result.Total, nil
}

func (s *ComplianceService) getMonthlyUsage(tenantID, customerID uint) (float64, error) {
	now := time.Now()
	monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)

	var result struct {
		Total float64
	}

	s.DB.Model(&models.Transaction{}).
		Select("COALESCE(SUM(send_amount), 0) as total").
		Where("tenant_id = ? AND client_id = ? AND transaction_date >= ?", tenantID, customerID, monthStart).
		Scan(&result)

	return result.Total, nil
}

func (s *ComplianceService) logAction(complianceID, tenantID uint, action, previousValue, newValue string, userID *uint, system bool) {
	log := models.ComplianceAuditLog{
		CustomerComplianceID: complianceID,
		TenantID:             tenantID,
		Action:               action,
		PreviousValue:        previousValue,
		NewValue:             newValue,
		PerformedByUserID:    userID,
		PerformedBySystem:    system,
	}
	s.DB.Create(&log)
}
