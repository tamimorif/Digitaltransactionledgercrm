package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
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
	adminService := services.NewAdminService(db) // Added adminService initialization
	exchangeRateService := services.NewExchangeRateService(db)
	reconciliationService := services.NewReconciliationService(db)
	reportService := services.NewReportService(db)
	ledgerService := services.NewLedgerService(db)
	cashBalanceService := services.NewCashBalanceService(db)
	paymentService := services.NewPaymentService(db, ledgerService, cashBalanceService)
	transferService := services.NewTransferService(db, cashBalanceService)

	// Initialize handlers
	handler := NewHandler(db)
	authHandler := NewAuthHandler(db)
	licenseHandler := NewLicenseHandler(db)
	adminHandler := NewAdminHandler(adminService)
	auditHandler := NewAuditHandler(db)
	branchHandler := NewBranchHandler(db)
	pickupHandler := NewPickupHandler(db)
	customerHandler := NewCustomerHandler(db)
	cashBalanceHandler := NewCashBalanceHandler(db)
	statisticsHandler := NewStatisticsHandler(statisticsService)
	exchangeRateHandler := NewExchangeRateHandler(exchangeRateService)
	reconciliationHandler := NewReconciliationHandler(reconciliationService)
	reportHandler := NewReportHandler(reportService)
	migrationHandler := NewMigrationHandler(db)
	ledgerHandler := NewLedgerHandler(db)
	paymentHandler := NewPaymentHandler(db, paymentService)
	userHandler := NewUserHandler(db) // Moved userHandler initialization here for public routes
	searchHandler := NewSearchHandler(db)
	wsHandler := NewWebSocketHandler(db)
	settlementHandler := NewRemittanceSettlementHandler(db) // Added settlement handler

	// NEW: Initialize new handlers for enhanced features
	dashboardHandler := NewDashboardHandler(db)
	autoSettlementHandler := NewAutoSettlementHandler(db)
	profitAnalysisHandler := NewProfitAnalysisHandler(db)
	receiptHandler := NewReceiptHandler(db)
	navasanHandler := NewNavasanHandler()
	transferHandler := NewTransferHandler(transferService)

	// =============================================================================
	// API VERSIONING STRATEGY
	// =============================================================================
	// We support both /api/v1/* (new versioned) and /api/* (legacy, deprecated)
	// The legacy /api/* routes will continue to work but should be migrated to v1
	// Future versions (v2, v3) can be added as needed with breaking changes
	// =============================================================================

	// API v1 routes (recommended)
	apiV1 := router.PathPrefix("/api/v1").Subrouter()

	// Legacy API routes (deprecated, kept for backward compatibility)
	apiLegacy := router.PathPrefix("/api").Subrouter()

	// Helper to register routes on both v1 and legacy paths
	registerRoutes := func(v1 *mux.Router, legacy *mux.Router) {
		// ============ PUBLIC ROUTES (No Authentication Required) ============

		// Public auth routes with IP rate limiting
		authV1 := v1.PathPrefix("/auth").Subrouter()
		authLegacy := legacy.PathPrefix("/auth").Subrouter()

		authV1.Use(middleware.IPRateLimitMiddleware(db, 10, 1*time.Minute))
		authLegacy.Use(middleware.IPRateLimitMiddleware(db, 10, 1*time.Minute))

		for _, authRouter := range []*mux.Router{authV1, authLegacy} {
			authRouter.HandleFunc("/register", authHandler.RegisterHandler).Methods("POST")
			authRouter.HandleFunc("/verify-email", authHandler.VerifyEmailHandler).Methods("POST")
			authRouter.HandleFunc("/resend-code", authHandler.ResendVerificationCodeHandler).Methods("POST")
			authRouter.HandleFunc("/login", authHandler.LoginHandler).Methods("POST")
			authRouter.HandleFunc("/forgot-password", authHandler.ForgotPasswordHandler).Methods("POST")
			authRouter.HandleFunc("/reset-password", authHandler.ResetPasswordHandler).Methods("POST")
			authRouter.HandleFunc("/refresh", authHandler.RefreshTokenHandler).Methods("POST")
		}

		// User routes (public for username check)
		v1.HandleFunc("/users/check-username", userHandler.CheckUsernameAvailabilityHandler).Methods("GET")
		legacy.HandleFunc("/users/check-username", userHandler.CheckUsernameAvailabilityHandler).Methods("GET")

		// Navasan exchange rates (public - Tehran market rates in IRR/Toman)
		for _, api := range []*mux.Router{v1, legacy} {
			api.HandleFunc("/rates/navasan", navasanHandler.GetNavasanRates).Methods("GET")
			api.HandleFunc("/rates/navasan/refresh", navasanHandler.RefreshNavasanRates).Methods("POST")
			api.HandleFunc("/rates/navasan/{currency}", navasanHandler.GetNavasanRate).Methods("GET")
			api.HandleFunc("/rates/usd-irr", navasanHandler.GetUSDToIRR).Methods("GET")
		}

		// ============ PROTECTED ROUTES (Authentication Required) ============

		// Create protected subrouters with rate limiting
		protectedV1 := v1.PathPrefix("").Subrouter()
		protectedV1.Use(middleware.AuthMiddleware(db))
		protectedV1.Use(middleware.RateLimitMiddleware(db, 100, 1*time.Minute))
		protectedV1.Use(middleware.TenantIsolationMiddleware)

		protectedLegacy := legacy.PathPrefix("").Subrouter()
		protectedLegacy.Use(middleware.AuthMiddleware(db))
		protectedLegacy.Use(middleware.RateLimitMiddleware(db, 100, 1*time.Minute))
		protectedLegacy.Use(middleware.TenantIsolationMiddleware)

		for _, protected := range []*mux.Router{protectedV1, protectedLegacy} {
			// Auth routes (protected)
			protected.HandleFunc("/auth/me", authHandler.GetMeHandler).Methods("GET")
			protected.HandleFunc("/auth/change-password", authHandler.ChangePasswordHandler).Methods("POST")
			protected.HandleFunc("/auth/logout", authHandler.LogoutHandler).Methods("POST")

			// Migration routes (protected - tenant owner only)
			protected.HandleFunc("/migrations/fix-owner-branch", migrationHandler.FixOwnerBranchHandler).Methods("POST")

			// License routes (protected)
			protected.HandleFunc("/licenses/activate", licenseHandler.ActivateLicenseHandler).Methods("POST")
			protected.HandleFunc("/licenses/status", licenseHandler.GetLicenseStatusHandler).Methods("GET")
			protected.HandleFunc("/licenses/my-licenses", licenseHandler.GetMyLicensesHandler).Methods("GET")

			// Transaction routes (protected)
			protected.HandleFunc("/transactions", handler.GetTransactions).Methods("GET")
			protected.Handle("/transactions", middleware.WithIdempotency(db, 24*time.Hour, middleware.ValidateRequestMiddleware(models.Transaction{}, handler.CreateTransaction))).Methods("POST")
			protected.HandleFunc("/transactions/{id}", handler.GetTransaction).Methods("GET")
			protected.HandleFunc("/transactions/{id}", handler.UpdateTransaction).Methods("PUT")
			protected.HandleFunc("/transactions/{id}/cancel", handler.CancelTransaction).Methods("POST")
			protected.HandleFunc("/transactions/{id}", handler.DeleteTransaction).Methods("DELETE")
			protected.HandleFunc("/transactions/search", handler.SearchTransactions).Methods("GET")

			// Payment routes (protected)
			protected.Handle("/transactions/{id}/payments", middleware.WithIdempotency(db, 24*time.Hour, http.HandlerFunc(paymentHandler.CreatePaymentHandler))).Methods("POST")
			protected.HandleFunc("/transactions/{id}/payments", paymentHandler.GetPaymentsHandler).Methods("GET")
			protected.HandleFunc("/transactions/{id}/complete", paymentHandler.CompleteTransactionHandler).Methods("POST")
			protected.HandleFunc("/payments/{id}", paymentHandler.GetPaymentHandler).Methods("GET")
			protected.HandleFunc("/payments/{id}", paymentHandler.UpdatePaymentHandler).Methods("PUT")
			protected.HandleFunc("/payments/{id}", paymentHandler.DeletePaymentHandler).Methods("DELETE")
			protected.HandleFunc("/payments/{id}/cancel", paymentHandler.CancelPaymentHandler).Methods("POST")

			// Remittance routes (protected)
			protected.Handle("/remittances/outgoing", middleware.WithIdempotency(db, 24*time.Hour, http.HandlerFunc(handler.CreateOutgoingRemittance))).Methods("POST")
			protected.HandleFunc("/remittances/outgoing", handler.GetOutgoingRemittances).Methods("GET")
			protected.HandleFunc("/remittances/outgoing/{id}", handler.GetOutgoingRemittanceDetails).Methods("GET")
			protected.HandleFunc("/remittances/outgoing/{id}/cancel", handler.CancelOutgoingRemittance).Methods("POST")
			protected.Handle("/remittances/incoming", middleware.WithIdempotency(db, 24*time.Hour, http.HandlerFunc(handler.CreateIncomingRemittance))).Methods("POST")
			protected.HandleFunc("/remittances/incoming", handler.GetIncomingRemittances).Methods("GET")
			protected.HandleFunc("/remittances/incoming/{id}", handler.GetIncomingRemittanceDetails).Methods("GET")
			protected.HandleFunc("/remittances/incoming/{id}/mark-paid", handler.MarkIncomingAsPaid).Methods("POST")
			protected.HandleFunc("/remittances/incoming/{id}/cancel", handler.CancelIncomingRemittance).Methods("POST")
			protected.Handle("/remittances/settle", middleware.WithIdempotency(db, 24*time.Hour, http.HandlerFunc(handler.SettleRemittance))).Methods("POST")
			protected.HandleFunc("/remittances/profit-summary", handler.GetRemittanceProfitSummary).Methods("GET")

			// Settlement routes
			protected.Handle("/remittances/settlements", middleware.WithIdempotency(db, 24*time.Hour, http.HandlerFunc(settlementHandler.CreateSettlementHandler))).Methods("POST")
			protected.HandleFunc("/remittances/{id}/settlements", settlementHandler.GetSettlementHistoryHandler).Methods("GET")
			protected.HandleFunc("/remittances/{id}/settlement-summary", settlementHandler.GetSettlementSummaryHandler).Methods("GET")
			protected.HandleFunc("/remittances/unsettled", settlementHandler.GetUnsettledRemittancesHandler).Methods("GET")

			// Auto-settlement routes
			protected.HandleFunc("/remittances/incoming/{id}/suggestions", autoSettlementHandler.GetSettlementSuggestionsHandler).Methods("GET")
			protected.HandleFunc("/remittances/auto-settle", autoSettlementHandler.AutoSettleHandler).Methods("POST")
			protected.HandleFunc("/remittances/unsettled-summary", autoSettlementHandler.GetUnsettledSummaryHandler).Methods("GET")

			// Client routes (protected)
			protected.HandleFunc("/clients", handler.GetClients).Methods("GET")
			protected.HandleFunc("/clients", middleware.ValidateRequestMiddleware(models.Client{}, handler.CreateClient)).Methods("POST")
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
			protected.HandleFunc("/pickups/{id}/edit", pickupHandler.EditPickupTransactionHandler).Methods("PUT")
			protected.HandleFunc("/pickups/{id}/pickup", pickupHandler.MarkAsPickedUpHandler).Methods("POST")
			protected.HandleFunc("/pickups/{id}/cancel", pickupHandler.CancelPickupTransactionHandler).Methods("POST")

			// External Rates route (protected)
			protected.HandleFunc("/rates/fetch-external", handler.FetchExternalRatesHandler).Methods("GET")

			// Analytics routes (protected)
			protected.HandleFunc("/analytics/daily", handler.GetDailyAnalyticsHandler).Methods("GET")

			// Profit Analysis routes
			protected.HandleFunc("/profit-analysis", profitAnalysisHandler.GetProfitAnalysisHandler).Methods("GET")
			protected.HandleFunc("/profit-analysis/daily", profitAnalysisHandler.GetDailyProfitHandler).Methods("GET")
			protected.HandleFunc("/profit-analysis/monthly", profitAnalysisHandler.GetMonthlyProfitHandler).Methods("GET")
			protected.HandleFunc("/profit-analysis/by-branch", profitAnalysisHandler.GetProfitByBranchHandler).Methods("GET")
			protected.HandleFunc("/profit-analysis/trend", profitAnalysisHandler.GetProfitTrendHandler).Methods("GET")
			protected.HandleFunc("/profit-analysis/by-customer", profitAnalysisHandler.GetTopCustomersHandler).Methods("GET")

			// Transfer routes
			protected.HandleFunc("/transfers", transferHandler.GetTransfersHandler).Methods("GET")
			protected.HandleFunc("/transfers", transferHandler.CreateTransferHandler).Methods("POST")
			protected.HandleFunc("/transfers/{id}/accept", transferHandler.AcceptTransferHandler).Methods("POST")
			protected.HandleFunc("/transfers/{id}/cancel", transferHandler.CancelTransferHandler).Methods("POST")

			// Dashboard routes
			protected.HandleFunc("/dashboard", dashboardHandler.GetDashboardHandler).Methods("GET")

			// Receipt generation routes
			protected.HandleFunc("/receipts/outgoing/{id}", receiptHandler.GetOutgoingRemittanceReceiptHandler).Methods("GET")
			protected.HandleFunc("/receipts/incoming/{id}", receiptHandler.GetIncomingRemittanceReceiptHandler).Methods("GET")
			protected.HandleFunc("/receipts/transaction/{id}", receiptHandler.GetTransactionReceiptHandler).Methods("GET")

			// Customer routes (protected)
			protected.HandleFunc("/customers", customerHandler.GetCustomersForTenantHandler).Methods("GET")
			protected.HandleFunc("/customers/search", customerHandler.SearchCustomersHandler).Methods("GET")
			protected.HandleFunc("/customers/phone/{phone}", customerHandler.GetCustomerByPhoneHandler).Methods("GET")
			protected.HandleFunc("/customers/find-or-create", customerHandler.FindOrCreateCustomerHandler).Methods("POST")
			protected.HandleFunc("/customers/{id}", customerHandler.UpdateCustomerHandler).Methods("PUT")

			// Ledger routes (protected)
			protected.HandleFunc("/clients/{id}/ledger/balance", ledgerHandler.GetClientBalances).Methods("GET")
			protected.HandleFunc("/clients/{id}/ledger/entries", ledgerHandler.GetClientEntries).Methods("GET")
			protected.HandleFunc("/clients/{id}/ledger/entry", ledgerHandler.AddEntry).Methods("POST")
			protected.HandleFunc("/clients/{id}/ledger/exchange", ledgerHandler.Exchange).Methods("POST")

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
			protected.HandleFunc("/export/pdf", statisticsHandler.ExportPDFHandler).Methods("GET")

			// Exchange Rate routes
			protected.HandleFunc("/rates", exchangeRateHandler.GetAllRatesHandler).Methods("GET")
			protected.HandleFunc("/rates/refresh", exchangeRateHandler.RefreshRatesHandler).Methods("POST")
			protected.HandleFunc("/rates/manual", exchangeRateHandler.SetManualRateHandler).Methods("POST")
			protected.HandleFunc("/rates/history", exchangeRateHandler.GetRateHistoryHandler).Methods("GET")

			// Daily Reconciliation routes
			protected.HandleFunc("/reconciliation", reconciliationHandler.CreateReconciliationHandler).Methods("POST")
			protected.HandleFunc("/reconciliation", reconciliationHandler.GetReconciliationHistoryHandler).Methods("GET")
			protected.HandleFunc("/reconciliation/variance", reconciliationHandler.GetVarianceReportHandler).Methods("GET")

			// Report Dashboard routes
			protected.HandleFunc("/reports/daily", reportHandler.GetDailyReportHandler).Methods("GET")
			protected.HandleFunc("/reports/monthly", reportHandler.GetMonthlyReportHandler).Methods("GET")
			protected.HandleFunc("/reports/custom", reportHandler.GetCustomReportHandler).Methods("GET")

			// Search routes (protected)
			protected.HandleFunc("/search/global", searchHandler.GlobalSearchHandler).Methods("GET")
			protected.HandleFunc("/search/advanced", searchHandler.AdvancedSearchHandler).Methods("POST")
			protected.HandleFunc("/search/save", searchHandler.SaveSearchHandler).Methods("POST")
			protected.HandleFunc("/search/saved", searchHandler.GetSavedSearchesHandler).Methods("GET")
			protected.HandleFunc("/search/saved/{id}", searchHandler.DeleteSavedSearchHandler).Methods("DELETE")

			// WebSocket route (protected)
			protected.HandleFunc("/ws", wsHandler.ServeWS).Methods("GET")
		}

		// ============ SUPER ADMIN ROUTES ============

		// Create admin subrouters (requires SuperAdmin role)
		adminV1 := v1.PathPrefix("/admin").Subrouter()
		adminV1.Use(middleware.AuthMiddleware(db))
		adminV1.Use(middleware.RequireSuperAdmin)

		adminLegacy := legacy.PathPrefix("/admin").Subrouter()
		adminLegacy.Use(middleware.AuthMiddleware(db))
		adminLegacy.Use(middleware.RequireSuperAdmin)

		for _, admin := range []*mux.Router{adminV1, adminLegacy} {
			// License management (SuperAdmin)
			admin.HandleFunc("/licenses/generate", adminHandler.GenerateLicenseHandler).Methods("POST")
			admin.HandleFunc("/licenses", adminHandler.GetAllLicensesHandler).Methods("GET")
			admin.HandleFunc("/licenses/{id}/revoke", adminHandler.RevokeLicenseHandler).Methods("POST")

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
		}
	}

	// Register routes on both v1 and legacy paths
	registerRoutes(apiV1, apiLegacy)

	// Swagger documentation (public)
	router.PathPrefix("/swagger/").Handler(httpSwagger.WrapHandler)

	// Add health check endpoint (public) - available at both /api/health and /api/v1/health
	healthHandler := func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":    "ok",
			"version":   "1.0.0",
			"timestamp": time.Now().Format(time.RFC3339),
		})
	}
	router.HandleFunc("/api/health", healthHandler)
	router.HandleFunc("/api/v1/health", healthHandler)

	// API version info endpoint
	router.HandleFunc("/api/version", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]interface{}{
			"currentVersion":     "v1",
			"supportedVersions":  []string{"v1"},
			"deprecatedVersions": []string{},
			"note":               "The /api/* routes (without version) are deprecated. Please migrate to /api/v1/*",
		})
	})

	// Setup CORS
	c := cors.New(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000"}, // Frontend URL
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Content-Type", "Authorization"},
		AllowCredentials: true,
	})

	// Apply CORS middleware
	return c.Handler(router)
}
