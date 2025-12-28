package services

import (
	"api/pkg/models"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupBatchPaymentTestDB creates an in-memory database for testing
func setupBatchPaymentTestDB(t *testing.T) *gorm.DB {
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
		&models.Payment{},
		&models.LedgerEntry{},
		&models.CashBalance{},
		&models.CashAdjustment{},
	)

	return db
}

// createTestTenantAndUser creates test tenant and user for batch payment tests
func createTestTenantAndUser(db *gorm.DB) (*models.Tenant, *models.User) {
	tenant := &models.Tenant{Name: "Batch Payment Test Exchange"}
	db.Create(tenant)

	user := &models.User{
		Email:    "batch@example.com",
		TenantID: &tenant.ID,
		Role:     "tenant_owner",
	}
	db.Create(user)

	return tenant, user
}

// createTestTransactions creates test transactions for batch payment tests
func createTestTransactions(db *gorm.DB, tenantID uint) []models.Transaction {
	// Create a test client first
	client := &models.Client{
		ID:          "test-client-batch-001",
		TenantID:    tenantID,
		Name:        "Batch Test Client",
		PhoneNumber: "+14165551234",
	}
	db.Create(client)

	transactions := []models.Transaction{
		{
			ID:                  "txn-batch-001",
			TenantID:            tenantID,
			ClientID:            client.ID,
			PaymentMethod:       models.TransactionMethodCash,
			SendCurrency:        "CAD",
			SendAmount:          models.NewDecimal(1000),
			ReceiveCurrency:     "IRR",
			ReceiveAmount:       models.NewDecimal(85000000),
			ReceivedCurrency:    "CAD",
			TotalReceived:       models.NewDecimal(1000),
			TotalPaid:           models.NewDecimal(0),
			RemainingBalance:    models.NewDecimal(1000),
			RateApplied:         models.NewDecimal(85000),
			AllowPartialPayment: true,
			PaymentStatus:       models.PaymentStatusOpen,
			Status:              models.StatusCompleted,
		},
		{
			ID:                  "txn-batch-002",
			TenantID:            tenantID,
			ClientID:            client.ID,
			PaymentMethod:       models.TransactionMethodCash,
			SendCurrency:        "CAD",
			SendAmount:          models.NewDecimal(500),
			ReceiveCurrency:     "IRR",
			ReceiveAmount:       models.NewDecimal(42500000),
			ReceivedCurrency:    "CAD",
			TotalReceived:       models.NewDecimal(500),
			TotalPaid:           models.NewDecimal(0),
			RemainingBalance:    models.NewDecimal(500),
			RateApplied:         models.NewDecimal(85000),
			AllowPartialPayment: true,
			PaymentStatus:       models.PaymentStatusOpen,
			Status:              models.StatusCompleted,
		},
		{
			ID:                  "txn-batch-003",
			TenantID:            tenantID,
			ClientID:            client.ID,
			PaymentMethod:       models.TransactionMethodCash,
			SendCurrency:        "CAD",
			SendAmount:          models.NewDecimal(750),
			ReceiveCurrency:     "IRR",
			ReceiveAmount:       models.NewDecimal(63750000),
			ReceivedCurrency:    "CAD",
			TotalReceived:       models.NewDecimal(750),
			TotalPaid:           models.NewDecimal(0),
			RemainingBalance:    models.NewDecimal(750),
			RateApplied:         models.NewDecimal(85000),
			AllowPartialPayment: true,
			PaymentStatus:       models.PaymentStatusOpen,
			Status:              models.StatusCompleted,
		},
	}

	for i := range transactions {
		// Add small delay to ensure different created_at times for FIFO testing
		time.Sleep(10 * time.Millisecond)
		db.Create(&transactions[i])
	}

	return transactions
}

func TestBatchPaymentService_PreviewBatchPayment_FIFO(t *testing.T) {
	db := setupBatchPaymentTestDB(t)
	tenant, _ := createTestTenantAndUser(db)
	transactions := createTestTransactions(db, tenant.ID)

	// Create service (payment service not needed for preview)
	service := NewBatchPaymentService(db, nil)

	// Test FIFO allocation with $1200 (should fully pay first, partially second)
	request := BatchPaymentRequest{
		TransactionIDs: []string{transactions[0].ID, transactions[1].ID, transactions[2].ID},
		TotalAmount:    1200,
		Currency:       "CAD",
		ExchangeRate:   1,
		PaymentMethod:  "CASH",
		Strategy:       "FIFO",
	}

	preview, err := service.PreviewBatchPayment(tenant.ID, request)
	if err != nil {
		t.Fatalf("PreviewBatchPayment failed: %v", err)
	}

	// Should have 3 allocations
	if len(preview.Allocations) != 3 {
		t.Errorf("Expected 3 allocations, got %d", len(preview.Allocations))
	}

	// First transaction should get full $1000
	if preview.Allocations[0].AllocatedAmount != 1000 {
		t.Errorf("First allocation should be 1000, got %f", preview.Allocations[0].AllocatedAmount)
	}
	if !preview.Allocations[0].IsFullPayment {
		t.Error("First allocation should be marked as full payment")
	}

	// Second transaction should get remaining $200
	if preview.Allocations[1].AllocatedAmount != 200 {
		t.Errorf("Second allocation should be 200, got %f", preview.Allocations[1].AllocatedAmount)
	}

	// Third transaction should get $0
	if preview.Allocations[2].AllocatedAmount != 0 {
		t.Errorf("Third allocation should be 0, got %f", preview.Allocations[2].AllocatedAmount)
	}

	// Total allocated should equal input
	if preview.TotalAllocated != 1200 {
		t.Errorf("Total allocated should be 1200, got %f", preview.TotalAllocated)
	}

	// Unallocated should be 0
	if preview.Unallocated != 0 {
		t.Errorf("Unallocated should be 0, got %f", preview.Unallocated)
	}

	t.Logf("FIFO Preview: %d transactions paid", preview.TransactionsPaid)
}

