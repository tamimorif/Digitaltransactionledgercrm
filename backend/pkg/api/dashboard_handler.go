package api

import (
	"api/pkg/middleware"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"gorm.io/gorm"
)

// DashboardHandler handles dashboard API requests
type DashboardHandler struct {
	dashboardService *services.DashboardService
}

// NewDashboardHandler creates a new DashboardHandler
func NewDashboardHandler(db *gorm.DB) *DashboardHandler {
	return &DashboardHandler{
		dashboardService: services.NewDashboardService(db),
	}
}

// GetDashboardHandler returns dashboard data
// @Summary Get dashboard data
// @Description Returns comprehensive dashboard metrics and alerts
// @Tags Dashboard
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param branchId query int false "Branch ID (optional)"
// @Success 200 {object} services.DashboardData
// @Router /dashboard [get]
func (h *DashboardHandler) GetDashboardHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var branchID *uint
	if branchIDStr := r.URL.Query().Get("branchId"); branchIDStr != "" {
		id, err := strconv.ParseUint(branchIDStr, 10, 64)
		if err == nil {
			bid := uint(id)
			branchID = &bid
		}
	}

	data, err := h.dashboardService.GetDashboardData(*tenantID, branchID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}
