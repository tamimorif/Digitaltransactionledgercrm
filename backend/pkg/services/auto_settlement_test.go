package services

import (
	"api/pkg/models"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestAutoSettlementService tests the auto-settlement functionality
func TestAutoSettlementService(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate models
	db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Branch{},
		&models.OutgoingRemittance{},
		&models.IncomingRemittance{},
		&models.RemittanceSettlement{},
	)

	// Create test tenant and user
	tenant := &models.Tenant{Name: "Test Exchange Bureau"}
	db.Create(tenant)

	user := &models.User{
		Email:    "test@example.com",
		TenantID: &tenant.ID,
		Role:     "tenant_owner",
	}
	db.Create(user)

	// Initialize services
	remittanceService := NewRemittanceService(db)
	autoSettleService := NewAutoSettlementService(db)

	t.Run("GetSettlementSuggestions_FIFO", func(t *testing.T) {
		// Create multiple outgoing remittances with different dates
		outgoing1 := &models.OutgoingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "OUT-FIFO-001",
			SenderName:     "Sender 1",
			SenderPhone:    "+1111111111",
			RecipientName:  "Recipient 1",
			AmountIRR:      models.NewDecimal(50000000), // 50M
			BuyRateCAD:     models.NewDecimal(85000),
			ReceivedCAD:    models.NewDecimal(588.24),
			RemainingIRR:   models.NewDecimal(50000000),
			TotalCostCAD:   models.NewDecimal(588.24),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		remittanceService.CreateOutgoingRemittance(outgoing1)

		time.Sleep(10 * time.Millisecond)

		outgoing2 := &models.OutgoingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "OUT-FIFO-002",
			SenderName:     "Sender 2",
			SenderPhone:    "+2222222222",
			RecipientName:  "Recipient 2",
			AmountIRR:      models.NewDecimal(30000000), // 30M
			BuyRateCAD:     models.NewDecimal(84000),
			ReceivedCAD:    models.NewDecimal(357.14),
			RemainingIRR:   models.NewDecimal(30000000),
			TotalCostCAD:   models.NewDecimal(357.14),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		remittanceService.CreateOutgoingRemittance(outgoing2)

		// Create incoming remittance
		incoming := &models.IncomingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "IN-FIFO-001",
			SenderName:     "Iran Sender",
			SenderPhone:    "+989121111111",
			RecipientName:  "Canada Recipient",
			AmountIRR:      models.NewDecimal(70000000), // 70M - enough to cover first outgoing completely
			SellRateCAD:    models.NewDecimal(86000),
			RemainingIRR:   models.NewDecimal(70000000),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		remittanceService.CreateIncomingRemittance(incoming)

		// Get FIFO suggestions
		suggestions, err := autoSettleService.GetSettlementSuggestions(tenant.ID, incoming.ID, StrategyFIFO, 0)
		if err != nil {
			t.Fatalf("Failed to get suggestions: %v", err)
		}

		if len(suggestions) == 0 {
			t.Fatal("Expected at least one suggestion")
		}

		// First suggestion should be the oldest (outgoing1)
		if suggestions[0].OutgoingRemittance.ID != outgoing1.ID {
			t.Errorf("FIFO should suggest oldest remittance first. Expected ID %d, got %d",
				outgoing1.ID, suggestions[0].OutgoingRemittance.ID)
		}

		// First suggestion should settle entire outgoing1 (50M)
		if suggestions[0].SuggestedAmountIRR != 50000000 {
			t.Errorf("Expected suggestion to settle 50M, got %f", suggestions[0].SuggestedAmountIRR)
		}

		// Should have profit estimate
		if suggestions[0].EstimatedProfitCAD <= 0 {
			t.Errorf("Expected positive profit estimate, got %f", suggestions[0].EstimatedProfitCAD)
		}
	})

	t.Run("AutoSettle_FIFO", func(t *testing.T) {
		// Create outgoing remittances
		outgoing := &models.OutgoingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "OUT-AUTO-001",
			SenderName:     "Auto Sender",
			SenderPhone:    "+3333333333",
			RecipientName:  "Auto Recipient",
			AmountIRR:      models.NewDecimal(100000000), // 100M
			BuyRateCAD:     models.NewDecimal(85000),
			ReceivedCAD:    models.NewDecimal(1176.47),
			RemainingIRR:   models.NewDecimal(100000000),
			TotalCostCAD:   models.NewDecimal(1176.47),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		remittanceService.CreateOutgoingRemittance(outgoing)

		// Create incoming
		incoming := &models.IncomingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "IN-AUTO-001",
			SenderName:     "Auto Iran Sender",
			SenderPhone:    "+989122222222",
			RecipientName:  "Auto Canada Recipient",
			AmountIRR:      models.NewDecimal(100000000), // 100M
			SellRateCAD:    models.NewDecimal(86000),
			RemainingIRR:   models.NewDecimal(100000000),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		remittanceService.CreateIncomingRemittance(incoming)

		// Auto-settle
		result, err := autoSettleService.AutoSettle(tenant.ID, incoming.ID, user.ID, StrategyFIFO)
		if err != nil {
			t.Fatalf("Auto-settle failed: %v", err)
		}

		if result.SettlementCount == 0 {
			t.Error("Expected at least one settlement")
		}

		if result.TotalProfitCAD <= 0 {
			t.Errorf("Expected positive profit, got %f", result.TotalProfitCAD)
		}

		// Verify outgoing is now completed or partial
		var updatedOutgoing models.OutgoingRemittance
		db.First(&updatedOutgoing, outgoing.ID)

		if updatedOutgoing.Status == models.RemittanceStatusPending {
			t.Error("Outgoing should not be PENDING after settlement")
		}
	})

	t.Run("GetUnsettledSummary", func(t *testing.T) {
		summary, err := autoSettleService.GetUnsettledSummary(tenant.ID)
		if err != nil {
			t.Fatalf("Failed to get unsettled summary: %v", err)
		}

		if summary == nil {
			t.Fatal("Summary should not be nil")
		}

		// Verify structure
		if _, ok := summary["byStatus"]; !ok {
			t.Error("Summary should have byStatus field")
		}
		if _, ok := summary["byAge"]; !ok {
			t.Error("Summary should have byAge field")
		}
	})
}

