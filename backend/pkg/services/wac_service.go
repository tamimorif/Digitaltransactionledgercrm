package services

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

// WACService handles Weighted Average Cost tracking for currency inventory
type WACService struct {
	DB *gorm.DB
}

// NewWACService creates a new WACService
func NewWACService(db *gorm.DB) *WACService {
	return &WACService{DB: db}
}

// CurrencyPosition represents the current position in a currency
type CurrencyPosition struct {
	Currency     string  `json:"currency"`
	Quantity     float64 `json:"quantity"`
	WAC          float64 `json:"wac"`          // Weighted Average Cost (per unit)
	TotalCost    float64 `json:"totalCost"`    // Total cost basis
	CurrentValue float64 `json:"currentValue"` // At current market rate
	UnrealizedPL float64 `json:"unrealizedPL"` // Unrealized profit/loss
}

// CurrencyInventory represents the full currency inventory for a tenant
type CurrencyInventory struct {
	TenantID        uint               `json:"tenantId"`
	BaseCurrency    string             `json:"baseCurrency"` // Usually CAD or USD
	Positions       []CurrencyPosition `json:"positions"`
	TotalValue      float64            `json:"totalValue"`
	TotalUnrealized float64            `json:"totalUnrealized"`
	AsOfDate        time.Time          `json:"asOfDate"`
}

// WACRecord tracks historical WAC updates
type WACRecord struct {
	ID               uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID         uint      `gorm:"type:bigint;not null;index" json:"tenantId"`
	Currency         string    `gorm:"type:varchar(10);not null;index" json:"currency"`
	TransactionID    *uint     `gorm:"type:bigint" json:"transactionId"`
	TransactionType  string    `gorm:"type:varchar(20);not null" json:"transactionType"` // BUY, SELL, ADJUSTMENT
	Quantity         float64   `gorm:"not null" json:"quantity"`                         // Positive = buy, negative = sell
	Rate             float64   `gorm:"not null" json:"rate"`                             // Rate at which acquired/sold
	PreviousQuantity float64   `gorm:"not null" json:"previousQuantity"`
	PreviousWAC      float64   `gorm:"not null" json:"previousWac"`
	NewQuantity      float64   `gorm:"not null" json:"newQuantity"`
	NewWAC           float64   `gorm:"not null" json:"newWac"`
	ProfitOrLoss     float64   `json:"profitOrLoss"` // Profit/loss on sale (formerly RealizedPL)
	Notes            string    `gorm:"type:text" json:"notes"`
	CreatedAt        time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
}

func (WACRecord) TableName() string {
	return "wac_records"
}

// CurrencyHolding tracks current holdings per currency per tenant
type CurrencyHolding struct {
	ID        uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID  uint      `gorm:"type:bigint;not null;uniqueIndex:idx_tenant_currency" json:"tenantId"`
	Currency  string    `gorm:"type:varchar(10);not null;uniqueIndex:idx_tenant_currency" json:"currency"`
	Quantity  float64   `gorm:"not null;default:0" json:"quantity"`
	WAC       float64   `gorm:"not null;default:0" json:"wac"` // Weighted Average Cost
	TotalCost float64   `gorm:"not null;default:0" json:"totalCost"`
	UpdatedAt time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
}

func (CurrencyHolding) TableName() string {
	return "currency_holdings"
}

