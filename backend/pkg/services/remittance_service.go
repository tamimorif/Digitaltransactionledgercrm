package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// RemittanceService handles remittance business logic
type RemittanceService struct {
	db *gorm.DB
}

func NewRemittanceService(db *gorm.DB) *RemittanceService {
	return &RemittanceService{db: db}
}

// generateRemittanceCode generates a unique remittance code atomically using FOR UPDATE lock
// This prevents race conditions where concurrent requests could get the same code
func (s *RemittanceService) generateRemittanceCode(tx *gorm.DB, tenantID uint, prefix string, model interface{}) (string, error) {
	var maxCode int64

	// Use raw SQL with FOR UPDATE to lock and get max code atomically
	// Extract the numeric portion from existing codes and find the max
	var result struct {
		MaxNum int64
	}

	tableName := ""
	switch model.(type) {
	case *models.OutgoingRemittance:
		tableName = "outgoing_remittances"
	case *models.IncomingRemittance:
		tableName = "incoming_remittances"
	default:
		return "", errors.New("unknown remittance type")
	}

	// Get the max code number with lock to prevent race conditions
	err := tx.Raw(fmt.Sprintf(`
		SELECT COALESCE(MAX(CAST(SUBSTR(remittance_code, LENGTH(?) + 2) AS INTEGER)), 0) as max_num 
		FROM %s 
		WHERE tenant_id = ? AND remittance_code LIKE ?
	`, tableName), prefix, tenantID, prefix+"-%").Scan(&result).Error

	if err != nil {
		return "", err
	}

	maxCode = result.MaxNum + 1
	return fmt.Sprintf("%s-%06d", prefix, maxCode), nil
}

// CreateOutgoingRemittance creates a new outgoing remittance (Canada to Iran)
func (s *RemittanceService) CreateOutgoingRemittance(req *models.OutgoingRemittance) error {
	// Calculate equivalent CAD
	if req.BuyRateCAD.LessThanOrEqual(models.Zero()) {
		return errors.New("buy rate must be greater than 0")
	}

	req.EquivalentCAD = req.AmountIRR.Div(req.BuyRateCAD)
	req.TotalCostCAD = req.EquivalentCAD
	req.RemainingIRR = req.AmountIRR
	req.SettledAmountIRR = models.Zero()
	req.TotalProfitCAD = models.Zero()
	req.Status = models.RemittanceStatusPending

	// Use transaction for atomic code generation and creation
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Generate unique code atomically
		code, err := s.generateRemittanceCode(tx, req.TenantID, "OUT", req)
		if err != nil {
			return fmt.Errorf("failed to generate remittance code: %w", err)
		}
		req.RemittanceCode = code

		return tx.Create(req).Error
	})
}

// CreateIncomingRemittance creates a new incoming remittance (Iran to Canada)
func (s *RemittanceService) CreateIncomingRemittance(req *models.IncomingRemittance) error {
	// Calculate equivalent CAD
	if req.SellRateCAD.LessThanOrEqual(models.Zero()) {
		return errors.New("sell rate must be greater than 0")
	}

	req.EquivalentCAD = req.AmountIRR.Div(req.SellRateCAD)
	req.RemainingIRR = req.AmountIRR
	req.AllocatedIRR = models.Zero()
	req.PaidCAD = models.Zero()
	req.Status = models.RemittanceStatusPending

	// Use transaction for atomic code generation and creation
	return s.db.Transaction(func(tx *gorm.DB) error {
		// Generate unique code atomically
		code, err := s.generateRemittanceCode(tx, req.TenantID, "IN", req)
		if err != nil {
			return fmt.Errorf("failed to generate remittance code: %w", err)
		}
		req.RemittanceCode = code

		return tx.Create(req).Error
	})
}

