//go:build ignore
// +build ignore

package main

import (
	"fmt"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Branch struct {
	ID       uint `gorm:"primaryKey"`
	Name     string
	Status   string
	TenantID uint
}

func main() {
	// Open database
	db, err := gorm.Open(sqlite.Open("./transactions.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	// Update all branches to active status
	result := db.Model(&Branch{}).Where("status != ?", "active").Update("status", "active")
	if result.Error != nil {
		log.Fatal("Failed to update branches:", result.Error)
	}

	fmt.Printf("✅ Successfully activated %d branches\n", result.RowsAffected)

	// List all branches with their status
	var branches []Branch
	db.Find(&branches)

	fmt.Println("\nAll Branches:")
	fmt.Println("ID | Name | Status | Tenant ID")
	fmt.Println("---|------|--------|----------")
	for _, branch := range branches {
		fmt.Printf("%d | %s | %s | %d\n", branch.ID, branch.Name, branch.Status, branch.TenantID)
	}
}
