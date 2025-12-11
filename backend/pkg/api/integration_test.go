package api_test

import (
	"api/pkg/api"
	"api/pkg/database"
	"api/pkg/models"
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestServer wraps the handler for testing
type TestServer struct {
	Handler http.Handler
	DB      *gorm.DB
}

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to test database: %v", err)
	}

	// Run migrations
	err = db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Branch{},
		&models.Client{},
		&models.Customer{},
		&models.Transaction{},
		&models.ExchangeRate{},
		&models.Payment{},
		&models.CashBalance{},
		&models.AuditLog{},
	)
	if err != nil {
		t.Fatalf("Failed to migrate test database: %v", err)
	}

	return db
}

// setupTestServer creates a test server with routes
func setupTestServer(t *testing.T) *TestServer {
	db := setupTestDB(t)
	database.SetDB(db)

	router := api.NewRouter(db)

	return &TestServer{
		Handler: router,
		DB:      db,
	}
}

// makeRequest is a helper to make HTTP requests
func (ts *TestServer) makeRequest(method, path string, body interface{}, token string) *httptest.ResponseRecorder {
	var reqBody []byte
	if body != nil {
		reqBody, _ = json.Marshal(body)
	}

	req := httptest.NewRequest(method, path, bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	rr := httptest.NewRecorder()
	ts.Handler.ServeHTTP(rr, req)
	return rr
}

// =============================================================================
// Health Check Tests
// =============================================================================

func TestHealthCheck(t *testing.T) {
	ts := setupTestServer(t)

	t.Run("Legacy API Health Check", func(t *testing.T) {
		rr := ts.makeRequest("GET", "/api/health", nil, "")

		if rr.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rr.Code)
		}

		var response map[string]interface{}
		json.Unmarshal(rr.Body.Bytes(), &response)

		if response["status"] != "ok" {
			t.Errorf("Expected status 'ok', got %v", response["status"])
		}
	})

	t.Run("V1 API Health Check", func(t *testing.T) {
		rr := ts.makeRequest("GET", "/api/v1/health", nil, "")

		if rr.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", rr.Code)
		}

		var response map[string]interface{}
		json.Unmarshal(rr.Body.Bytes(), &response)

		if response["status"] != "ok" {
			t.Errorf("Expected status 'ok', got %v", response["status"])
		}

		if response["version"] != "1.0.0" {
			t.Errorf("Expected version '1.0.0', got %v", response["version"])
		}
	})
}

// =============================================================================
// API Version Tests
// =============================================================================

func TestAPIVersionInfo(t *testing.T) {
	ts := setupTestServer(t)

	rr := ts.makeRequest("GET", "/api/version", nil, "")

	if rr.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", rr.Code)
	}

	var response map[string]interface{}
	json.Unmarshal(rr.Body.Bytes(), &response)

	if response["currentVersion"] != "v1" {
		t.Errorf("Expected currentVersion 'v1', got %v", response["currentVersion"])
	}

	supportedVersions := response["supportedVersions"].([]interface{})
	if len(supportedVersions) != 1 || supportedVersions[0] != "v1" {
		t.Errorf("Expected supportedVersions ['v1'], got %v", supportedVersions)
	}
}

// =============================================================================
// Authentication Tests
// =============================================================================

func TestAuthEndpoints(t *testing.T) {
	ts := setupTestServer(t)

	t.Run("Login with Missing Credentials", func(t *testing.T) {
		loginReq := map[string]string{}
		rr := ts.makeRequest("POST", "/api/auth/login", loginReq, "")

		// Should return 400 Bad Request or similar
		if rr.Code == http.StatusOK {
			t.Error("Expected error for missing credentials")
		}
	})

	t.Run("Login with Invalid Credentials", func(t *testing.T) {
		loginReq := map[string]string{
			"username": "nonexistent",
			"password": "wrongpass",
		}
		rr := ts.makeRequest("POST", "/api/auth/login", loginReq, "")

		if rr.Code == http.StatusOK {
			t.Error("Expected error for invalid credentials")
		}
	})
}

// =============================================================================
// Protected Endpoint Tests
// =============================================================================

func TestProtectedEndpoints(t *testing.T) {
	ts := setupTestServer(t)

	t.Run("Unauthorized Access - No Token", func(t *testing.T) {
		rr := ts.makeRequest("GET", "/api/v1/transactions", nil, "")

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("Expected status 401, got %d", rr.Code)
		}
	})

	t.Run("Unauthorized Access - Invalid Token", func(t *testing.T) {
		rr := ts.makeRequest("GET", "/api/v1/transactions", nil, "invalid-token")

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("Expected status 401, got %d", rr.Code)
		}
	})
}

// =============================================================================
// Soft Delete Tests
// =============================================================================

