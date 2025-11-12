package api

import (
	"api/pkg/models"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserHandler struct {
	DB *gorm.DB
}

func NewUserHandler(db *gorm.DB) *UserHandler {
	return &UserHandler{DB: db}
}

// CheckUsernameAvailabilityHandler checks if a username is available
// GET /api/users/check-username?username=xxx
func (h *UserHandler) CheckUsernameAvailabilityHandler(w http.ResponseWriter, r *http.Request) {
	username := r.URL.Query().Get("username")

	if username == "" {
		respondWithError(w, http.StatusBadRequest, "Username is required")
		return
	}

	// Validate username format (3-30 chars, alphanumeric + underscore)
	if !isValidUsername(username) {
		respondWithError(w, http.StatusBadRequest, "Username must be 3-30 characters and contain only letters, numbers, and underscores")
		return
	}

	// Check if username exists
	var existingUser models.User
	err := h.DB.Where("username = ?", username).First(&existingUser).Error

	if err == nil {
		// Username is taken
		suggestions := generateUsernameSuggestions(username, h.DB)
		respondWithJSON(w, http.StatusOK, map[string]interface{}{
			"available":   false,
			"message":     "Username already taken",
			"suggestions": suggestions,
		})
		return
	}

	if err != gorm.ErrRecordNotFound {
		respondWithError(w, http.StatusInternalServerError, "Error checking username")
		return
	}

	// Username is available
	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"available": true,
		"message":   "Username available",
	})
}

