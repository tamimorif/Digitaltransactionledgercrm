package api

import (
	"net/http"
	"time"

	"api/pkg/models"
)

// AnalyticsResponse represents the daily analytics data
type AnalyticsResponse struct {
	Date             string             `json:"date"`
	TotalVolume      map[string]float64 `json:"totalVolume"` // Currency -> Amount
	TotalFees        map[string]float64 `json:"totalFees"`   // Currency -> Amount
	TransactionCount int64              `json:"transactionCount"`
}

// GetDailyAnalyticsHandler returns the daily volume and fees
// @Summary Get daily analytics
// @Description Get daily transaction volume and fees
// @Tags analytics
// @Produce json
// @Security BearerAuth
// @Success 200 {object} AnalyticsResponse
// @Failure 500 {object} map[string]string
// @Router /analytics/daily [get]
func (h *Handler) GetDailyAnalyticsHandler(w http.ResponseWriter, r *http.Request) {
	// Get current date range (start of day to end of day)
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	endOfDay := startOfDay.Add(24 * time.Hour)

	var transactions []models.Transaction

	// Let's just use the user from context to get TenantID
	userVal := r.Context().Value("user")
	var tenantID uint
	if userVal != nil {
		user := userVal.(*models.User)
		if user.TenantID != nil {
			tenantID = *user.TenantID
		}
	}

	query := h.db.WithContext(r.Context()).Where("transaction_date >= ? AND transaction_date < ? AND status = ?", startOfDay, endOfDay, models.StatusCompleted)

	if tenantID != 0 {
		query = query.Where("tenant_id = ?", tenantID)
	}

	if err := query.Find(&transactions).Error; err != nil {
		http.Error(w, "Failed to fetch transactions", http.StatusInternalServerError)
		return
	}

	// Aggregate data
	totalVolume := make(map[string]float64)
	totalFees := make(map[string]float64)
	var count int64 = 0

	for _, tx := range transactions {
		count++

		// Volume (Send Amount)
		totalVolume[tx.SendCurrency] += tx.SendAmount

		// Fees (Assuming Fee is in Send Currency)
		totalFees[tx.SendCurrency] += tx.FeeCharged
	}

	response := AnalyticsResponse{
		Date:             startOfDay.Format("2006-01-02"),
		TotalVolume:      totalVolume,
		TotalFees:        totalFees,
		TransactionCount: count,
	}

	respondJSON(w, http.StatusOK, response)
}
