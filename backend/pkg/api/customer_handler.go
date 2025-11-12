package api

import (
	"api/pkg/middleware"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

type CustomerHandler struct {
	CustomerService *services.CustomerService
}

func NewCustomerHandler(db *gorm.DB) *CustomerHandler {
	return &CustomerHandler{
		CustomerService: services.NewCustomerService(db),
	}
}

// SearchCustomersHandler searches for customers by phone or name (tenant-scoped)
// GET /customers/search?q=phone_or_name
func (h *CustomerHandler) SearchCustomersHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	customers, err := h.CustomerService.SearchCustomers(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, customers)
}

// GetCustomerByPhoneHandler retrieves a customer by phone number
// GET /customers/phone/:phone
func (h *CustomerHandler) GetCustomerByPhoneHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	phone := vars["phone"]
	if phone == "" {
		http.Error(w, "Phone number is required", http.StatusBadRequest)
		return
	}

	customer, err := h.CustomerService.GetCustomerByPhone(phone)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, customer)
}

// FindOrCreateCustomerHandler finds or creates a customer and links to tenant
// POST /customers/find-or-create
func (h *CustomerHandler) FindOrCreateCustomerHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	var req struct {
		Phone    string  `json:"phone"`
		FullName string  `json:"fullName"`
		Email    *string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Find or create customer
	customer, err := h.CustomerService.FindOrCreateCustomer(req.Phone, req.FullName, req.Email)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Link customer to tenant
	if err := h.CustomerService.LinkCustomerToTenant(customer.ID, *tenantID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, customer)
}

// GetCustomersForTenantHandler retrieves all customers for the current tenant
// GET /customers
func (h *CustomerHandler) GetCustomersForTenantHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}

	customers, err := h.CustomerService.GetCustomersForTenant(*tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, customers)
}

// UpdateCustomerHandler updates customer information
// PUT /customers/:id
func (h *CustomerHandler) UpdateCustomerHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid customer ID", http.StatusBadRequest)
		return
	}

	var req struct {
		FullName string  `json:"fullName"`
		Email    *string `json:"email"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	if err := h.CustomerService.UpdateCustomer(uint(id), req.FullName, req.Email); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "Customer updated successfully"})
}

// ============ SUPER ADMIN ROUTES ============

// SearchCustomersGlobalHandler searches customers across all tenants (SuperAdmin only)
// GET /admin/customers/search?q=phone_or_name
func (h *CustomerHandler) SearchCustomersGlobalHandler(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	customers, err := h.CustomerService.SearchCustomersGlobal(query)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	respondJSON(w, http.StatusOK, customers)
}

// GetCustomerWithTenantsHandler retrieves customer with all tenant links (SuperAdmin only)
// GET /admin/customers/:id
func (h *CustomerHandler) GetCustomerWithTenantsHandler(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid customer ID", http.StatusBadRequest)
		return
	}

	customer, err := h.CustomerService.GetCustomerWithTenants(uint(id))
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}

	respondJSON(w, http.StatusOK, customer)
}
