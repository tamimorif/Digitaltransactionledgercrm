package services

import (
	"api/pkg/models"
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type RemittanceSettlementService struct {
	DB *gorm.DB
}

func NewRemittanceSettlementService(db *gorm.DB) *RemittanceSettlementService {
	return &RemittanceSettlementService{DB: db}
}

// CreateSettlement creates a new settlement linking incoming and outgoing remittances
func (s *RemittanceSettlementService) CreateSettlement(
	tenantID uint,
	outgoingRemittanceID uint,
	incomingRemittanceID uint,
	settlementAmount models.Decimal,
	notes string,
	settledBy uint,
) (*models.RemittanceSettlement, error) {

	// Start transaction
	tx := s.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Get outgoing remittance with FOR UPDATE lock to prevent race conditions
	var outgoing models.OutgoingRemittance
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND tenant_id = ?", outgoingRemittanceID, tenantID).First(&outgoing).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("outgoing remittance not found")
	}

	// Get incoming remittance with FOR UPDATE lock to prevent race conditions
	var incoming models.IncomingRemittance
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND tenant_id = ?", incomingRemittanceID, tenantID).First(&incoming).Error; err != nil {
		tx.Rollback()
		return nil, errors.New("incoming remittance not found")
	}

	// Validate currencies match
	if outgoing.AmountIRR.LessThanOrEqual(models.Zero()) || incoming.AmountIRR.LessThanOrEqual(models.Zero()) {
		tx.Rollback()
		return nil, errors.New("invalid remittance amounts")
	}

	// Calculate remaining amount for outgoing
	outgoingRemaining := outgoing.RemainingIRR

	// Validate settlement amount
	if settlementAmount.GreaterThan(outgoingRemaining) {
		tx.Rollback()
		return nil, errors.New("settlement amount exceeds outgoing remaining balance")
	}

	if settlementAmount.GreaterThan(incoming.RemainingIRR) {
		tx.Rollback()
		return nil, errors.New("settlement amount exceeds incoming remaining balance")
	}

	// Calculate CAD equivalents and profit/loss
	outgoingBuyRate := outgoing.BuyRateCAD
	incomingSellRate := incoming.SellRateCAD

	// Profit calculation:
	// Cost (what we owe): settlementAmount / buyRate
	// Revenue (what we give): settlementAmount / sellRate
	// Profit = cost - revenue
	cost := settlementAmount.Div(outgoingBuyRate)
	revenue := settlementAmount.Div(incomingSellRate)
	profitCAD := cost.Sub(revenue)

	//Convert to pointer for notes
	var notesPtr *string
	if notes != "" {
		notesPtr = &notes
	}

	// Create settlement record using existing schema field names
	settlement := models.RemittanceSettlement{
		TenantID:             tenantID,
		OutgoingRemittanceID: outgoingRemittanceID,
		IncomingRemittanceID: incomingRemittanceID,
		SettledAmountIRR:     settlementAmount, // Existing field name
		OutgoingBuyRate:      outgoingBuyRate,  // Existing field name
		IncomingSellRate:     incomingSellRate, // Existing field name
		ProfitCAD:            profitCAD,        // Existing field name
		Notes:                notesPtr,
		CreatedBy:            settledBy,
	}

	if err := tx.Create(&settlement).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update outgoing remittance
	newSettledAmount := outgoing.SettledAmountIRR.Add(settlementAmount)
	newRemainingAmount := outgoing.AmountIRR.Sub(newSettledAmount)

	threshold := models.NewDecimal(0.01)
	settlementStatus := "PARTIAL"
	if newRemainingAmount.LessThanOrEqual(threshold) { // Standardized threshold: Consider settled if remaining < 0.01
		settlementStatus = "COMPLETED"
		newRemainingAmount = models.Zero()
	}

	outgoingUpdates := map[string]interface{}{
		"settled_amount_irr": newSettledAmount,
		"remaining_irr":      newRemainingAmount,
		"status":             settlementStatus,
		"total_profit_cad":   outgoing.TotalProfitCAD.Add(profitCAD),
	}

	if err := tx.Model(&models.OutgoingRemittance{}).Where("id = ?", outgoingRemittanceID).Updates(outgoingUpdates).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Update incoming remittance
	newAllocatedIRR := incoming.AllocatedIRR.Add(settlementAmount)
	newIncomingRemaining := incoming.AmountIRR.Sub(newAllocatedIRR)

	incomingStatus := "PARTIAL"
	if newIncomingRemaining.LessThanOrEqual(threshold) { // Standardized threshold
		incomingStatus = "COMPLETED"
		newIncomingRemaining = models.Zero()
	}

	incomingUpdates := map[string]interface{}{
		"allocated_irr": newAllocatedIRR,
		"remaining_irr": newIncomingRemaining,
		"status":        incomingStatus,
	}

	if err := tx.Model(&models.IncomingRemittance{}).Where("id = ?", incomingRemittanceID).Updates(incomingUpdates).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &settlement, nil
}

// GetSettlementHistory retrieves settlement history for a remittance
func (s *RemittanceSettlementService) GetSettlementHistory(tenantID uint, remittanceID uint) ([]models.RemittanceSettlement, error) {
	var settlements []models.RemittanceSettlement

	err := s.DB.Where("tenant_id = ? AND (outgoing_remittance_id = ? OR incoming_remittance_id = ?)",
		tenantID, remittanceID, remittanceID).
		Preload("OutgoingRemittance").
		Preload("IncomingRemittance").
		Preload("Creator").
		Order("created_at DESC").
		Find(&settlements).Error

	return settlements, err
}

// GetUnsettledRemittances retrieves remittances pending settlement
func (s *RemittanceSettlementService) GetUnsettledRemittances(tenantID uint, remittanceType string) (interface{}, error) {
	if remittanceType == "outgoing" {
		var remittances []models.OutgoingRemittance
		err := s.DB.Where("tenant_id = ? AND status IN (?)", tenantID, []string{"PENDING", "PARTIAL"}).
			Order("created_at DESC").Find(&remittances).Error
		return remittances, err
	} else {
		var remittances []models.IncomingRemittance
		err := s.DB.Where("tenant_id = ? AND status IN (?)", tenantID, []string{"PENDING", "PARTIAL"}).
			Order("created_at DESC").Find(&remittances).Error
		return remittances, err
	}
}

// GetSettlementSummary returns summary statistics for a remittance
func (s *RemittanceSettlementService) GetSettlementSummary(tenantID uint, remittanceID uint) (map[string]interface{}, error) {
	var outgoing models.OutgoingRemittance
	if err := s.DB.Where("id = ? AND tenant_id = ?", remittanceID, tenantID).First(&outgoing).Error; err != nil {
		return nil, err
	}

	settlements, err := s.GetSettlementHistory(tenantID, remittanceID)
	if err != nil {
		return nil, err
	}

	totalProfit := outgoing.TotalProfitCAD

	summary := map[string]interface{}{
		"remittanceId":     remittanceID,
		"totalAmount":      outgoing.AmountIRR,
		"settledAmount":    outgoing.SettledAmountIRR,
		"remainingAmount":  outgoing.RemainingIRR,
		"currency":         "IRR",
		"settlementStatus": outgoing.Status,
		"totalProfit":      totalProfit,
		"settlementCount":  len(settlements),
		"settlements":      settlements,
	}

	return summary, nil
}
