package api

import (
	"encoding/json"
	"log"
	"net/http"

	"api/pkg/middleware"
	"api/pkg/services"
)

var backupService *services.BackupService

// InitBackupService initializes the backup service
func InitBackupService() {
	backupService = services.NewBackupService()
}

// GetBackupService returns the backup service instance
func GetBackupService() *services.BackupService {
	if backupService == nil {
		InitBackupService()
	}
	return backupService
}

// CreateBackupHandler handles POST /api/admin/backup
// @Summary Create a database backup
// @Description Creates a backup of the database and uploads to configured cloud storage
// @Tags Admin
// @Produce json
// @Success 200 {object} services.BackupResult
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security BearerAuth
// @Router /api/admin/backup [post]
func CreateBackupHandler(w http.ResponseWriter, r *http.Request) {
	// Only superadmins and tenant owners can create backups
	claims, ok := middleware.GetClaimsFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Role != "superadmin" && claims.Role != "tenant_owner" {
		http.Error(w, "Forbidden: Only superadmins and tenant owners can create backups", http.StatusForbidden)
		return
	}

	bs := GetBackupService()
	result, err := bs.CreateBackup()
	if err != nil {
		log.Printf("❌ Backup failed: %v", err)
		http.Error(w, "Failed to create backup: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ListBackupsHandler handles GET /api/admin/backups
// @Summary List all backups
// @Description Lists all available backups from local storage and cloud
// @Tags Admin
// @Produce json
// @Success 200 {array} services.BackupResult
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security BearerAuth
// @Router /api/admin/backups [get]
func ListBackupsHandler(w http.ResponseWriter, r *http.Request) {
	// Only superadmins and tenant owners can list backups
	claims, ok := middleware.GetClaimsFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Role != "superadmin" && claims.Role != "tenant_owner" {
		http.Error(w, "Forbidden: Only superadmins and tenant owners can list backups", http.StatusForbidden)
		return
	}

	bs := GetBackupService()
	backups, err := bs.ListBackups()
	if err != nil {
		http.Error(w, "Failed to list backups: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(backups)
}

// CleanBackupsHandler handles POST /api/admin/backups/clean
// @Summary Clean old backups
// @Description Removes backups older than the retention period
// @Tags Admin
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security BearerAuth
// @Router /api/admin/backups/clean [post]
func CleanBackupsHandler(w http.ResponseWriter, r *http.Request) {
	// Only superadmins can clean backups
	claims, ok := middleware.GetClaimsFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Role != "superadmin" {
		http.Error(w, "Forbidden: Only superadmins can clean backups", http.StatusForbidden)
		return
	}

	bs := GetBackupService()
	deleted, err := bs.CleanOldBackups()
	if err != nil {
		http.Error(w, "Failed to clean backups: "+err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message":       "Old backups cleaned successfully",
		"deletedCount":  deleted,
		"retentionDays": bs.RetentionDays,
	})
}

// GetBackupStatusHandler handles GET /api/admin/backup/status
// @Summary Get backup service status
// @Description Returns the current backup service configuration and status
// @Tags Admin
// @Produce json
// @Success 200 {object} map[string]interface{}
// @Failure 401 {object} ErrorResponse
// @Failure 403 {object} ErrorResponse
// @Security BearerAuth
// @Router /api/admin/backup/status [get]
func GetBackupStatusHandler(w http.ResponseWriter, r *http.Request) {
	// Only superadmins and tenant owners can view backup status
	claims, ok := middleware.GetClaimsFromContext(r)
	if !ok {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if claims.Role != "superadmin" && claims.Role != "tenant_owner" {
		http.Error(w, "Forbidden: Only superadmins and tenant owners can view backup status", http.StatusForbidden)
		return
	}

	bs := GetBackupService()

	// Get latest backups count
	backups, _ := bs.ListBackups()

	status := map[string]interface{}{
		"enabled":       bs.Enabled,
		"provider":      bs.Provider,
		"retentionDays": bs.RetentionDays,
		"backupCount":   len(backups),
		"bucketName":    bs.BucketName,
	}

	// Add S3 status
	if bs.Provider == "s3" {
		status["cloudConfigured"] = true
	} else {
		status["cloudConfigured"] = false
		status["message"] = "Configure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and BACKUP_S3_BUCKET to enable cloud backups"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}
