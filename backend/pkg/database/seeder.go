package database

import (
	"api/pkg/models"
	"log"
	"os"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedDatabase seeds the database with initial data
func SeedDatabase(db *gorm.DB) error {
	// Get SuperAdmin password from environment variable
	adminPassword := os.Getenv("SUPERADMIN_PASSWORD")
	if adminPassword == "" {
		adminPassword = "Admin@123456" // Fallback for development only
		log.Println("⚠️  SUPERADMIN_PASSWORD not set in .env - using default (CHANGE THIS IN PRODUCTION!)")
	}

	// Get SuperAdmin recovery email from environment variable
	recoveryEmail := os.Getenv("SUPERADMIN_RECOVERY_EMAIL")

	// Check if SuperAdmin already exists
	var superAdmin models.User
	err := db.Where("email = ?", "superadmin@velopay.ca").First(&superAdmin).Error

	if err == nil {
		// SuperAdmin exists, verify/update password
		log.Println("✅ SuperAdmin already exists. Verifying credentials...")

		// Re-hash password to ensure it's correct
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		// Update SuperAdmin with correct password
		superAdmin.PasswordHash = string(hashedPassword)
		superAdmin.EmailVerified = true
		superAdmin.Role = models.RoleSuperAdmin
		superAdmin.Status = models.StatusActive

		if err := db.Save(&superAdmin).Error; err != nil {
			return err
		}

		log.Printf("✅ SuperAdmin credentials updated:")
		log.Printf("   Email: %s", superAdmin.Email)
		log.Printf("   Password: [SET VIA SUPERADMIN_PASSWORD ENV VAR]")
	} else {
		// Create new SuperAdmin
		log.Println("🌱 Seeding database with initial SuperAdmin...")

		// Create SuperAdmin user
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(adminPassword), bcrypt.DefaultCost)
		if err != nil {
			return err
		}

		// Set recovery email pointer if provided
		var recoveryEmailPtr *string
		if recoveryEmail != "" {
			recoveryEmailPtr = &recoveryEmail
		}

		superAdmin = models.User{
			Email:         "superadmin@velopay.ca",
			PasswordHash:  string(hashedPassword),
			EmailVerified: true,
			Role:          models.RoleSuperAdmin,
			Status:        models.StatusActive,
			RecoveryEmail: recoveryEmailPtr,
		}

		if err := db.Create(&superAdmin).Error; err != nil {
			return err
		}

		log.Printf("✅ SuperAdmin created:")
		log.Printf("   Email: %s", superAdmin.Email)
		log.Printf("   Password: [SET VIA SUPERADMIN_PASSWORD ENV VAR]")
	}

	// Seed default roles
	if err := seedRoles(db); err != nil {
		return err
	}

	return nil
}

// seedRoles creates default roles with permissions
func seedRoles(db *gorm.DB) error {
	log.Println("🌱 Seeding default roles...")

	roles := []models.Role{
		{
			Name:        models.RoleTenantOwner,
			DisplayName: "Tenant Owner",
			Description: "Owner of a tenant with full access to tenant resources",
		},
		{
			Name:        models.RoleTenantAdmin,
			DisplayName: "Tenant Admin",
			Description: "Admin user with most permissions except tenant settings",
		},
		{
			Name:        models.RoleTenantUser,
			DisplayName: "Tenant User",
			Description: "Regular user with limited permissions",
		},
	}

	for _, role := range roles {
		// Check if role exists
		var existingRole models.Role
		err := db.Where("name = ?", role.Name).First(&existingRole).Error
		if err == nil {
			continue // Role already exists
		}

		// Create role
		if err := db.Create(&role).Error; err != nil {
			return err
		}

		// Assign permissions based on role
		if err := assignPermissions(db, &role); err != nil {
			return err
		}

		log.Printf("✅ Role created: %s", role.DisplayName)
	}

	return nil
}

// assignPermissions assigns permissions to a role
func assignPermissions(db *gorm.DB, role *models.Role) error {
	var permissions []models.RolePermission

	switch role.Name {
	case models.RoleTenantOwner:
		// Tenant Owner has all permissions except SuperAdmin features
		for _, feature := range models.AllFeatures() {
			if feature != models.FeatureSuperAdminPanel &&
				feature != models.FeatureManageLicenses &&
				feature != models.FeatureViewAllTenants {
				permissions = append(permissions, models.RolePermission{
					RoleID:    role.ID,
					Feature:   feature,
					CanAccess: true,
				})
			}
		}

	case models.RoleTenantAdmin:
		// Tenant Admin has most permissions except tenant settings
		adminFeatures := []string{
			models.FeatureViewTransactions,
			models.FeatureCreateTransaction,
			models.FeatureEditTransaction,
			models.FeatureDeleteTransaction,
			models.FeatureViewClients,
			models.FeatureManageClients,
			models.FeatureViewReports,
			models.FeatureManageUsers, // Can manage other users
		}
		for _, feature := range adminFeatures {
			permissions = append(permissions, models.RolePermission{
				RoleID:    role.ID,
				Feature:   feature,
				CanAccess: true,
			})
		}

	case models.RoleTenantUser:
		// Regular user has limited permissions
		userFeatures := []string{
			models.FeatureViewTransactions,
			models.FeatureCreateTransaction,
			models.FeatureViewClients,
			models.FeatureViewReports,
		}
		for _, feature := range userFeatures {
			permissions = append(permissions, models.RolePermission{
				RoleID:    role.ID,
				Feature:   feature,
				CanAccess: true,
			})
		}
	}

	// Create permissions
	if len(permissions) > 0 {
		if err := db.Create(&permissions).Error; err != nil {
			return err
		}
	}

	return nil
}

// CreateTestData creates test data for development (optional)
func CreateTestData(db *gorm.DB) error {
	log.Println("🌱 Creating test data...")

	// Check if test data already exists
	var tenantCount int64
	if err := db.Model(&models.Tenant{}).Where("name LIKE ?", "Test%").Count(&tenantCount).Error; err != nil {
		return err
	}

	if tenantCount > 0 {
		log.Println("✅ Test data already exists. Skipping.")
		return nil
	}

	// Create test user
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte("Test@123456"), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	trialEndsAt := time.Now().Add(7 * 24 * time.Hour)
	testUser := &models.User{
		Email:         "test@example.com",
		PasswordHash:  string(hashedPassword),
		EmailVerified: true,
		Role:          models.RoleTenantOwner,
		TrialEndsAt:   &trialEndsAt,
		Status:        models.StatusActive,
	}

	if err := db.Create(testUser).Error; err != nil {
		return err
	}

	// Create test tenant
	testTenant := &models.Tenant{
		Name:      "Test Company",
		OwnerID:   testUser.ID,
		UserLimit: 1,
		Status:    models.TenantStatusTrial,
	}

	if err := db.Create(testTenant).Error; err != nil {
		return err
	}

	// Update user's tenant
	testUser.TenantID = &testTenant.ID
	db.Save(testUser)

	log.Printf("✅ Test user created:")
	log.Printf("   Email: %s", testUser.Email)
	log.Printf("   Password: Test@123456")

	return nil
}
