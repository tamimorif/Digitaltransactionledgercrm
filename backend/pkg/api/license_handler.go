package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"log"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// LicenseHandler handles license-related requests
type LicenseHandler struct {
	LicenseService *services.LicenseService
	DB             *gorm.DB
}

// NewLicenseHandler creates a new license handler
func NewLicenseHandler(db *gorm.DB) *LicenseHandler {
	return &LicenseHandler{
		LicenseService: services.NewLicenseService(db),
		DB:             db,
	}
}

// GenerateLicenseHandler generates a new license (SuperAdmin only)
// @Summary Generate a new license
// @Description Generate a new license key (SuperAdmin only)
// @Tags licenses
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body services.GenerateLicenseRequest true "License generation details"
// @Success 201 {object} models.License "License created"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/licenses/generate [post]
func (lh *LicenseHandler) GenerateLicenseHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can generate licenses")
		return
	}

	var req services.GenerateLicenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	license, err := lh.LicenseService.GenerateLicense(req, user.ID)
	if err != nil {
		log.Printf("License generation error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, license)
}

// ActivateLicenseHandler activates a license for the current user's tenant
// @Summary Activate a license
// @Description Activate a license for the current tenant
// @Tags licenses
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body map[string]string true "License key"
// @Success 200 {object} map[string]string "License activated"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /licenses/activate [post]
func (lh *LicenseHandler) ActivateLicenseHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Only tenant owner can activate license
	if user.Role != models.RoleTenantOwner && user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only tenant owner can activate license")
		return
	}

	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User has no tenant assigned")
		return
	}

	var req struct {
		LicenseKey string `json:"licenseKey"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.LicenseKey == "" {
		respondWithError(w, http.StatusBadRequest, "License key is required")
		return
	}

	err := lh.LicenseService.ActivateLicense(req.LicenseKey, *user.TenantID)
	if err != nil {
		log.Printf("License activation error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "License activated successfully",
	})
}

// GetLicenseStatusHandler returns the current license status for the tenant
// @Summary Get license status
// @Description Get current license status for the authenticated user's tenant
// @Tags licenses
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.License "License status"
// @Failure 404 {object} map[string]string "No active license"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /licenses/status [get]
func (lh *LicenseHandler) GetLicenseStatusHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	if user.TenantID == nil {
		respondWithError(w, http.StatusNotFound, "No tenant assigned")
		return
	}

	// Get tenant with license
	var tenant models.Tenant
	if err := lh.DB.Preload("CurrentLicense").First(&tenant, user.TenantID).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get tenant info")
		return
	}

	if tenant.CurrentLicenseID == nil || tenant.CurrentLicense == nil {
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"hasLicense": false,
			"status":     tenant.Status,
			"trialEndsAt": user.TrialEndsAt,
		})
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"hasLicense":  true,
		"license":     tenant.CurrentLicense,
		"userLimit":   tenant.UserLimit,
		"tenantStatus": tenant.Status,
	})
}

// GetAllLicensesHandler returns all licenses (SuperAdmin only)
// @Summary Get all licenses
// @Description Get all licenses in the system (SuperAdmin only)
// @Tags licenses
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.License "List of licenses"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/licenses [get]
func (lh *LicenseHandler) GetAllLicensesHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can view all licenses")
		return
	}

	licenses, err := lh.LicenseService.GetAllLicenses()
	if err != nil {
		log.Printf("Get licenses error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to get licenses")
		return
	}

	respondWithJSON(w, http.StatusOK, licenses)
}

// RevokeLicenseHandler revokes a license (SuperAdmin only)
// @Summary Revoke a license
// @Description Revoke a license and suspend associated tenant (SuperAdmin only)
// @Tags licenses
// @Produce json
// @Security BearerAuth
// @Param id path int true "License ID"
// @Success 200 {object} map[string]string "License revoked"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /admin/licenses/{id}/revoke [post]
func (lh *LicenseHandler) RevokeLicenseHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context
	user, ok := r.Context().Value("user").(*models.User)
	if !ok || user.Role != models.RoleSuperAdmin {
		respondWithError(w, http.StatusForbidden, "Only SuperAdmin can revoke licenses")
		return
	}

	vars := mux.Vars(r)
	idStr := vars["id"]
	licenseID, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid license ID")
		return
	}

	err = lh.LicenseService.RevokeLicense(uint(licenseID))
	if err != nil {
		log.Printf("License revocation error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "License revoked successfully",
	})
}