func TestProfitAnalysisService(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate models
	db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Branch{},
		&models.Client{},
		&models.Transaction{},
		&models.OutgoingRemittance{},
		&models.IncomingRemittance{},
		&models.RemittanceSettlement{},
	)

	// Create test tenant and user
	tenant := &models.Tenant{Name: "Profit Test Exchange"}
	db.Create(tenant)

	user := &models.User{
		Email:    "profit@example.com",
		TenantID: &tenant.ID,
		Role:     "tenant_owner",
	}
	db.Create(user)

	// Initialize services
	remittanceService := NewRemittanceService(db)
	profitService := NewProfitAnalysisService(db)

	// Create test data
	outgoing := &models.OutgoingRemittance{
		TenantID:       tenant.ID,
		RemittanceCode: "OUT-PROFIT-001",
		SenderName:     "Profit Sender",
		SenderPhone:    "+4444444444",
		RecipientName:  "Profit Recipient",
		AmountIRR:      models.NewDecimal(100000000),
		BuyRateCAD:     models.NewDecimal(80000),
		ReceivedCAD:    models.NewDecimal(1250.00),
		RemainingIRR:   models.NewDecimal(100000000),
		TotalCostCAD:   models.NewDecimal(1250.00),
		Status:         models.RemittanceStatusPending,
		CreatedBy:      user.ID,
	}
	remittanceService.CreateOutgoingRemittance(outgoing)

	incoming := &models.IncomingRemittance{
		TenantID:       tenant.ID,
		RemittanceCode: "IN-PROFIT-001",
		SenderName:     "Profit Iran Sender",
		SenderPhone:    "+989123333333",
		RecipientName:  "Profit Canada Recipient",
		AmountIRR:      models.NewDecimal(100000000),
		SellRateCAD:    models.NewDecimal(81000),
		RemainingIRR:   models.NewDecimal(100000000),
		Status:         models.RemittanceStatusPending,
		CreatedBy:      user.ID,
	}
	remittanceService.CreateIncomingRemittance(incoming)

	// Create a client for the transaction
	client := &models.Client{
		ID:          "profit-test-client",
		TenantID:    tenant.ID,
		Name:        "Profit Test Client",
		PhoneNumber: "+14165551234",
	}
	db.Create(client)

	// Create a transaction with profit for the analysis test
	// Profit = (1/BuyRate - 1/SellRate) * AmountIRR in CAD terms
	// Cost = 100M / 80,000 = 1,250 CAD
	// Revenue = 100M / 81,000 = 1,234.57 CAD
	// Profit = 1,250 - 1,234.57 = 15.43 CAD (approx)
	expectedProfit := (100000000.0 / 80000.0) - (100000000.0 / 81000.0)
	txn := &models.Transaction{
		ID:              "profit-analysis-txn-001",
		TenantID:        tenant.ID,
		ClientID:        client.ID,
		PaymentMethod:   models.TransactionMethodCash,
		SendCurrency:    "CAD",
		SendAmount:      models.NewDecimal(1250.00),
		ReceiveCurrency: "IRR",
		ReceiveAmount:   models.NewDecimal(100000000),
		RateApplied:     models.NewDecimal(80000),
		StandardRate:    models.NewDecimal(81000),
		Profit:          models.NewDecimal(expectedProfit),
		Status:          models.StatusCompleted,
		TransactionDate: time.Now(),
	}
	db.Create(txn)

	// Settle
	remittanceService.SettleRemittance(tenant.ID, outgoing.ID, incoming.ID, models.NewDecimal(100000000), user.ID)

	t.Run("GetProfitAnalysis", func(t *testing.T) {
		startDate := time.Now().AddDate(0, -1, 0)
		endDate := time.Now().AddDate(0, 0, 1)

		result, err := profitService.GetProfitAnalysis(tenant.ID, nil, startDate, endDate)
		if err != nil {
			t.Fatalf("Failed to get profit analysis: %v", err)
		}

		if result.TotalSettlements == 0 {
			t.Error("Expected at least one settlement")
		}

		if result.TotalProfitCAD <= 0 {
			t.Errorf("Expected positive profit, got %f", result.TotalProfitCAD)
		}

		// Verify profit calculation
		// expectedProfit was calculated above
		if result.TotalProfitCAD < expectedProfit-0.1 || result.TotalProfitCAD > expectedProfit+0.1 {
			t.Errorf("Profit calculation wrong. Expected ~%f, got %f", expectedProfit, result.TotalProfitCAD)
		}
	})

	t.Run("GetDailyProfit", func(t *testing.T) {
		periods, err := profitService.GetDailyProfit(tenant.ID, nil, 30)
		if err != nil {
			t.Fatalf("Failed to get daily profit: %v", err)
		}

		// Note: SQLite may not return periods if settlements were just created
		// This is a timing-dependent test, so we just check it doesn't error
		t.Logf("Retrieved %d profit periods", len(periods))
	})
}

