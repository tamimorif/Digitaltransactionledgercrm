package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// TicketService handles ticket operations
type TicketService struct {
	DB *gorm.DB
}

// NewTicketService creates a new ticket service
func NewTicketService(db *gorm.DB) *TicketService {
	return &TicketService{DB: db}
}

// CreateTicketRequest represents the request to create a ticket
type CreateTicketRequest struct {
	Subject           string                `json:"subject"`
	Description       string                `json:"description"`
	Priority          models.TicketPriority `json:"priority"`
	Category          models.TicketCategory `json:"category"`
	CustomerID        *uint                 `json:"customerId"`
	AssignedToUserID  *uint                 `json:"assignedToUserId"`
	BranchID          *uint                 `json:"branchId"`
	RelatedEntityType string                `json:"relatedEntityType"`
	RelatedEntityID   uint                  `json:"relatedEntityId"`
	Tags              string                `json:"tags"`
}

// CreateTicket creates a new support ticket
func (s *TicketService) CreateTicket(tenantID, createdByUserID uint, req CreateTicketRequest) (*models.Ticket, error) {
	// Generate ticket code
	ticketCode, err := s.generateTicketCode(tenantID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate ticket code: %w", err)
	}

	// Set defaults
	if req.Priority == "" {
		req.Priority = models.TicketPriorityMedium
	}
	if req.Category == "" {
		req.Category = models.TicketCategoryGeneral
	}

	ticket := &models.Ticket{
		TenantID:          tenantID,
		TicketCode:        ticketCode,
		Subject:           req.Subject,
		Description:       req.Description,
		Status:            models.TicketStatusOpen,
		Priority:          req.Priority,
		Category:          req.Category,
		CreatedByUserID:   &createdByUserID,
		CustomerID:        req.CustomerID,
		AssignedToUserID:  req.AssignedToUserID,
		BranchID:          req.BranchID,
		RelatedEntityType: req.RelatedEntityType,
		RelatedEntityID:   req.RelatedEntityID,
		Tags:              req.Tags,
	}

	// Set SLA due date based on priority
	ticket.DueAt = s.calculateDueDate(req.Priority)

	if err := s.DB.Create(ticket).Error; err != nil {
		return nil, fmt.Errorf("failed to create ticket: %w", err)
	}

	// Log activity
	s.logActivity(ticket.ID, tenantID, "created", "", "", "", "Ticket created", &createdByUserID, false)

	// Auto-assign based on category or branch if not specified
	if ticket.AssignedToUserID == nil {
		s.autoAssignTicket(ticket)
	}

	return ticket, nil
}

