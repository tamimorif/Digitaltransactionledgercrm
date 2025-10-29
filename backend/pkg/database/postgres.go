package database

import (
    "os"
    "gorm.io/driver/postgres"
)

func InitDB(dbURL string) (*gorm.DB, error) {
    // Use DATABASE_URL from environment
    if os.Getenv("DATABASE_URL") != "" {
        dbURL = os.Getenv("DATABASE_URL")
    }
    
    // PostgreSQL for production, SQLite for local
    var dialector gorm.Dialector
    if strings.HasPrefix(dbURL, "postgres://") {
        dialector = postgres.Open(dbURL)
    } else {
        dialector = sqlite.Open(dbURL)
    }
    
    db, err := gorm.Open(dialector, &gorm.Config{})
    // ... rest of your code
}