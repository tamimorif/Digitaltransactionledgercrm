package services

import (
	"api/pkg/models"
	"context"
	"fmt"
	"math"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestComprehensiveTransactions(t *testing.T) {
	// 1. Setup In-Memory DB
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// 2. Auto-migrate models
	err = db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Branch{},
		&models.Client{},
		&models.Transaction{},
		&models.ExchangeRate{},
		&models.Payment{},
		&models.LedgerEntry{},
		&models.CashBalance{},
		&models.CashAdjustment{},
	)
	if err != nil {
		t.Fatalf("Failed to migrate: %v", err)
	}

	// 3. Seed Data
	tenant := &models.Tenant{Name: "Test Exchange"}
	db.Create(tenant)

	user := &models.User{
		Email:    "admin@test.com",
		TenantID: &tenant.ID,
		Role:     "tenant_owner",
	}
	db.Create(user)

	branch := &models.Branch{
		TenantID: tenant.ID,
		Name:     "Main Branch",
		Status:   "active",
	}
	db.Create(branch)

	email := "john@example.com"
	client := &models.Client{
		TenantID: tenant.ID,
		Name:     "John Doe",
		Email:    &email,
	}
	db.Create(client)

	// Seed Exchange Rates (Standard Market Rates)
	// CAD -> IRR (Standard: 45000)
	db.Create(&models.ExchangeRate{
		TenantID:       tenant.ID,
		BaseCurrency:   "CAD",
		TargetCurrency: "IRR",
		Rate:           45000,
		Source:         "MANUAL",
	})
	// USD -> IRR (Standard: 60000)
	db.Create(&models.ExchangeRate{
		TenantID:       tenant.ID,
		BaseCurrency:   "USD",
		TargetCurrency: "IRR",
		Rate:           60000,
		Source:         "MANUAL",
	})

	// 4. Initialize Services
	exchangeRateService := NewExchangeRateService(db)
	transactionService := NewTransactionService(db, exchangeRateService)
	ledgerService := NewLedgerService(db)
	cashBalanceService := NewCashBalanceService(db)
	paymentService := NewPaymentService(db, ledgerService, cashBalanceService)

	fmt.Println("\n🧪 Starting Comprehensive Transaction Tests")
	fmt.Println("==========================================")

	// Test Case 1: Wire Transfer (Standard Profit)
	t.Run("Wire Transfer Profit", func(t *testing.T) {
		fmt.Println("\n📝 Test 1: Wire Transfer (CAD -> IRR)")
		tx := &models.Transaction{
			TenantID:            tenant.ID,
			BranchID:            &branch.ID,
			ClientID:            client.ID,
			PaymentMethod:       models.TransactionMethodBank,
			SendAmount:          1000,
			SendCurrency:        "CAD",
			ReceiveCurrency:     "IRR",
			RateApplied:         44000,
			AllowPartialPayment: false,
			Status:              "PENDING",
			PaymentStatus:       models.PaymentStatusFullyPaid,
		}

		err := transactionService.CreateTransaction(context.Background(), tx)
		if err != nil {
			t.Fatalf("Failed to create transaction: %v", err)
		}

		// Verify Profit (in Send Currency - CAD)
		// Irr Profit: 1000 * (45000 - 44000) = 1,000,000 IRR
		// Cad Profit: 1,000,000 / 45000 = 22.22 CAD
		expectedProfit := 22.22
		if math.Abs(tx.Profit-expectedProfit) > 0.1 {
			t.Errorf("Expected profit ~%.2f CAD, got %.2f", expectedProfit, tx.Profit)
		}
		fmt.Printf("   ✅ Transaction Created: %s\n", tx.ID)
		fmt.Printf("   💰 Profit Calculated: %.2f CAD\n", tx.Profit)
	})

	// Test Case 2: Cash Pickup (Loss Scenario)
	t.Run("Cash Pickup Loss", func(t *testing.T) {
		fmt.Println("\n📝 Test 2: Cash Pickup (USD -> IRR) - Loss Scenario")
		tx := &models.Transaction{
			TenantID:            tenant.ID,
			BranchID:            &branch.ID,
			ClientID:            client.ID,
			PaymentMethod:       models.TransactionMethodPickup,
			SendAmount:          100,
			SendCurrency:        "USD",
			ReceiveCurrency:     "IRR",
			RateApplied:         61000,
			AllowPartialPayment: false,
			Status:              "PENDING",
		}

		err := transactionService.CreateTransaction(context.Background(), tx)
		if err != nil {
			t.Fatalf("Failed to create transaction: %v", err)
		}

		// Profit (in Send Currency - USD)
		// Irr Loss: 100 * (60000 - 61000) = -100,000 IRR
		// Usd Loss: -100,000 / 60000 = -1.66 USD
		expectedProfit := -1.66
		if math.Abs(tx.Profit-expectedProfit) > 0.1 {
			t.Errorf("Expected profit ~%.2f USD, got %.2f", expectedProfit, tx.Profit)
		}
		fmt.Printf("   ✅ Transaction Created: %s\n", tx.ID)
		fmt.Printf("   📉 Loss Calculated: %.2f USD\n", tx.Profit)
	})

	// Test Case 3: Multi-Payment (Partial -> Complete)
	t.Run("Multi-Payment Flow", func(t *testing.T) {
		fmt.Println("\n📝 Test 3: Multi-Payment Flow")
		tx := &models.Transaction{
			TenantID:            tenant.ID,
			BranchID:            &branch.ID,
			ClientID:            client.ID,
			PaymentMethod:       models.TransactionMethodBank,
			SendAmount:          2000,
			SendCurrency:        "CAD",
			ReceiveCurrency:     "IRR",
			RateApplied:         44000,
			AllowPartialPayment: true, // Enable Multi-Payment
			Status:              "PENDING",
		}

		err := transactionService.CreateTransaction(context.Background(), tx)
		if err != nil {
			t.Fatalf("Failed to create transaction: %v", err)
		}

		fmt.Printf("   ✅ Transaction Created: %s (Partial Payment Enabled)\n", tx.ID)
		if tx.PaymentStatus != models.PaymentStatusOpen {
			t.Errorf("Expected status OPEN, got %s", tx.PaymentStatus)
		}
		if tx.RemainingBalance != 2000 {
			t.Errorf("Expected remaining 2000, got %.2f", tx.RemainingBalance)
		}

		// Payment 1: 500 CAD
		fmt.Println("   💳 Adding Payment 1: 500 CAD")
		payment1 := &models.Payment{
			TenantID:      tenant.ID,
			BranchID:      &branch.ID,
			TransactionID: tx.ID,
			Amount:        500,
			Currency:      "CAD",
			ExchangeRate:  1.0, // Same currency
			PaymentMethod: models.PaymentMethodCash,
		}
		err = paymentService.CreatePayment(payment1, user.ID)
		if err != nil {
			t.Fatalf("Failed to create payment 1: %v", err)
		}

		// Reload transaction
		updatedTx, _ := transactionService.GetTransaction(context.Background(), tx.ID, tenant.ID)
		if updatedTx.PaymentStatus != models.PaymentStatusPartial {
			t.Errorf("Expected status PARTIAL, got %s", updatedTx.PaymentStatus)
		}
		if updatedTx.RemainingBalance != 1500 {
			t.Errorf("Expected remaining 1500, got %.2f", updatedTx.RemainingBalance)
		}
		fmt.Printf("   ✅ Payment 1 Accepted. Remaining: %.2f\n", updatedTx.RemainingBalance)

		// Payment 2: 1500 CAD (Final)
		fmt.Println("   💳 Adding Payment 2: 1500 CAD")
		payment2 := &models.Payment{
			TenantID:      tenant.ID,
			BranchID:      &branch.ID,
			TransactionID: tx.ID,
			Amount:        1500,
			Currency:      "CAD",
			ExchangeRate:  1.0,
			PaymentMethod: models.PaymentMethodBankTransfer,
			Details: map[string]interface{}{
				"bankName":      "Test Bank",
				"accountNumber": "123456789",
				"referenceId":   "REF-123",
			},
		}
		err = paymentService.CreatePayment(payment2, user.ID)
		if err != nil {
			t.Fatalf("Failed to create payment 2: %v", err)
		}

		// Reload transaction
		updatedTx, _ = transactionService.GetTransaction(context.Background(), tx.ID, tenant.ID)
		if updatedTx.PaymentStatus != models.PaymentStatusFullyPaid {
			t.Errorf("Expected status FULLY_PAID, got %s", updatedTx.PaymentStatus)
		}
		if updatedTx.RemainingBalance > 0.01 {
			t.Errorf("Expected remaining 0, got %.2f", updatedTx.RemainingBalance)
		}
		fmt.Printf("   ✅ Payment 2 Accepted. Status: %s\n", updatedTx.PaymentStatus)
	})
	fmt.Println("\n✅ ALL COMPREHENSIVE TESTS PASSED!")
	fmt.Println("==========================================")
}
