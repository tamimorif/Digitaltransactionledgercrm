package api

import (
	"encoding/json"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"gorm.io/gorm"
	"net/http"
	"time"
)

func NewRouter(db *gorm.DB) http.Handler {
	router := mux.NewRouter()

	// Initialize handler
	handler := NewHandler(db)

	// API routes
	api := router.PathPrefix("/api").Subrouter()

	// Transaction routes
	api.HandleFunc("/transactions", handler.GetTransactions).Methods("GET")
	api.HandleFunc("/transactions", handler.CreateTransaction).Methods("POST")
	api.HandleFunc("/transactions/{id}", handler.GetTransaction).Methods("GET")
	api.HandleFunc("/transactions/{id}", handler.UpdateTransaction).Methods("PUT")
	api.HandleFunc("/transactions/{id}", handler.DeleteTransaction).Methods("DELETE")
	api.HandleFunc("/transactions/search", handler.SearchTransactions).Methods("GET")
	
	// Client routes
	api.HandleFunc("/clients", handler.GetClients).Methods("GET")
	api.HandleFunc("/clients", handler.CreateClient).Methods("POST")
	api.HandleFunc("/clients/{id}", handler.GetClient).Methods("GET")
	api.HandleFunc("/clients/{id}", handler.UpdateClient).Methods("PUT")
	api.HandleFunc("/clients/{id}", handler.DeleteClient).Methods("DELETE")
	api.HandleFunc("/clients/{id}/transactions", handler.GetClientTransactions).Methods("GET")
	api.HandleFunc("/clients/search", handler.SearchClients).Methods("GET")

	// Add health check endpoint
	router.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status": "ok",
			"timestamp": time.Now().String(),
		})
	})

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins: []string{"http://localhost:3000", "http://localhost:3001"}, // Add your frontend URLs
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	// Apply CORS middleware
	return c.Handler(router)
}
