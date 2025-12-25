package api

import (
	"api/pkg/middleware"
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// TicketHandler handles ticket-related API endpoints
type TicketHandler struct {
	ticketService *services.TicketService
	db            *gorm.DB
}

// NewTicketHandler creates a new ticket handler
func NewTicketHandler(db *gorm.DB) *TicketHandler {
	return &TicketHandler{
		ticketService: services.NewTicketService(db),
		db:            db,
	}
}

// CreateTicketHandler creates a new ticket
// @Summary Create a new ticket
// @Tags Tickets
// @Accept json
// @Produce json
// @Success 201 {object} models.Ticket
// @Router /tickets [post]
func (h *TicketHandler) CreateTicketHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID

	var req services.CreateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Subject == "" {
		http.Error(w, "Subject is required", http.StatusBadRequest)
		return
	}

	ticket, err := h.ticketService.CreateTicket(*tenantID, userID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ticket)
}

// GetTicketHandler retrieves a ticket by ID
// @Summary Get ticket by ID
// @Tags Tickets
// @Produce json
// @Param id path int true "Ticket ID"
// @Success 200 {object} models.Ticket
// @Router /tickets/{id} [get]
func (h *TicketHandler) GetTicketHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	ticketIDStr := vars["id"]
	ticketID, err := strconv.ParseUint(ticketIDStr, 10, 32)
	if err != nil {
		http.Error(w, "Invalid ticket ID", http.StatusBadRequest)
		return
	}

	ticket, err := h.ticketService.GetTicket(*tenantID, uint(ticketID))
	if err != nil {
		http.Error(w, "Ticket not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(ticket)
}

// ListTicketsHandler lists tickets with filters
// @Summary List tickets
// @Tags Tickets
// @Produce json
// @Success 200 {object} TicketListResponse
// @Router /tickets [get]
func (h *TicketHandler) ListTicketsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 20
	}

	filter := services.TicketFilter{
		Search:        r.URL.Query().Get("search"),
		IncludeClosed: r.URL.Query().Get("includeClosed") == "true",
	}

	// Parse status filter
	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		filter.Status = []models.TicketStatus{models.TicketStatus(statusStr)}
	}

	// Parse priority filter
	if priorityStr := r.URL.Query().Get("priority"); priorityStr != "" {
		filter.Priority = []models.TicketPriority{models.TicketPriority(priorityStr)}
	}

	// Parse category filter
	if categoryStr := r.URL.Query().Get("category"); categoryStr != "" {
		filter.Category = []models.TicketCategory{models.TicketCategory(categoryStr)}
	}

	// Parse assignee filter
	if assigneeStr := r.URL.Query().Get("assignedTo"); assigneeStr != "" {
		if id, err := strconv.ParseUint(assigneeStr, 10, 32); err == nil {
			uid := uint(id)
			filter.AssignedToUserID = &uid
		}
	}

	// Parse branch filter
	if branchStr := r.URL.Query().Get("branchId"); branchStr != "" {
		if id, err := strconv.ParseUint(branchStr, 10, 32); err == nil {
			bid := uint(id)
			filter.BranchID = &bid
		}
	}

	tickets, total, err := h.ticketService.ListTickets(*tenantID, filter, page, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	response := TicketListResponse{
		Tickets: tickets,
		Total:   total,
		Page:    page,
		Limit:   limit,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// TicketListResponse represents the paginated ticket list
type TicketListResponse struct {
	Tickets []models.Ticket `json:"tickets"`
	Total   int64           `json:"total"`
	Page    int             `json:"page"`
	Limit   int             `json:"limit"`
}

// UpdateTicketStatusHandler updates ticket status
// @Summary Update ticket status
// @Tags Tickets
// @Accept json
// @Produce json
// @Router /tickets/{id}/status [put]
func (h *TicketHandler) UpdateTicketStatusHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	ticketID, _ := strconv.ParseUint(vars["id"], 10, 32)

	var req struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := h.ticketService.UpdateTicketStatus(*tenantID, uint(ticketID), models.TicketStatus(req.Status), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Status updated"})
}

// AssignTicketHandler assigns a ticket to a user
// @Summary Assign ticket
// @Tags Tickets
// @Accept json
// @Produce json
// @Router /tickets/{id}/assign [put]
func (h *TicketHandler) AssignTicketHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	ticketID, _ := strconv.ParseUint(vars["id"], 10, 32)

	var req struct {
		AssignToUserID uint `json:"assignToUserId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := h.ticketService.AssignTicket(*tenantID, uint(ticketID), req.AssignToUserID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Ticket assigned"})
}

// AddMessageHandler adds a message to a ticket
// @Summary Add message to ticket
// @Tags Tickets
// @Accept json
// @Produce json
// @Router /tickets/{id}/messages [post]
func (h *TicketHandler) AddMessageHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	ticketID, _ := strconv.ParseUint(vars["id"], 10, 32)

	var req struct {
		Content    string `json:"content"`
		IsInternal bool   `json:"isInternal"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Content == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	message, err := h.ticketService.AddMessage(*tenantID, uint(ticketID), userID, req.Content, req.IsInternal)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(message)
}

// GetMessagesHandler retrieves messages for a ticket
// @Summary Get ticket messages
// @Tags Tickets
// @Produce json
// @Router /tickets/{id}/messages [get]
func (h *TicketHandler) GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	ticketID, _ := strconv.ParseUint(vars["id"], 10, 32)

	includeInternal := r.URL.Query().Get("includeInternal") == "true"

	messages, err := h.ticketService.GetMessages(*tenantID, uint(ticketID), includeInternal)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// ResolveTicketHandler resolves a ticket
// @Summary Resolve ticket
// @Tags Tickets
// @Accept json
// @Produce json
// @Router /tickets/{id}/resolve [post]
func (h *TicketHandler) ResolveTicketHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	ticketID, _ := strconv.ParseUint(vars["id"], 10, 32)

	var req struct {
		Resolution string `json:"resolution"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := h.ticketService.ResolveTicket(*tenantID, uint(ticketID), req.Resolution, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Ticket resolved"})
}

// GetTicketStatsHandler returns ticket statistics
// @Summary Get ticket statistics
// @Tags Tickets
// @Produce json
// @Router /tickets/stats [get]
func (h *TicketHandler) GetTicketStatsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	stats, err := h.ticketService.GetTicketStats(*tenantID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GetMyTicketsHandler returns tickets assigned to the current user
// @Summary Get my assigned tickets
// @Tags Tickets
// @Produce json
// @Router /tickets/my [get]
func (h *TicketHandler) GetMyTicketsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID

	includeClosed := r.URL.Query().Get("includeClosed") == "true"

	tickets, err := h.ticketService.GetMyTickets(*tenantID, userID, includeClosed)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

// GetTicketActivityHandler returns the activity log for a ticket
// @Summary Get ticket activity log
// @Tags Tickets
// @Produce json
// @Router /tickets/{id}/activity [get]
func (h *TicketHandler) GetTicketActivityHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	vars := mux.Vars(r)
	ticketID, _ := strconv.ParseUint(vars["id"], 10, 32)

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 50
	}

	activities, err := h.ticketService.GetTicketActivity(*tenantID, uint(ticketID), limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(activities)
}

// UpdateTicketPriorityHandler updates ticket priority
// @Summary Update ticket priority
// @Tags Tickets
// @Accept json
// @Produce json
// @Router /tickets/{id}/priority [put]
func (h *TicketHandler) UpdateTicketPriorityHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID
	vars := mux.Vars(r)
	ticketID, _ := strconv.ParseUint(vars["id"], 10, 32)

	var req struct {
		Priority string `json:"priority"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	err := h.ticketService.UpdateTicketPriority(*tenantID, uint(ticketID), models.TicketPriority(req.Priority), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Priority updated"})
}

// SearchTicketsHandler searches for tickets
// @Summary Search tickets
// @Tags Tickets
// @Produce json
// @Router /tickets/search [get]
func (h *TicketHandler) SearchTicketsHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	query := r.URL.Query().Get("q")
	if query == "" {
		http.Error(w, "Search query is required", http.StatusBadRequest)
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit == 0 {
		limit = 20
	}

	tickets, err := h.ticketService.SearchTickets(*tenantID, query, limit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

// CreateQuickTicketHandler creates a ticket from a transaction issue
// @Summary Create quick ticket from entity
// @Tags Tickets
// @Accept json
// @Produce json
// @Router /tickets/quick [post]
func (h *TicketHandler) CreateQuickTicketHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := middleware.GetTenantID(r)
	if tenantID == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	user, ok := middleware.GetUserFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID := user.ID

	var req struct {
		EntityType string `json:"entityType"` // transaction, remittance, pickup
		EntityID   uint   `json:"entityId"`
		Issue      string `json:"issue"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	ticket, err := h.ticketService.CreateQuickTicket(*tenantID, userID, req.EntityType, req.EntityID, req.Issue)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(ticket)
}