// GetTicket retrieves a ticket by ID
func (s *TicketService) GetTicket(tenantID, ticketID uint) (*models.Ticket, error) {
	var ticket models.Ticket
	err := s.DB.Where("id = ? AND tenant_id = ?", ticketID, tenantID).
		Preload("CreatedByUser").
		Preload("AssignedToUser").
		Preload("Customer").
		Preload("Branch").
		First(&ticket).Error

	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

// GetTicketByCode retrieves a ticket by its code
func (s *TicketService) GetTicketByCode(tenantID uint, code string) (*models.Ticket, error) {
	var ticket models.Ticket
	err := s.DB.Where("ticket_code = ? AND tenant_id = ?", code, tenantID).
		Preload("CreatedByUser").
		Preload("AssignedToUser").
		Preload("Customer").
		First(&ticket).Error

	if err != nil {
		return nil, err
	}
	return &ticket, nil
}

// TicketFilter represents filter criteria for listing tickets
type TicketFilter struct {
	Status           []models.TicketStatus
	Priority         []models.TicketPriority
	Category         []models.TicketCategory
	AssignedToUserID *uint
	CreatedByUserID  *uint
	CustomerID       *uint
	BranchID         *uint
	Search           string
	DateFrom         *time.Time
	DateTo           *time.Time
	IncludeClosed    bool
}

// ListTickets retrieves tickets with filtering and pagination
func (s *TicketService) ListTickets(tenantID uint, filter TicketFilter, page, limit int) ([]models.Ticket, int64, error) {
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}
	offset := (page - 1) * limit

	query := s.DB.Model(&models.Ticket{}).Where("tenant_id = ?", tenantID)

	// Apply filters
	if len(filter.Status) > 0 {
		query = query.Where("status IN ?", filter.Status)
	} else if !filter.IncludeClosed {
		query = query.Where("status NOT IN ?", []models.TicketStatus{models.TicketStatusClosed})
	}

	if len(filter.Priority) > 0 {
		query = query.Where("priority IN ?", filter.Priority)
	}

	if len(filter.Category) > 0 {
		query = query.Where("category IN ?", filter.Category)
	}

	if filter.AssignedToUserID != nil {
		query = query.Where("assigned_to_user_id = ?", *filter.AssignedToUserID)
	}

	if filter.CreatedByUserID != nil {
		query = query.Where("created_by_user_id = ?", *filter.CreatedByUserID)
	}

	if filter.CustomerID != nil {
		query = query.Where("customer_id = ?", *filter.CustomerID)
	}

	if filter.BranchID != nil {
		query = query.Where("branch_id = ?", *filter.BranchID)
	}

	if filter.Search != "" {
		pattern := "%" + filter.Search + "%"
		query = query.Where("(subject LIKE ? OR description LIKE ? OR ticket_code LIKE ?)", pattern, pattern, pattern)
	}

	if filter.DateFrom != nil {
		query = query.Where("created_at >= ?", filter.DateFrom)
	}

	if filter.DateTo != nil {
		query = query.Where("created_at <= ?", filter.DateTo)
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Get results
	var tickets []models.Ticket
	err := query.
		Preload("CreatedByUser").
		Preload("AssignedToUser").
		Preload("Customer").
		Order("CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&tickets).Error

	return tickets, total, err
}

// UpdateTicketStatus updates the ticket status
func (s *TicketService) UpdateTicketStatus(tenantID, ticketID uint, newStatus models.TicketStatus, userID uint) error {
	var ticket models.Ticket
	if err := s.DB.Where("id = ? AND tenant_id = ?", ticketID, tenantID).First(&ticket).Error; err != nil {
		return err
	}

	oldStatus := ticket.Status
	ticket.Status = newStatus
	ticket.UpdatedAt = time.Now()

	// Handle resolution/closure timestamps
	if newStatus == models.TicketStatusResolved && oldStatus != models.TicketStatusResolved {
		now := time.Now()
		ticket.ResolvedAt = &now
		ticket.ResolvedByUserID = &userID
	}
	if newStatus == models.TicketStatusClosed && oldStatus != models.TicketStatusClosed {
		now := time.Now()
		ticket.ClosedAt = &now
	}

	if err := s.DB.Save(&ticket).Error; err != nil {
		return err
	}

	// Log activity
	s.logActivity(ticketID, tenantID, "status_changed", "status", string(oldStatus), string(newStatus),
		fmt.Sprintf("Status changed from %s to %s", oldStatus, newStatus), &userID, false)

	return nil
}

// AssignTicket assigns a ticket to a user
func (s *TicketService) AssignTicket(tenantID, ticketID, assignToUserID uint, assignedByUserID uint) error {
	var ticket models.Ticket
	if err := s.DB.Where("id = ? AND tenant_id = ?", ticketID, tenantID).First(&ticket).Error; err != nil {
		return err
	}

	var oldAssignee string
	if ticket.AssignedToUserID != nil {
		oldAssignee = fmt.Sprintf("%d", *ticket.AssignedToUserID)
	}

	ticket.AssignedToUserID = &assignToUserID
	ticket.UpdatedAt = time.Now()

	// If first assignment, move to In Progress
	if ticket.Status == models.TicketStatusOpen {
		ticket.Status = models.TicketStatusInProgress
	}

	if err := s.DB.Save(&ticket).Error; err != nil {
		return err
	}

	// Log activity
	s.logActivity(ticketID, tenantID, "assigned", "assigned_to_user_id", oldAssignee, fmt.Sprintf("%d", assignToUserID),
		"Ticket assigned", &assignedByUserID, false)

	return nil
}

// AddMessage adds a message to a ticket
func (s *TicketService) AddMessage(tenantID, ticketID uint, authorUserID uint, content string, isInternal bool) (*models.TicketMessage, error) {
	var ticket models.Ticket
	if err := s.DB.Where("id = ? AND tenant_id = ?", ticketID, tenantID).First(&ticket).Error; err != nil {
		return nil, err
	}

	// Get author name
	var user models.User
	authorName := "Unknown"
	if err := s.DB.First(&user, authorUserID).Error; err == nil {
		authorName = user.Email
	}

	message := &models.TicketMessage{
		TicketID:     ticketID,
		TenantID:     tenantID,
		AuthorUserID: &authorUserID,
		AuthorName:   authorName,
		Content:      content,
		ContentType:  "text",
		IsInternal:   isInternal,
	}

	if err := s.DB.Create(message).Error; err != nil {
		return nil, err
	}

	// Update first response time if this is the first staff response
	if ticket.FirstResponseAt == nil && !isInternal {
		now := time.Now()
		s.DB.Model(&ticket).Update("first_response_at", now)
	}

	// Update ticket timestamp
	s.DB.Model(&ticket).Update("updated_at", time.Now())

	// Log activity
	action := "comment_added"
	if isInternal {
		action = "internal_note_added"
	}
	s.logActivity(ticketID, tenantID, action, "", "", "", "Message added", &authorUserID, false)

	return message, nil
}

// GetMessages retrieves messages for a ticket
func (s *TicketService) GetMessages(tenantID, ticketID uint, includeInternal bool) ([]models.TicketMessage, error) {
	query := s.DB.Where("ticket_id = ? AND tenant_id = ?", ticketID, tenantID)

	if !includeInternal {
		query = query.Where("is_internal = ?", false)
	}

	var messages []models.TicketMessage
	err := query.
		Preload("AuthorUser").
		Order("created_at ASC").
		Find(&messages).Error

	return messages, err
}

// ResolveTicket resolves a ticket with resolution notes
func (s *TicketService) ResolveTicket(tenantID, ticketID uint, resolution string, userID uint) error {
	var ticket models.Ticket
	if err := s.DB.Where("id = ? AND tenant_id = ?", ticketID, tenantID).First(&ticket).Error; err != nil {
		return err
	}

	now := time.Now()
	ticket.Status = models.TicketStatusResolved
	ticket.Resolution = resolution
	ticket.ResolvedAt = &now
	ticket.ResolvedByUserID = &userID
	ticket.UpdatedAt = now

	if err := s.DB.Save(&ticket).Error; err != nil {
		return err
	}

	// Add system message
	s.addSystemMessage(ticketID, tenantID, "resolved", "Ticket resolved")

	// Log activity
	s.logActivity(ticketID, tenantID, "resolved", "", "", "", "Ticket resolved: "+resolution, &userID, false)

	return nil
}

// GetTicketStats returns ticket statistics for a tenant
func (s *TicketService) GetTicketStats(tenantID uint) (*TicketStats, error) {
	stats := &TicketStats{}

	// Count by status
	var openCount, inProgressCount, waitingCount, resolvedCount, closedCount int64
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND status = ?", tenantID, models.TicketStatusOpen).Count(&openCount)
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND status = ?", tenantID, models.TicketStatusInProgress).Count(&inProgressCount)
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND status = ?", tenantID, models.TicketStatusWaiting).Count(&waitingCount)
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND status = ?", tenantID, models.TicketStatusResolved).Count(&resolvedCount)
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND status = ?", tenantID, models.TicketStatusClosed).Count(&closedCount)

	stats.OpenCount = int(openCount)
	stats.InProgressCount = int(inProgressCount)
	stats.WaitingCount = int(waitingCount)
	stats.ResolvedCount = int(resolvedCount)
	stats.ClosedCount = int(closedCount)

	// Count by priority (non-closed)
	var criticalCount, highCount int64
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND priority = ? AND status NOT IN ?",
		tenantID, models.TicketPriorityCritical, []models.TicketStatus{models.TicketStatusClosed, models.TicketStatusResolved}).Count(&criticalCount)
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND priority = ? AND status NOT IN ?",
		tenantID, models.TicketPriorityHigh, []models.TicketStatus{models.TicketStatusClosed, models.TicketStatusResolved}).Count(&highCount)

	stats.CriticalCount = int(criticalCount)
	stats.HighPriorityCount = int(highCount)

	// SLA breaches
	var breachedCount int64
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND breached_sla = ? AND status NOT IN ?",
		tenantID, true, []models.TicketStatus{models.TicketStatusClosed, models.TicketStatusResolved}).Count(&breachedCount)
	stats.SLABreachCount = int(breachedCount)

	// Unassigned
	var unassignedCount int64
	s.DB.Model(&models.Ticket{}).Where("tenant_id = ? AND assigned_to_user_id IS NULL AND status NOT IN ?",
		tenantID, []models.TicketStatus{models.TicketStatusClosed, models.TicketStatusResolved}).Count(&unassignedCount)
	stats.UnassignedCount = int(unassignedCount)

	return stats, nil
}