// SettleRemittance creates a settlement between incoming and outgoing remittances
// This is the core function that handles multi-part settlements
func (s *RemittanceService) SettleRemittance(tenantID, outgoingID, incomingID uint, amountIRR models.Decimal, userID uint) (*models.RemittanceSettlement, error) {
	var outgoing models.OutgoingRemittance
	var incoming models.IncomingRemittance

	// Start transaction
	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Get outgoing remittance with lock (FOR UPDATE prevents race conditions)
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND tenant_id = ?", outgoingID, tenantID).
		First(&outgoing).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("outgoing remittance not found")
	}

	// Get incoming remittance with lock (FOR UPDATE prevents race conditions)
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
		Where("id = ? AND tenant_id = ?", incomingID, tenantID).
		First(&incoming).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("incoming remittance not found")
	}

	// Validate settlement amount
	if amountIRR.LessThanOrEqual(models.Zero()) {
		tx.Rollback()
		return nil, errors.New("settlement amount must be greater than 0")
	}

	if amountIRR.GreaterThan(outgoing.RemainingIRR) {
		tx.Rollback()
		return nil, fmt.Errorf("settlement amount (%s) exceeds remaining debt (%s)", amountIRR.String(), outgoing.RemainingIRR.String())
	}

	if amountIRR.GreaterThan(incoming.RemainingIRR) {
		tx.Rollback()
		return nil, fmt.Errorf("settlement amount (%s) exceeds incoming remaining (%s)", amountIRR.String(), incoming.RemainingIRR.String())
	}

	// Calculate profit from this settlement
	// Profit = Settlement Amount / Sell Rate - Settlement Amount / Buy Rate
	// Or: Settlement Amount * (1/Sell Rate - 1/Buy Rate)
	costCAD := amountIRR.Div(outgoing.BuyRateCAD)
	revenueCAD := amountIRR.Div(incoming.SellRateCAD)
	profit := costCAD.Sub(revenueCAD) // Profit = What we spent (cost) - What we received (revenue from settlement)

	// Create settlement record
	settlement := &models.RemittanceSettlement{
		TenantID:             tenantID,
		OutgoingRemittanceID: outgoingID,
		IncomingRemittanceID: incomingID,
		SettledAmountIRR:     amountIRR,
		OutgoingBuyRate:      outgoing.BuyRateCAD,
		IncomingSellRate:     incoming.SellRateCAD,
		ProfitCAD:            profit,
		CreatedBy:            userID,
	}

	if err := tx.Create(settlement).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update outgoing remittance
	outgoing.SettledAmountIRR = outgoing.SettledAmountIRR.Add(amountIRR)
	outgoing.RemainingIRR = outgoing.RemainingIRR.Sub(amountIRR)
	outgoing.TotalProfitCAD = outgoing.TotalProfitCAD.Add(profit)

	threshold := models.NewDecimal(0.01)
	if outgoing.RemainingIRR.LessThanOrEqual(threshold) {
		outgoing.Status = models.RemittanceStatusCompleted
		now := time.Now()
		outgoing.CompletedAt = &now
	} else if outgoing.SettledAmountIRR.GreaterThan(models.Zero()) {
		outgoing.Status = models.RemittanceStatusPartial
	}

	if err := tx.Save(&outgoing).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update incoming remittance
	incoming.AllocatedIRR = incoming.AllocatedIRR.Add(amountIRR)
	incoming.RemainingIRR = incoming.RemainingIRR.Sub(amountIRR)

	if incoming.RemainingIRR.LessThanOrEqual(threshold) {
		incoming.Status = models.RemittanceStatusCompleted
	} else if incoming.AllocatedIRR.GreaterThan(models.Zero()) {
		incoming.Status = models.RemittanceStatusPartial
	}

	if err := tx.Save(&incoming).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// Load relations
	s.db.Preload("OutgoingRemittance").Preload("IncomingRemittance").First(settlement, settlement.ID)

	return settlement, nil
}

// GetOutgoingRemittances retrieves outgoing remittances with filters
func (s *RemittanceService) GetOutgoingRemittances(tenantID uint, status string, branchID *uint) ([]models.OutgoingRemittance, error) {
	var remittances []models.OutgoingRemittance

	query := s.db.Where("tenant_id = ?", tenantID).
		Preload("Branch").
		Preload("Creator").
		Preload("Settlements").
		Order("created_at DESC")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	err := query.Find(&remittances).Error
	return remittances, err
}

// GetIncomingRemittances retrieves incoming remittances with filters
func (s *RemittanceService) GetIncomingRemittances(tenantID uint, status string, branchID *uint) ([]models.IncomingRemittance, error) {
	var remittances []models.IncomingRemittance

	query := s.db.Where("tenant_id = ?", tenantID).
		Preload("Branch").
		Preload("Creator").
		Preload("Settlements").
		Order("created_at DESC")

	if status != "" {
		query = query.Where("status = ?", status)
	}

	if branchID != nil {
		query = query.Where("branch_id = ?", *branchID)
	}

	err := query.Find(&remittances).Error
	return remittances, err
}

