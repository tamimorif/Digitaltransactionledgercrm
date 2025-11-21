package main

import (
	"log"
	"os"
	"time"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// User model (minimal for migration)
type User struct {
	ID              uint       `gorm:"primaryKey"`
	Email           string     `gorm:"type:varchar(255);uniqueIndex"`
	TenantID        *uint      `gorm:"type:bigint"`
	PrimaryBranchID *uint      `gorm:"type:bigint"`
	Role            string     `gorm:"type:varchar(50)"`
}

// Branch model (minimal for migration)
type Branch struct {
	ID         uint      `gorm:"primaryKey"`
	TenantID   uint      `gorm:"type:bigint"`
	Name       string    `gorm:"type:varchar(255)"`
	Location   string    `gorm:"type:text"`
	BranchCode string    `gorm:"type:varchar(50)"`
	IsPrimary  bool      `gorm:"type:boolean"`
	Status     string    `gorm:"type:varchar(50)"`
	CreatedAt  time.Time `gorm:"type:timestamp"`
	UpdatedAt  time.Time `gorm:"type:timestamp"`
}

// This script creates a Head Office branch for existing owner accounts
// that don't have a primary branch set

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	// Database connection
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Fatal("DATABASE_URL environment variable not set")
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	// Find all tenant owners without a primary branch
	var owners []User
	if err := db.Where("role = ? AND primary_branch_id IS NULL", "tenant_owner").
		Find(&owners).Error; err != nil {
		log.Fatalf("Failed to find owners: %v", err)
	}

	if len(owners) == 0 {
		log.Println("✅ No owners need Head Office branch creation")
		return
	}

	log.Printf("Found %d owner(s) without Head Office branch\n", len(owners))

	// Process each owner
	for _, owner := range owners {
		if owner.TenantID == nil {
			log.Printf("⚠️  Skipping owner %s (ID: %d) - no tenant assigned", owner.Email, owner.ID)
			continue
		}

		// Check if tenant already has a branch
		var existingBranches []Branch
		if err := db.Where("tenant_id = ?", *owner.TenantID).Find(&existingBranches).Error; err != nil {
			log.Printf("❌ Error checking branches for owner %s: %v", owner.Email, err)
			continue
		}

		var headOffice *Branch

		if len(existingBranches) > 0 {
			// Use existing branch (set first one as Head Office if not already set)
			headOffice = &existingBranches[0]
			
			// Update it to be primary and rename to Head Office if needed
			updates := map[string]interface{}{
				"is_primary": true,
			}
			
			if headOffice.Name != "Head Office" {
				updates["name"] = "Head Office"
			}
			if headOffice.BranchCode == "" {
				updates["branch_code"] = "HQ"
			}

			if err := db.Model(headOffice).Updates(updates).Error; err != nil {
				log.Printf("❌ Failed to update branch for owner %s: %v", owner.Email, err)
				continue
			}

			log.Printf("✅ Updated existing branch '%s' to Head Office for %s", 
				existingBranches[0].Name, owner.Email)
		} else {
			// Create new Head Office branch
			headOffice = &Branch{
				TenantID:   *owner.TenantID,
				Name:       "Head Office",
				Location:   "",
				BranchCode: "HQ",
				IsPrimary:  true,
				Status:     "active",
			}

			if err := db.Create(headOffice).Error; err != nil {
				log.Printf("❌ Failed to create Head Office for owner %s: %v", owner.Email, err)
				continue
			}

			log.Printf("✅ Created new Head Office branch for %s", owner.Email)
		}

		// Assign the branch to the owner
		if err := db.Model(&owner).Update("primary_branch_id", headOffice.ID).Error; err != nil {
			log.Printf("❌ Failed to assign Head Office to owner %s: %v", owner.Email, err)
			continue
		}

		log.Printf("✅ Assigned Head Office (ID: %d) to owner %s (ID: %d)", 
			headOffice.ID, owner.Email, owner.ID)
	}

	log.Println("\n🎉 Migration complete!")
}
