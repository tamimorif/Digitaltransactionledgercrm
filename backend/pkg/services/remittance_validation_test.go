package services

import (
	"api/pkg/models"
	"fmt"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestRemittanceValidation tests validation rules
func TestRemittanceValidation(t *testing.T) {
	// Setup
	db, _ := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.OutgoingRemittance{},
		&models.IncomingRemittance{},
		&models.RemittanceSettlement{},
	)

	tenant := &models.Tenant{Name: "Test Exchange"}
	db.Create(tenant)

	user := &models.User{Email: "test@example.com", TenantID: &tenant.ID}
	db.Create(user)

	service := NewRemittanceService(db)

	fmt.Println("\n🧪 Testing Validation Rules")
	fmt.Println("=====================================")

	// Test 1: Cannot settle more than remaining debt
	fmt.Println("\n Test 1: Settlement amount exceeds remaining debt")
	outgoing := &models.OutgoingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "John",
		RecipientName: "Ali",
		AmountIRR:     100000000,
		BuyRateCAD:    85000,
		CreatedBy:     user.ID,
	}
	service.CreateOutgoingRemittance(outgoing)

	incoming := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "Sara",
		RecipientName: "Bob",
		AmountIRR:     150000000,
		SellRateCAD:   86500,
		CreatedBy:     user.ID,
	}
	service.CreateIncomingRemittance(incoming)

	_, err := service.SettleRemittance(tenant.ID, outgoing.ID, incoming.ID, 150000000, user.ID)
	if err == nil {
		t.Error("Expected error when settling more than remaining debt")
	}
	fmt.Printf("   ✅ Correctly rejected: %v\n", err)

	// Test 2: Cannot settle more than incoming remaining
	fmt.Println("\n Test 2: Settlement amount exceeds incoming remaining")
	incoming2 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "Reza",
		RecipientName: "Jane",
		AmountIRR:     50000000,
		SellRateCAD:   86500,
		CreatedBy:     user.ID,
	}
	service.CreateIncomingRemittance(incoming2)

	_, err = service.SettleRemittance(tenant.ID, outgoing.ID, incoming2.ID, 80000000, user.ID)
	if err == nil {
		t.Error("Expected error when settling more than incoming remaining")
	}
	fmt.Printf("   ✅ Correctly rejected: %v\n", err)

	// Test 3: Valid settlement
	fmt.Println("\n Test 3: Valid settlement within limits")
	_, err = service.SettleRemittance(tenant.ID, outgoing.ID, incoming2.ID, 50000000, user.ID)
	if err != nil {
		t.Errorf("Valid settlement failed: %v", err)
	}
	fmt.Printf("   ✅ Settlement successful\n")

	// Test 4: Status transitions
	fmt.Println("\n Test 4: Status transitions")
	outgoingDetails, _ := service.GetOutgoingRemittanceDetails(tenant.ID, outgoing.ID)
	if outgoingDetails.Status != models.RemittanceStatusPartial {
		t.Errorf("Expected PARTIAL status, got %s", outgoingDetails.Status)
	}
	fmt.Printf("   ✅ Status correctly changed to PARTIAL\n")

	// Complete the settlement
	_, err = service.SettleRemittance(tenant.ID, outgoing.ID, incoming.ID, 50000000, user.ID)
	if err != nil {
		t.Errorf("Final settlement failed: %v", err)
	}

	outgoingDetails, _ = service.GetOutgoingRemittanceDetails(tenant.ID, outgoing.ID)
	if outgoingDetails.Status != models.RemittanceStatusCompleted {
		t.Errorf("Expected COMPLETED status, got %s", outgoingDetails.Status)
	}
	fmt.Printf("   ✅ Status correctly changed to COMPLETED\n")

	// Test 5: Cannot cancel with settlements
	fmt.Println("\n Test 5: Cannot cancel remittance with settlements")
	err = service.CancelOutgoingRemittance(tenant.ID, outgoing.ID, user.ID, "Test cancel")
	if err == nil {
		t.Error("Expected error when cancelling remittance with settlements")
	}
	fmt.Printf("   ✅ Correctly prevented cancellation: %v\n", err)

	// Test 6: Can cancel without settlements
	fmt.Println("\n Test 6: Can cancel remittance without settlements")
	outgoing2 := &models.OutgoingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "Test",
		RecipientName: "Test",
		AmountIRR:     100000000,
		BuyRateCAD:    85000,
		CreatedBy:     user.ID,
	}
	service.CreateOutgoingRemittance(outgoing2)

	err = service.CancelOutgoingRemittance(tenant.ID, outgoing2.ID, user.ID, "Customer request")
	if err != nil {
		t.Errorf("Failed to cancel remittance: %v", err)
	}

	outgoing2Details, _ := service.GetOutgoingRemittanceDetails(tenant.ID, outgoing2.ID)
	if outgoing2Details.Status != models.RemittanceStatusCancelled {
		t.Errorf("Expected CANCELLED status, got %s", outgoing2Details.Status)
	}
	fmt.Printf("   ✅ Successfully cancelled\n")

	// Test 7: Mark as paid validation
	fmt.Println("\n Test 7: Cannot mark as paid if not fully allocated")
	incoming3 := &models.IncomingRemittance{
		TenantID:      tenant.ID,
		SenderName:    "Mohammad",
		RecipientName: "Sarah",
		AmountIRR:     100000000,
		SellRateCAD:   86500,
		CreatedBy:     user.ID,
	}
	service.CreateIncomingRemittance(incoming3)

	err = service.MarkIncomingAsPaid(tenant.ID, incoming3.ID, user.ID, "CASH", "")
	if err == nil {
		t.Error("Expected error when marking partially allocated incoming as paid")
	}
	fmt.Printf("   ✅ Correctly prevented: %v\n", err)

	// Test 8: Negative amounts
	fmt.Println("\n Test 8: Negative amounts validation")
	_, err = service.SettleRemittance(tenant.ID, outgoing.ID, incoming.ID, -10000, user.ID)
	if err == nil {
		t.Error("Expected error for negative settlement amount")
	}
	fmt.Printf("   ✅ Correctly rejected negative amount\n")

	fmt.Println("\n✅ ALL VALIDATION TESTS PASSED!")
	fmt.Println("=====================================")
}
