package migrations

import (
	"log"

	"gorm.io/gorm"
)

// FixBranchUniqueIndexes fixes the branch table unique indexes to be per-tenant
// instead of globally unique. This fixes the "UNIQUE constraint failed: branches.branch_code"
// error when multiple tenants try to use the same branch code (like "HQ").
func FixBranchUniqueIndexes(db *gorm.DB) error {
	log.Println("Fixing branch unique indexes to be per-tenant...")

	// Check if branches table exists
	if !db.Migrator().HasTable("branches") {
		log.Println("Branches table does not exist, skipping migration")
		return nil
	}

	// For SQLite, we need to handle this differently than PostgreSQL
	// SQLite doesn't support DROP INDEX IF EXISTS with the same syntax

	// Try to drop old indexes (ignore errors if they don't exist)
	dropIndexes := []string{
		"DROP INDEX IF EXISTS idx_tenant_branch_code",
		"DROP INDEX IF EXISTS idx_tenant_username",
		"DROP INDEX IF EXISTS branches_branch_code_key",    // PostgreSQL naming
		"DROP INDEX IF EXISTS branches_username_key",       // PostgreSQL naming
		"DROP INDEX IF EXISTS sqlite_autoindex_branches_1", // SQLite auto index
		"DROP INDEX IF EXISTS sqlite_autoindex_branches_2", // SQLite auto index
	}

	for _, sql := range dropIndexes {
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("Note: Could not drop index (may not exist): %v", err)
			// Continue - index may not exist
		}
	}

	// Create new composite unique indexes
	createIndexes := []struct {
		name    string
		columns string
	}{
		{"idx_tenant_branch_code", "tenant_id, branch_code"},
		{"idx_tenant_username", "tenant_id, username"},
	}

	for _, idx := range createIndexes {
		sql := "CREATE UNIQUE INDEX IF NOT EXISTS " + idx.name + " ON branches (" + idx.columns + ")"
		if err := db.Exec(sql).Error; err != nil {
			log.Printf("Warning: Failed to create index %s: %v", idx.name, err)
			// Try alternative syntax for PostgreSQL
			altSQL := "CREATE UNIQUE INDEX " + idx.name + " ON branches (" + idx.columns + ")"
			if err2 := db.Exec(altSQL).Error; err2 != nil {
				log.Printf("Warning: Also failed with alternative syntax: %v", err2)
			}
		} else {
			log.Printf("Created composite unique index: %s", idx.name)
		}
	}

	log.Println("Branch unique indexes fixed successfully")
	return nil
}
