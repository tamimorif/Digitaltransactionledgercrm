package api

import (
	"api/pkg/models"
	"api/pkg/services"
	"encoding/json"
	"log"
	"net/http"

	"gorm.io/gorm"
)

// AuthHandler handles authentication-related requests
type AuthHandler struct {
	AuthService *services.AuthService
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{
		AuthService: services.NewAuthService(db),
	}
}

// RegisterHandler handles user registration
// @Summary Register a new user
// @Description Register a new user and create a tenant
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.RegisterRequest true "Registration details"
// @Success 201 {object} map[string]interface{} "User created successfully"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/register [post]
func (ah *AuthHandler) RegisterHandler(w http.ResponseWriter, r *http.Request) {
	var req services.RegisterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	// Validate request
	if req.Email == "" || req.Password == "" || req.Name == "" {
		respondWithError(w, http.StatusBadRequest, "Email, password, and name are required")
		return
	}

	if len(req.Password) < 8 {
		respondWithError(w, http.StatusBadRequest, "Password must be at least 8 characters")
		return
	}

	user, err := ah.AuthService.Register(req)
	if err != nil {
		log.Printf("Registration error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, map[string]interface{}{
		"message": "Registration successful. Please check your email for verification code.",
		"user": map[string]interface{}{
			"id":            user.ID,
			"email":         user.Email,
			"emailVerified": user.EmailVerified,
			"role":          user.Role,
			"tenantId":      user.TenantID,
			"trialEndsAt":   user.TrialEndsAt,
		},
	})
}

// VerifyEmailHandler handles email verification
// @Summary Verify user email
// @Description Verify user email with verification code
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.VerifyEmailRequest true "Verification details"
// @Success 200 {object} map[string]string "Email verified successfully"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/verify-email [post]
func (ah *AuthHandler) VerifyEmailHandler(w http.ResponseWriter, r *http.Request) {
	var req services.VerifyEmailRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Code == "" {
		respondWithError(w, http.StatusBadRequest, "Email and code are required")
		return
	}

	if len(req.Code) != 6 {
		respondWithError(w, http.StatusBadRequest, "Code must be 6 digits")
		return
	}

	err := ah.AuthService.VerifyEmail(req)
	if err != nil {
		log.Printf("Email verification error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Email verified successfully. You can now login.",
	})
}

// ResendVerificationCodeHandler handles resending verification code
// @Summary Resend verification code
// @Description Resend verification code to user email
// @Tags auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Email"
// @Success 200 {object} map[string]string "Verification code sent"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/resend-code [post]
func (ah *AuthHandler) ResendVerificationCodeHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email string `json:"email"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" {
		respondWithError(w, http.StatusBadRequest, "Email is required")
		return
	}

	err := ah.AuthService.ResendVerificationCode(req.Email)
	if err != nil {
		log.Printf("Resend code error: %v", err)
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Verification code sent successfully.",
	})
}

// LoginHandler handles user login
// @Summary Login user
// @Description Authenticate user and return JWT token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body services.LoginRequest true "Login credentials"
// @Success 200 {object} map[string]interface{} "Login successful"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/login [post]
func (ah *AuthHandler) LoginHandler(w http.ResponseWriter, r *http.Request) {
	var req services.LoginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.Email == "" || req.Password == "" {
		respondWithError(w, http.StatusBadRequest, "Email/username and password are required")
		return
	}

	loginResp, err := ah.AuthService.Login(req)
	if err != nil {
		log.Printf("Login error: %v", err)
		respondWithError(w, http.StatusUnauthorized, err.Error())
		return
	}

	user := loginResp.User

	// Get tenant info if exists
	var tenantInfo map[string]interface{}
	if user.TenantID != nil && user.Tenant != nil {
		tenantInfo = map[string]interface{}{
			"id":        user.Tenant.ID,
			"name":      user.Tenant.Name,
			"status":    user.Tenant.Status,
			"userLimit": user.Tenant.UserLimit,
		}
	}

	// Prepare user response with branch info if exists
	userResponse := map[string]interface{}{
		"id":              user.ID,
		"email":           user.Email,
		"username":        user.Username,
		"role":            user.Role,
		"tenantId":        user.TenantID,
		"primaryBranchId": user.PrimaryBranchID,
		"status":          user.Status,
		"trialEndsAt":     user.TrialEndsAt,
		"emailVerified":   user.EmailVerified,
	}

	// Add primary branch info if exists
	if user.PrimaryBranch != nil {
		userResponse["primaryBranch"] = map[string]interface{}{
			"id":       user.PrimaryBranch.ID,
			"name":     user.PrimaryBranch.Name,
			"location": user.PrimaryBranch.Location,
		}
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message":      "Login successful",
		"accessToken":  loginResp.AccessToken,
		"refreshToken": loginResp.RefreshToken,
		"token":        loginResp.AccessToken, // Backward compatibility
		"user":         userResponse,
		"tenant":       tenantInfo,
	})
}

// GetMeHandler returns current user info (requires authentication)
// @Summary Get current user
// @Description Get authenticated user information
// @Tags auth
// @Produce json
// @Security BearerAuth
// @Success 200 {object} models.User "User info"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Internal server error"
// @Router /auth/me [get]
func (ah *AuthHandler) GetMeHandler(w http.ResponseWriter, r *http.Request) {
	// Get user from context (set by auth middleware)
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Reload user with relationships
	var fullUser models.User
	if err := ah.AuthService.DB.Preload("Tenant").Preload("PrimaryBranch").First(&fullUser, user.ID).Error; err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to load user data")
		return
	}

	// Get tenant info if exists
	var tenantInfo map[string]interface{}
	if fullUser.TenantID != nil && fullUser.Tenant != nil {
		tenantInfo = map[string]interface{}{
			"id":        fullUser.Tenant.ID,
			"name":      fullUser.Tenant.Name,
			"status":    fullUser.Tenant.Status,
			"userLimit": fullUser.Tenant.UserLimit,
		}
	}

	response := map[string]interface{}{
		"id":              fullUser.ID,
		"email":           fullUser.Email,
		"username":        fullUser.Username,
		"role":            fullUser.Role,
		"tenantId":        fullUser.TenantID,
		"primaryBranchId": fullUser.PrimaryBranchID,
		"status":          fullUser.Status,
		"trialEndsAt":     fullUser.TrialEndsAt,
		"emailVerified":   fullUser.EmailVerified,
		"createdAt":       fullUser.CreatedAt,
	}

	// Add primary branch info if exists
	if fullUser.PrimaryBranch != nil {
		response["primaryBranch"] = map[string]interface{}{
			"id":       fullUser.PrimaryBranch.ID,
			"name":     fullUser.PrimaryBranch.Name,
			"location": fullUser.PrimaryBranch.Location,
		}
	}

	if tenantInfo != nil {
		response["tenant"] = tenantInfo
	}

	respondWithJSON(w, http.StatusOK, response)
}

// ChangePasswordHandler changes user password
// POST /api/auth/change-password
func (ah *AuthHandler) ChangePasswordHandler(w http.ResponseWriter, r *http.Request) {
	user := r.Context().Value("user").(*models.User)

	var req struct {
		CurrentPassword string `json:"currentPassword"`
		NewPassword     string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.CurrentPassword == "" || req.NewPassword == "" {
		respondWithError(w, http.StatusBadRequest, "Current password and new password are required")
		return
	}

	if len(req.NewPassword) < 8 {
		respondWithError(w, http.StatusBadRequest, "New password must be at least 8 characters")
		return
	}

	// Change password through auth service
	if err := ah.AuthService.ChangePassword(user.ID, req.CurrentPassword, req.NewPassword); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Password changed successfully",
	})
}

// ForgotPasswordHandler godoc
// @Summary Request password reset
// @Description Send a password reset code to user's email or phone
// @Tags auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Email or phone"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Router /auth/forgot-password [post]
func (ah *AuthHandler) ForgotPasswordHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		EmailOrPhone string `json:"emailOrPhone"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.EmailOrPhone == "" {
		respondWithError(w, http.StatusBadRequest, "Email or phone is required")
		return
	}

	// Send reset code through auth service
	if err := ah.AuthService.SendPasswordResetCode(req.EmailOrPhone); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Password reset code sent successfully",
	})
}