// RecordCurrencyPurchase records a currency purchase and updates WAC
func (s *WACService) RecordCurrencyPurchase(tenantID uint, currency string, quantity, rate float64, txID *uint, notes string) (*WACRecord, error) {
	if quantity <= 0 {
		return nil, fmt.Errorf("purchase quantity must be positive")
	}
	if rate <= 0 {
		return nil, fmt.Errorf("rate must be positive")
	}

	// Get or create holding
	holding, err := s.getOrCreateHolding(tenantID, currency)
	if err != nil {
		return nil, err
	}

	// Calculate new WAC
	// New WAC = (Old Total Cost + New Purchase Cost) / (Old Quantity + New Quantity)
	oldTotalCost := holding.Quantity * holding.WAC
	newPurchaseCost := quantity * rate
	newTotalCost := oldTotalCost + newPurchaseCost
	newQuantity := holding.Quantity + quantity
	newWAC := newTotalCost / newQuantity

	// Create record
	record := &WACRecord{
		TenantID:         tenantID,
		Currency:         currency,
		TransactionID:    txID,
		TransactionType:  "BUY",
		Quantity:         quantity,
		Rate:             rate,
		PreviousQuantity: holding.Quantity,
		PreviousWAC:      holding.WAC,
		NewQuantity:      newQuantity,
		NewWAC:           newWAC,
		ProfitOrLoss:     0, // No realized P/L on purchase
		Notes:            notes,
		CreatedAt:        time.Now(),
	}

	// Update holding
	holding.Quantity = newQuantity
	holding.WAC = newWAC
	holding.TotalCost = newTotalCost
	holding.UpdatedAt = time.Now()

	// Save both in transaction
	err = s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		return tx.Save(holding).Error
	})

	if err != nil {
		return nil, err
	}

	return record, nil
}

// RecordCurrencySale records a currency sale, calculates realized P/L, and updates position
func (s *WACService) RecordCurrencySale(tenantID uint, currency string, quantity, rate float64, txID *uint, notes string) (*WACRecord, error) {
	if quantity <= 0 {
		return nil, fmt.Errorf("sale quantity must be positive")
	}
	if rate <= 0 {
		return nil, fmt.Errorf("rate must be positive")
	}

	// Get holding
	holding, err := s.getOrCreateHolding(tenantID, currency)
	if err != nil {
		return nil, err
	}

	if holding.Quantity < quantity {
		return nil, fmt.Errorf("insufficient %s balance: have %.2f, need %.2f", currency, holding.Quantity, quantity)
	}

	// Calculate realized P/L
	// Realized P/L = (Sale Rate - WAC) * Quantity Sold
	profitOrLoss := (rate - holding.WAC) * quantity
	fmt.Printf("DEBUG: Rate=%.4f WAC=%.4f Qty=%.4f PL=%.4f\n", rate, holding.WAC, quantity, profitOrLoss)

	// Calculate new position
	newQuantity := holding.Quantity - quantity
	// WAC stays the same for sales (FIFO/WAC method)
	newWAC := holding.WAC
	if newQuantity == 0 {
		newWAC = 0 // Reset WAC when position is fully closed
	}
	newTotalCost := newQuantity * newWAC

	// Create record
	record := &WACRecord{
		TenantID:         tenantID,
		Currency:         currency,
		TransactionID:    txID,
		TransactionType:  "SELL",
		Quantity:         -quantity, // Negative for sales
		Rate:             rate,
		PreviousQuantity: holding.Quantity,
		PreviousWAC:      holding.WAC,
		NewQuantity:      newQuantity,
		NewWAC:           newWAC,
		ProfitOrLoss:     profitOrLoss,
		Notes:            notes,
		CreatedAt:        time.Now(),
	}

	// Update holding
	holding.Quantity = newQuantity
	holding.WAC = newWAC
	holding.TotalCost = newTotalCost
	holding.UpdatedAt = time.Now()

	// Save both in transaction
	err = s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		return tx.Save(holding).Error
	})

	if err != nil {
		return nil, err
	}

	return record, nil
}

// GetCurrencyInventory returns current currency inventory for a tenant
func (s *WACService) GetCurrencyInventory(tenantID uint, baseCurrency string) (*CurrencyInventory, error) {
	var holdings []CurrencyHolding
	if err := s.DB.Where("tenant_id = ? AND quantity > 0", tenantID).Find(&holdings).Error; err != nil {
		return nil, err
	}

	inventory := &CurrencyInventory{
		TenantID:     tenantID,
		BaseCurrency: baseCurrency,
		Positions:    make([]CurrencyPosition, 0, len(holdings)),
		AsOfDate:     time.Now(),
	}

	for _, h := range holdings {
		pos := CurrencyPosition{
			Currency:  h.Currency,
			Quantity:  h.Quantity,
			WAC:       h.WAC,
			TotalCost: h.TotalCost,
		}
		// TODO: Get current market rate to calculate unrealized P/L
		// For now, we'll set current value equal to cost (no unrealized P/L)
		pos.CurrentValue = pos.TotalCost
		pos.UnrealizedPL = 0

		inventory.Positions = append(inventory.Positions, pos)
		inventory.TotalValue += pos.CurrentValue
	}

	return inventory, nil
}