// TicketStats represents ticket statistics
type TicketStats struct {
	OpenCount         int `json:"openCount"`
	InProgressCount   int `json:"inProgressCount"`
	WaitingCount      int `json:"waitingCount"`
	ResolvedCount     int `json:"resolvedCount"`
	ClosedCount       int `json:"closedCount"`
	CriticalCount     int `json:"criticalCount"`
	HighPriorityCount int `json:"highPriorityCount"`
	SLABreachCount    int `json:"slaBreachCount"`
	UnassignedCount   int `json:"unassignedCount"`
}

// GetMyTickets returns tickets assigned to a specific user
func (s *TicketService) GetMyTickets(tenantID, userID uint, includeClosed bool) ([]models.Ticket, error) {
	query := s.DB.Where("tenant_id = ? AND assigned_to_user_id = ?", tenantID, userID)

	if !includeClosed {
		query = query.Where("status NOT IN ?", []models.TicketStatus{models.TicketStatusClosed})
	}

	var tickets []models.Ticket
	err := query.
		Preload("Customer").
		Order("CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END, created_at DESC").
		Find(&tickets).Error

	return tickets, err
}

// GetTicketActivity returns the activity log for a ticket
func (s *TicketService) GetTicketActivity(tenantID, ticketID uint, limit int) ([]models.TicketActivity, error) {
	if limit <= 0 {
		limit = 50
	}

	var activities []models.TicketActivity
	err := s.DB.Where("ticket_id = ? AND tenant_id = ?", ticketID, tenantID).
		Preload("PerformedByUser").
		Order("created_at DESC").
		Limit(limit).
		Find(&activities).Error

	return activities, err
}

