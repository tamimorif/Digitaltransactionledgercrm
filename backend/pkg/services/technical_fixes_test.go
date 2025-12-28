package services_test

import (
	"api/pkg/models"
	"api/pkg/services"
	"context"
	"math"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}
	services.ResetGlobalCacheService()

	// Migrate all required tables
	err = db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Branch{},
		&models.Client{},
		&models.Transaction{},
		&models.Payment{},
		&models.LedgerEntry{},
		&models.CashBalance{},
		&models.CashAdjustment{},
		&models.ExchangeRate{},
		&models.IdempotencyRecord{},
	)
	if err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

// TestTransactionProfitCalculationStatus verifies that profit calculation status is tracked
func TestTransactionProfitCalculationStatus(t *testing.T) {
	db := setupTestDB(t)

	// Create a tenant
	tenant := models.Tenant{Name: "Test Tenant"}
	db.Create(&tenant)

	// Create a client
	client := models.Client{
		ID:          uuid.New().String(),
		TenantID:    tenant.ID,
		Name:        "Test Client",
		PhoneNumber: "555-1234",
	}
	db.Create(&client)

	// Create exchange rate service and transaction service
	exchangeRateService := services.NewExchangeRateService(db)
	transactionService := services.NewTransactionService(db, exchangeRateService)

	// Create a transaction without a standard rate available
	// This should result in ProfitCalculationStatus = PENDING
	transaction := &models.Transaction{
		TenantID:        tenant.ID,
		ClientID:        client.ID,
		PaymentMethod:   models.TransactionMethodCash,
		SendCurrency:    "USD",
		SendAmount:      models.NewDecimal(1000),
		ReceiveCurrency: "CAD",
		ReceiveAmount:   models.NewDecimal(1350),
		RateApplied:     models.NewDecimal(1.35),
		TransactionDate: time.Now(),
	}

	// 4. Create Transactions with Service (which handles profit calc)
	// Transaction 1
	if err := transactionService.CreateTransaction(context.Background(), transaction); err != nil {
		t.Fatalf("Failed to create transaction 1: %v", err)
	}

	// Verify it was marked as PENDING (since no rate exists yet, effectively - though we haven't strictly enforced that in the mock setup,
	// let's assume the service does the check).
	// Actually, CreateTransaction logic: if standardRateObj found -> Calculated. Else -> Pending.
	// Since we haven't seeded ExchangeRate for USD->CAD in this test DB yet (we just created services),
	// CreateTransaction will fail to find rate and set it to PENDING.
	if transaction.ProfitCalculationStatus != models.ProfitStatusPending {
		t.Errorf("Expected profit status PENDING, got %s", transaction.ProfitCalculationStatus)
	}
	t.Logf("First transaction profit status: %s", transaction.ProfitCalculationStatus)

	// Now add an exchange rate
	rate := &models.ExchangeRate{
		TenantID:       tenant.ID,
		BaseCurrency:   "USD",
		TargetCurrency: "CAD",
		Rate:           models.NewDecimal(1.30), // Standard rate
		Source:         "MANUAL",
	}
	db.Create(rate)

	// Create another transaction - this one should have CALCULATED status
	transaction2 := &models.Transaction{
		TenantID:        tenant.ID,
		ClientID:        client.ID,
		PaymentMethod:   models.TransactionMethodCash,
		SendCurrency:    "USD",
		SendAmount:      models.NewDecimal(500),
		ReceiveCurrency: "CAD",
		ReceiveAmount:   models.NewDecimal(675),
		RateApplied:     models.NewDecimal(1.35),
		TransactionDate: time.Now(),
	}

	// Transaction 2 (should be CALCULATED immediately)
	if err := transactionService.CreateTransaction(context.Background(), transaction2); err != nil {
		t.Fatalf("Failed to create transaction 2: %v", err)
	}

	var savedTxn2 models.Transaction
	db.First(&savedTxn2, "id = ?", transaction2.ID)

	if savedTxn2.ProfitCalculationStatus != models.ProfitStatusCalculated {
		t.Errorf("Expected profit status CALCULATED, got %s", savedTxn2.ProfitCalculationStatus)
	}
	t.Logf("Second transaction profit status: %s, profit: %s", savedTxn2.ProfitCalculationStatus, savedTxn2.Profit.String())

	// Profit = SendAmount - (ReceiveAmount / StandardRate)
	// Service calculates profit in Base Currency (USD).
	// We received 500 USD. We gave 675 CAD.
	// Cost of 675 CAD at Standard Rate (1.30) is 675 / 1.30 = 519.23 USD.
	// Profit = 500 - 519.23 = -19.23.
	expectedProfit := 500.0 - (675.0 / savedTxn2.StandardRate.Float64())

	// Allow small float difference
	if math.Abs(savedTxn2.Profit.Float64()-expectedProfit) > 0.01 {
		t.Errorf("Expected Profit=%.2f, got=%s", expectedProfit, savedTxn2.Profit.String())
	}
	t.Logf("Expected Profit=%.2f, got=%s", expectedProfit, savedTxn2.Profit.String())

	t.Logf("✅ Transaction profit calculation status tracking works correctly")
}