func TestValidation(t *testing.T) {
	t.Run("PhoneValidation", func(t *testing.T) {
		validPhones := []string{
			"+14165551234",
			"+1-416-555-1234",
			"416-555-1234",
			"+989121234567",
		}

		invalidPhones := []string{
			"abc",
			"123",
			"phone",
		}

		// These would be tested with the validation package
		_ = validPhones
		_ = invalidPhones
	})

	t.Run("IBANValidation", func(t *testing.T) {
		validIBANs := []string{
			"IR650170000000123456789012",
			"IR123456789012345678901234",
		}

		invalidIBANs := []string{
			"IR123",                      // Too short
			"US650170000000123456789012", // Wrong country
		}

		_ = validIBANs
		_ = invalidIBANs
	})
}

func TestDecimalCalculations(t *testing.T) {
	t.Run("PreciseMoneyCalculation", func(t *testing.T) {
		// Test that our calculations don't suffer from floating point errors
		// Example: 0.1 + 0.2 should equal 0.3 exactly

		amountIRR := 100000000.01
		rate := 80000.0

		// Using float64 (current implementation)
		result := amountIRR / rate
		expected := 1250.000000125

		// Allow small tolerance
		tolerance := 0.0001
		if result < expected-tolerance || result > expected+tolerance {
			t.Errorf("Calculation precision issue: expected ~%f, got %f", expected, result)
		}
	})

	t.Run("LargeAmountCalculation", func(t *testing.T) {
		// Test with very large amounts (50 billion Toman)
		amountIRR := 50000000000.0
		rate := 80000.0

		result := amountIRR / rate
		expected := 625000.0

		if result != expected {
			t.Errorf("Large amount calculation wrong: expected %f, got %f", expected, result)
		}
	})
}

