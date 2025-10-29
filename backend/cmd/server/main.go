package main

import (
	"api/pkg/api"
	"api/pkg/database"
	_ "api/docs" // Import generated docs
	"log"
	"net/http"
	"os"
)

// @title Transaction Ledger & Client CRM API
// @version 1.0
// @description API for Currency Exchange & Remittance Management System
// @termsOfService http://swagger.io/terms/

// @contact.name API Support
// @contact.email support@transactionledger.com

// @license.name MIT
// @license.url https://opensource.org/licenses/MIT

// @host localhost:8080
// @BasePath /api
// @schemes http https

// @securityDefinitions.apikey BearerAuth
// @in header
// @name Authorization

func main() {
	// Initialize database
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "./transactions.db"
	}

	// Fix: Change the database initialization call
	db, err := database.InitDB(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Get the router as http.Handler
	handler := api.NewRouter(db)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Starting server on :%s\n", port)
	log.Printf("API available at http://localhost:%s/api\n", port)
	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Could not start server: %v", err)
	}
}