func TestSoftDelete(t *testing.T) {
	db := setupTestDB(t)

	t.Run("Client Soft Delete", func(t *testing.T) {
		// Create a tenant
		tenant := models.Tenant{Name: "Test Tenant", Status: models.TenantStatusActive}
		db.Create(&tenant)

		// Create a client
		client := models.Client{
			ID:          "test-client-1",
			TenantID:    tenant.ID,
			Name:        "Test Client",
			PhoneNumber: "1234567890",
		}
		db.Create(&client)

		// Soft delete
		db.Delete(&client)

		// Verify not found in normal query
		var found models.Client
		result := db.First(&found, "id = ?", client.ID)
		if result.Error == nil {
			t.Error("Expected client to be soft-deleted and not found")
		}

		// Verify found with Unscoped
		result = db.Unscoped().First(&found, "id = ?", client.ID)
		if result.Error != nil {
			t.Error("Expected soft-deleted client to be found with Unscoped")
		}

		if found.DeletedAt.Time.IsZero() {
			t.Error("Expected DeletedAt to be set")
		}
	})

	t.Run("Customer Soft Delete", func(t *testing.T) {
		// Create a customer
		customer := models.Customer{
			FullName: "Test Customer",
			Phone:    "9876543210",
		}
		db.Create(&customer)

		// Soft delete
		db.Delete(&customer)

		// Verify not found in normal query
		var found models.Customer
		result := db.First(&found, "id = ?", customer.ID)
		if result.Error == nil {
			t.Error("Expected customer to be soft-deleted and not found")
		}

		// Verify found with Unscoped
		result = db.Unscoped().First(&found, "id = ?", customer.ID)
		if result.Error != nil {
			t.Error("Expected soft-deleted customer to be found with Unscoped")
		}
	})
}

// =============================================================================
// Decimal Precision Tests
// =============================================================================

func TestDecimalPrecision(t *testing.T) {
	t.Run("Decimal Arithmetic", func(t *testing.T) {
		// Test that decimal operations don't have floating point errors
		amount1 := models.NewDecimal(0.1)
		amount2 := models.NewDecimal(0.2)
		result := amount1.Add(amount2)
		// 0.1 + 0.2 should equal 0.3 exactly (not 0.30000000000000004)
		expected := models.NewDecimal(0.3)

		if !result.Decimal.Equal(expected.Decimal) {
			t.Errorf("Expected 0.3, got %s", result.String())
		}
	})

	t.Run("Large Currency Amounts", func(t *testing.T) {
		// Test large Iranian Rial amounts
		amount := models.NewDecimal(1000000000.50) // 1 billion and 50 cents
		fee := models.NewDecimal(0.01)
		result := amount.Sub(fee)
		expected := models.NewDecimal(1000000000.49)

		if !result.Decimal.Equal(expected.Decimal) {
			t.Errorf("Expected %s, got %s", expected.String(), result.String())
		}
	})

	t.Run("Currency Conversion", func(t *testing.T) {
		// Test currency conversion with exchange rate
		usdAmount := models.NewDecimal(1000.00)
		exchangeRate := models.NewDecimal(42000.00) // 1 USD = 42000 IRR
		irrAmount := usdAmount.Mul(exchangeRate)
		expected := models.NewDecimal(42000000.00)

		if !irrAmount.Decimal.Equal(expected.Decimal) {
			t.Errorf("Expected %s IRR, got %s", expected.String(), irrAmount.String())
		}
	})
}

// =============================================================================
// Database Transaction Tests
// =============================================================================

func TestDatabaseTransactions(t *testing.T) {
	db := setupTestDB(t)

	t.Run("Transaction Rollback on Error", func(t *testing.T) {
		// Create a tenant
		tenant := models.Tenant{Name: "Transaction Test Tenant", Status: models.TenantStatusActive}
		db.Create(&tenant)

		// Start transaction
		tx := db.Begin()

		// Create a client in transaction
		client := models.Client{
			ID:          "tx-test-client",
			TenantID:    tenant.ID,
			Name:        "Transaction Test Client",
			PhoneNumber: "5555555555",
		}
		tx.Create(&client)

		// Rollback
		tx.Rollback()

		// Verify client was not created
		var found models.Client
		result := db.First(&found, "id = ?", "tx-test-client")
		if result.Error == nil {
			t.Error("Expected client not to exist after rollback")
		}
	})

	t.Run("Transaction Commit", func(t *testing.T) {
		// Create a tenant
		tenant := models.Tenant{Name: "Commit Test Tenant", Status: models.TenantStatusActive}
		db.Create(&tenant)

		// Start transaction
		tx := db.Begin()

		// Create a client in transaction
		client := models.Client{
			ID:          "commit-test-client",
			TenantID:    tenant.ID,
			Name:        "Commit Test Client",
			PhoneNumber: "6666666666",
		}
		tx.Create(&client)

		// Commit
		tx.Commit()

		// Verify client exists
		var found models.Client
		result := db.First(&found, "id = ?", "commit-test-client")
		if result.Error != nil {
			t.Error("Expected client to exist after commit")
		}
	})
}

// =============================================================================
// API Route Tests
// =============================================================================

func TestAPIRoutes(t *testing.T) {
	ts := setupTestServer(t)

	routes := []struct {
		method         string
		path           string
		expectedStatus int
		requiresAuth   bool
	}{
		{"GET", "/api/health", http.StatusOK, false},
		{"GET", "/api/v1/health", http.StatusOK, false},
		{"GET", "/api/version", http.StatusOK, false},
		{"GET", "/api/v1/transactions", http.StatusUnauthorized, true},
		{"GET", "/api/v1/customers", http.StatusUnauthorized, true},
		{"GET", "/api/v1/branches", http.StatusUnauthorized, true},
	}

	for _, route := range routes {
		t.Run(route.method+" "+route.path, func(t *testing.T) {
			rr := ts.makeRequest(route.method, route.path, nil, "")

			if rr.Code != route.expectedStatus {
				t.Errorf("Expected status %d, got %d for %s %s",
					route.expectedStatus, rr.Code, route.method, route.path)
			}
		})
	}
}

// =============================================================================
// Run All Tests
// =============================================================================

func TestMain(m *testing.M) {
	// Set JWT_SECRET for tests
	os.Setenv("JWT_SECRET", "test-secret-key-for-integration-tests")

	code := m.Run()
	os.Exit(code)
}
