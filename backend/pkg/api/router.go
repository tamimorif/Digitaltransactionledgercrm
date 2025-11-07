package api

import (
	"api/pkg/middleware"
	"encoding/json"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	httpSwagger "github.com/swaggo/http-swagger"
	"gorm.io/gorm"
	"net/http"
)

func NewRouter(db *gorm.DB) http.Handler {
	router := mux.NewRouter()

	// Initialize handlers
	handler := NewHandler(db)
	authHandler := NewAuthHandler(db)
	licenseHandler := NewLicenseHandler(db)
	adminHandler := NewAdminHandler(db)
	auditHandler := NewAuditHandler(db)

	// API routes
	api := router.PathPrefix("/api").Subrouter()

	// ============ PUBLIC ROUTES (No Authentication Required) ============
	
	// Auth routes
	api.HandleFunc("/auth/register", authHandler.RegisterHandler).Methods("POST")
	api.HandleFunc("/auth/verify-email", authHandler.VerifyEmailHandler).Methods("POST")
	api.HandleFunc("/auth/resend-code", authHandler.ResendVerificationCodeHandler).Methods("POST")
	api.HandleFunc("/auth/login", authHandler.LoginHandler).Methods("POST")

	// ============ PROTECTED ROUTES (Authentication Required) ============
	
	// Create protected subrouter
	protected := api.PathPrefix("").Subrouter()
	protected.Use(middleware.AuthMiddleware(db))
	protected.Use(middleware.TenantIsolationMiddleware)

	// Auth routes (protected)
	protected.HandleFunc("/auth/me", authHandler.GetMeHandler).Methods("GET")

	// License routes (protected)
	protected.HandleFunc("/licenses/activate", licenseHandler.ActivateLicenseHandler).Methods("POST")
	protected.HandleFunc("/licenses/status", licenseHandler.GetLicenseStatusHandler).Methods("GET")

	// Transaction routes (protected)
	protected.HandleFunc("/transactions", handler.GetTransactions).Methods("GET")
	protected.HandleFunc("/transactions", handler.CreateTransaction).Methods("POST")
	protected.HandleFunc("/transactions/{id}", handler.GetTransaction).Methods("GET")
	protected.HandleFunc("/transactions/{id}", handler.UpdateTransaction).Methods("PUT")
	protected.HandleFunc("/transactions/{id}", handler.DeleteTransaction).Methods("DELETE")
	protected.HandleFunc("/transactions/search", handler.SearchTransactions).Methods("GET")
	
	// Client routes (protected)
	protected.HandleFunc("/clients", handler.GetClients).Methods("GET")
	protected.HandleFunc("/clients", handler.CreateClient).Methods("POST")
	protected.HandleFunc("/clients/{id}", handler.GetClient).Methods("GET")
	protected.HandleFunc("/clients/{id}", handler.UpdateClient).Methods("PUT")
	protected.HandleFunc("/clients/{id}", handler.DeleteClient).Methods("DELETE")
	protected.HandleFunc("/clients/{id}/transactions", handler.GetClientTransactions).Methods("GET")
	protected.HandleFunc("/clients/search", handler.SearchClients).Methods("GET")

	// Audit logs (protected)
	protected.HandleFunc("/audit-logs", auditHandler.GetAuditLogsHandler).Methods("GET")

	// ============ SUPER ADMIN ROUTES ============
	
	// Create admin subrouter (requires SuperAdmin role)
	admin := api.PathPrefix("/admin").Subrouter()
	admin.Use(middleware.AuthMiddleware(db))
	admin.Use(middleware.RequireSuperAdmin)

	// License management (SuperAdmin)
	admin.HandleFunc("/licenses/generate", licenseHandler.GenerateLicenseHandler).Methods("POST")
	admin.HandleFunc("/licenses", licenseHandler.GetAllLicensesHandler).Methods("GET")
	admin.HandleFunc("/licenses/{id}/revoke", licenseHandler.RevokeLicenseHandler).Methods("POST")

	// Tenant management (SuperAdmin)
	admin.HandleFunc("/tenants", adminHandler.GetAllTenantsHandler).Methods("GET")
	admin.HandleFunc("/tenants/{id}", adminHandler.GetTenantByIDHandler).Methods("GET")
	admin.HandleFunc("/tenants/{id}/suspend", adminHandler.SuspendTenantHandler).Methods("POST")
	admin.HandleFunc("/tenants/{id}/activate", adminHandler.ActivateTenantHandler).Methods("POST")

	// User management (SuperAdmin)
	admin.HandleFunc("/users", adminHandler.GetAllUsersHandler).Methods("GET")

	// Dashboard (SuperAdmin)
	admin.HandleFunc("/dashboard/stats", adminHandler.GetDashboardStatsHandler).Methods("GET")

	// Swagger documentation (public)
	router.PathPrefix("/swagger/").Handler(httpSwagger.WrapHandler)

	// Add health check endpoint (public)
	router.HandleFunc("/api/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"status":    "ok",
			"timestamp": time.Now().String(),
		})
	})

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:3001"}, // Add your frontend URLs
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	// Apply CORS middleware
	return c.Handler(router)
}

