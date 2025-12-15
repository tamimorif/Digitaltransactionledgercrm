package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"encoding/json"
	"net/http"

	"github.com/google/uuid"
	"github.com/gorilla/mux"
)

// GetClients godoc
// @Summary Get all clients
// @Description Get a list of all clients (filtered by tenant)
// @Tags clients
// @Produce json
// @Security BearerAuth
// @Success 200 {array} models.Client
// @Failure 500 {object} map[string]string
// @Router /clients [get]
func (h *Handler) GetClients(w http.ResponseWriter, r *http.Request) {
	var clients []models.Client

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Find(&clients)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, clients)
}

// CreateClient godoc
// @Summary Create a new client
// @Description Create a new client with the provided information
// @Tags clients
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param client body models.Client true "Client object"
// @Success 201 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /clients [post]
func (h *Handler) CreateClient(w http.ResponseWriter, r *http.Request) {
	var client models.Client

	// Check if already validated by middleware
	if val := middleware.GetValidatedData(r); val != nil {
		if c, ok := val.(*models.Client); ok {
			client = *c
		} else {
			// Should not happen if configured correctly
			http.Error(w, "Internal validation error", http.StatusInternalServerError)
			return
		}
	} else {
		// Fallback for tests or direct calls
		if err := json.NewDecoder(r.Body).Decode(&client); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	// Generate UUID for the client
	client.ID = uuid.New().String()

	// Get tenant ID from context and assign to client
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Tenant ID required", http.StatusBadRequest)
		return
	}
	client.TenantID = *tenantID

	result := h.db.WithContext(r.Context()).Create(&client)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusCreated, client)
}

// GetClient godoc
// @Summary Get a client by ID
// @Description Get a specific client by their ID with transactions
// @Tags clients
// @Produce json
// @Security BearerAuth
// @Param id path string true "Client ID"
// @Success 200 {object} models.Client
// @Failure 404 {object} map[string]string
// @Router /clients/{id} [get]
func (h *Handler) GetClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var client models.Client

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Preload("Transactions").First(&client, "id = ?", id)
	if result.Error != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}
	respondJSON(w, http.StatusOK, client)
}

// UpdateClient godoc
// @Summary Update a client
// @Description Update an existing client's information
// @Tags clients
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path string true "Client ID"
// @Param client body models.Client true "Client object"
// @Success 200 {object} models.Client
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /clients/{id} [put]
func (h *Handler) UpdateClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	var client models.Client
	if err := db.First(&client, "id = ?", id).Error; err != nil {
		http.Error(w, "Client not found", http.StatusNotFound)
		return
	}

	// Decode into a separate payload to avoid overwriting protected fields (ID, TenantID)
	var payload struct {
		Name        *string `json:"name"`
		PhoneNumber *string `json:"phoneNumber"`
		Email       *string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	updates := map[string]interface{}{}
	if payload.Name != nil {
		updates["name"] = *payload.Name
	}
	if payload.PhoneNumber != nil {
		updates["phone_number"] = *payload.PhoneNumber
	}
	if payload.Email != nil {
		updates["email"] = payload.Email
	}

	if len(updates) > 0 {
		if err := db.Model(&client).Updates(updates).Error; err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	respondJSON(w, http.StatusOK, client)
}

// DeleteClient godoc
// @Summary Delete a client
// @Description Delete a client by ID
// @Tags clients
// @Produce json
// @Security BearerAuth
// @Param id path string true "Client ID"
// @Success 200 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /clients/{id} [delete]
func (h *Handler) DeleteClient(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Delete(&models.Client{}, "id = ?", id)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"message": "Client deleted successfully"})
}

// SearchClients godoc
// @Summary Search clients
// @Description Search clients by name, email, or phone
// @Tags clients
// @Produce json
// @Security BearerAuth
// @Param q query string true "Search query"
// @Success 200 {array} models.Client
// @Failure 400 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /clients/search [get]
func (h *Handler) SearchClients(w http.ResponseWriter, r *http.Request) {
	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	var clients []models.Client

	// Apply tenant isolation
	db := middleware.ApplyTenantScope(h.db, r)

	result := db.Where("name LIKE ? OR email LIKE ? OR phone_number LIKE ?",
		"%"+query+"%", "%"+query+"%", "%"+query+"%").Find(&clients)
	if result.Error != nil {
		http.Error(w, result.Error.Error(), http.StatusInternalServerError)
		return
	}
	respondJSON(w, http.StatusOK, clients)
}
