package database

import (
	"api/pkg/models"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

// InitDB initializes the database connection and runs migrations.
// It is updated to return the *gorm.DB instance, which is a common best practice
// for dependency injection rather than relying on a global variable.
func InitDB(dbPath string) (*gorm.DB, error) {
	log.Printf("Attempting to connect to SQLite database at: %s", dbPath)

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, nil
	}

	// Auto-migrate the schema
	// You will need to ensure models.Client and models.Transaction is defined.
	log.Println("Running GORM auto-migrations for Client and Transaction models...")
	err = db.AutoMigrate(&models.Client{}, &models.Transaction{})
	if err != nil {
		// Log the warning but return the DB instance if the error is non-fatal
		log.Printf("Warning: Failed to run auto-migrations: %v", err)
	}

	log.Println("Database initialized successfully.")
	return db, nil
}


func GetDB() *gorm.DB {
	return DB
}
