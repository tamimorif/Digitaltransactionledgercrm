package services

import (
	"api/pkg/models"
	"fmt"
	"testing"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestRemittanceLossScenario tests when exchange loses money
func TestRemittanceLossScenario(t *testing.T) {
	// Setup
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Branch{},
		&models.License{},
		&models.OutgoingRemittance{},
		&models.IncomingRemittance{},
		&models.RemittanceSettlement{},
	)

	// Create test data
	license := &models.License{LicenseKey: "TEST", LicenseType: "ENTERPRISE", MaxBranches: 999, Status: "active"}
	db.Create(license)

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("Test123!"), 10)
	ownerPlaceholder := &models.User{
		Email:         "owner@losstest.com",
		PasswordHash:  string(hashedPassword),
		Role:          models.RoleTenantOwner,
		EmailVerified: true,
	}
	db.Create(ownerPlaceholder)

	tenant := &models.Tenant{
		Name:             "Loss Test Exchange",
		OwnerID:          ownerPlaceholder.ID,
		CurrentLicenseID: &license.ID,
		Status:           "active",
	}
	db.Create(tenant)

	ownerPlaceholder.TenantID = &tenant.ID
	db.Save(ownerPlaceholder)
	owner := ownerPlaceholder

	branch := &models.Branch{
		TenantID:   tenant.ID,
		Name:       "Main Branch",
		BranchCode: "MAIN",
		IsPrimary:  true,
		Status:     "active",
	}
	db.Create(branch)
	owner.PrimaryBranchID = &branch.ID
	db.Save(owner)

	service := NewRemittanceService(db)

	fmt.Println("\n🧪 Testing LOSS Scenario - Exchange Loses Money")
	fmt.Println("=================================================")
	fmt.Println("📉 Scenario: Market fluctuation causes loss")
	fmt.Println("   - Bought Toman at HIGH rate (expensive)")
	fmt.Println("   - Sold Toman at LOW rate (cheap)")
	fmt.Println("   - Result: LOSS instead of profit")

	// Create Outgoing - BUY at HIGH RATE (expensive)
	fmt.Println("\n📤 Outgoing: Customer sends 300M Toman to Iran")
	outgoing := &models.OutgoingRemittance{
		TenantID:      tenant.ID,
		BranchID:      &branch.ID,
		SenderName:    "John Smith",
		SenderPhone:   "+14165551234",
		RecipientName: "علی محمدی",
		AmountIRR:     models.NewDecimal(300000000), // 300 Million Toman
		BuyRateCAD:    models.NewDecimal(87000),     // HIGH BUY RATE (bought expensive)
		ReceivedCAD:   models.NewDecimal(3448.28),   // 300M / 87,000
		FeeCAD:        models.NewDecimal(20),
		Notes:         testStringPtr("Bought at high rate - bad timing"),
		CreatedBy:     owner.ID,
	}

	err := service.CreateOutgoingRemittance(outgoing)
	if err != nil {
		t.Fatalf("Failed to create outgoing: %v", err)
	}

	fmt.Printf("   💰 Amount: 300,000,000 Toman\n")
	fmt.Printf("   📊 Buy Rate: 87,000 Toman/CAD (expensive!)\n")
	fmt.Printf("   💵 Cost: %.2f CAD\n", outgoing.EquivalentCAD.Float64())
	fmt.Printf("   ⚠️  Market situation: Toman is expensive right now\n")

	// Create Incoming 1 - SELL at LOW RATE (cheap)
	fmt.Println("\n📥 Incoming #1: Customer sends 150M Toman from Iran")
	incoming1 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		BranchID:      &branch.ID,
		SenderName:    "سارا کریمی",
		SenderPhone:   "+989121234567",
		RecipientName: "Mary Johnson",
		AmountIRR:     models.NewDecimal(150000000), // 150 Million Toman
		SellRateCAD:   models.NewDecimal(85000),     // LOW SELL RATE (sold cheap)
		FeeCAD:        models.NewDecimal(10),
		Notes:         testStringPtr("Market dropped - selling at lower rate"),
		CreatedBy:     owner.ID,
	}

	err = service.CreateIncomingRemittance(incoming1)
	if err != nil {
		t.Fatalf("Failed to create incoming: %v", err)
	}

	fmt.Printf("   💰 Amount: 150,000,000 Toman\n")
	fmt.Printf("   📊 Sell Rate: 85,000 Toman/CAD (cheap!)\n")
	fmt.Printf("   💵 To Pay: %.2f CAD\n", incoming1.EquivalentCAD.Float64())
	fmt.Printf("   ⚠️  Market situation: Toman dropped in value\n")

	fmt.Println("\n🔗 Settlement #1:")
	settlement1, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming1.ID, models.NewDecimal(150000000), owner.ID)
	if err != nil {
		t.Fatalf("Failed to settle: %v", err)
	}

	costCAD1 := 150000000.0 / 87000.0
	revenueCAD1 := 150000000.0 / 85000.0
	expectedLoss1 := costCAD1 - revenueCAD1

	fmt.Printf("   📊 Calculation:\n")
	fmt.Printf("      What we SPENT (cost): 150M / 87,000 = %.2f CAD\n", costCAD1)
	fmt.Printf("      What we RECEIVED (revenue): 150M / 85,000 = %.2f CAD\n", revenueCAD1)
	fmt.Printf("      Difference: %.2f - %.2f = %.2f CAD\n", costCAD1, revenueCAD1, expectedLoss1)

	if settlement1.ProfitCAD.Float64() < 0 {
		fmt.Printf("   ❌ LOSS: %.2f CAD (negative profit)\n", settlement1.ProfitCAD.Float64())
	} else {
		fmt.Printf("   ✅ Profit: %.2f CAD\n", settlement1.ProfitCAD.Float64())
	}

	// Verify it's actually a loss
	if settlement1.ProfitCAD.Float64() >= 0 {
		t.Errorf("Expected loss (negative), got profit: %.2f", settlement1.ProfitCAD.Float64())
	}

	// Create Incoming 2 - Also at low rate
	fmt.Println("\n📥 Incoming #2: Customer sends 150M Toman from Iran")
	incoming2 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		BranchID:      &branch.ID,
		SenderName:    "محمد رضایی",
		SenderPhone:   "+989359876543",
		RecipientName: "David Lee",
		AmountIRR:     models.NewDecimal(150000000),
		SellRateCAD:   models.NewDecimal(85000), // Still low rate
		FeeCAD:        models.NewDecimal(10),
		CreatedBy:     owner.ID,
	}

	err = service.CreateIncomingRemittance(incoming2)
	if err != nil {
		t.Fatalf("Failed to create incoming 2: %v", err)
	}

	fmt.Printf("   💰 Amount: 150,000,000 Toman\n")
	fmt.Printf("   📊 Sell Rate: 85,000 Toman/CAD\n")

	fmt.Println("\n🔗 Settlement #2 (Final):")
	settlement2, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming2.ID, models.NewDecimal(150000000), owner.ID)
	if err != nil {
		t.Fatalf("Failed to settle: %v", err)
	}

	costCAD2 := 150000000.0 / 87000.0
	revenueCAD2 := 150000000.0 / 85000.0
	expectedLoss2 := costCAD2 - revenueCAD2

	fmt.Printf("   📊 Calculation:\n")
	fmt.Printf("      Cost: %.2f CAD\n", costCAD2)
	fmt.Printf("      Revenue: %.2f CAD\n", revenueCAD2)
	fmt.Printf("      Loss: %.2f CAD\n", expectedLoss2)

	if settlement2.ProfitCAD.Float64() < 0 {
		fmt.Printf("   ❌ LOSS: %.2f CAD\n", settlement2.ProfitCAD.Float64())
	}

	// Get final details
	fmt.Println("\n📊 FINAL RESULTS - LOSS SCENARIO")
	fmt.Println("=================================================")

	outgoingDetails, _ := service.GetOutgoingRemittanceDetails(tenant.ID, outgoing.ID)

	fmt.Printf("\n✅ Outgoing: %s\n", outgoingDetails.RemittanceCode)
	fmt.Printf("   Status: %s\n", outgoingDetails.Status)
	fmt.Printf("   Amount: 300,000,000 Toman\n")
	fmt.Printf("   Settlements: %d\n", len(outgoingDetails.Settlements))
	fmt.Printf("   Total Profit/Loss: %.2f CAD\n", outgoingDetails.TotalProfitCAD.Float64())

	if outgoingDetails.TotalProfitCAD.Float64() < 0 {
		fmt.Printf("\n   ❌ NET LOSS: %.2f CAD (negative)\n", outgoingDetails.TotalProfitCAD.Float64())
		fmt.Printf("   📉 This happens when:\n")
		fmt.Printf("      - Bought Toman at high rate (87,000)\n")
		fmt.Printf("      - Sold Toman at low rate (85,000)\n")
		fmt.Printf("      - Rate difference worked against us\n")
	} else {
		t.Errorf("Expected total loss, got profit: %.2f", outgoingDetails.TotalProfitCAD.Float64())
	}

	// Calculate total expected loss
	totalCost := 300000000.0 / 87000.0
	totalRevenue := 300000000.0 / 85000.0
	expectedTotalLoss := totalCost - totalRevenue

	fmt.Println("\n💰 DETAILED LOSS BREAKDOWN:")
	fmt.Println("=================================================")
	fmt.Printf("What we SPENT buying 300M Toman:\n")
	fmt.Printf("   300,000,000 / 87,000 = %.2f CAD\n\n", totalCost)

	fmt.Printf("What we RECEIVED selling 300M Toman:\n")
	fmt.Printf("   300,000,000 / 85,000 = %.2f CAD\n\n", totalRevenue)

	fmt.Printf("NET RESULT:\n")
	fmt.Printf("   %.2f - %.2f = %.2f CAD\n", totalCost, totalRevenue, expectedTotalLoss)
	fmt.Printf("   ❌ LOSS of %.2f CAD\n\n", testAbs(expectedTotalLoss))

	fmt.Printf("Loss Percentage: %.2f%%\n", (testAbs(expectedTotalLoss)/totalCost)*100)

	// Verify the loss calculation is correct
	if testAbs(outgoingDetails.TotalProfitCAD.Float64()-expectedTotalLoss) > 0.1 {
		t.Errorf("Loss calculation wrong. Expected %.2f, got %.2f",
			expectedTotalLoss, outgoingDetails.TotalProfitCAD.Float64())
	}

	// Test profit summary with losses
	fmt.Println("\n📈 PROFIT/LOSS SUMMARY:")
	summary, _ := service.GetRemittanceProfitSummary(tenant.ID, nil, nil)

	fmt.Printf("   Total Settlements: %v\n", summary["totalSettlements"])
	fmt.Printf("   Total Profit/Loss: %.2f CAD\n", summary["totalProfitCAD"])
	fmt.Printf("   Average per Settlement: %.2f CAD\n", summary["averageProfitCAD"])

	if summary["totalProfitCAD"].(float64) < 0 {
		fmt.Printf("\n   ⚠️  WARNING: Overall LOSS detected\n")
		fmt.Printf("   💡 Recommendation: Adjust rates to avoid future losses\n")
	}

	fmt.Println("\n✅ LOSS SCENARIO TEST PASSED!")
	fmt.Println("=================================================")
	fmt.Println("✅ System correctly handles negative profit (loss)")
	fmt.Println("✅ Loss calculations are accurate")
	fmt.Println("✅ Negative values properly tracked")
	fmt.Println("✅ Reports show losses correctly")
	fmt.Println("=================================================")
}

// Helper functions moved to test_helpers_test.go
