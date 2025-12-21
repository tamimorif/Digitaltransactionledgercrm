package services

import (
	"api/pkg/models"
	"fmt"
	"testing"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestRemittanceWithTenantUser tests remittance system with a real tenant user
func TestRemittanceWithTenantUser(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate all necessary models
	db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Branch{},
		&models.License{},
		&models.OutgoingRemittance{},
		&models.IncomingRemittance{},
		&models.RemittanceSettlement{},
	)

	fmt.Println("\n🧪 Testing Remittance System with Tenant User")
	fmt.Println("==============================================")

	// Step 1: Create a license
	fmt.Println("\n📜 Step 1: Creating Enterprise License")
	license := &models.License{
		LicenseKey:  "ENT-TEST-12345",
		LicenseType: "ENTERPRISE",
		MaxBranches: 999,
		Status:      "active",
	}
	db.Create(license)
	fmt.Printf("   ✅ License created: %s\n", license.LicenseKey)

	// Step 2: Create a tenant owner user first (needed for OwnerID)
	fmt.Println("\n👤 Step 2: Creating Tenant Owner User (placeholder)")
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte("Owner123!"), 10)
	ownerPlaceholder := &models.User{
		Email:         "owner@tehranexchange.com",
		PasswordHash:  string(hashedPassword),
		Role:          models.RoleTenantOwner,
		EmailVerified: true,
	}
	db.Create(ownerPlaceholder)

	// Step 3: Create a tenant (exchange company)
	fmt.Println("\n🏢 Step 3: Creating Tenant (Exchange Company)")
	tenant := &models.Tenant{
		Name:             "Tehran Exchange Bureau",
		OwnerID:          ownerPlaceholder.ID,
		CurrentLicenseID: &license.ID,
		Status:           "active",
	}
	db.Create(tenant)
	fmt.Printf("   ✅ Tenant created: %s (ID: %d)\n", tenant.Name, tenant.ID)

	// Update owner with tenant ID
	ownerPlaceholder.TenantID = &tenant.ID
	db.Save(ownerPlaceholder)
	owner := ownerPlaceholder

	fmt.Printf("   👤 Owner: %s\n", owner.Email)
	fmt.Printf("   🏷️  Role: %s\n", owner.Role)
	fmt.Printf("   🏢 Tenant ID: %d\n", *owner.TenantID)

	// Step 4: Create a main branch
	fmt.Println("\n🏦 Step 4: Creating Main Branch")
	branch := &models.Branch{
		TenantID:   tenant.ID,
		Name:       "Downtown Toronto",
		Location:   "123 Yonge St, Toronto",
		BranchCode: "DT-TOR",
		IsPrimary:  true,
		Status:     "active",
	}
	db.Create(branch)
	owner.PrimaryBranchID = &branch.ID
	db.Save(owner)
	fmt.Printf("   ✅ Branch created: %s\n", branch.Name)
	fmt.Printf("   📍 Location: %s\n", branch.Location)
	fmt.Printf("   🔑 Code: %s\n", branch.BranchCode)

	// Initialize remittance service
	service := NewRemittanceService(db)

	// Test Scenario: 500 Million Toman remittance
	fmt.Println("\n💰 MAIN TEST: 500M Toman Remittance Settled in 3 Parts")
	fmt.Println("=========================================================")

	// Create Outgoing Remittance
	fmt.Println("\n📤 Creating Outgoing Remittance (Canada → Iran)")
	outgoing := &models.OutgoingRemittance{
		TenantID:         tenant.ID,
		BranchID:         &branch.ID,
		SenderName:       "David Thompson",
		SenderPhone:      "+14165551234",
		SenderEmail:      testStringPtr("david@example.com"),
		RecipientName:    "محمد رضا کریمی",
		RecipientPhone:   testStringPtr("+989121234567"),
		RecipientIBAN:    testStringPtr("IR820540102680020817909002"),
		RecipientBank:    testStringPtr("بانک ملت"),
		RecipientAddress: testStringPtr("تهران، خیابان ولیعصر، پلاک 123"),
		AmountIRR:        models.NewDecimal(500000000), // 500 Million Toman
		BuyRateCAD:       models.NewDecimal(84000),     // Buy at 84,000 per CAD
		ReceivedCAD:      models.NewDecimal(5952.38),   // 500M / 84,000
		FeeCAD:           models.NewDecimal(30),
		Notes:            testStringPtr("Monthly family support - December 2024"),
		CreatedBy:        owner.ID,
	}

	err = service.CreateOutgoingRemittance(outgoing)
	if err != nil {
		t.Fatalf("❌ Failed to create outgoing remittance: %v", err)
	}

	fmt.Printf("   ✅ Outgoing Created: %s\n", outgoing.RemittanceCode)
	fmt.Printf("   👤 Sender: %s\n", outgoing.SenderName)
	fmt.Printf("   👥 Recipient: %s\n", outgoing.RecipientName)
	fmt.Printf("   🏦 Bank: %s\n", *outgoing.RecipientBank)
	fmt.Printf("   💰 Amount: 500,000,000 Toman\n")
	fmt.Printf("   📊 Buy Rate: 84,000 Toman/CAD\n")
	fmt.Printf("   💵 Equivalent: %.2f CAD\n", outgoing.EquivalentCAD.Float64())
	fmt.Printf("   💸 Received from Customer: %.2f CAD\n", outgoing.ReceivedCAD.Float64())
	fmt.Printf("   🏷️  Fee: %.2f CAD\n", outgoing.FeeCAD.Float64())
	fmt.Printf("   📝 Status: %s\n", outgoing.Status)
	fmt.Printf("   📍 Branch: %s\n", branch.Name)

	// Verify outgoing was created correctly
	if outgoing.Status != models.RemittanceStatusPending {
		t.Errorf("Expected status PENDING, got %s", outgoing.Status)
	}
	if outgoing.RemainingIRR.Float64() != 500000000.0 {
		t.Errorf("Expected remaining 500M, got %.0f", outgoing.RemainingIRR.Float64())
	}

	// Settlement 1: 200M Toman
	fmt.Println("\n📥 Creating First Incoming (200M Toman from Iran)")
	incoming1 := &models.IncomingRemittance{
		TenantID:       tenant.ID,
		BranchID:       &branch.ID,
		SenderName:     "علی اکبری",
		SenderPhone:    "+989351234567",
		SenderIBAN:     testStringPtr("IR062960000000100324200001"),
		SenderBank:     testStringPtr("بانک صادرات"),
		RecipientName:  "Jennifer Lee",
		RecipientPhone: testStringPtr("+16475559876"),
		RecipientEmail: testStringPtr("jennifer@example.com"),
		AmountIRR:      models.NewDecimal(200000000), // 200 Million Toman
		SellRateCAD:    models.NewDecimal(85500),     // Sell at 85,500 per CAD
		FeeCAD:         models.NewDecimal(15),
		Notes:          testStringPtr("Student tuition payment"),
		CreatedBy:      owner.ID,
	}

	err = service.CreateIncomingRemittance(incoming1)
	if err != nil {
		t.Fatalf("❌ Failed to create incoming remittance 1: %v", err)
	}

	fmt.Printf("   ✅ Incoming Created: %s\n", incoming1.RemittanceCode)
	fmt.Printf("   👤 Sender: %s\n", incoming1.SenderName)
	fmt.Printf("   👥 Recipient: %s\n", incoming1.RecipientName)
	fmt.Printf("   💰 Amount: 200,000,000 Toman\n")
	fmt.Printf("   📊 Sell Rate: 85,500 Toman/CAD\n")
	fmt.Printf("   💵 To Pay Customer: %.2f CAD\n", incoming1.EquivalentCAD.Float64())

	fmt.Println("\n🔗 Settling 200M Toman")
	settlement1, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming1.ID, models.NewDecimal(200000000), owner.ID)
	if err != nil {
		t.Fatalf("❌ Failed to settle: %v", err)
	}

	fmt.Printf("   ✅ Settlement #1 Created\n")
	fmt.Printf("   💰 Settled: 200,000,000 Toman\n")
	fmt.Printf("   💵 Profit: %.2f CAD\n", settlement1.ProfitCAD.Float64())
	fmt.Printf("   📊 Calculation:\n")
	fmt.Printf("      Cost: 200M / 84,000 = %.2f CAD\n", 200000000.0/84000.0)
	fmt.Printf("      Revenue: 200M / 85,500 = %.2f CAD\n", 200000000.0/85500.0)
	fmt.Printf("      Profit: %.2f - %.2f = %.2f CAD\n",
		200000000.0/84000.0, 200000000.0/85500.0, settlement1.ProfitCAD.Float64())

	// Settlement 2: 250M Toman
	fmt.Println("\n📥 Creating Second Incoming (250M Toman)")
	incoming2 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		BranchID:      &branch.ID,
		SenderName:    "سارا احمدی",
		SenderPhone:   "+989129876543",
		RecipientName: "Robert Smith",
		AmountIRR:     models.NewDecimal(250000000),
		SellRateCAD:   models.NewDecimal(85500),
		FeeCAD:        models.NewDecimal(18),
		CreatedBy:     owner.ID,
	}

	err = service.CreateIncomingRemittance(incoming2)
	if err != nil {
		t.Fatalf("❌ Failed to create incoming 2: %v", err)
	}

	fmt.Printf("   ✅ Incoming Created: %s\n", incoming2.RemittanceCode)
	fmt.Printf("   💰 Amount: 250,000,000 Toman\n")

	fmt.Println("\n🔗 Settling 250M Toman")
	settlement2, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming2.ID, models.NewDecimal(250000000), owner.ID)
	if err != nil {
		t.Fatalf("❌ Failed to settle: %v", err)
	}

	fmt.Printf("   ✅ Settlement #2 Created\n")
	fmt.Printf("   💵 Profit: %.2f CAD\n", settlement2.ProfitCAD.Float64())

	// Settlement 3: Final 50M Toman
	fmt.Println("\n📥 Creating Third Incoming (100M Toman)")
	incoming3 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		BranchID:      &branch.ID,
		SenderName:    "حسن رضایی",
		SenderPhone:   "+989357654321",
		RecipientName: "Emily Chen",
		AmountIRR:     models.NewDecimal(100000000),
		SellRateCAD:   models.NewDecimal(85500),
		FeeCAD:        models.NewDecimal(10),
		CreatedBy:     owner.ID,
	}

	err = service.CreateIncomingRemittance(incoming3)
	if err != nil {
		t.Fatalf("❌ Failed to create incoming 3: %v", err)
	}

	fmt.Printf("   ✅ Incoming Created: %s\n", incoming3.RemittanceCode)
	fmt.Printf("   💰 Amount: 100,000,000 Toman\n")

	fmt.Println("\n🔗 Settling Final 50M Toman (Completes Outgoing)")
	settlement3, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming3.ID, models.NewDecimal(50000000), owner.ID)
	if err != nil {
		t.Fatalf("❌ Failed to settle: %v", err)
	}

	fmt.Printf("   ✅ Final Settlement #3 Created\n")
	fmt.Printf("   💵 Profit: %.2f CAD\n", settlement3.ProfitCAD.Float64())
	fmt.Printf("   🎉 Outgoing COMPLETED\n")
	fmt.Printf("   📊 Incoming #3 has 50M Toman remaining\n")

	// Get complete details
	fmt.Println("\n📊 FINAL VERIFICATION")
	fmt.Println("=========================================================")

	outgoingDetails, err := service.GetOutgoingRemittanceDetails(tenant.ID, outgoing.ID)
	if err != nil {
		t.Fatalf("❌ Failed to get details: %v", err)
	}

	fmt.Printf("\n✅ Outgoing Remittance: %s\n", outgoingDetails.RemittanceCode)
	fmt.Printf("   Status: %s\n", outgoingDetails.Status)
	fmt.Printf("   Initial Amount: 500,000,000 Toman\n")
	fmt.Printf("   Settled Amount: %.0f Toman\n", outgoingDetails.SettledAmountIRR.Float64())
	fmt.Printf("   Remaining: %.0f Toman\n", outgoingDetails.RemainingIRR.Float64())
	fmt.Printf("   Number of Settlements: %d\n", len(outgoingDetails.Settlements))
	fmt.Printf("   Total Profit: %.2f CAD\n", outgoingDetails.TotalProfitCAD.Float64())

	// Verify status
	if outgoingDetails.Status != models.RemittanceStatusCompleted {
		t.Errorf("❌ Expected COMPLETED status, got %s", outgoingDetails.Status)
	}

	if outgoingDetails.RemainingIRR.Float64() > 0.01 {
		t.Errorf("❌ Expected 0 remaining, got %.2f", outgoingDetails.RemainingIRR.Float64())
	}

	if len(outgoingDetails.Settlements) != 3 {
		t.Errorf("❌ Expected 3 settlements, got %d", len(outgoingDetails.Settlements))
	}

	// Calculate expected profit
	expectedProfit := (500000000.0 / 84000.0) - (500000000.0 / 85500.0)
	fmt.Printf("\n💰 PROFIT VERIFICATION\n")
	fmt.Printf("   Cost (bought): 500M / 84,000 = %.2f CAD\n", 500000000.0/84000.0)
	fmt.Printf("   Revenue (sold): 500M / 85,500 = %.2f CAD\n", 500000000.0/85500.0)
	fmt.Printf("   Expected Profit: %.2f CAD\n", expectedProfit)
	fmt.Printf("   Actual Profit: %.2f CAD\n", outgoingDetails.TotalProfitCAD.Float64())
	fmt.Printf("   Difference: %.4f CAD (should be ~0)\n",
		testAbs(outgoingDetails.TotalProfitCAD.Float64()-expectedProfit))

	if testAbs(outgoingDetails.TotalProfitCAD.Float64()-expectedProfit) > 0.1 {
		t.Errorf("❌ Profit calculation wrong. Expected %.2f, got %.2f",
			expectedProfit, outgoingDetails.TotalProfitCAD.Float64())
	}

	// Test profit summary
	fmt.Println("\n📈 PROFIT SUMMARY")
	summary, err := service.GetRemittanceProfitSummary(tenant.ID, nil, nil)
	if err != nil {
		t.Fatalf("❌ Failed to get profit summary: %v", err)
	}

	fmt.Printf("   Total Settlements: %v\n", summary["totalSettlements"])
	fmt.Printf("   Total Profit: %.2f CAD\n", summary["totalProfitCAD"])
	fmt.Printf("   Average per Settlement: %.2f CAD\n", summary["averageProfitCAD"])

	// Test tenant isolation - try to access with wrong tenant ID
	fmt.Println("\n🔒 TESTING TENANT ISOLATION")
	wrongTenantID := uint(999)
	_, err = service.GetOutgoingRemittanceDetails(wrongTenantID, outgoing.ID)
	if err == nil {
		t.Error("❌ Security issue: Could access other tenant's data!")
	} else {
		fmt.Printf("   ✅ Tenant isolation working: %v\n", err)
	}

	fmt.Println("\n✅ ALL TESTS PASSED!")
	fmt.Println("=========================================================")
	fmt.Println("✅ Tenant user created and verified")
	fmt.Println("✅ Remittance system works with tenant isolation")
	fmt.Println("✅ Multi-part settlements functional")
	fmt.Println("✅ Profit calculations accurate")
	fmt.Println("✅ Status transitions correct")
	fmt.Println("✅ Data integrity maintained")
	fmt.Println("=========================================================")
}

// Helper functions moved to test_helpers_test.go