// GetWACHistory returns WAC change history for a currency
func (s *WACService) GetWACHistory(tenantID uint, currency string, limit int) ([]WACRecord, error) {
	var records []WACRecord
	query := s.DB.Where("tenant_id = ?", tenantID)
	if currency != "" {
		query = query.Where("currency = ?", currency)
	}
	if err := query.Order("created_at DESC").Limit(limit).Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

// GetRealizedPL returns total realized P/L for a period
func (s *WACService) GetRealizedPL(tenantID uint, startDate, endDate time.Time) (float64, error) {
	var result struct {
		TotalPL float64
	}
	if err := s.DB.Model(&WACRecord{}).
		Select("COALESCE(SUM(profit_or_loss), 0) as total_pl").
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Scan(&result).Error; err != nil {
		return 0, err
	}
	return result.TotalPL, nil
}

// GetRealizedPLByCurrency returns realized P/L broken down by currency
func (s *WACService) GetRealizedPLByCurrency(tenantID uint, startDate, endDate time.Time) (map[string]float64, error) {
	var results []struct {
		Currency string
		TotalPL  float64
	}
	if err := s.DB.Model(&WACRecord{}).
		Select("currency, COALESCE(SUM(profit_or_loss), 0) as total_pl").
		Where("tenant_id = ? AND created_at BETWEEN ? AND ?", tenantID, startDate, endDate).
		Group("currency").
		Scan(&results).Error; err != nil {
		return nil, err
	}

	plMap := make(map[string]float64)
	for _, r := range results {
		plMap[r.Currency] = r.TotalPL
	}
	return plMap, nil
}

// Helper functions

func (s *WACService) getOrCreateHolding(tenantID uint, currency string) (*CurrencyHolding, error) {
	var holding CurrencyHolding
	err := s.DB.Where("tenant_id = ? AND currency = ?", tenantID, currency).First(&holding).Error
	if err == gorm.ErrRecordNotFound {
		holding = CurrencyHolding{
			TenantID:  tenantID,
			Currency:  currency,
			Quantity:  0,
			WAC:       0,
			TotalCost: 0,
			UpdatedAt: time.Now(),
		}
		if err := s.DB.Create(&holding).Error; err != nil {
			return nil, err
		}
	} else if err != nil {
		return nil, err
	}
	return &holding, nil
}

// AdjustInventory allows manual adjustment of currency holdings (for corrections)
func (s *WACService) AdjustInventory(tenantID uint, currency string, quantityDelta, newWAC float64, reason string) (*WACRecord, error) {
	holding, err := s.getOrCreateHolding(tenantID, currency)
	if err != nil {
		return nil, err
	}

	newQuantity := holding.Quantity + quantityDelta
	if newQuantity < 0 {
		return nil, fmt.Errorf("adjustment would result in negative quantity")
	}

	// If no new WAC specified, keep the old one
	if newWAC <= 0 {
		newWAC = holding.WAC
	}
	newTotalCost := newQuantity * newWAC

	record := &WACRecord{
		TenantID:         tenantID,
		Currency:         currency,
		TransactionType:  "ADJUSTMENT",
		Quantity:         quantityDelta,
		Rate:             newWAC,
		PreviousQuantity: holding.Quantity,
		PreviousWAC:      holding.WAC,
		NewQuantity:      newQuantity,
		NewWAC:           newWAC,
		ProfitOrLoss:     0,
		Notes:            reason,
		CreatedAt:        time.Now(),
	}

	holding.Quantity = newQuantity
	holding.WAC = newWAC
	holding.TotalCost = newTotalCost
	holding.UpdatedAt = time.Now()

	err = s.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(record).Error; err != nil {
			return err
		}
		return tx.Save(holding).Error
	})

	return record, err
}
