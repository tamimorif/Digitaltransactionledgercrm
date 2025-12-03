package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"api/pkg/models"
	"api/pkg/services"

	"github.com/gorilla/mux"
)

type AdminHandler struct {
	adminService *services.AdminService
}

func NewAdminHandler(adminService *services.AdminService) *AdminHandler {
	return &AdminHandler{adminService: adminService}
}

// GenerateLicenseRequest request body
type GenerateLicenseRequest struct {
	LicenseType   string `json:"licenseType"`
	UserLimit     int    `json:"userLimit"`
	DurationType  string `json:"durationType"`
	DurationValue *int   `json:"durationValue"`
	Notes         string `json:"notes"`
}

// GenerateLicenseHandler handler
// @Summary Generate a new license key
// @Description Create a new license key with specified parameters
// @Tags Admin
// @Accept json
// @Produce json
// @Param request body GenerateLicenseRequest true "License Details"
// @Success 201 {object} models.License
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /api/admin/licenses [post]
func (h *AdminHandler) GenerateLicenseHandler(w http.ResponseWriter, r *http.Request) {
	var req GenerateLicenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Get user from context (set by AuthMiddleware as "user")
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		http.Error(w, "User not found in context", http.StatusUnauthorized)
		return
	}

	license, err := h.adminService.GenerateLicense(req.LicenseType, req.UserLimit, req.DurationType, req.DurationValue, user.ID, req.Notes)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(license)
}

// GetAllTenantsHandler handler
// @Summary Get all tenants
// @Description Retrieve a list of all tenants with summary stats
// @Tags Admin
// @Produce json
// @Success 200 {array} models.Tenant
// @Failure 500 {object} ErrorResponse
// @Router /api/admin/tenants [get]
func (h *AdminHandler) GetAllTenantsHandler(w http.ResponseWriter, r *http.Request) {
	tenants, err := h.adminService.GetAllTenants()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(tenants)
}

// GetTenantByIDHandler handler
func (h *AdminHandler) GetTenantByIDHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseUint(vars["id"], 10, 32)
	tenant, err := h.adminService.GetTenantByID(uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(tenant)
}

// SuspendTenantHandler handler
func (h *AdminHandler) SuspendTenantHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseUint(vars["id"], 10, 32)
	if err := h.adminService.UpdateTenantStatus(uint(id), "suspended"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// ActivateTenantHandler handler
func (h *AdminHandler) ActivateTenantHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseUint(vars["id"], 10, 32)
	if err := h.adminService.UpdateTenantStatus(uint(id), "active"); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// GetTenantCashBalancesHandler handler
func (h *AdminHandler) GetTenantCashBalancesHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseUint(vars["id"], 10, 32)
	balances, err := h.adminService.GetTenantCashBalances(uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(balances)
}

// GetTenantCustomerCountHandler handler
func (h *AdminHandler) GetTenantCustomerCountHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id, _ := strconv.ParseUint(vars["id"], 10, 32)
	count, err := h.adminService.GetTenantCustomerCount(uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(map[string]int64{"count": count})
}

// GetTenantUsersHandler handler
// @Summary Get users for a tenant
// @Description Retrieve all users belonging to a specific tenant
// @Tags Admin
// @Produce json
// @Param id path int true "Tenant ID"
// @Success 200 {array} models.User
// @Failure 500 {object} ErrorResponse
// @Router /api/admin/tenants/{id}/users [get]
func (h *AdminHandler) GetTenantUsersHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tenantID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid tenant ID", http.StatusBadRequest)
		return
	}

	users, err := h.adminService.GetTenantUsers(uint(tenantID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(users)
}

// DeleteTenantHandler handler
// @Summary Delete a tenant
// @Description Permanently delete a tenant and all associated data
// @Tags Admin
// @Param id path int true "Tenant ID"
// @Success 204 "No Content"
// @Failure 500 {object} ErrorResponse
// @Router /api/admin/tenants/{id} [delete]
func (h *AdminHandler) DeleteTenantHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tenantID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid tenant ID", http.StatusBadRequest)
		return
	}

	if err := h.adminService.DeleteTenant(uint(tenantID)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetAllLicensesHandler handler
// @Summary Get all licenses
// @Description Retrieve a list of all generated licenses
// @Tags Admin
// @Produce json
// @Success 200 {array} models.License
// @Failure 500 {object} ErrorResponse
// @Router /api/admin/licenses [get]
func (h *AdminHandler) GetAllLicensesHandler(w http.ResponseWriter, r *http.Request) {
	licenses, err := h.adminService.GetAllLicenses()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(licenses)
}

// RevokeLicenseHandler handler
// @Summary Revoke a license
// @Description Mark a license as revoked
// @Tags Admin
// @Param id path int true "License ID"
// @Success 204 "No Content"
// @Failure 500 {object} ErrorResponse
// @Router /api/admin/licenses/{id} [delete]
func (h *AdminHandler) RevokeLicenseHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	licenseID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid license ID", http.StatusBadRequest)
		return
	}

	if err := h.adminService.RevokeLicense(uint(licenseID)); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// GetAllUsersHandler handler
func (h *AdminHandler) GetAllUsersHandler(w http.ResponseWriter, r *http.Request) {
	users, err := h.adminService.GetAllUsers()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(users)
}

// GetAllTransactionsHandler handler
func (h *AdminHandler) GetAllTransactionsHandler(w http.ResponseWriter, r *http.Request) {
	transactions, err := h.adminService.GetAllTransactions()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(transactions)
}

// GetDashboardStatsHandler handler
func (h *AdminHandler) GetDashboardStatsHandler(w http.ResponseWriter, r *http.Request) {
	stats, err := h.adminService.GetDashboardStats()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	json.NewEncoder(w).Encode(stats)
}
