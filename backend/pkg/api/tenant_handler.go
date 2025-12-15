package api

import (
	"api/pkg/models"
	"encoding/json"
	"net/http"
)

// UpdateTenantName godoc
// @Summary Update tenant organization name
// @Description Update the organization name for the current tenant
// @Tags tenant
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body object{name=string} true "Update tenant name request"
// @Success 200 {object} models.Tenant
// @Failure 400 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /tenant/update-name [put]
func (h *Handler) UpdateTenantName(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user := r.Context().Value("user").(*models.User)

	// Only tenant owners can update tenant name
	if user.Role != "tenant_owner" {
		http.Error(w, "Only tenant owners can update organization name", http.StatusForbidden)
		return
	}

	// Parse request body
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate name
	if req.Name == "" {
		http.Error(w, "Organization name cannot be empty", http.StatusBadRequest)
		return
	}

	// Get tenant
	var tenant models.Tenant
	if err := h.db.WithContext(r.Context()).First(&tenant, "id = ?", user.TenantID).Error; err != nil {
		http.Error(w, "Tenant not found", http.StatusNotFound)
		return
	}

	// Update tenant name
	tenant.Name = req.Name
	if err := h.db.WithContext(r.Context()).Save(&tenant).Error; err != nil {
		http.Error(w, "Failed to update tenant name", http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, tenant)
}

// GetTenantInfo godoc
// @Summary Get tenant information with license
// @Description Get tenant info including active branches and license details
// @Tags tenant
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /tenant/info [get]
func (h *Handler) GetTenantInfo(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	if user.TenantID == nil {
		http.Error(w, "User must belong to a tenant", http.StatusBadRequest)
		return
	}

	// Get tenant
	var tenant models.Tenant
	if err := h.db.WithContext(r.Context()).Preload("CurrentLicense").First(&tenant, *user.TenantID).Error; err != nil {
		http.Error(w, "Tenant not found", http.StatusNotFound)
		return
	}

	// Count active branches
	var activeBranches int64
	h.db.WithContext(r.Context()).Model(&models.Branch{}).
		Where("tenant_id = ? AND status = ?", *user.TenantID, models.BranchStatusActive).
		Count(&activeBranches)

	response := map[string]interface{}{
		"id":             tenant.ID,
		"name":           tenant.Name,
		"activeBranches": activeBranches,
	}

	if tenant.CurrentLicense != nil {
		response["license"] = map[string]interface{}{
			"id":          tenant.CurrentLicense.ID,
			"maxBranches": tenant.CurrentLicense.MaxBranches,
			"expiresAt":   tenant.CurrentLicense.ExpiresAt,
			"status":      tenant.CurrentLicense.Status,
		}
	}

	respondJSON(w, http.StatusOK, response)
}
