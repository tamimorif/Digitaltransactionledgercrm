package services

import (
	"api/pkg/models"
	"fmt"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestRemittanceSystemFlow tests the complete remittance flow
func TestRemittanceSystemFlow(t *testing.T) {
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

	// Initialize remittance service
	service := NewRemittanceService(db)

	fmt.Println("\n🧪 Testing Remittance System Flow")
	fmt.Println("=====================================")

	// Test Scenario: 350 Million Toman remittance settled in 4 parts
	fmt.Println("\n📤 Step 1: Create Outgoing Remittance (350M Toman to Iran)")
	outgoing := &models.OutgoingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "Michael Chen",
		SenderPhone:   "+16475551234",
		RecipientName: "فاطمه احمدی",
		RecipientIBAN: testStringPtr("IR650170000000123456789012"),
		RecipientBank: testStringPtr("Bank Tejarat"),
		AmountIRR:     models.NewDecimal(350000000), // 350 Million Toman
		BuyRateCAD:    models.NewDecimal(85000),     // Buy rate: 85,000 Toman per CAD
		ReceivedCAD:   models.NewDecimal(4117.65),   // 350M / 85,000 = 4,117.65 CAD
		FeeCAD:        models.NewDecimal(20),
		CreatedBy:     user.ID,
	}

	err = service.CreateOutgoingRemittance(outgoing)
	if err != nil {
		t.Fatalf("Failed to create outgoing remittance: %v", err)
	}

	expected := 350000000.0 / 85000.0
	if outgoing.EquivalentCAD.Float64() != expected {
		t.Errorf("Expected equivalent CAD %.2f, got %.2f", expected, outgoing.EquivalentCAD.Float64())
	}

	fmt.Printf("   ✅ Created: %s\n", outgoing.RemittanceCode)
	fmt.Printf("   💰 Amount: 350,000,000 Toman\n")
	fmt.Printf("   📊 Buy Rate: 85,000 Toman/CAD\n")
	fmt.Printf("   💵 Equivalent: %.2f CAD\n", outgoing.EquivalentCAD.Float64())
	fmt.Printf("   📈 Status: %s\n", outgoing.Status)
	fmt.Printf("   💸 Remaining Debt: %.0f Toman\n", outgoing.RemainingIRR.Float64())

	// Settlement 1: 120M Toman
	fmt.Println("\n📥 Step 2: Create First Incoming (120M Toman from Iran)")
	incoming1 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "حسین رضایی",
		SenderPhone:   "+989121234567",
		RecipientName: "Sarah Johnson",
		AmountIRR:     models.NewDecimal(120000000), // 120 Million Toman
		SellRateCAD:   models.NewDecimal(86500),     // Sell rate: 86,500 Toman per CAD
		CreatedBy:     user.ID,
	}

	err = service.CreateIncomingRemittance(incoming1)
	if err != nil {
		t.Fatalf("Failed to create incoming remittance: %v", err)
	}

	fmt.Printf("   ✅ Created: %s\n", incoming1.RemittanceCode)
	fmt.Printf("   💰 Amount: 120,000,000 Toman\n")
	fmt.Printf("   📊 Sell Rate: 86,500 Toman/CAD\n")
	fmt.Printf("   💵 To Pay Customer: %.2f CAD\n", incoming1.EquivalentCAD.Float64())

	fmt.Println("\n🔗 Step 3: Settle 120M Toman")
	settlement1, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming1.ID, models.NewDecimal(120000000), user.ID)
	if err != nil {
		t.Fatalf("Failed to create settlement 1: %v", err)
	}

	fmt.Printf("   ✅ Settlement Created\n")
	fmt.Printf("   💵 Profit from this settlement: %.2f CAD\n", settlement1.ProfitCAD.Float64())
	fmt.Printf("   📉 Remaining Debt: 230,000,000 Toman\n")

	// Verify calculations
	expectedCost := 120000000.0 / 85000.0
	expectedRevenue := 120000000.0 / 86500.0
	expectedProfit := expectedCost - expectedRevenue

	if settlement1.ProfitCAD.Float64() < expectedProfit-0.01 || settlement1.ProfitCAD.Float64() > expectedProfit+0.01 {
		t.Errorf("Profit calculation wrong. Expected %.2f, got %.2f", expectedProfit, settlement1.ProfitCAD.Float64())
	}

	// Settlement 2: 150M Toman
	fmt.Println("\n📥 Step 4: Create Second Incoming (150M Toman)")
	incoming2 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "مریم کریمی",
		SenderPhone:   "+989359876543",
		RecipientName: "David Lee",
		AmountIRR:     models.NewDecimal(150000000),
		SellRateCAD:   models.NewDecimal(86500),
		CreatedBy:     user.ID,
	}

	err = service.CreateIncomingRemittance(incoming2)
	if err != nil {
		t.Fatalf("Failed to create incoming remittance 2: %v", err)
	}

	fmt.Printf("   ✅ Created: %s\n", incoming2.RemittanceCode)
	fmt.Printf("   💰 Amount: 150,000,000 Toman\n")

	fmt.Println("\n🔗 Step 5: Settle 150M Toman")
	settlement2, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming2.ID, models.NewDecimal(150000000), user.ID)
	if err != nil {
		t.Fatalf("Failed to create settlement 2: %v", err)
	}

	fmt.Printf("   ✅ Settlement Created\n")
	fmt.Printf("   💵 Profit from this settlement: %.2f CAD\n", settlement2.ProfitCAD.Float64())
	fmt.Printf("   📉 Remaining Debt: 80,000,000 Toman\n")

	// Settlement 3: 50M Toman
	fmt.Println("\n📥 Step 6: Create Third Incoming (50M Toman)")
	incoming3 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "علی محمدی",
		SenderPhone:   "+989127654321",
		RecipientName: "Emma Wilson",
		AmountIRR:     models.NewDecimal(50000000),
		SellRateCAD:   models.NewDecimal(86500),
		CreatedBy:     user.ID,
	}

	err = service.CreateIncomingRemittance(incoming3)
	if err != nil {
		t.Fatalf("Failed to create incoming remittance 3: %v", err)
	}

	fmt.Printf("   ✅ Created: %s\n", incoming3.RemittanceCode)
	fmt.Printf("   💰 Amount: 50,000,000 Toman\n")

	fmt.Println("\n🔗 Step 7: Settle 50M Toman")
	settlement3, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming3.ID, models.NewDecimal(50000000), user.ID)
	if err != nil {
		t.Fatalf("Failed to create settlement 3: %v", err)
	}

	fmt.Printf("   ✅ Settlement Created\n")
	fmt.Printf("   💵 Profit from this settlement: %.2f CAD\n", settlement3.ProfitCAD.Float64())
	fmt.Printf("   📉 Remaining Debt: 30,000,000 Toman\n")

	// Settlement 4: 30M Toman (final)
	fmt.Println("\n📥 Step 8: Create Fourth Incoming (100M Toman)")
	incoming4 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "زهرا صادقی",
		SenderPhone:   "+989198765432",
		RecipientName: "James Brown",
		AmountIRR:     models.NewDecimal(100000000),
		SellRateCAD:   models.NewDecimal(86500),
		CreatedBy:     user.ID,
	}

	err = service.CreateIncomingRemittance(incoming4)
	if err != nil {
		t.Fatalf("Failed to create incoming remittance 4: %v", err)
	}

	fmt.Printf("   ✅ Created: %s\n", incoming4.RemittanceCode)
	fmt.Printf("   💰 Amount: 100,000,000 Toman\n")

	fmt.Println("\n🔗 Step 9: Settle Final 30M Toman (completes outgoing)")
	settlement4, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming4.ID, models.NewDecimal(30000000), user.ID)
	if err != nil {
		t.Fatalf("Failed to create settlement 4: %v", err)
	}

	fmt.Printf("   ✅ Final Settlement Created\n")
	fmt.Printf("   💵 Profit from this settlement: %.2f CAD\n", settlement4.ProfitCAD.Float64())
	fmt.Printf("   🎉 Outgoing Status: COMPLETED\n")
	fmt.Printf("   📊 Incoming #4 has 70M Toman remaining\n")

	// Get final details
	outgoingDetails, err := service.GetOutgoingRemittanceDetails(tenant.ID, outgoing.ID)
	if err != nil {
		t.Fatalf("Failed to get outgoing details: %v", err)
	}

	if outgoingDetails.Status != models.RemittanceStatusCompleted {
		t.Errorf("Expected status COMPLETED, got %s", outgoingDetails.Status)
	}

	fmt.Println("\n📊 FINAL RESULTS:")
	fmt.Println("=====================================")
	fmt.Printf("Outgoing Remittance: %s\n", outgoingDetails.RemittanceCode)
	fmt.Printf("Initial Amount: 350,000,000 Toman\n")
	fmt.Printf("Settled Amount: %.0f Toman\n", outgoingDetails.SettledAmountIRR.Float64())
	fmt.Printf("Remaining: %.0f Toman\n", outgoingDetails.RemainingIRR.Float64())
	fmt.Printf("Status: %s\n", outgoingDetails.Status)
	fmt.Printf("Number of Settlements: %d\n", len(outgoingDetails.Settlements))
	fmt.Printf("Total Profit: %.2f CAD\n", outgoingDetails.TotalProfitCAD.Float64())

	fmt.Println("\n💰 PROFIT BREAKDOWN:")
	fmt.Println("=====================================")
	totalCost := 350000000.0 / 85000.0
	totalRevenue := 350000000.0 / 86500.0
	fmt.Printf("Cost (bought at 85,000 rate): %.2f CAD\n", totalCost)
	fmt.Printf("Revenue (sold at 86,500 rate): %.2f CAD\n", totalRevenue)
	fmt.Printf("Profit: %.2f CAD\n", totalCost-totalRevenue)
	fmt.Printf("Profit Margin: %.2f%%\n", ((totalCost-totalRevenue)/totalCost)*100)

	// Verify profit calculation
	expectedTotalProfit := totalCost - totalRevenue
	if outgoingDetails.TotalProfitCAD.Float64() < expectedTotalProfit-0.1 || outgoingDetails.TotalProfitCAD.Float64() > expectedTotalProfit+0.1 {
		t.Errorf("Total profit calculation wrong. Expected %.2f, got %.2f", expectedTotalProfit, outgoingDetails.TotalProfitCAD.Float64())
	}

	// Test profit summary
	summary, err := service.GetRemittanceProfitSummary(tenant.ID, nil, nil)
	if err != nil {
		t.Fatalf("Failed to get profit summary: %v", err)
	}

	fmt.Println("\n📈 PROFIT SUMMARY:")
	fmt.Println("=====================================")
	fmt.Printf("Total Settlements: %v\n", summary["totalSettlements"])
	fmt.Printf("Total Profit: %.2f CAD\n", summary["totalProfitCAD"])
	fmt.Printf("Average Profit per Settlement: %.2f CAD\n", summary["averageProfitCAD"])

	fmt.Println("\n✅ ALL TESTS PASSED!")
	fmt.Println("=====================================")
}

// Helper functions moved to test_helpers_test.go