// UpdateTicketPriority updates the ticket priority
func (s *TicketService) UpdateTicketPriority(tenantID, ticketID uint, priority models.TicketPriority, userID uint) error {
	var ticket models.Ticket
	if err := s.DB.Where("id = ? AND tenant_id = ?", ticketID, tenantID).First(&ticket).Error; err != nil {
		return err
	}

	oldPriority := ticket.Priority
	ticket.Priority = priority
	ticket.DueAt = s.calculateDueDate(priority)
	ticket.UpdatedAt = time.Now()

	if err := s.DB.Save(&ticket).Error; err != nil {
		return err
	}

	s.logActivity(ticketID, tenantID, "priority_changed", "priority", string(oldPriority), string(priority),
		fmt.Sprintf("Priority changed from %s to %s", oldPriority, priority), &userID, false)

	return nil
}

// SearchTickets searches for tickets by text
func (s *TicketService) SearchTickets(tenantID uint, query string, limit int) ([]models.Ticket, error) {
	if limit <= 0 {
		limit = 20
	}

	pattern := "%" + query + "%"
	var tickets []models.Ticket
	err := s.DB.Where("tenant_id = ? AND (subject LIKE ? OR description LIKE ? OR ticket_code LIKE ?)",
		tenantID, pattern, pattern, pattern).
		Preload("AssignedToUser").
		Preload("Customer").
		Order("created_at DESC").
		Limit(limit).
		Find(&tickets).Error

	return tickets, err
}

