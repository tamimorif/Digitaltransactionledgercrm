package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"api/pkg/services"
	"net/http"
	"strconv"

	"gorm.io/gorm"
)

// AuditHandler handles audit log requests
type AuditHandler struct {
	AuditService *services.AuditService
}

// NewAuditHandler creates a new audit handler
func NewAuditHandler(db *gorm.DB) *AuditHandler {
	return &AuditHandler{
		AuditService: services.NewAuditService(db),
	}
}

// GetAuditLogsHandler returns audit logs for the tenant
// @Summary Get audit logs
// @Description Get audit logs for the current tenant (or all if SuperAdmin)
// @Tags audit
// @Produce json
// @Security BearerAuth
// @Param limit query int false "Limit" default(50)
// @Param offset query int false "Offset" default(0)
// @Success 200 {object} map[string]interface{} "Audit logs"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /audit-logs [get]
func (ah *AuditHandler) GetAuditLogsHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Get pagination params
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	// Apply tenant filter
	var tenantID *uint
	if user.Role != models.RoleSuperAdmin {
		tenantID = middleware.GetTenantID(r)
	}

	logs, total, err := ah.AuditService.GetAuditLogs(tenantID, limit, offset)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get audit logs")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"logs":   logs,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
