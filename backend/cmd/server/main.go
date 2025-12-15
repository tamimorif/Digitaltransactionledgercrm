package main

import (
	_ "api/docs" // Import generated docs
	"api/pkg/api"
	"api/pkg/database"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/joho/godotenv"
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
	// Load environment variables from .env file if it exists
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

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

	// Create server with timeouts to prevent resource exhaustion
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	log.Printf("Starting server on :%s\n", port)
	log.Printf("API available at http://localhost:%s/api\n", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatalf("Could not start server: %v", err)
	}
}