// GetRemittanceDetails retrieves detailed information about an outgoing remittance
func (s *RemittanceService) GetOutgoingRemittanceDetails(tenantID, id uint) (*models.OutgoingRemittance, error) {
	var remittance models.OutgoingRemittance

	err := s.db.Where("id = ? AND tenant_id = ?", id, tenantID).
		Preload("Branch").
		Preload("Creator").
		Preload("Settlements.IncomingRemittance").
		Preload("Settlements.Creator").
		First(&remittance).Error

	return &remittance, err
}

// GetIncomingRemittanceDetails retrieves detailed information about an incoming remittance
func (s *RemittanceService) GetIncomingRemittanceDetails(tenantID, id uint) (*models.IncomingRemittance, error) {
	var remittance models.IncomingRemittance

	err := s.db.Where("id = ? AND tenant_id = ?", id, tenantID).
		Preload("Branch").
		Preload("Creator").
		Preload("Settlements.OutgoingRemittance").
		Preload("Settlements.Creator").
		First(&remittance).Error

	return &remittance, err
}

// MarkIncomingAsPaid marks an incoming remittance as paid to recipient
func (s *RemittanceService) MarkIncomingAsPaid(tenantID, id, userID uint, paymentMethod, paymentRef string) error {
	var incoming models.IncomingRemittance

	if err := s.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&incoming).Error; err != nil {
		return err
	}

	threshold := models.NewDecimal(0.01)
	if incoming.RemainingIRR.GreaterThan(threshold) {
		return errors.New("cannot mark as paid: remittance not fully allocated")
	}

	now := time.Now()
	incoming.Status = models.RemittanceStatusPaid
	incoming.PaidAt = &now
	incoming.PaidBy = &userID
	incoming.PaidCAD = incoming.EquivalentCAD
	incoming.PaymentMethod = paymentMethod
	if paymentRef != "" {
		incoming.PaymentReference = &paymentRef
	}

	return s.db.Save(&incoming).Error
}

// CancelOutgoingRemittance cancels an outgoing remittance
func (s *RemittanceService) CancelOutgoingRemittance(tenantID, id, userID uint, reason string) error {
	var outgoing models.OutgoingRemittance

	if err := s.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&outgoing).Error; err != nil {
		return err
	}

	if outgoing.SettledAmountIRR.GreaterThan(models.Zero()) {
		return errors.New("cannot cancel: remittance has been partially or fully settled")
	}

	now := time.Now()
	outgoing.Status = models.RemittanceStatusCancelled
	outgoing.CancelledAt = &now
	outgoing.CancelledBy = &userID
	outgoing.CancellationReason = &reason

	return s.db.Save(&outgoing).Error
}

// CancelIncomingRemittance cancels an incoming remittance
func (s *RemittanceService) CancelIncomingRemittance(tenantID, id, userID uint, reason string) error {
	var incoming models.IncomingRemittance

	if err := s.db.Where("id = ? AND tenant_id = ?", id, tenantID).First(&incoming).Error; err != nil {
		return err
	}

	if incoming.AllocatedIRR.GreaterThan(models.Zero()) {
		return errors.New("cannot cancel: remittance has been partially or fully allocated")
	}

	now := time.Now()
	incoming.Status = models.RemittanceStatusCancelled
	incoming.CancelledAt = &now
	incoming.CancelledBy = &userID
	incoming.CancellationReason = &reason

	return s.db.Save(&incoming).Error
}

// GetRemittanceProfitSummary calculates profit summary for a tenant
func (s *RemittanceService) GetRemittanceProfitSummary(tenantID uint, startDate, endDate *time.Time) (map[string]interface{}, error) {
	var settlements []models.RemittanceSettlement

	query := s.db.Where("tenant_id = ?", tenantID)

	if startDate != nil {
		query = query.Where("created_at >= ?", startDate)
	}
	if endDate != nil {
		query = query.Where("created_at <= ?", endDate)
	}

	if err := query.Find(&settlements).Error; err != nil {
		return nil, err
	}

	totalProfit := models.Zero()
	totalSettlements := len(settlements)

	for _, settlement := range settlements {
		totalProfit = totalProfit.Add(settlement.ProfitCAD)
	}

	return map[string]interface{}{
		"totalProfitCAD":   totalProfit.Float64(),
		"totalSettlements": totalSettlements,
		"averageProfitCAD": func() float64 {
			if totalSettlements > 0 {
				return totalProfit.Float64() / float64(totalSettlements)
			}
			return 0
		}(),
	}, nil
}