// isValidUsername validates username format
func isValidUsername(username string) bool {
	if len(username) < 3 || len(username) > 30 {
		return false
	}
	// Only allow alphanumeric and underscore
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9_]+$`, username)
	return matched
}

// generateUsernameSuggestions generates alternative username suggestions
func generateUsernameSuggestions(username string, db *gorm.DB) []string {
	suggestions := []string{}
	baseUsername := strings.ToLower(username)

	// Try adding numbers
	for i := 2; i <= 5; i++ {
		suggestion := fmt.Sprintf("%s%d", baseUsername, i)
		if isUsernameAvailable(suggestion, db) {
			suggestions = append(suggestions, suggestion)
			if len(suggestions) >= 3 {
				break
			}
		}
	}

	// Try adding _branch, _user suffixes
	suffixes := []string{"_branch", "_user", "_office"}
	for _, suffix := range suffixes {
		if len(suggestions) >= 3 {
			break
		}
		suggestion := baseUsername + suffix
		if isUsernameAvailable(suggestion, db) {
			suggestions = append(suggestions, suggestion)
		}
	}

	return suggestions
}

// isUsernameAvailable checks if a username is available
func isUsernameAvailable(username string, db *gorm.DB) bool {
	var user models.User
	err := db.Where("username = ?", username).First(&user).Error
	return err == gorm.ErrRecordNotFound
}

// Helper functions

// decodeJSON decodes JSON request body
func decodeJSON(body io.ReadCloser, v interface{}) error {
	return json.NewDecoder(body).Decode(v)
}

// hashPassword hashes a password using bcrypt
func hashPassword(password string) (string, error) {
	hashedBytes, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(hashedBytes), nil
}

// getIDFromPath extracts ID from URL path
func getIDFromPath(path string, prefix string) uint {
	// Extract ID from path like /api/users/123
	idStr := strings.TrimPrefix(path, prefix)
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		return 0
	}
	return uint(id)
}

// CreateBranchUserRequest represents request to create a branch user
type CreateBranchUserRequest struct {
	Username        string `json:"username"`
	Email           string `json:"email"`
	Password        string `json:"password"`
	PrimaryBranchID *uint  `json:"primaryBranchId"`
	Role            string `json:"role"` // tenant_user or tenant_admin
}

// CreateBranchUserHandler creates a new user for a branch
// POST /api/users/create-branch-user
func (h *UserHandler) CreateBranchUserHandler(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user and tenant from context
	user := r.Context().Value("user").(*models.User)
	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	// Only tenant owners and admins can create users
	if user.Role != models.RoleTenantOwner && user.Role != models.RoleTenantAdmin {
		respondWithError(w, http.StatusForbidden, "Only owners and admins can create users")
		return
	}

	var req CreateBranchUserRequest
	if err := decodeJSON(r.Body, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate required fields
	if req.Username == "" || req.Email == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Username, email, and password are required")
		return
	}

	// Validate username format
	if !isValidUsername(req.Username) {
		respondWithError(w, http.StatusBadRequest, "Username must be 3-30 characters and contain only letters, numbers, and underscores")
		return
	}

	// Validate role
	if req.Role == "" {
		req.Role = models.RoleTenantUser
	}
	if req.Role != models.RoleTenantUser && req.Role != models.RoleTenantAdmin {
		respondWithError(w, http.StatusBadRequest, "Role must be tenant_user or tenant_admin")
		return
	}

	// Check if username already exists
	if !isUsernameAvailable(req.Username, h.DB) {
		respondWithError(w, http.StatusBadRequest, "Username already taken")
		return
	}

	// Check if email already exists
	var existingUser models.User
	if err := h.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		respondWithError(w, http.StatusBadRequest, "Email already registered")
		return
	}

	// Hash password
	hashedPassword, err := hashPassword(req.Password)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to hash password")
		return
	}

	// Create new user
	newUser := models.User{
		Username:        &req.Username,
		Email:           req.Email,
		PasswordHash:    hashedPassword,
		EmailVerified:   true, // Branch users are auto-verified
		TenantID:        user.TenantID,
		PrimaryBranchID: req.PrimaryBranchID,
		Role:            req.Role,
		Status:          models.StatusActive,
	}

	if err := h.DB.Create(&newUser).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create user")
		return
	}

	// Return user without password
	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "User created successfully",
		"user": map[string]interface{}{
			"id":              newUser.ID,
			"username":        newUser.Username,
			"email":           newUser.Email,
			"role":            newUser.Role,
			"tenantId":        newUser.TenantID,
			"primaryBranchId": newUser.PrimaryBranchID,
			"status":          newUser.Status,
		},
	})
}

// GetUsersHandler lists all users for a tenant
// GET /api/users
func (h *UserHandler) GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)
	if user.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	// Only owners and admins can list users
	if user.Role != models.RoleTenantOwner && user.Role != models.RoleTenantAdmin {
		respondWithError(w, http.StatusForbidden, "Only owners and admins can list users")
		return
	}

	var users []models.User
	if err := h.DB.Preload("PrimaryBranch").
		Where("tenant_id = ?", user.TenantID).
		Order("created_at DESC").
		Find(&users).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to fetch users")
		return
	}

	// Format response without passwords
	usersResponse := make([]map[string]interface{}, len(users))
	for i, u := range users {
		usersResponse[i] = map[string]interface{}{
			"id":              u.ID,
			"username":        u.Username,
			"email":           u.Email,
			"role":            u.Role,
			"tenantId":        u.TenantID,
			"primaryBranchId": u.PrimaryBranchID,
			"primaryBranch":   u.PrimaryBranch,
			"status":          u.Status,
			"emailVerified":   u.EmailVerified,
			"createdAt":       u.CreatedAt,
		}
	}

	respondWithJSON(w, http.StatusOK, usersResponse)
}

// UpdateUserRequest represents request to update a user
type UpdateUserRequest struct {
	Username        *string `json:"username"`
	Email           *string `json:"email"`
	Password        *string `json:"password"`
	PrimaryBranchID *uint   `json:"primaryBranchId"`
	Role            *string `json:"role"`
	Status          *string `json:"status"`
}

// UpdateUserHandler updates a user
// PUT /api/users/:id
func (h *UserHandler) UpdateUserHandler(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user
	authUser := r.Context().Value("user").(*models.User)
	if authUser.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	// Only owners and admins can update users
	if authUser.Role != models.RoleTenantOwner && authUser.Role != models.RoleTenantAdmin {
		respondWithError(w, http.StatusForbidden, "Only owners and admins can update users")
		return
	}

	// Get user ID from URL
	userID := getIDFromPath(r.URL.Path, "/api/users/")
	if userID == 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	var req UpdateUserRequest
	if err := decodeJSON(r.Body, &req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Get user to update
	var targetUser models.User
	if err := h.DB.First(&targetUser, userID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	// Verify user belongs to same tenant
	if targetUser.TenantID == nil || *targetUser.TenantID != *authUser.TenantID {
		respondWithError(w, http.StatusForbidden, "Cannot update users from other tenants")
		return
	}

	// Update fields if provided
	updates := make(map[string]interface{})

	if req.Username != nil {
		if !isValidUsername(*req.Username) {
			respondWithError(w, http.StatusBadRequest, "Invalid username format")
			return
		}
		// Check if new username is available (excluding current user)
		var existingUser models.User
		err := h.DB.Where("username = ? AND id != ?", *req.Username, userID).First(&existingUser).Error
		if err == nil {
			respondWithError(w, http.StatusBadRequest, "Username already taken")
			return
		}
		updates["username"] = *req.Username
	}

	if req.Email != nil {
		updates["email"] = *req.Email
	}

	if req.Password != nil && *req.Password != "" {
		hashedPassword, err := hashPassword(*req.Password)
		if err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to hash password")
			return
		}
		updates["password_hash"] = hashedPassword
	}

	if req.PrimaryBranchID != nil {
		updates["primary_branch_id"] = *req.PrimaryBranchID
	}

	if req.Role != nil {
		updates["role"] = *req.Role
	}

	if req.Status != nil {
		updates["status"] = *req.Status
	}

	// Apply updates
	if len(updates) > 0 {
		if err := h.DB.Model(&targetUser).Updates(updates).Error; err != nil {
			respondWithError(w, http.StatusInternalServerError, "Failed to update user")
			return
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "User updated successfully",
	})
}

// DeleteUserHandler deletes a user
// DELETE /api/users/:id
func (h *UserHandler) DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	// Get authenticated user
	authUser := r.Context().Value("user").(*models.User)
	if authUser.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	// Only tenant owners can delete users
	if authUser.Role != models.RoleTenantOwner {
		respondWithError(w, http.StatusForbidden, "Only owners can delete users")
		return
	}

	// Get user ID from URL
	userID := getIDFromPath(r.URL.Path, "/api/users/")
	if userID == 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid user ID")
		return
	}

	// Get user to delete
	var targetUser models.User
	if err := h.DB.First(&targetUser, userID).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "User not found")
		return
	}

	// Verify user belongs to same tenant
	if targetUser.TenantID == nil || *targetUser.TenantID != *authUser.TenantID {
		respondWithError(w, http.StatusForbidden, "Cannot delete users from other tenants")
		return
	}

	// Cannot delete yourself
	if targetUser.ID == authUser.ID {
		respondWithError(w, http.StatusBadRequest, "Cannot delete your own account")
		return
	}

	// Delete user
	if err := h.DB.Delete(&targetUser).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to delete user")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message": "User deleted successfully",
	})
}

// GetBranchUsersHandler gets all users assigned to a specific branch
// GET /api/branches/:id/users
func (h *UserHandler) GetBranchUsersHandler(w http.ResponseWriter, r *http.Request) {
	authUser := r.Context().Value("user").(*models.User)
	if authUser.TenantID == nil {
		respondWithError(w, http.StatusBadRequest, "User must belong to a tenant")
		return
	}

	// Get branch ID from URL using mux.Vars
	vars := mux.Vars(r)
	branchID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil || branchID == 0 {
		respondWithError(w, http.StatusBadRequest, "Invalid branch ID")
		return
	}

	// Verify branch belongs to user's tenant
	var branch models.Branch
	if err := h.DB.Where("id = ? AND tenant_id = ?", branchID, *authUser.TenantID).First(&branch).Error; err != nil {
		respondWithError(w, http.StatusNotFound, "Branch not found")
		return
	}

	// Get users where primaryBranchId = branchID
	var users []models.User
	if err := h.DB.Where("tenant_id = ? AND primary_branch_id = ?", *authUser.TenantID, uint(branchID)).
		Select("id, username, email, role, primary_branch_id, status, created_at").
		Find(&users).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get branch users")
		return
	}

	respondWithJSON(w, http.StatusOK, users)
}
