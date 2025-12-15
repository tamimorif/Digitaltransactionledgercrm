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

// CreateOutgoingRemittance creates a new outgoing remittance (Canada to Iran)
func (s *RemittanceService) CreateOutgoingRemittance(req *models.OutgoingRemittance) error {
	// Calculate equivalent CAD
	if req.BuyRateCAD <= 0 {
		return errors.New("buy rate must be greater than 0")
	}

	req.EquivalentCAD = req.AmountIRR / req.BuyRateCAD
	req.TotalCostCAD = req.EquivalentCAD
	req.RemainingIRR = req.AmountIRR
	req.SettledAmountIRR = 0
	req.TotalProfitCAD = 0
	req.Status = models.RemittanceStatusPending

	// Generate unique code
	var count int64
	s.db.Model(&models.OutgoingRemittance{}).Where("tenant_id = ?", req.TenantID).Count(&count)
	req.RemittanceCode = fmt.Sprintf("OUT-%06d", count+1)

	return s.db.Create(req).Error
}

// CreateIncomingRemittance creates a new incoming remittance (Iran to Canada)
func (s *RemittanceService) CreateIncomingRemittance(req *models.IncomingRemittance) error {
	// Calculate equivalent CAD
	if req.SellRateCAD <= 0 {
		return errors.New("sell rate must be greater than 0")
	}

	req.EquivalentCAD = req.AmountIRR / req.SellRateCAD
	req.RemainingIRR = req.AmountIRR
	req.AllocatedIRR = 0
	req.PaidCAD = 0
	req.Status = models.RemittanceStatusPending

	// Generate unique code
	var count int64
	s.db.Model(&models.IncomingRemittance{}).Where("tenant_id = ?", req.TenantID).Count(&count)
	req.RemittanceCode = fmt.Sprintf("IN-%06d", count+1)

	return s.db.Create(req).Error
}

// SettleRemittance creates a settlement between incoming and outgoing remittances
// This is the core function that handles multi-part settlements
func (s *RemittanceService) SettleRemittance(tenantID, outgoingID, incomingID uint, amountIRR float64, userID uint) (*models.RemittanceSettlement, error) {
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
	if amountIRR <= 0 {
		tx.Rollback()
		return nil, errors.New("settlement amount must be greater than 0")
	}

	if amountIRR > outgoing.RemainingIRR {
		tx.Rollback()
		return nil, fmt.Errorf("settlement amount (%f) exceeds remaining debt (%f)", amountIRR, outgoing.RemainingIRR)
	}

	if amountIRR > incoming.RemainingIRR {
		tx.Rollback()
		return nil, fmt.Errorf("settlement amount (%f) exceeds incoming remaining (%f)", amountIRR, incoming.RemainingIRR)
	}

	// Calculate profit from this settlement
	// Profit = Settlement Amount / Sell Rate - Settlement Amount / Buy Rate
	// Or: Settlement Amount * (1/Sell Rate - 1/Buy Rate)
	costCAD := amountIRR / outgoing.BuyRateCAD
	revenueCAD := amountIRR / incoming.SellRateCAD
	profit := costCAD - revenueCAD // Profit = What we spent (cost) - What we received (revenue from settlement)

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
	outgoing.SettledAmountIRR += amountIRR
	outgoing.RemainingIRR -= amountIRR
	outgoing.TotalProfitCAD += profit

	if outgoing.RemainingIRR <= 0.01 { // Allow small floating point error
		outgoing.Status = models.RemittanceStatusCompleted
		now := time.Now()
		outgoing.CompletedAt = &now
	} else if outgoing.SettledAmountIRR > 0 {
		outgoing.Status = models.RemittanceStatusPartial
	}

	if err := tx.Save(&outgoing).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update incoming remittance
	incoming.AllocatedIRR += amountIRR
	incoming.RemainingIRR -= amountIRR

	if incoming.RemainingIRR <= 0.01 { // Allow small floating point error
		incoming.Status = models.RemittanceStatusCompleted
	} else if incoming.AllocatedIRR > 0 {
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

	if incoming.RemainingIRR > 0.01 {
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

	if outgoing.SettledAmountIRR > 0 {
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

	if incoming.AllocatedIRR > 0 {
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

	totalProfit := 0.0
	totalSettlements := len(settlements)

	for _, settlement := range settlements {
		totalProfit += settlement.ProfitCAD
	}

	return map[string]interface{}{
		"totalProfitCAD":   totalProfit,
		"totalSettlements": totalSettlements,
		"averageProfitCAD": func() float64 {
			if totalSettlements > 0 {
				return totalProfit / float64(totalSettlements)
			}
			return 0
		}(),
	}, nil
}
