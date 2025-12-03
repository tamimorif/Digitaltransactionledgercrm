package services

import (
	"api/pkg/models"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// SearchService handles global search operations
type SearchService struct {
	DB *gorm.DB
}

// NewSearchService creates a new search service
func NewSearchService(db *gorm.DB) *SearchService {
	return &SearchService{DB: db}
}

// GlobalSearchResult represents a unified search result
type GlobalSearchResult struct {
	Type        string                 `json:"type"` // "customer", "transaction", "remittance", "pickup", "branch", "user"
	ID          uint                   `json:"id"`
	Title       string                 `json:"title"`
	Subtitle    string                 `json:"subtitle"`
	Description string                 `json:"description"`
	Data        map[string]interface{} `json:"data"`
	CreatedAt   *time.Time             `json:"createdAt,omitempty"`
}

// GlobalSearch performs a search across all entities
func (s *SearchService) GlobalSearch(tenantID uint, query string, limit int) ([]GlobalSearchResult, error) {
	if limit == 0 {
		limit = 50
	}

	query = strings.TrimSpace(query)
	if query == "" {
		return []GlobalSearchResult{}, nil
	}

	searchPattern := "%" + query + "%"
	results := []GlobalSearchResult{}

	// Search Customers
	var customers []models.Customer
	s.DB.Joins("JOIN customer_tenant_links ON customer_tenant_links.customer_id = customers.id").
		Where("customer_tenant_links.tenant_id = ? AND (customers.full_name LIKE ? OR customers.phone LIKE ? OR customers.email LIKE ?)",
			tenantID, searchPattern, searchPattern, searchPattern).
		Limit(limit / 5).
		Find(&customers)

	for _, c := range customers {
		emailStr := ""
		if c.Email != nil {
			emailStr = *c.Email
		}
		results = append(results, GlobalSearchResult{
			Type:        "customer",
			ID:          c.ID,
			Title:       c.FullName,
			Subtitle:    c.Phone,
			Description: fmt.Sprintf("Email: %s", emailStr),
			Data: map[string]interface{}{
				"phone": c.Phone,
				"email": c.Email,
			},
			CreatedAt: &c.CreatedAt,
		})
	}

	// Search Transactions (using Client model)
	var clients []models.Client
	s.DB.Where("tenant_id = ? AND (name LIKE ? OR phone_number LIKE ?)",
		tenantID, searchPattern, searchPattern).
		Limit(limit / 5).
		Find(&clients)

	for _, c := range clients {
		results = append(results, GlobalSearchResult{
			Type:        "client",
			ID:          0, // Will parse string ID if needed
			Title:       c.Name,
			Subtitle:    c.PhoneNumber,
			Description: fmt.Sprintf("Client since %s", c.JoinDate.Format("2006-01-02")),
			Data: map[string]interface{}{
				"id":          c.ID,
				"name":        c.Name,
				"phoneNumber": c.PhoneNumber,
				"email":       c.Email,
			},
			CreatedAt: &c.CreatedAt,
		})
	}

	// Search Remittances (Outgoing)
	var outgoingRemittances []models.OutgoingRemittance
	s.DB.Where("tenant_id = ? AND (remittance_code LIKE ? OR recipient_name LIKE ? OR recipient_phone LIKE ?)",
		tenantID, searchPattern, searchPattern, searchPattern).
		Limit(limit / 5).
		Find(&outgoingRemittances)

	for _, r := range outgoingRemittances {
		results = append(results, GlobalSearchResult{
			Type:        "outgoing_remittance",
			ID:          r.ID,
			Title:       fmt.Sprintf("Remittance #%s", r.RemittanceCode),
			Subtitle:    fmt.Sprintf("To: %s", r.RecipientName),
			Description: fmt.Sprintf("%.2f IRR - %s", r.AmountIRR, r.Status),
			Data: map[string]interface{}{
				"amountIrr":      r.AmountIRR,
				"equivalentCad":  r.EquivalentCAD,
				"status":         r.Status,
				"recipientName":  r.RecipientName,
				"remittanceCode": r.RemittanceCode,
			},
			CreatedAt: &r.CreatedAt,
		})
	}

	// Search Remittances (Incoming)
	var incomingRemittances []models.IncomingRemittance
	s.DB.Where("tenant_id = ? AND (remittance_code LIKE ? OR sender_name LIKE ? OR recipient_name LIKE ?)",
		tenantID, searchPattern, searchPattern, searchPattern).
		Limit(limit / 5).
		Find(&incomingRemittances)

	for _, r := range incomingRemittances {
		results = append(results, GlobalSearchResult{
			Type:        "incoming_remittance",
			ID:          r.ID,
			Title:       fmt.Sprintf("Incoming #%s", r.RemittanceCode),
			Subtitle:    fmt.Sprintf("From: %s", r.SenderName),
			Description: fmt.Sprintf("%.2f IRR for %s - %s", r.AmountIRR, r.RecipientName, r.Status),
			Data: map[string]interface{}{
				"amountIrr":      r.AmountIRR,
				"equivalentCad":  r.EquivalentCAD,
				"status":         r.Status,
				"senderName":     r.SenderName,
				"recipientName":  r.RecipientName,
				"remittanceCode": r.RemittanceCode,
			},
			CreatedAt: &r.CreatedAt,
		})
	}

	// Search Pickup Transactions
	var pickups []models.PickupTransaction
	s.DB.Preload("Customer").
		Where("tenant_id = ? AND (pickup_code LIKE ? OR recipient_name LIKE ? OR recipient_phone LIKE ?)",
			tenantID, searchPattern, searchPattern, searchPattern).
		Limit(limit / 5).
		Find(&pickups)

	for _, p := range pickups {
		results = append(results, GlobalSearchResult{
			Type:        "pickup",
			ID:          p.ID,
			Title:       fmt.Sprintf("Pickup #%s", p.PickupCode),
			Subtitle:    p.RecipientName,
			Description: fmt.Sprintf("%.2f %s - %s", p.Amount, p.Currency, p.Status),
			Data: map[string]interface{}{
				"amount":        p.Amount,
				"currency":      p.Currency,
				"status":        p.Status,
				"pickupCode":    p.PickupCode,
				"recipientName": p.RecipientName,
			},
			CreatedAt: &p.CreatedAt,
		})
	}

	return results, nil
}

// SearchFilter represents advanced filter criteria
type SearchFilter struct {
	Entity       string                 `json:"entity"` // Required: "customer", "transaction", etc.
	Query        string                 `json:"query"`  // Text search
	DateFrom     *time.Time             `json:"dateFrom"`
	DateTo       *time.Time             `json:"dateTo"`
	AmountMin    *float64               `json:"amountMin"`
	AmountMax    *float64               `json:"amountMax"`
	Status       []string               `json:"status"`
	Currency     []string               `json:"currency"`
	BranchID     *uint                  `json:"branchId"`
	CustomFields map[string]interface{} `json:"customFields"` // Additional entity-specific filters
}

// AdvancedSearch performs a filtered search on a specific entity
func (s *SearchService) AdvancedSearch(tenantID uint, filter SearchFilter, page, limit int) ([]interface{}, int64, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = 20
	}
	offset := (page - 1) * limit

	switch filter.Entity {
	case "transaction":
		return s.searchTransactions(tenantID, filter, offset, limit)
	case "remittance":
		return s.searchRemittances(tenantID, filter, offset, limit)
	case "pickup":
		return s.searchPickups(tenantID, filter, offset, limit)
	case "customer":
		return s.searchCustomers(tenantID, filter, offset, limit)
	default:
		return nil, 0, errors.New("unsupported entity type")
	}
}