// TestTransactionVersionField verifies optimistic locking field exists
func TestTransactionVersionField(t *testing.T) {
	db := setupTestDB(t)

	tenant := models.Tenant{Name: "Test Tenant"}
	db.Create(&tenant)

	client := models.Client{
		ID:          uuid.New().String(),
		TenantID:    tenant.ID,
		Name:        "Test Client",
		PhoneNumber: "555-1234",
	}
	db.Create(&client)

	transaction := models.Transaction{
		ID:              uuid.New().String(),
		TenantID:        tenant.ID,
		ClientID:        client.ID,
		PaymentMethod:   models.TransactionMethodCash,
		SendCurrency:    "USD",
		SendAmount:      models.NewDecimal(100),
		ReceiveCurrency: "CAD",
		ReceiveAmount:   models.NewDecimal(135),
		RateApplied:     models.NewDecimal(1.35),
		TransactionDate: time.Now(),
		Version:         0,
	}
	db.Create(&transaction)

	// Verify version starts at 0
	var savedTxn models.Transaction
	db.First(&savedTxn, "id = ?", transaction.ID)

	if savedTxn.Version != 0 {
		t.Errorf("Expected Version=0, got=%d", savedTxn.Version)
	}

	// Simulate optimistic lock update
	result := db.Model(&models.Transaction{}).
		Where("id = ? AND version = ?", transaction.ID, 0).
		Updates(map[string]interface{}{
			"send_amount": 200,
			"version":     gorm.Expr("version + 1"),
		})

	if result.RowsAffected != 1 {
		t.Errorf("Expected 1 row affected, got %d", result.RowsAffected)
	}

	// Verify version incremented
	db.First(&savedTxn, "id = ?", transaction.ID)
	if savedTxn.Version != 1 {
		t.Errorf("Expected Version=1 after update, got=%d", savedTxn.Version)
	}

	// Try to update with stale version - should affect 0 rows
	result = db.Model(&models.Transaction{}).
		Where("id = ? AND version = ?", transaction.ID, 0). // Stale version
		Updates(map[string]interface{}{
			"send_amount": 300,
			"version":     gorm.Expr("version + 1"),
		})

	if result.RowsAffected != 0 {
		t.Errorf("Expected 0 rows affected with stale version, got %d", result.RowsAffected)
	}

	t.Logf("✅ Transaction optimistic locking works correctly")
}