func TestBatchPaymentService_PreviewBatchPayment_Proportional(t *testing.T) {
	db := setupBatchPaymentTestDB(t)
	tenant, _ := createTestTenantAndUser(db)
	transactions := createTestTransactions(db, tenant.ID)

	service := NewBatchPaymentService(db, nil)

	// Test proportional allocation with $450 (20% of total $2250)
	request := BatchPaymentRequest{
		TransactionIDs: []string{transactions[0].ID, transactions[1].ID, transactions[2].ID},
		TotalAmount:    450,
		Currency:       "CAD",
		ExchangeRate:   1,
		PaymentMethod:  "CASH",
		Strategy:       "PROPORTIONAL",
	}

	preview, err := service.PreviewBatchPayment(tenant.ID, request)
	if err != nil {
		t.Fatalf("PreviewBatchPayment failed: %v", err)
	}

	// Total: $1000 + $500 + $750 = $2250
	// Proportions: 44.4%, 22.2%, 33.3%
	// Allocations: ~$200, ~$100, ~$150

	// First should get ~$200 (1000/2250 * 450 = 200)
	if preview.Allocations[0].AllocatedAmount < 199 || preview.Allocations[0].AllocatedAmount > 201 {
		t.Errorf("First allocation should be ~200, got %f", preview.Allocations[0].AllocatedAmount)
	}

	// Second should get ~$100 (500/2250 * 450 = 100)
	if preview.Allocations[1].AllocatedAmount < 99 || preview.Allocations[1].AllocatedAmount > 101 {
		t.Errorf("Second allocation should be ~100, got %f", preview.Allocations[1].AllocatedAmount)
	}

	// Third should get ~$150 (750/2250 * 450 = 150)
	if preview.Allocations[2].AllocatedAmount < 149 || preview.Allocations[2].AllocatedAmount > 151 {
		t.Errorf("Third allocation should be ~150, got %f", preview.Allocations[2].AllocatedAmount)
	}

	t.Logf("Proportional Preview: allocations = [%.2f, %.2f, %.2f]",
		preview.Allocations[0].AllocatedAmount,
		preview.Allocations[1].AllocatedAmount,
		preview.Allocations[2].AllocatedAmount)
}

func TestBatchPaymentService_GetPendingTransactions(t *testing.T) {
	db := setupBatchPaymentTestDB(t)
	tenant, _ := createTestTenantAndUser(db)
	createTestTransactions(db, tenant.ID)

	service := NewBatchPaymentService(db, nil)

	pending, err := service.GetPendingTransactions(tenant.ID)
	if err != nil {
		t.Fatalf("GetPendingTransactions failed: %v", err)
	}

	if len(pending) != 3 {
		t.Errorf("Expected 3 pending transactions, got %d", len(pending))
	}

	// Should be ordered by created_at ASC (oldest first)
	for i := 0; i < len(pending)-1; i++ {
		if pending[i].CreatedAt.After(pending[i+1].CreatedAt) {
			t.Error("Transactions should be ordered by created_at ASC")
		}
	}

	t.Logf("Found %d pending transactions", len(pending))
}

func TestBatchPaymentService_ExceedsRemainingBalance(t *testing.T) {
	db := setupBatchPaymentTestDB(t)
	tenant, _ := createTestTenantAndUser(db)
	transactions := createTestTransactions(db, tenant.ID)

	service := NewBatchPaymentService(db, nil)

	// Try to allocate more than total remaining ($5000 > $2250)
	request := BatchPaymentRequest{
		TransactionIDs: []string{transactions[0].ID, transactions[1].ID, transactions[2].ID},
		TotalAmount:    5000,
		Currency:       "CAD",
		ExchangeRate:   1,
		PaymentMethod:  "CASH",
		Strategy:       "FIFO",
	}

	preview, err := service.PreviewBatchPayment(tenant.ID, request)
	if err != nil {
		t.Fatalf("PreviewBatchPayment failed: %v", err)
	}

	// Should only allocate up to total remaining
	totalRemaining := 1000.0 + 500.0 + 750.0
	if preview.TotalAllocated != totalRemaining {
		t.Errorf("Total allocated should be %f, got %f", totalRemaining, preview.TotalAllocated)
	}

	// Unallocated should be the excess
	expectedUnallocated := 5000 - totalRemaining
	if preview.Unallocated != expectedUnallocated {
		t.Errorf("Unallocated should be %f, got %f", expectedUnallocated, preview.Unallocated)
	}

	t.Logf("Excess payment: allocated %.2f, unallocated %.2f", preview.TotalAllocated, preview.Unallocated)
}
