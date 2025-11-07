package api

import (
	"api/pkg/models"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// AdminHandler handles admin-related requests
type AdminHandler struct {
	DB *gorm.DB
}

// NewAdminHandler creates a new admin handler
func NewAdminHandler(db *gorm.DB) *AdminHandler {
	return &AdminHandler{
		DB: db,
	}
}

// GetAllTenantsHandler returns all tenants (SuperAdmin only)
// @Summary Get all tenants
// @Description Get all tenants in the system (SuperAdmin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.Tenant "List of tenants"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/tenants [get]
func (ah *AdminHandler) GetAllTenantsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can view all tenants")
		return
	}

	var tenants []models.Tenant
	if err := ah.DB.Preload("Owner").Preload("CurrentLicense").Find(&tenants).Error; err != nil {
		log.Printf("Get tenants error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to get tenants")
		return
	}

	respondWithJSON(w, http.StatusOK, tenants)
}

// GetTenantByIDHandler returns a specific tenant (SuperAdmin only)
// @Summary Get tenant by ID
// @Description Get detailed information about a specific tenant (SuperAdmin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path int true "Tenant ID"
// @Success 200 {object} models.Tenant "Tenant details"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 404 {object} map[string]string "Not found"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/tenants/{id} [get]
func (ah *AdminHandler) GetTenantByIDHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can view tenant details")
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	tenantID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	var tenant models.Tenant
	if err := ah.DB.Preload("Owner").Preload("CurrentLicense").Preload("Users").
		First(&tenant, tenantID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Tenant not found")
		return
	}

	respondWithJSON(w, http.StatusOK, tenant)
}

// SuspendTenantHandler suspends a tenant (SuperAdmin only)
// @Summary Suspend a tenant
// @Description Suspend a tenant and all its users (SuperAdmin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path int true "Tenant ID"
// @Success 200 {object} map[string]string "Tenant suspended"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/tenants/{id}/suspend [post]
func (ah *AdminHandler) SuspendTenantHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can suspend tenants")
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	tenantID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	tx := ah.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Update tenant
	var tenant models.Tenant
	if err := tx.First(&tenant, tenantID).Error; err != nil {
		tx.Rollback()
		respondWithError(w, http.StatusNotFound, "Tenant not found")
		return
	}

	tenant.Status = models.TenantStatusSuspended
	if err := tx.Save(&tenant).Error; err != nil {
		tx.Rollback()
		respondWithError(w, http.StatusInternalServerError, "Failed to suspend tenant")
		return
	}

	// Suspend all users
	if err := tx.Model(&models.User{}).Where("tenant_id = ?", tenantID).
		Update("status", models.StatusSuspended).Error; err != nil {
		tx.Rollback()
		respondWithError(w, http.StatusInternalServerError, "Failed to suspend users")
		return
	}

	tx.Commit()

	log.Printf("⚠️  Tenant suspended by SuperAdmin: ID %d", tenantID)
	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Tenant suspended successfully",
	})
}

// ActivateTenantHandler activates a suspended tenant (SuperAdmin only)
// @Summary Activate a tenant
// @Description Activate a suspended tenant and its users (SuperAdmin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Param id path int true "Tenant ID"
// @Success 200 {object} map[string]string "Tenant activated"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/tenants/{id}/activate [post]
func (ah *AdminHandler) ActivateTenantHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can activate tenants")
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	tenantID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid tenant ID")
		return
	}

	tx := ah.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Update tenant
	var tenant models.Tenant
	if err := tx.First(&tenant, tenantID).Error; err != nil {
		tx.Rollback()
		respondWithError(w, http.StatusNotFound, "Tenant not found")
		return
	}

	tenant.Status = models.TenantStatusActive
	if err := tx.Save(&tenant).Error; err != nil {
		tx.Rollback()
		respondWithError(w, http.StatusInternalServerError, "Failed to activate tenant")
		return
	}

	// Activate all users
	if err := tx.Model(&models.User{}).Where("tenant_id = ?", tenantID).
		Update("status", models.StatusActive).Error; err != nil {
		tx.Rollback()
		respondWithError(w, http.StatusInternalServerError, "Failed to activate users")
		return
	}

	tx.Commit()

	log.Printf("✅ Tenant activated by SuperAdmin: ID %d", tenantID)
	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Tenant activated successfully",
	})
}

// GetAllUsersHandler returns all users in the system (SuperAdmin only)
// @Summary Get all users
// @Description Get all users in the system (SuperAdmin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.User "List of users"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/users [get]
func (ah *AdminHandler) GetAllUsersHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can view all users")
		return
	}

	var users []models.User
	if err := ah.DB.Preload("Tenant").Find(&users).Error; err != nil {
		log.Printf("Get users error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to get users")
		return
	}

	respondWithJSON(w, http.StatusOK, users)
}

// GetDashboardStatsHandler returns dashboard statistics (SuperAdmin only)
// @Summary Get dashboard stats
// @Description Get overall system statistics (SuperAdmin only)
// @Tags admin
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]interface{} "Dashboard statistics"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/dashboard/stats [get]
func (ah *AdminHandler) GetDashboardStatsHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can view dashboard")
		return
	}

	// Count tenants
	var totalTenants int64
	ah.DB.Model(&models.Tenant{}).Count(&totalTenants)

	var activeTenants int64
	ah.DB.Model(&models.Tenant{}).Where("status = ?", models.TenantStatusActive).Count(&activeTenants)

	var trialTenants int64
	ah.DB.Model(&models.Tenant{}).Where("status = ?", models.TenantStatusTrial).Count(&trialTenants)

	// Count users
	var totalUsers int64
	ah.DB.Model(&models.User{}).Count(&totalUsers)

	var activeUsers int64
	ah.DB.Model(&models.User{}).Where("status = ?", models.StatusActive).Count(&activeUsers)

	// Count licenses
	var totalLicenses int64
	ah.DB.Model(&models.License{}).Count(&totalLicenses)

	var activeLicenses int64
	ah.DB.Model(&models.License{}).Where("status = ?", models.LicenseStatusActive).Count(&activeLicenses)

	var unusedLicenses int64
	ah.DB.Model(&models.License{}).Where("status = ?", models.LicenseStatusUnused).Count(&unusedLicenses)

	stats := map[string]interface{}{
		"tenants": map[string]interface{}{
			"total":  totalTenants,
			"active": activeTenants,
			"trial":  trialTenants,
		},
		"users": map[string]interface{}{
			"total":  totalUsers,
			"active": activeUsers,
		},
		"licenses": map[string]interface{}{
			"total":  totalLicenses,
			"active": activeLicenses,
			"unused": unusedLicenses,
		},
	}

	respondWithJSON(w, http.StatusOK, stats)
}