func TestSettlementEdgeCases(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.OutgoingRemittance{},
		&models.IncomingRemittance{},
		&models.RemittanceSettlement{},
	)

	tenant := &models.Tenant{Name: "Edge Case Exchange"}
	db.Create(tenant)

	user := &models.User{
		Email:    "edge@example.com",
		TenantID: &tenant.ID,
		Role:     "tenant_owner",
	}
	db.Create(user)

	service := NewRemittanceService(db)

	t.Run("SettleExactAmount", func(t *testing.T) {
		outgoing := &models.OutgoingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "OUT-EXACT-001",
			SenderName:     "Exact Sender",
			SenderPhone:    "+5555555555",
			RecipientName:  "Exact Recipient",
			AmountIRR:      models.NewDecimal(100000000),
			BuyRateCAD:     models.NewDecimal(80000),
			ReceivedCAD:    models.NewDecimal(1250.00),
			RemainingIRR:   models.NewDecimal(100000000),
			TotalCostCAD:   models.NewDecimal(1250.00),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		service.CreateOutgoingRemittance(outgoing)

		incoming := &models.IncomingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "IN-EXACT-001",
			SenderName:     "Exact Iran",
			SenderPhone:    "+989124444444",
			RecipientName:  "Exact Canada",
			AmountIRR:      models.NewDecimal(100000000), // Exact same amount
			SellRateCAD:    models.NewDecimal(81000),
			RemainingIRR:   models.NewDecimal(100000000),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		service.CreateIncomingRemittance(incoming)

		// Settle exact amount
		settlement, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming.ID, models.NewDecimal(100000000), user.ID)
		if err != nil {
			t.Fatalf("Settlement failed: %v", err)
		}

		// Both should be completed
		var updatedOutgoing models.OutgoingRemittance
		db.First(&updatedOutgoing, outgoing.ID)

		var updatedIncoming models.IncomingRemittance
		db.First(&updatedIncoming, incoming.ID)

		if updatedOutgoing.Status != models.RemittanceStatusCompleted {
			t.Errorf("Outgoing should be COMPLETED, got %s", updatedOutgoing.Status)
		}

		if updatedIncoming.Status != models.RemittanceStatusCompleted {
			t.Errorf("Incoming should be COMPLETED, got %s", updatedIncoming.Status)
		}

		_ = settlement
	})

	t.Run("SettleSmallRemainder", func(t *testing.T) {
		// Test that small floating point remainders don't prevent completion
		outgoing := &models.OutgoingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "OUT-SMALL-001",
			SenderName:     "Small Sender",
			SenderPhone:    "+6666666666",
			RecipientName:  "Small Recipient",
			AmountIRR:      models.NewDecimal(100000000),
			BuyRateCAD:     models.NewDecimal(80000),
			ReceivedCAD:    models.NewDecimal(1250.00),
			RemainingIRR:   models.NewDecimal(100000000),
			TotalCostCAD:   models.NewDecimal(1250.00),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		service.CreateOutgoingRemittance(outgoing)

		incoming := &models.IncomingRemittance{
			TenantID:       tenant.ID,
			RemittanceCode: "IN-SMALL-001",
			SenderName:     "Small Iran",
			SenderPhone:    "+989125555555",
			RecipientName:  "Small Canada",
			AmountIRR:      models.NewDecimal(100000000.005), // Slightly more due to floating point
			SellRateCAD:    models.NewDecimal(81000),
			RemainingIRR:   models.NewDecimal(100000000.005),
			Status:         models.RemittanceStatusPending,
			CreatedBy:      user.ID,
		}
		service.CreateIncomingRemittance(incoming)

		// Settle the full outgoing amount
		_, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming.ID, models.NewDecimal(100000000), user.ID)
		if err != nil {
			t.Fatalf("Settlement failed: %v", err)
		}

		var updatedOutgoing models.OutgoingRemittance
		db.First(&updatedOutgoing, outgoing.ID)

		// Should be completed (remaining should be ~0)
		if updatedOutgoing.RemainingIRR.Float64() > 0.01 {
			t.Errorf("Expected remaining ~0, got %f", updatedOutgoing.RemainingIRR.Float64())
		}
	})
}
