package services

import (
	"api/pkg/models"
	"errors"
	"time"

	"gorm.io/gorm"
)

type CustomerService struct {
	DB *gorm.DB
}

func NewCustomerService(db *gorm.DB) *CustomerService {
	return &CustomerService{DB: db}
}

// FindOrCreateCustomer finds a customer by phone or creates a new one
func (s *CustomerService) FindOrCreateCustomer(phone, fullName string, email *string) (*models.Customer, error) {
	if phone == "" {
		return nil, errors.New("phone is required")
	}
	if fullName == "" {
		return nil, errors.New("full_name is required")
	}

	var customer models.Customer

	// Try to find existing customer by phone
	err := s.DB.Where("phone = ?", phone).First(&customer).Error
	if err == nil {
		// Customer exists, update name and email if provided
		updates := map[string]interface{}{
			"full_name":  fullName,
			"updated_at": time.Now(),
		}
		if email != nil && *email != "" {
			updates["email"] = email
		}
		s.DB.Model(&customer).Updates(updates)
		return &customer, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	// Customer doesn't exist, create new one
	customer = models.Customer{
		Phone:    phone,
		FullName: fullName,
		Email:    email,
	}

	if err := s.DB.Create(&customer).Error; err != nil {
		return nil, err
	}

	return &customer, nil
}

// LinkCustomerToTenant creates or updates a link between a customer and tenant
func (s *CustomerService) LinkCustomerToTenant(customerID, tenantID uint) error {
	if customerID == 0 || tenantID == 0 {
		return errors.New("customer_id and tenant_id are required")
	}

	var link models.CustomerTenantLink
	now := time.Now()

	// Check if link already exists
	err := s.DB.Where("customer_id = ? AND tenant_id = ?", customerID, tenantID).First(&link).Error
	if err == nil {
		// Link exists, update transaction count and last transaction time
		updates := map[string]interface{}{
			"total_transactions":  gorm.Expr("total_transactions + 1"),
			"last_transaction_at": now,
			"updated_at":          now,
		}
		return s.DB.Model(&link).Updates(updates).Error
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	// Link doesn't exist, create new one
	link = models.CustomerTenantLink{
		CustomerID:         customerID,
		TenantID:           tenantID,
		FirstTransactionAt: now,
		LastTransactionAt:  now,
		TotalTransactions:  1,
	}

	return s.DB.Create(&link).Error
}

// SearchCustomers searches for customers by phone or name
func (s *CustomerService) SearchCustomers(query string) ([]models.Customer, error) {
	var customers []models.Customer

	err := s.DB.Where("phone LIKE ? OR LOWER(full_name) LIKE LOWER(?)",
		"%"+query+"%", "%"+query+"%").
		Limit(10).
		Find(&customers).Error

	return customers, err
}

// GetCustomerByPhone retrieves a customer by phone number
func (s *CustomerService) GetCustomerByPhone(phone string) (*models.Customer, error) {
	var customer models.Customer
	err := s.DB.Where("phone = ?", phone).First(&customer).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("customer not found")
		}
		return nil, err
	}
	return &customer, nil
}

// GetCustomerWithTenants retrieves a customer with all their tenant links (for SuperAdmin)
func (s *CustomerService) GetCustomerWithTenants(customerID uint) (*models.Customer, error) {
	var customer models.Customer
	err := s.DB.Preload("TenantLinks.Tenant").First(&customer, customerID).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("customer not found")
		}
		return nil, err
	}
	return &customer, nil
}

// CustomerBranchInfo holds branch information for a customer in a tenant
type CustomerBranchInfo struct {
	BranchID   uint   `json:"branchId"`
	BranchName string `json:"branchName"`
}

// CustomerTenantInfo holds tenant and branch information for a customer
type CustomerTenantInfo struct {
	CustomerID         uint                 `json:"customerId"`
	TenantID           uint                 `json:"tenantId"`
	CompanyName        string               `json:"companyName"`
	FirstTransactionAt time.Time            `json:"firstTransactionAt"`
	LastTransactionAt  time.Time            `json:"lastTransactionAt"`
	TotalTransactions  int                  `json:"totalTransactions"`
	Branches           []CustomerBranchInfo `json:"branches"`
}