// ResetPasswordHandler godoc
// @Summary Reset password with code
// @Description Reset password using verification code
// @Tags auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Reset details"
// @Success 200 {object} map[string]string
// @Failure 400 {object} map[string]string
// @Router /auth/reset-password [post]
func (ah *AuthHandler) ResetPasswordHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		EmailOrPhone string `json:"emailOrPhone"`
		Code         string `json:"code"`
		NewPassword  string `json:"newPassword"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.EmailOrPhone == "" || req.Code == "" || req.NewPassword == "" {
		respondWithError(w, http.StatusBadRequest, "Email/phone, code, and new password are required")
		return
	}

	if len(req.NewPassword) < 8 {
		respondWithError(w, http.StatusBadRequest, "New password must be at least 8 characters")
		return
	}

	// Reset password through auth service
	if err := ah.AuthService.ResetPasswordWithCode(req.EmailOrPhone, req.Code, req.NewPassword); err != nil {
		respondWithError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Password reset successfully",
	})
}

// RefreshTokenHandler refreshes an access token using a refresh token
// @Summary Refresh access token
// @Description Get a new access token using a refresh token
// @Tags auth
// @Accept json
// @Produce json
// @Param request body map[string]string true "Refresh token"
// @Success 200 {object} map[string]interface{} "New tokens"
// @Failure 400 {object} map[string]string "Bad request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Router /auth/refresh [post]
func (ah *AuthHandler) RefreshTokenHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RefreshToken string `json:"refreshToken"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.RefreshToken == "" {
		respondWithError(w, http.StatusBadRequest, "Refresh token is required")
		return
	}

	loginResp, err := ah.AuthService.RefreshAccessToken(req.RefreshToken)
	if err != nil {
		log.Printf("Token refresh error: %v", err)
		respondWithError(w, http.StatusUnauthorized, err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]interface{}{
		"message":      "Token refreshed successfully",
		"accessToken":  loginResp.AccessToken,
		"refreshToken": loginResp.RefreshToken,
		"token":        loginResp.AccessToken, // Backward compatibility
	})
}

// LogoutHandler revokes the user's refresh token
// @Summary Logout user
// @Description Revoke all user refresh tokens
// @Tags auth
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} map[string]string "Logout successful"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Router /auth/logout [post]
func (ah *AuthHandler) LogoutHandler(w http.ResponseWriter, r *http.Request) {
	user, ok := r.Context().Value("user").(*models.User)
	if !ok {
		respondWithError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	// Revoke all user tokens
	if err := ah.AuthService.RevokeAllUserTokens(user.ID); err != nil {
		log.Printf("Logout error: %v", err)
		respondWithError(w, http.StatusInternalServerError, "Failed to logout")
		return
	}

	respondWithJSON(w, http.StatusOK, map[string]string{
		"message": "Logout successful",
	})
}

// Helper functions
func respondWithJSON(w http.ResponseWriter, statusCode int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(data)
}

func respondWithError(w http.ResponseWriter, statusCode int, message string) {
	respondWithJSON(w, statusCode, map[string]string{"error": message})
}
