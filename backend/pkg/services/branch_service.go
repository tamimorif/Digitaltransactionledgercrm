package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"log"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// BranchService handles branch operations
type BranchService struct {
	DB *gorm.DB
}

// NewBranchService creates a new branch service instance
func NewBranchService(db *gorm.DB) *BranchService {
	return &BranchService{
		DB: db,
	}
}

// CreateBranchRequest represents a request to create a branch
type CreateBranchRequest struct {
	Name     string `json:"name" binding:"required"`
	Location string `json:"location"`
	Username string `json:"username"` // Optional: for branch login
	Password string `json:"password"` // Optional: for branch login
}

// UpdateBranchRequest represents a request to update a branch
type UpdateBranchRequest struct {
	Name     string `json:"name"`
	Location string `json:"location"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// CreateBranch creates a new branch for a tenant
func (bs *BranchService) CreateBranch(tenantID uint, req CreateBranchRequest, createdByUserID uint) (*models.Branch, error) {
	// Check tenant exists
	var tenant models.Tenant
	if err := bs.DB.First(&tenant, tenantID).Error; err != nil {
		return nil, fmt.Errorf("tenant not found: %w", err)
	}

	// Count existing branches
	var branchCount int64
	if err := bs.DB.Model(&models.Branch{}).Where("tenant_id = ? AND status = ?", tenantID, models.BranchStatusActive).Count(&branchCount).Error; err != nil {
		return nil, fmt.Errorf("failed to count branches: %w", err)
	}

	// Determine max branches allowed
	maxBranches := 1 // Default for trial tenants

	// If tenant has a current license, load it and check the branch limit
	if tenant.CurrentLicenseID != nil {
		var license models.License
		if err := bs.DB.First(&license, *tenant.CurrentLicenseID).Error; err == nil {
			if license.Status == models.LicenseStatusActive {
				maxBranches = license.MaxBranches
			}
		}
	}

	// Check limit (-1 means unlimited)
	if maxBranches != -1 && int(branchCount) >= maxBranches {
		return nil, fmt.Errorf("branch limit reached: your license allows %d branch(es)", maxBranches)
	}

	// Validate username if provided
	if req.Username != "" {
		var existingBranch models.Branch
		if err := bs.DB.Where("username = ?", req.Username).First(&existingBranch).Error; err == nil {
			return nil, errors.New("username already taken")
		}
	}

	// Generate branch code
	branchCode := bs.generateBranchCode(tenantID, req.Name)

	// Branches are never primary - main office is not a branch
	isPrimary := false

	branch := &models.Branch{
		TenantID:   tenantID,
		Name:       req.Name,
		Location:   req.Location,
		BranchCode: branchCode,
		IsPrimary:  isPrimary,
		Status:     models.BranchStatusActive,
	}

	// Set credentials if provided
	if req.Username != "" && req.Password != "" {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
		if err != nil {
			return nil, fmt.Errorf("failed to hash password: %w", err)
		}
		hashedPasswordStr := string(hashedPassword)
		branch.Username = &req.Username
		branch.PasswordHash = &hashedPasswordStr
	}

	if err := bs.DB.Create(branch).Error; err != nil {
		return nil, fmt.Errorf("failed to create branch: %w", err)
	}

	log.Printf("✅ Branch created: %s (ID: %d) for Tenant ID: %d", branch.Name, branch.ID, tenantID)
	return branch, nil
}

// generateBranchCode generates a unique branch code
func (bs *BranchService) generateBranchCode(tenantID uint, name string) string {
	// Create code from first 3 letters of name + random number
	prefix := strings.ToUpper(strings.ReplaceAll(name, " ", ""))
	if len(prefix) > 3 {
		prefix = prefix[:3]
	}

	// Find unique code
	for i := 1; i < 1000; i++ {
		code := fmt.Sprintf("%s-%03d", prefix, i)
		var count int64
		bs.DB.Model(&models.Branch{}).Where("tenant_id = ? AND branch_code = ?", tenantID, code).Count(&count)
		if count == 0 {
			return code
		}
	}

	// Fallback
	return fmt.Sprintf("BR-%d-%d", tenantID, time.Now().Unix())
}

// GetBranches retrieves all branches for a tenant
func (bs *BranchService) GetBranches(tenantID uint) ([]models.Branch, error) {
	var branches []models.Branch
	if err := bs.DB.Where("tenant_id = ?", tenantID).Order("is_primary DESC, created_at ASC").Find(&branches).Error; err != nil {
		return nil, fmt.Errorf("failed to get branches: %w", err)
	}
	return branches, nil
}

// GetBranchByID retrieves a single branch
func (bs *BranchService) GetBranchByID(branchID, tenantID uint) (*models.Branch, error) {
	var branch models.Branch
	if err := bs.DB.Where("id = ? AND tenant_id = ?", branchID, tenantID).First(&branch).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("branch not found")
		}
		return nil, fmt.Errorf("database error: %w", err)
	}
	return &branch, nil
}

// UpdateBranch updates branch details
func (bs *BranchService) UpdateBranch(branchID, tenantID uint, req UpdateBranchRequest) (*models.Branch, error) {
	var branch models.Branch
	if err := bs.DB.Where("id = ? AND tenant_id = ?", branchID, tenantID).First(&branch).Error; err != nil {
		return nil, errors.New("branch not found")
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Location != "" {
		updates["location"] = req.Location
	}

	if len(updates) > 0 {
		if err := bs.DB.Model(&branch).Updates(updates).Error; err != nil {
			return nil, fmt.Errorf("failed to update branch: %w", err)
		}
	}

	return &branch, nil
}

// DeactivateBranch deactivates a branch
func (bs *BranchService) DeactivateBranch(branchID, tenantID uint) error {
	var branch models.Branch
	if err := bs.DB.Where("id = ? AND tenant_id = ?", branchID, tenantID).First(&branch).Error; err != nil {
		return errors.New("branch not found")
	}

	// Check for pending pickup transactions (just log warning, don't block)
	var pendingCount int64
	if err := bs.DB.Table("pickup_transactions").
		Where("(sender_branch_id = ? OR receiver_branch_id = ?) AND status = ?", branchID, branchID, "PENDING").
		Count(&pendingCount).Error; err == nil && pendingCount > 0 {
		log.Printf("⚠️  Warning: Deactivating branch with %d pending pickup transaction(s)", pendingCount)
	}

	// Deactivate
	if err := bs.DB.Model(&branch).Update("status", models.BranchStatusInactive).Error; err != nil {
		return fmt.Errorf("failed to deactivate branch: %w", err)
	}

	log.Printf("✅ Branch deactivated: %s (ID: %d)", branch.Name, branch.ID)
	return nil
}

// AssignUserToBranch assigns a user to a branch
func (bs *BranchService) AssignUserToBranch(userID, branchID uint, accessLevel string) error {
	// Check if user and branch exist and belong to same tenant
	var user models.User
	if err := bs.DB.First(&user, userID).Error; err != nil {
		return errors.New("user not found")
	}

	var branch models.Branch
	if err := bs.DB.First(&branch, branchID).Error; err != nil {
		return errors.New("branch not found")
	}

	if user.TenantID == nil || *user.TenantID != branch.TenantID {
		return errors.New("user and branch must belong to same tenant")
	}

	// Check if already assigned
	var existing models.UserBranch
	result := bs.DB.Where("user_id = ? AND branch_id = ?", userID, branchID).First(&existing)
	if result.Error == nil {
		// Update access level
		return bs.DB.Model(&existing).Update("access_level", accessLevel).Error
	}

	// Create new assignment
	userBranch := models.UserBranch{
		UserID:      userID,
		BranchID:    branchID,
		AccessLevel: accessLevel,
	}

	if err := bs.DB.Create(&userBranch).Error; err != nil {
		return fmt.Errorf("failed to assign user to branch: %w", err)
	}

	log.Printf("✅ User %d assigned to Branch %d with %s access", userID, branchID, accessLevel)
	return nil
}

// RemoveUserFromBranch removes a user from a branch
func (bs *BranchService) RemoveUserFromBranch(userID, branchID uint) error {
	result := bs.DB.Where("user_id = ? AND branch_id = ?", userID, branchID).Delete(&models.UserBranch{})
	if result.Error != nil {
		return fmt.Errorf("failed to remove user from branch: %w", result.Error)
	}
	if result.RowsAffected == 0 {
		return errors.New("user not assigned to this branch")
	}
	return nil
}

// GetUserBranches retrieves all branches a user has access to
func (bs *BranchService) GetUserBranches(userID uint) ([]models.Branch, error) {
	// First get the user to check their primary branch
	var user models.User
	if err := bs.DB.First(&user, userID).Error; err != nil {
		return nil, fmt.Errorf("failed to find user: %w", err)
	}

	// Get branches from user_branches join table
	var branches []models.Branch
	if err := bs.DB.Joins("JOIN user_branches ON user_branches.branch_id = branches.id").
		Where("user_branches.user_id = ?", userID).
		Find(&branches).Error; err != nil {
		return nil, fmt.Errorf("failed to get user branches: %w", err)
	}

	// If user has a primary branch, include it if not already in list
	if user.PrimaryBranchID != nil {
		var primaryBranch models.Branch
		if err := bs.DB.First(&primaryBranch, *user.PrimaryBranchID).Error; err == nil {
			// Check if already in list
			found := false
			for _, b := range branches {
				if b.ID == primaryBranch.ID {
					found = true
					break
				}
			}
			if !found {
				// Add primary branch at the beginning
				branches = append([]models.Branch{primaryBranch}, branches...)
			}
		}
	}

	return branches, nil
}

// SetBranchCredentials sets username and password for a branch
func (bs *BranchService) SetBranchCredentials(branchID, tenantID uint, username, password string) error {
	// Check branch exists and belongs to tenant
	var branch models.Branch
	if err := bs.DB.Where("id = ? AND tenant_id = ?", branchID, tenantID).First(&branch).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("branch not found")
		}
		return fmt.Errorf("failed to fetch branch: %w", err)
	}

	// Check if username is already taken by another branch
	if username != "" {
		var existingBranch models.Branch
		err := bs.DB.Where("username = ? AND id != ?", username, branchID).First(&existingBranch).Error
		if err == nil {
			return errors.New("username already taken by another branch")
		} else if !errors.Is(err, gorm.ErrRecordNotFound) {
			return fmt.Errorf("failed to check username: %w", err)
		}
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("failed to hash password: %w", err)
	}

	hashedPasswordStr := string(hashedPassword)

	// Update branch credentials
	if err := bs.DB.Model(&branch).Updates(map[string]interface{}{
		"username":      &username,
		"password_hash": &hashedPasswordStr,
		"updated_at":    time.Now(),
	}).Error; err != nil {
		return fmt.Errorf("failed to update branch credentials: %w", err)
	}

	return nil
}