// CustomerSearchResult includes customer info and their tenant/branch associations
type CustomerSearchResult struct {
	models.Customer
	TenantInfos []CustomerTenantInfo `json:"tenantInfos"`
}

// SearchCustomersGlobal searches customers across all tenants (SuperAdmin only)
func (s *CustomerService) SearchCustomersGlobal(query string) ([]CustomerSearchResult, error) {
	// Use clients table directly
	var clients []models.Client

	// Search by phone or name
	err := s.DB.Preload("Tenant").
		Where("phone_number LIKE ? OR LOWER(name) LIKE LOWER(?)",
			"%"+query+"%", "%"+query+"%").
		Limit(20).
		Find(&clients).Error

	if err != nil {
		return nil, err
	}

	// Build result with branch information
	results := make([]CustomerSearchResult, 0, len(clients))
	for _, client := range clients {
		// Get transactions count and dates for this client
		type ClientStats struct {
			FirstTransaction time.Time
			LastTransaction  time.Time
			TotalCount       int
		}
		var stats ClientStats

		s.DB.Table("transactions").
			Select("MIN(transaction_date) as first_transaction, MAX(transaction_date) as last_transaction, COUNT(*) as total_count").
			Where("client_id = ? AND tenant_id = ?", client.ID, client.TenantID).
			Scan(&stats)

		// Get distinct branches
		type BranchResult struct {
			BranchID   uint
			BranchName string
		}
		var branches []BranchResult

		s.DB.Table("transactions").
			Select("DISTINCT branches.id as branch_id, branches.name as branch_name").
			Joins("LEFT JOIN branches ON transactions.branch_id = branches.id").
			Where("transactions.client_id = ? AND transactions.tenant_id = ? AND transactions.branch_id IS NOT NULL",
				client.ID, client.TenantID).
			Scan(&branches)

		// Convert branches to CustomerBranchInfo
		branchInfos := make([]CustomerBranchInfo, 0, len(branches))
		for _, branch := range branches {
			branchInfos = append(branchInfos, CustomerBranchInfo{
				BranchID:   branch.BranchID,
				BranchName: branch.BranchName,
			})
		}

		// Create tenant info
		tenantInfo := CustomerTenantInfo{
			CustomerID:         0, // We'll use client.ID directly in the result
			TenantID:           client.TenantID,
			CompanyName:        client.Tenant.Name,
			FirstTransactionAt: stats.FirstTransaction,
			LastTransactionAt:  stats.LastTransaction,
			TotalTransactions:  stats.TotalCount,
			Branches:           branchInfos,
		}

		// Create result - map Client to Customer structure for response
		result := CustomerSearchResult{
			Customer: models.Customer{
				ID:        uint(0), // Not using customer table ID
				Phone:     client.PhoneNumber,
				FullName:  client.Name,
				Email:     client.Email,
				CreatedAt: client.CreatedAt,
				UpdatedAt: client.UpdatedAt,
			},
			TenantInfos: []CustomerTenantInfo{tenantInfo},
		}

		results = append(results, result)
	}

	return results, nil
}

// GetCustomersForTenant retrieves all customers that have transacted with a specific tenant
func (s *CustomerService) GetCustomersForTenant(tenantID uint) ([]models.Customer, error) {
	var customers []models.Customer

	err := s.DB.Joins("JOIN customer_tenant_links ON customer_tenant_links.customer_id = customers.id").
		Where("customer_tenant_links.tenant_id = ?", tenantID).
		Order("customer_tenant_links.last_transaction_at DESC").
		Find(&customers).Error

	return customers, err
}

// UpdateCustomer updates customer information
func (s *CustomerService) UpdateCustomer(customerID uint, fullName string, email *string) error {
	updates := map[string]interface{}{
		"full_name":  fullName,
		"updated_at": time.Now(),
	}

	if email != nil {
		updates["email"] = email
	}

	return s.DB.Model(&models.Customer{}).Where("id = ?", customerID).Updates(updates).Error
}