// Helper functions

func (s *TicketService) generateTicketCode(tenantID uint) (string, error) {
	today := time.Now().Format("20060102")

	// Get count of tickets created today
	var count int64
	s.DB.Model(&models.Ticket{}).
		Where("tenant_id = ? AND DATE(created_at) = DATE(?)", tenantID, time.Now()).
		Count(&count)

	return fmt.Sprintf("TKT-%s-%04d", today, count+1), nil
}

func (s *TicketService) calculateDueDate(priority models.TicketPriority) *time.Time {
	now := time.Now()
	var due time.Time

	switch priority {
	case models.TicketPriorityCritical:
		due = now.Add(4 * time.Hour)
	case models.TicketPriorityHigh:
		due = now.Add(8 * time.Hour)
	case models.TicketPriorityMedium:
		due = now.Add(24 * time.Hour)
	case models.TicketPriorityLow:
		due = now.Add(72 * time.Hour)
	default:
		due = now.Add(24 * time.Hour)
	}

	return &due
}

func (s *TicketService) autoAssignTicket(ticket *models.Ticket) {
	// Simple round-robin or category-based assignment could be implemented here
	// For now, we leave it unassigned for manual assignment
}

func (s *TicketService) logActivity(ticketID, tenantID uint, action, field, oldValue, newValue, description string, userID *uint, isSystem bool) {
	activity := &models.TicketActivity{
		TicketID:          ticketID,
		TenantID:          tenantID,
		Action:            action,
		Field:             field,
		OldValue:          oldValue,
		NewValue:          newValue,
		Description:       description,
		PerformedByUserID: userID,
		IsSystemAction:    isSystem,
	}
	s.DB.Create(activity)
}

func (s *TicketService) addSystemMessage(ticketID, tenantID uint, action, content string) {
	message := &models.TicketMessage{
		TicketID:        ticketID,
		TenantID:        tenantID,
		Content:         content,
		IsSystemMessage: true,
		SystemAction:    action,
	}
	s.DB.Create(message)
}

// CreateQuickTicket creates a ticket from a transaction/remittance issue
func (s *TicketService) CreateQuickTicket(tenantID, userID uint, entityType string, entityID uint, issue string) (*models.Ticket, error) {
	var subject string
	var category models.TicketCategory

	switch entityType {
	case "transaction":
		subject = fmt.Sprintf("Issue with Transaction #%d", entityID)
		category = models.TicketCategoryTransaction
	case "remittance":
		subject = fmt.Sprintf("Issue with Remittance #%d", entityID)
		category = models.TicketCategoryRemittance
	case "pickup":
		subject = fmt.Sprintf("Issue with Pickup #%d", entityID)
		category = models.TicketCategoryTransaction
	default:
		return nil, errors.New("invalid entity type")
	}

	return s.CreateTicket(tenantID, userID, CreateTicketRequest{
		Subject:           subject,
		Description:       issue,
		Priority:          models.TicketPriorityMedium,
		Category:          category,
		RelatedEntityType: entityType,
		RelatedEntityID:   entityID,
	})
}
