package services

import (
	"api/pkg/models"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// AuthService handles authentication operations
type AuthService struct {
	DB           *gorm.DB
	EmailService *EmailService
	JWTSecret    string
}

// NewAuthService creates a new auth service instance
func NewAuthService(db *gorm.DB) *AuthService {
	jwtSecret := getEnv("JWT_SECRET", "")
	if jwtSecret == "" {
		panic("JWT_SECRET environment variable is required and must be set")
	}
	return &AuthService{
		DB:           db,
		EmailService: NewEmailService(),
		JWTSecret:    jwtSecret,
	}
}

// JWTClaims represents the JWT token claims
type JWTClaims struct {
	UserID   uint   `json:"userId"`
	Email    string `json:"email"`
	Role     string `json:"role"`
	TenantID *uint  `json:"tenantId"`
	jwt.RegisteredClaims
}

// RegisterRequest represents a registration request
type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=8"`
	Name     string `json:"name" binding:"required"`
}

// VerifyEmailRequest represents an email verification request
type VerifyEmailRequest struct {
	Email string `json:"email" binding:"required,email"`
	Code  string `json:"code" binding:"required,len=6"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

// Register creates a new user and tenant, sends verification email
func (as *AuthService) Register(req RegisterRequest) (*models.User, error) {
	// Check if user already exists
	var existingUser models.User
	if err := as.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return nil, errors.New("user with this email already exists")
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Generate verification code
	verificationCode, err := GenerateVerificationCode()
	if err != nil {
		return nil, fmt.Errorf("failed to generate verification code: %w", err)
	}

	codeExpiresAt := time.Now().Add(10 * time.Minute)

	// Start transaction
	tx := as.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Create user
	trialEndsAt := time.Now().Add(7 * 24 * time.Hour) // 7 days trial
	user := &models.User{
		Email:            req.Email,
		PasswordHash:     string(hashedPassword),
		EmailVerified:    false,
		VerificationCode: &verificationCode,
		CodeExpiresAt:    &codeExpiresAt,
		Role:             models.RoleTenantOwner, // First user is owner of their tenant
		TrialEndsAt:      &trialEndsAt,
		Status:           models.StatusActive,
	}

	if err := tx.Create(user).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	// Create tenant for the user
	tenant := &models.Tenant{
		Name:      fmt.Sprintf("%s's Organization", req.Name),
		OwnerID:   user.ID,
		UserLimit: 1, // Trial: only 1 user
		Status:    models.TenantStatusTrial,
	}

	if err := tx.Create(tenant).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create tenant: %w", err)
	}

	// Update user's tenant ID
	user.TenantID = &tenant.ID
	if err := tx.Save(user).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to update user tenant: %w", err)
	}

	// Create primary branch (Head Office) for the owner
	hashedPasswordStr := string(hashedPassword)
	ownerBranch := &models.Branch{
		TenantID:     tenant.ID,
		Name:         "Head Office",
		Location:     "",
		BranchCode:   "HQ",
		IsPrimary:    true,
		Status:       models.BranchStatusActive,
		Username:     &req.Email,         // Set username to email as requested
		PasswordHash: &hashedPasswordStr, // Set password to same as user
	}

	if err := tx.Create(ownerBranch).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to create owner branch: %w", err)
	}

	// Assign the primary branch to the owner user
	user.PrimaryBranchID = &ownerBranch.ID
	if err := tx.Save(user).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to assign primary branch: %w", err)
	}

	log.Printf("✅ Created Head Office branch (ID: %d) for owner: %s", ownerBranch.ID, user.Email)

	// Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	// Send verification email (don't fail registration if email fails)
	if err := as.EmailService.SendVerificationEmail(user.Email, verificationCode); err != nil {
		log.Printf("Warning: Failed to send verification email: %v", err)
	}

	return user, nil
}

// VerifyEmail verifies a user's email with the provided code
func (as *AuthService) VerifyEmail(req VerifyEmailRequest) error {
	var user models.User
	if err := as.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	// Check if already verified
	if user.EmailVerified {
		return errors.New("email already verified")
	}

	// Check if code exists
	if user.VerificationCode == nil {
		return errors.New("no verification code found")
	}

	// Check if code expired
	if user.CodeExpiresAt != nil && time.Now().After(*user.CodeExpiresAt) {
		return errors.New("verification code expired")
	}

	// Verify code
	if *user.VerificationCode != req.Code {
		return errors.New("invalid verification code")
	}

	// Update user as verified
	user.EmailVerified = true
	user.VerificationCode = nil
	user.CodeExpiresAt = nil

	if err := as.DB.Save(&user).Error; err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	log.Printf("✅ Email verified successfully for user: %s", user.Email)
	return nil
}

// ResendVerificationCode resends a verification code
func (as *AuthService) ResendVerificationCode(email string) error {
	var user models.User
	if err := as.DB.Where("email = ?", email).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return fmt.Errorf("database error: %w", err)
	}

	if user.EmailVerified {
		return errors.New("email already verified")
	}

	// Generate new code
	verificationCode, err := GenerateVerificationCode()
	if err != nil {
		return fmt.Errorf("failed to generate verification code: %w", err)
	}

	codeExpiresAt := time.Now().Add(10 * time.Minute)
	user.VerificationCode = &verificationCode
	user.CodeExpiresAt = &codeExpiresAt

	if err := as.DB.Save(&user).Error; err != nil {
		return fmt.Errorf("failed to update user: %w", err)
	}

	// Send verification email
	if err := as.EmailService.SendVerificationEmail(user.Email, verificationCode); err != nil {
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	return nil
}

// LoginResponse contains both access and refresh tokens
type LoginResponse struct {
	AccessToken  string       `json:"accessToken"`
	RefreshToken string       `json:"refreshToken"`
	User         *models.User `json:"user"`
}

// Login authenticates a user and returns JWT tokens
// Accepts email, username, OR branch username for login
func (as *AuthService) Login(req LoginRequest) (*LoginResponse, error) {
	var user models.User

	// Try to find user by email first, then by username
	err := as.DB.Preload("Tenant").Preload("PrimaryBranch").Where("email = ?", req.Email).First(&user).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Try finding by username in users table
			err = as.DB.Preload("Tenant").Preload("PrimaryBranch").Where("username = ?", req.Email).First(&user).Error
			if err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					// Try finding as branch login
					var branch models.Branch
					err = as.DB.Preload("Tenant").Where("username = ? AND status = ?", req.Email, models.BranchStatusActive).First(&branch).Error
					if err == nil {
						// Branch found, verify password
						if branch.PasswordHash == nil || *branch.PasswordHash == "" {
							return nil, errors.New("branch credentials not set")
						}
						if err := bcrypt.CompareHashAndPassword([]byte(*branch.PasswordHash), []byte(req.Password)); err != nil {
							return nil, errors.New("invalid username or password")
						}

						// Find or create a user for this branch
						var branchUser models.User
						branchEmail := *branch.Username + "@branch.local"
						err = as.DB.Preload("Tenant").Preload("PrimaryBranch").Where("email = ?", branchEmail).First(&branchUser).Error

						if errors.Is(err, gorm.ErrRecordNotFound) {
							// Create a user for this branch
							branchUser = models.User{
								Username:        branch.Username,
								Email:           branchEmail,
								PasswordHash:    *branch.PasswordHash, // Use same password hash
								EmailVerified:   true,
								Role:            models.RoleTenantUser,
								TenantID:        &branch.TenantID,
								PrimaryBranchID: &branch.ID,
								Status:          models.StatusActive,
							}
							if err := as.DB.Create(&branchUser).Error; err != nil {
								return nil, fmt.Errorf("failed to create branch user: %w", err)
							}
							// Reload with associations
							as.DB.Preload("Tenant").Preload("PrimaryBranch").First(&branchUser, branchUser.ID)
						} else if err != nil {
							return nil, fmt.Errorf("database error: %w", err)
						}

						// Generate tokens for branch login
						return as.generateLoginResponse(&branchUser)
					}
					return nil, errors.New("invalid email or password")
				}
				return nil, fmt.Errorf("database error: %w", err)
			}
		} else {
			return nil, fmt.Errorf("database error: %w", err)
		}
	}

	// Check if email is verified
	if !user.EmailVerified {
		return nil, errors.New("email not verified. Please verify your email first")
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid email or password")
	}

	// Check if account is active
	if user.Status == models.StatusSuspended {
		return nil, errors.New("account is suspended. Please contact support")
	}

	// Check trial expiration (if not SuperAdmin)
	if user.Role != models.RoleSuperAdmin && user.TenantID != nil {
		var tenant models.Tenant
		if err := as.DB.First(&tenant, user.TenantID).Error; err == nil {
			if tenant.Status == models.TenantStatusTrial && user.TrialEndsAt != nil && time.Now().After(*user.TrialEndsAt) {
				user.Status = models.StatusTrialExpired
				tenant.Status = models.TenantStatusExpired
				as.DB.Save(&user)
				as.DB.Save(&tenant)
				return nil, errors.New("trial period expired. Please activate a license")
			}
		}
	}

	// Generate tokens
	return as.generateLoginResponse(&user)
}

// generateLoginResponse creates access and refresh tokens
func (as *AuthService) generateLoginResponse(user *models.User) (*LoginResponse, error) {
	// Generate access token (short-lived: 15 minutes)
	accessToken, err := as.GenerateAccessToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	// Generate refresh token (long-lived: 7 days)
	refreshToken, err := as.GenerateRefreshToken(user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate refresh token: %w", err)
	}

	log.Printf("✅ User logged in successfully: %s", user.Email)

	return &LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	}, nil
}

// GenerateJWT generates a JWT token for a user (backward compatibility)
func (as *AuthService) GenerateJWT(user *models.User) (string, error) {
	return as.GenerateAccessToken(user)
}

// GenerateAccessToken generates a short-lived access token (15 minutes)
func (as *AuthService) GenerateAccessToken(user *models.User) (string, error) {
	claims := JWTClaims{
		UserID:   user.ID,
		Email:    user.Email,
		Role:     user.Role,
		TenantID: user.TenantID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)), // 15 minutes
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "digital-transaction-ledger",
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(as.JWTSecret))
	if err != nil {
		return "", err
	}

	return tokenString, nil
}

// GenerateRefreshToken generates a long-lived refresh token (7 days)
func (as *AuthService) GenerateRefreshToken(user *models.User) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   fmt.Sprintf("%d", user.ID),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(7 * 24 * time.Hour)), // 7 days
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		Issuer:    "digital-transaction-ledger-refresh",
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(as.JWTSecret))
	if err != nil {
		return "", err
	}

	// Store refresh token in database
	refreshToken := models.RefreshToken{
		UserID:    user.ID,
		Token:     tokenString,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
		IsRevoked: false,
	}

	if err := as.DB.Create(&refreshToken).Error; err != nil {
		return "", fmt.Errorf("failed to store refresh token: %w", err)
	}

	return tokenString, nil
}

// RefreshAccessToken validates a refresh token and generates a new access token
func (as *AuthService) RefreshAccessToken(refreshTokenString string) (*LoginResponse, error) {
	// Parse refresh token
	token, err := jwt.ParseWithClaims(refreshTokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(as.JWTSecret), nil
	})

	if err != nil {
		return nil, errors.New("invalid refresh token")
	}

	_, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid refresh token claims")
	}

	// Check if token exists and is not revoked in database
	var refreshToken models.RefreshToken
	if err := as.DB.Where("token = ? AND is_revoked = ?", refreshTokenString, false).First(&refreshToken).Error; err != nil {
		return nil, errors.New("refresh token not found or revoked")
	}

	// Check if token is expired
	if time.Now().After(refreshToken.ExpiresAt) {
		return nil, errors.New("refresh token expired")
	}

	// Get user
	var user models.User
	if err := as.DB.Preload("Tenant").Preload("PrimaryBranch").First(&user, refreshToken.UserID).Error; err != nil {
		return nil, errors.New("user not found")
	}

	// Check if user is still active
	if user.Status == models.StatusSuspended {
		return nil, errors.New("account is suspended")
	}

	// Generate new access token
	accessToken, err := as.GenerateAccessToken(&user)
	if err != nil {
		return nil, fmt.Errorf("failed to generate access token: %w", err)
	}

	log.Printf("✅ Access token refreshed for user: %s", user.Email)

	return &LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshTokenString, // Return same refresh token
		User:         &user,
	}, nil
}

// RevokeRefreshToken revokes a refresh token
func (as *AuthService) RevokeRefreshToken(tokenString string) error {
	result := as.DB.Model(&models.RefreshToken{}).
		Where("token = ?", tokenString).
		Update("is_revoked", true)

	if result.Error != nil {
		return fmt.Errorf("failed to revoke token: %w", result.Error)
	}

	if result.RowsAffected == 0 {
		return errors.New("token not found")
	}

	return nil
}

// RevokeAllUserTokens revokes all refresh tokens for a user
func (as *AuthService) RevokeAllUserTokens(userID uint) error {
	result := as.DB.Model(&models.RefreshToken{}).
		Where("user_id = ?", userID).
		Update("is_revoked", true)

	if result.Error != nil {
		return fmt.Errorf("failed to revoke tokens: %w", result.Error)
	}

	log.Printf("✅ Revoked all tokens for user ID: %d", userID)
	return nil
}

// ValidateJWT validates a JWT token and returns the claims
func (as *AuthService) ValidateJWT(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(as.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, errors.New("invalid token")
}

// ChangePassword changes a user's password
func (as *AuthService) ChangePassword(userID uint, currentPassword, newPassword string) error {
	var user models.User
	if err := as.DB.First(&user, userID).Error; err != nil {
		return errors.New("user not found")
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(currentPassword)); err != nil {
		return errors.New("current password is incorrect")
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("failed to hash new password")
	}

	// Update password
	user.PasswordHash = string(hashedPassword)
	if err := as.DB.Save(&user).Error; err != nil {
		return errors.New("failed to update password")
	}

	log.Printf("✅ Password changed for user ID: %d", userID)
	return nil
}

// SendPasswordResetCode generates and sends a password reset code
func (as *AuthService) SendPasswordResetCode(emailOrPhone string) error {
	// Find user by email
	var user models.User
	err := as.DB.Where("email = ?", emailOrPhone).First(&user).Error
	if err != nil {
		return errors.New("user not found")
	}

	// Generate a 6-digit code
	code := fmt.Sprintf("%06d", rand.Intn(1000000))

	// Create reset code record
	resetCode := models.PasswordResetCode{
		Email:     user.Email,
		Code:      code,
		ExpiresAt: time.Now().Add(15 * time.Minute), // Expires in 15 minutes
		Used:      false,
	}

	if err := as.DB.Create(&resetCode).Error; err != nil {
		return errors.New("failed to create reset code")
	}

	// Send code via email
	if err := as.EmailService.SendPasswordResetCode(user.Email, code); err != nil {
		log.Printf("⚠️  Failed to send password reset email to %s: %v", user.Email, err)
		log.Printf("📧 [FALLBACK] Password reset code: %s (Expires in 15 minutes)", code)
		// Don't fail the request even if email fails - code is logged
	} else {
		log.Printf("✅ Password reset code sent to %s", user.Email)
	}

	return nil
}

// ResetPasswordWithCode resets password using verification code
func (as *AuthService) ResetPasswordWithCode(emailOrPhone, code, newPassword string) error {
	// Find user by email
	var user models.User
	err := as.DB.Where("email = ?", emailOrPhone).First(&user).Error
	if err != nil {
		return errors.New("user not found")
	}

	// Find valid reset code
	var resetCode models.PasswordResetCode
	err = as.DB.Where(
		"email = ? AND code = ? AND used = ? AND expires_at > ?",
		user.Email, code, false, time.Now(),
	).First(&resetCode).Error

	if err != nil {
		return errors.New("invalid or expired reset code")
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return errors.New("failed to hash new password")
	}

	// Update password
	user.PasswordHash = string(hashedPassword)
	if err := as.DB.Save(&user).Error; err != nil {
		return errors.New("failed to update password")
	}

	// Mark reset code as used
	resetCode.Used = true
	as.DB.Save(&resetCode)

	log.Printf("✅ Password reset successfully for user: %s", emailOrPhone)
	return nil
}
