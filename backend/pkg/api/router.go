package api

import (
	"api/pkg/middleware"
	"api/pkg/services"
	"encoding/json"
	"time"

	"net/http"

	"github.com/gorilla/mux"
	"github.com/rs/cors"
	httpSwagger "github.com/swaggo/http-swagger"
	"gorm.io/gorm"
)

func NewRouter(db *gorm.DB) http.Handler {
	router := mux.NewRouter()

	// Initialize services
	statisticsService := services.NewStatisticsService(db)

	// Initialize handlers
	handler := NewHandler(db)
	authHandler := NewAuthHandler(db)
	licenseHandler := NewLicenseHandler(db)
	adminHandler := NewAdminHandler(db)
	auditHandler := NewAuditHandler(db)
	branchHandler := NewBranchHandler(db)
	pickupHandler := NewPickupHandler(db)
	customerHandler := NewCustomerHandler(db)
	cashBalanceHandler := NewCashBalanceHandler(db)
	statisticsHandler := NewStatisticsHandler(statisticsService)

	// API routes
	api := router.PathPrefix("/api").Subrouter()

	// ============ PUBLIC ROUTES (No Authentication Required) ============

	// Public auth routes
	api.HandleFunc("/auth/register", authHandler.RegisterHandler).Methods("POST")
	api.HandleFunc("/auth/verify-email", authHandler.VerifyEmailHandler).Methods("POST")
	api.HandleFunc("/auth/resend-code", authHandler.ResendVerificationCodeHandler).Methods("POST")
	api.HandleFunc("/auth/login", authHandler.LoginHandler).Methods("POST")
	api.HandleFunc("/auth/forgot-password", authHandler.ForgotPasswordHandler).Methods("POST")
	api.HandleFunc("/auth/reset-password", authHandler.ResetPasswordHandler).Methods("POST")

	// User routes (public for username check)
	userHandler := NewUserHandler(db)
	api.HandleFunc("/users/check-username", userHandler.CheckUsernameAvailabilityHandler).Methods("GET")

	// ============ PROTECTED ROUTES (Authentication Required) ============

	// Create protected subrouter
	protected := api.PathPrefix("").Subrouter()
	protected.Use(middleware.AuthMiddleware(db))
	protected.Use(middleware.TenantIsolationMiddleware)

	// Auth routes (protected)
	protected.HandleFunc("/auth/me", authHandler.GetMeHandler).Methods("GET")
	protected.HandleFunc("/auth/change-password", authHandler.ChangePasswordHandler).Methods("POST")

	// License routes (protected)
	protected.HandleFunc("/licenses/activate", licenseHandler.ActivateLicenseHandler).Methods("POST")
	protected.HandleFunc("/licenses/status", licenseHandler.GetLicenseStatusHandler).Methods("GET")
	protected.HandleFunc("/licenses/my-licenses", licenseHandler.GetMyLicensesHandler).Methods("GET")

	// Transaction routes (protected)
	protected.HandleFunc("/transactions", handler.GetTransactions).Methods("GET")
	protected.HandleFunc("/transactions", handler.CreateTransaction).Methods("POST")
	protected.HandleFunc("/transactions/{id}", handler.GetTransaction).Methods("GET")
	protected.HandleFunc("/transactions/{id}", handler.UpdateTransaction).Methods("PUT")
	protected.HandleFunc("/transactions/{id}/cancel", handler.CancelTransaction).Methods("POST")
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

	// Tenant routes (protected)
	protected.HandleFunc("/tenant/info", handler.GetTenantInfo).Methods("GET")
	protected.HandleFunc("/tenant/update-name", handler.UpdateTenantName).Methods("PUT")

	// User management routes (protected)
	protected.HandleFunc("/users", userHandler.GetUsersHandler).Methods("GET")
	protected.HandleFunc("/users/create-branch-user", userHandler.CreateBranchUserHandler).Methods("POST")
	protected.HandleFunc("/users/{id}", userHandler.UpdateUserHandler).Methods("PUT")
	protected.HandleFunc("/users/{id}", userHandler.DeleteUserHandler).Methods("DELETE")

	// Branch routes (protected)
	protected.HandleFunc("/branches", branchHandler.GetBranchesHandler).Methods("GET")
	protected.HandleFunc("/branches", branchHandler.CreateBranchHandler).Methods("POST")
	protected.HandleFunc("/branches/my-branches", branchHandler.GetUserBranchesHandler).Methods("GET")
	protected.HandleFunc("/branches/{id}", branchHandler.GetBranchHandler).Methods("GET")
	protected.HandleFunc("/branches/{id}", branchHandler.UpdateBranchHandler).Methods("PUT")
	protected.HandleFunc("/branches/{id}/credentials", branchHandler.SetBranchCredentialsHandler).Methods("PUT")
	protected.HandleFunc("/branches/{id}/users", userHandler.GetBranchUsersHandler).Methods("GET")
	protected.HandleFunc("/branches/{id}/deactivate", branchHandler.DeactivateBranchHandler).Methods("POST")
	protected.HandleFunc("/branches/{id}/assign-user", branchHandler.AssignUserToBranchHandler).Methods("POST")

	// Pickup transaction routes (protected)
	protected.HandleFunc("/pickups", pickupHandler.GetPickupTransactionsHandler).Methods("GET")
	protected.HandleFunc("/pickups", pickupHandler.CreatePickupTransactionHandler).Methods("POST")
	protected.HandleFunc("/pickups/pending/count", pickupHandler.GetPendingPickupsCountHandler).Methods("GET")
	protected.HandleFunc("/pickups/search", pickupHandler.SearchPickupsByQueryHandler).Methods("GET")
	protected.HandleFunc("/pickups/search/{code}", pickupHandler.SearchPickupByCodeHandler).Methods("GET")
	protected.HandleFunc("/pickups/{id}", pickupHandler.GetPickupTransactionHandler).Methods("GET")
	protected.HandleFunc("/pickups/{id}/pickup", pickupHandler.MarkAsPickedUpHandler).Methods("POST")
	protected.HandleFunc("/pickups/{id}/cancel", pickupHandler.CancelPickupTransactionHandler).Methods("POST")

	// Customer routes (protected)
	protected.HandleFunc("/customers", customerHandler.GetCustomersForTenantHandler).Methods("GET")
	protected.HandleFunc("/customers/search", customerHandler.SearchCustomersHandler).Methods("GET")
	protected.HandleFunc("/customers/phone/{phone}", customerHandler.GetCustomerByPhoneHandler).Methods("GET")
	protected.HandleFunc("/customers/find-or-create", customerHandler.FindOrCreateCustomerHandler).Methods("POST")
	protected.HandleFunc("/customers/{id}", customerHandler.UpdateCustomerHandler).Methods("PUT")

	// Cash balance routes (protected)
	protected.HandleFunc("/cash-balances", cashBalanceHandler.GetAllBalancesHandler).Methods("GET")
	protected.HandleFunc("/cash-balances/currencies", cashBalanceHandler.GetActiveCurrenciesHandler).Methods("GET")
	protected.HandleFunc("/cash-balances/refresh-all", cashBalanceHandler.RefreshAllBalancesHandler).Methods("POST")
	protected.HandleFunc("/cash-balances/adjust", cashBalanceHandler.CreateAdjustmentHandler).Methods("POST")
	protected.HandleFunc("/cash-balances/adjustments", cashBalanceHandler.GetAdjustmentHistoryHandler).Methods("GET")
	protected.HandleFunc("/cash-balances/{currency}", cashBalanceHandler.GetBalanceByCurrencyHandler).Methods("GET")
	protected.HandleFunc("/cash-balances/{id}/refresh", cashBalanceHandler.RefreshBalanceHandler).Methods("POST")

	// Statistics and export routes (protected)
	protected.HandleFunc("/statistics", statisticsHandler.GetStatisticsHandler).Methods("GET")
	protected.HandleFunc("/export/csv", statisticsHandler.ExportCSVHandler).Methods("GET")
	protected.HandleFunc("/export/json", statisticsHandler.ExportJSONHandler).Methods("GET")

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
	admin.HandleFunc("/tenants/{id}/cash-balances", adminHandler.GetTenantCashBalancesHandler).Methods("GET")
	admin.HandleFunc("/tenants/{id}/customer-count", adminHandler.GetTenantCustomerCountHandler).Methods("GET")

	// User management (SuperAdmin)
	admin.HandleFunc("/users", adminHandler.GetAllUsersHandler).Methods("GET")

	// Transaction management (SuperAdmin)
	admin.HandleFunc("/transactions", adminHandler.GetAllTransactionsHandler).Methods("GET")

	// Customer management (SuperAdmin)
	admin.HandleFunc("/customers/search", customerHandler.SearchCustomersGlobalHandler).Methods("GET")
	admin.HandleFunc("/customers/{id}", customerHandler.GetCustomerWithTenantsHandler).Methods("GET")

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
