package api

import (
	"api/pkg/services"
	"encoding/json"
	"net/http"

	"gorm.io/gorm"
)

// Handler struct
type Handler struct {
	db                  *gorm.DB
	auditService        *services.AuditService
	exchangeRateService *services.ExchangeRateService
	transactionService  *services.TransactionService
	navasanService      *services.NavasanService
}

// NewHandler creates a new handler instance with database connection
func NewHandler(db *gorm.DB) *Handler {
	exchangeRateService := services.NewExchangeRateService(db)
	return &Handler{
		db:                  db,
		auditService:        services.NewAuditService(db),
		exchangeRateService: exchangeRateService,
		transactionService:  services.NewTransactionService(db, exchangeRateService),
		navasanService:      services.NewNavasanService(),
	}
}

// Helper function to send JSON response
func respondJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	err := json.NewEncoder(w).Encode(payload)
	if err != nil {
		return
	}
}