func (s *SearchService) searchTransactions(tenantID uint, filter SearchFilter, offset, limit int) ([]interface{}, int64, error) {
	query := s.DB.Model(&models.Transaction{}).Where("tenant_id = ?", tenantID)

	// Text search
	if filter.Query != "" {
		pattern := "%" + filter.Query + "%"
		query = query.Where("user_notes LIKE ?", pattern)
	}

	// Date range
	if filter.DateFrom != nil {
		query = query.Where("created_at >= ?", filter.DateFrom)
	}
	if filter.DateTo != nil {
		query = query.Where("created_at <= ?", filter.DateTo)
	}

	// Amount range (using send_amount field)
	if filter.AmountMin != nil {
		query = query.Where("send_amount >= ?", *filter.AmountMin)
	}
	if filter.AmountMax != nil {
		query = query.Where("send_amount <= ?", *filter.AmountMax)
	}

	// Status filter
	if len(filter.Status) > 0 {
		query = query.Where("status IN ?", filter.Status)
	}

	// Currency filter (using send_currency)
	if len(filter.Currency) > 0 {
		query = query.Where("send_currency IN ?", filter.Currency)
	}

	// Branch filter
	if filter.BranchID != nil {
		query = query.Where("branch_id = ?", *filter.BranchID)
	}

	// Get total count
	var total int64
	query.Count(&total)

	// Get results
	var transactions []models.Transaction
	err := query.Preload("Client").Preload("Branch").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&transactions).Error

	if err != nil {
		return nil, 0, err
	}

	results := make([]interface{}, len(transactions))
	for i, t := range transactions {
		results[i] = t
	}

	return results, total, nil
}

