package main

import (
	"api/pkg/api"
	"api/pkg/database"
	"log"
	"net/http"
	"os"
)

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
