package database

import (
	"api/pkg/models"
	"log"
	"os"
	"strings"

	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB initializes the database connection and runs migrations.
// Supports both SQLite (local development) and PostgreSQL (production)
func InitDB(dbPath string) (*gorm.DB, error) {
	var db *gorm.DB
	var err error

	// Check for DATABASE_URL environment variable (production)
	databaseURL := os.Getenv("DATABASE_URL")

	if databaseURL != "" {
		// Production: Use PostgreSQL
		log.Printf("Connecting to PostgreSQL database...")

		// Handle Render.com's DATABASE_URL format (postgres:// -> postgresql://)
		if strings.HasPrefix(databaseURL, "postgres://") {
			databaseURL = strings.Replace(databaseURL, "postgres://", "postgresql://", 1)
		}

		db, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
		if err != nil {
			log.Printf("Failed to connect to PostgreSQL: %v", err)
			return nil, err
		}
		log.Println("Connected to PostgreSQL database")
	} else {
		// Local Development: Use SQLite
		log.Printf("Connecting to SQLite database at: %s", dbPath)
		db, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
		if err != nil {
			log.Printf("Failed to connect to SQLite: %v", err)
			return nil, err
		}
		log.Println("Connected to SQLite database")
	}

	// Auto-migrate the schema
	log.Println("Running GORM auto-migrations for all models...")
	err = db.AutoMigrate(
		// Core models
		&models.User{},
		&models.Tenant{},
		&models.License{},
		&models.Branch{},
		&models.UserBranch{},
		&models.Role{},
		&models.RolePermission{},
		&models.OwnershipTransferLog{},
		&models.AuditLog{},
		&models.PasswordResetCode{},
		// Security & Rate Limiting
		&models.RefreshToken{},
		&models.RateLimitEntry{},
		// Search
		&models.SavedSearch{},
		// Existing models (now with TenantID)
		&models.Client{},
		&models.Transaction{},
		&models.PickupTransaction{},
		// Global models (NOT tenant-scoped)
		&models.Customer{},
		&models.CustomerTenantLink{},
		// Cash management
		&models.CashBalance{},
		&models.CashAdjustment{},
		// Payment system (NEW)
		&models.Payment{},
		// Remittance system (NEW)
		&models.OutgoingRemittance{},
		&models.IncomingRemittance{},
		&models.RemittanceSettlement{},
		// Exchange Rates
		&models.ExchangeRate{},
		// Reconciliation
		&models.DailyReconciliation{},
	)
	if err != nil {
		log.Printf("Warning: Failed to run auto-migrations: %v", err)
		return nil, err
	}

	// Seed database with initial data
	log.Println("Seeding database...")
	if err := SeedDatabase(db); err != nil {
		log.Printf("Warning: Failed to seed database: %v", err)
		// Don't fail if seeding fails
	}

	log.Println("Database initialized successfully.")
	DB = db
	return db, nil
}

func GetDB() *gorm.DB {
	return DB
}