func (s *SearchService) searchRemittances(tenantID uint, filter SearchFilter, offset, limit int) ([]interface{}, int64, error) {
	// Search both outgoing and incoming remittances
	var results []interface{}
	var total int64 = 0

	// Outgoing remittances
	queryOut := s.DB.Model(&models.OutgoingRemittance{}).Where("tenant_id = ?", tenantID)
	if filter.Query != "" {
		pattern := "%" + filter.Query + "%"
		queryOut = queryOut.Where("remittance_code LIKE ? OR recipient_name LIKE ?", pattern, pattern)
	}
	if filter.DateFrom != nil {
		queryOut = queryOut.Where("created_at >= ?", filter.DateFrom)
	}
	if filter.DateTo != nil {
		queryOut = queryOut.Where("created_at <= ?", filter.DateTo)
	}
	if filter.AmountMin != nil {
		queryOut = queryOut.Where("amount_irr >= ?", *filter.AmountMin)
	}
	if filter.AmountMax != nil {
		queryOut = queryOut.Where("amount_irr <= ?", *filter.AmountMax)
	}
	if len(filter.Status) > 0 {
		queryOut = queryOut.Where("status IN ?", filter.Status)
	}

	var outCount int64
	queryOut.Count(&outCount)
	total += outCount

	var outgoing []models.OutgoingRemittance
	queryOut.Order("created_at DESC").Offset(offset).Limit(limit).Find(&outgoing)

	for _, r := range outgoing {
		results = append(results, r)
	}

	return results, total, nil
}

func (s *SearchService) searchPickups(tenantID uint, filter SearchFilter, offset, limit int) ([]interface{}, int64, error) {
	query := s.DB.Model(&models.PickupTransaction{}).Where("tenant_id = ?", tenantID)

	if filter.Query != "" {
		pattern := "%" + filter.Query + "%"
		query = query.Where("pickup_code LIKE ? OR recipient_name LIKE ?", pattern, pattern)
	}
	if filter.DateFrom != nil {
		query = query.Where("created_at >= ?", filter.DateFrom)
	}
	if filter.DateTo != nil {
		query = query.Where("created_at <= ?", filter.DateTo)
	}
	if filter.AmountMin != nil {
		query = query.Where("amount >= ?", *filter.AmountMin)
	}
	if filter.AmountMax != nil {
		query = query.Where("amount <= ?", *filter.AmountMax)
	}
	if len(filter.Status) > 0 {
		query = query.Where("status IN ?", filter.Status)
	}

	var total int64
	query.Count(&total)

	var pickups []models.PickupTransaction
	err := query.Preload("Customer").Preload("Branch").
		Order("created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&pickups).Error

	if err != nil {
		return nil, 0, err
	}

	results := make([]interface{}, len(pickups))
	for i, p := range pickups {
		results[i] = p
	}

	return results, total, nil
}

func (s *SearchService) searchCustomers(tenantID uint, filter SearchFilter, offset, limit int) ([]interface{}, int64, error) {
	query := s.DB.Model(&models.Customer{}).
		Joins("JOIN customer_tenant_links ON customer_tenant_links.customer_id = customers.id").
		Where("customer_tenant_links.tenant_id = ?", tenantID)

	if filter.Query != "" {
		pattern := "%" + filter.Query + "%"
		query = query.Where("customers.full_name LIKE ? OR customers.phone LIKE ? OR customers.email LIKE ?",
			pattern, pattern, pattern)
	}

	var total int64
	query.Count(&total)

	var customers []models.Customer
	err := query.Order("customers.created_at DESC").
		Offset(offset).
		Limit(limit).
		Find(&customers).Error

	if err != nil {
		return nil, 0, err
	}

	results := make([]interface{}, len(customers))
	for i, c := range customers {
		results[i] = c
	}

	return results, total, nil
}

// SaveSearch saves a search filter for later use
func (s *SearchService) SaveSearch(userID, tenantID uint, name, description string, filter SearchFilter) (*models.SavedSearch, error) {
	filterJSON, err := json.Marshal(filter)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal filter: %w", err)
	}

	savedSearch := &models.SavedSearch{
		UserID:      userID,
		TenantID:    tenantID,
		Name:        name,
		Description: description,
		Entity:      filter.Entity,
		Filters:     string(filterJSON),
		IsPublic:    false,
	}

	if err := s.DB.Create(savedSearch).Error; err != nil {
		return nil, fmt.Errorf("failed to save search: %w", err)
	}

	return savedSearch, nil
}

// GetSavedSearches retrieves all saved searches for a user
func (s *SearchService) GetSavedSearches(userID, tenantID uint) ([]models.SavedSearch, error) {
	var searches []models.SavedSearch
	err := s.DB.Where("user_id = ? OR (tenant_id = ? AND is_public = ?)", userID, tenantID, true).
		Order("created_at DESC").
		Find(&searches).Error

	return searches, err
}

// DeleteSavedSearch deletes a saved search
func (s *SearchService) DeleteSavedSearch(id, userID uint) error {
	result := s.DB.Where("id = ? AND user_id = ?", id, userID).Delete(&models.SavedSearch{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("saved search not found or access denied")
	}
	return nil
}
