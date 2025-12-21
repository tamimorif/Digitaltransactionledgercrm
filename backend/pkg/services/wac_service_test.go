package services

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupWACTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open("file::memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto migrate relevant tables
	err = db.AutoMigrate(&CurrencyHolding{}, &WACRecord{})
	if err != nil {
		t.Fatalf("Failed to migrate database: %v", err)
	}

	return db
}

func TestWACService_Workflow(t *testing.T) {
	db := setupWACTestDB(t)
	s := NewWACService(db)
	tenantID := uint(1)
	currency := "USD"

	t.Run("1. Initial Purchase", func(t *testing.T) {
		// Buy 1000 USD at 1.35
		record, err := s.RecordCurrencyPurchase(tenantID, currency, 1000, 1.35, nil, "Initial stock")
		assert.NoError(t, err)
		assert.NotNil(t, record)
		assert.Equal(t, 1000.0, record.NewQuantity)
		assert.Equal(t, 1.35, record.NewWAC)

		// Verify Holding
		inv, err := s.GetCurrencyInventory(tenantID, "CAD")
		assert.NoError(t, err)
		assert.Len(t, inv.Positions, 1)
		assert.Equal(t, 1000.0, inv.Positions[0].Quantity)
		assert.Equal(t, 1.35, inv.Positions[0].WAC)
		assert.Equal(t, 1350.0, inv.Positions[0].TotalCost)
	})

	t.Run("2. Second Purchase (Averaging Down)", func(t *testing.T) {
		// Buy 1000 USD at 1.30
		// Old: 1000 @ 1.35 (Cost 1350)
		// New: 1000 @ 1.30 (Cost 1300)
		// Total: 2000 @ (2650/2000) = 1.325
		record, err := s.RecordCurrencyPurchase(tenantID, currency, 1000, 1.30, nil, "Adding stock")
		assert.NoError(t, err)
		assert.Equal(t, 2000.0, record.NewQuantity)
		assert.Equal(t, 1.325, record.NewWAC) // (1350 + 1300) / 2000 = 1.325

		// Verify Holding
		inv, err := s.GetCurrencyInventory(tenantID, "CAD")
		assert.NoError(t, err)
		assert.Equal(t, 2000.0, inv.Positions[0].Quantity)
		assert.Equal(t, 1.325, inv.Positions[0].WAC)
		assert.Equal(t, 2650.0, inv.Positions[0].TotalCost)
	})

	t.Run("3. Sale with Profit", func(t *testing.T) {
		// Sell 500 USD at 1.40
		// WAC is 1.325
		// Profit = (1.40 - 1.325) * 500 = 0.075 * 500 = 37.5
		record, err := s.RecordCurrencySale(tenantID, currency, 500, 1.40, nil, "Selling part")
		assert.NoError(t, err)
		assert.Equal(t, 1500.0, record.NewQuantity)
		assert.Equal(t, 1.325, record.NewWAC) // WAC shouldn't change on sale
		assert.InDelta(t, 37.5, record.ProfitOrLoss, 0.001)

		// Verify Holding
		inv, err := s.GetCurrencyInventory(tenantID, "CAD")
		assert.NoError(t, err)
		assert.Equal(t, 1500.0, inv.Positions[0].Quantity)
		assert.Equal(t, 1.325, inv.Positions[0].WAC)
		assert.Equal(t, 1987.5, inv.Positions[0].TotalCost) // 1500 * 1.325
	})

	t.Run("4. Sale with Loss", func(t *testing.T) {
		// Sell 500 USD at 1.30
		// WAC is 1.325
		// Loss = (1.30 - 1.325) * 500 = -0.025 * 500 = -12.5
		record, err := s.RecordCurrencySale(tenantID, currency, 500, 1.30, nil, "Stop loss")
		assert.NoError(t, err)
		assert.Equal(t, 1000.0, record.NewQuantity)
		assert.Equal(t, 1.325, record.NewWAC)
		assert.InDelta(t, -12.5, record.ProfitOrLoss, 0.001)
	})

	t.Run("5. History & PL Reporting", func(t *testing.T) {
		// Check history length (2 buys + 2 sells = 4 records)
		history, err := s.GetWACHistory(tenantID, currency, 10)
		assert.NoError(t, err)
		assert.Len(t, history, 4)

		// Check total realized PL
		// 37.5 (profit) - 12.5 (loss) = 25.0
		totalPL, err := s.GetRealizedPL(tenantID, time.Now().Add(-1*time.Hour), time.Now().Add(1*time.Hour))
		assert.NoError(t, err)
		assert.InDelta(t, 25.0, totalPL, 0.001)

		// Check by currency
		plMap, err := s.GetRealizedPLByCurrency(tenantID, time.Now().Add(-1*time.Hour), time.Now().Add(1*time.Hour))
		assert.NoError(t, err)
		assert.InDelta(t, 25.0, plMap["USD"], 0.001)
	})

	t.Run("6. Validation Errors", func(t *testing.T) {
		_, err := s.RecordCurrencyPurchase(tenantID, currency, -100, 1.0, nil, "Bad qty")
		assert.Error(t, err)

		_, err = s.RecordCurrencySale(tenantID, currency, 10000, 1.0, nil, "Oversell") // Have 1000, sell 10000
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "insufficient")
	})
}