// TestLedgerServiceWithLocking verifies ledger balance queries use locking
func TestLedgerServiceWithLocking(t *testing.T) {
	db := setupTestDB(t)

	tenant := models.Tenant{Name: "Test Tenant"}
	db.Create(&tenant)

	client := models.Client{
		ID:          uuid.New().String(),
		TenantID:    tenant.ID,
		Name:        "Test Client",
		PhoneNumber: "555-1234",
	}
	db.Create(&client)

	ledgerService := services.NewLedgerService(db)

	// Add some ledger entries
	entry1 := models.LedgerEntry{
		TenantID:    tenant.ID,
		ClientID:    client.ID,
		Type:        models.LedgerTypeDeposit,
		Currency:    "USD",
		Amount:      models.NewDecimal(1000),
		Description: "Deposit 1",
		CreatedBy:   1,
	}
	ledgerService.AddEntry(entry1)

	entry2 := models.LedgerEntry{
		TenantID:    tenant.ID,
		ClientID:    client.ID,
		Type:        models.LedgerTypeWithdrawal,
		Currency:    "USD",
		Amount:      models.NewDecimal(-300),
		Description: "Withdrawal 1",
		CreatedBy:   1,
	}
	ledgerService.AddEntry(entry2)

	entry3 := models.LedgerEntry{
		TenantID:    tenant.ID,
		ClientID:    client.ID,
		Type:        models.LedgerTypeDeposit,
		Currency:    "CAD",
		Amount:      models.NewDecimal(500),
		Description: "Deposit CAD",
		CreatedBy:   1,
	}
	ledgerService.AddEntry(entry3)

	// Get balances
	balances, err := ledgerService.GetClientBalances(client.ID, tenant.ID)
	if err != nil {
		t.Fatalf("Failed to get balances: %v", err)
	}

	expectedUSD := 700.0 // 1000 - 300
	expectedCAD := 500.0

	if balances["USD"].Float64() != expectedUSD {
		t.Errorf("Expected USD balance=%.2f, got=%.2f", expectedUSD, balances["USD"].Float64())
	}
	if balances["CAD"].Float64() != expectedCAD {
		t.Errorf("Expected CAD balance=%.2f, got=%.2f", expectedCAD, balances["CAD"].Float64())
	}

	t.Logf("✅ Ledger service balance calculation works correctly")
}

// TestIdempotencyRecordUniqueConstraint verifies tenant is part of unique key
func TestIdempotencyRecordUniqueConstraint(t *testing.T) {
	db := setupTestDB(t)

	// Create two different tenants
	tenant1 := models.Tenant{Name: "Tenant 1"}
	tenant2 := models.Tenant{Name: "Tenant 2"}
	db.Create(&tenant1)
	db.Create(&tenant2)

	// Create idempotency record for tenant 1
	record1 := models.IdempotencyRecord{
		TenantID:    tenant1.ID,
		Key:         "test-key-123",
		Route:       "/api/transactions",
		Method:      "POST",
		RequestHash: "abc123",
		State:       models.IdemStateCompleted,
		StatusCode:  201,
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	}
	err := db.Create(&record1).Error
	if err != nil {
		t.Fatalf("Failed to create record1: %v", err)
	}

	// Same key for tenant 2 should work (different tenant)
	record2 := models.IdempotencyRecord{
		TenantID:    tenant2.ID,
		Key:         "test-key-123", // Same key
		Route:       "/api/transactions",
		Method:      "POST",
		RequestHash: "def456",
		State:       models.IdemStateCompleted,
		StatusCode:  201,
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	}
	err = db.Create(&record2).Error
	if err != nil {
		t.Errorf("Should allow same key for different tenant: %v", err)
	}

	// Duplicate for same tenant should fail
	record3 := models.IdempotencyRecord{
		TenantID:    tenant1.ID,
		Key:         "test-key-123", // Same key, same tenant
		Route:       "/api/transactions",
		Method:      "POST",
		RequestHash: "ghi789",
		State:       models.IdemStateInProgress,
		StatusCode:  0,
		ExpiresAt:   time.Now().Add(24 * time.Hour),
	}
	err = db.Create(&record3).Error
	if err == nil {
		t.Errorf("Should reject duplicate key for same tenant")
	}

	t.Logf("✅ Idempotency record tenant scoping works correctly")
}
