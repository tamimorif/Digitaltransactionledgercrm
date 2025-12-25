package services

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
)

// BackupService handles database backups to cloud storage
type BackupService struct {
	S3Client      *s3.Client
	BucketName    string
	DatabasePath  string
	BackupDir     string
	RetentionDays int
	Enabled       bool
	Provider      string // "s3", "local", or "disabled"
}

// BackupConfig holds the configuration for backup service
type BackupConfig struct {
	// AWS S3 Configuration
	AWSRegion          string
	AWSAccessKeyID     string
	AWSSecretAccessKey string
	S3BucketName       string

	// Database path
	DatabasePath string

	// Local backup directory (fallback)
	BackupDir string

	// How many days to keep backups
	RetentionDays int
}

// NewBackupService creates a new backup service
func NewBackupService() *BackupService {
	cfg := BackupConfig{
		AWSRegion:          getEnv("AWS_REGION", "us-east-1"),
		AWSAccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", ""),
		AWSSecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", ""),
		S3BucketName:       getEnv("BACKUP_S3_BUCKET", ""),
		DatabasePath:       getEnv("DATABASE_PATH", "./transactions.db"),
		BackupDir:          getEnv("BACKUP_DIR", "./backups"),
		RetentionDays:      30,
	}

	service := &BackupService{
		BucketName:    cfg.S3BucketName,
		DatabasePath:  cfg.DatabasePath,
		BackupDir:     cfg.BackupDir,
		RetentionDays: cfg.RetentionDays,
	}

	// Determine provider based on configuration
	if cfg.AWSAccessKeyID != "" && cfg.AWSSecretAccessKey != "" && cfg.S3BucketName != "" {
		// Configure S3 client
		awsCfg, err := config.LoadDefaultConfig(context.Background(),
			config.WithRegion(cfg.AWSRegion),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AWSAccessKeyID,
				cfg.AWSSecretAccessKey,
				"",
			)),
		)
		if err != nil {
			log.Printf("⚠️  Failed to configure AWS: %v. Using local backups.", err)
			service.Provider = "local"
			service.Enabled = true
		} else {
			service.S3Client = s3.NewFromConfig(awsCfg)
			service.Provider = "s3"
			service.Enabled = true
			log.Printf("☁️  Backup service configured with S3 (bucket: %s)", cfg.S3BucketName)
		}
	} else {
		service.Provider = "local"
		service.Enabled = true
		log.Printf("💾 Backup service configured with local storage (dir: %s)", cfg.BackupDir)
	}

	// Create local backup directory if it doesn't exist
	if err := os.MkdirAll(cfg.BackupDir, 0755); err != nil {
		log.Printf("⚠️  Failed to create backup directory: %v", err)
	}

	return service
}

// BackupResult contains information about a backup
type BackupResult struct {
	Filename  string    `json:"filename"`
	Size      int64     `json:"size"`
	Provider  string    `json:"provider"`
	Location  string    `json:"location"`
	CreatedAt time.Time `json:"createdAt"`
	Success   bool      `json:"success"`
	Error     string    `json:"error,omitempty"`
}

// CreateBackup creates a backup of the database
func (bs *BackupService) CreateBackup() (*BackupResult, error) {
	if !bs.Enabled {
		return nil, fmt.Errorf("backup service is disabled")
	}

	timestamp := time.Now().Format("2006-01-02_15-04-05")
	backupFilename := fmt.Sprintf("velopay_backup_%s.zip", timestamp)
	localPath := filepath.Join(bs.BackupDir, backupFilename)

	result := &BackupResult{
		Filename:  backupFilename,
		Provider:  bs.Provider,
		CreatedAt: time.Now(),
	}

	// Create a zip archive containing the database
	if err := bs.createZipBackup(localPath); err != nil {
		result.Success = false
		result.Error = err.Error()
		return result, err
	}

	// Get file size
	fileInfo, err := os.Stat(localPath)
	if err == nil {
		result.Size = fileInfo.Size()
	}

	// Upload to S3 if configured
	if bs.Provider == "s3" {
		s3Key := fmt.Sprintf("backups/%s", backupFilename)
		if err := bs.uploadToS3(localPath, s3Key); err != nil {
			log.Printf("⚠️  Failed to upload to S3: %v. Keeping local backup.", err)
			result.Provider = "local"
			result.Location = localPath
		} else {
			result.Location = fmt.Sprintf("s3://%s/%s", bs.BucketName, s3Key)
			// Optionally delete local file after successful upload
			// os.Remove(localPath)
		}
	} else {
		result.Location = localPath
	}

	result.Success = true
	log.Printf("✅ Backup created: %s (%d bytes)", result.Location, result.Size)

	return result, nil
}

// createZipBackup creates a zip archive of the database
func (bs *BackupService) createZipBackup(destPath string) error {
	// Check if database file exists
	if _, err := os.Stat(bs.DatabasePath); os.IsNotExist(err) {
		return fmt.Errorf("database file not found: %s", bs.DatabasePath)
	}

	// Create zip file
	zipFile, err := os.Create(destPath)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	// Open database file
	dbFile, err := os.Open(bs.DatabasePath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer dbFile.Close()

	// Get file info
	dbInfo, err := dbFile.Stat()
	if err != nil {
		return fmt.Errorf("failed to stat database: %w", err)
	}

	// Create zip entry
	header, err := zip.FileInfoHeader(dbInfo)
	if err != nil {
		return fmt.Errorf("failed to create zip header: %w", err)
	}
	header.Name = "transactions.db"
	header.Method = zip.Deflate

	writer, err := zipWriter.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("failed to create zip entry: %w", err)
	}

	// Copy database to zip
	if _, err := io.Copy(writer, dbFile); err != nil {
		return fmt.Errorf("failed to write to zip: %w", err)
	}

	// Add metadata file
	metaWriter, err := zipWriter.Create("backup_info.txt")
	if err == nil {
		metadata := fmt.Sprintf("Backup created: %s\nDatabase: %s\nSize: %d bytes\n",
			time.Now().Format(time.RFC3339),
			bs.DatabasePath,
			dbInfo.Size(),
		)
		metaWriter.Write([]byte(metadata))
	}

	return nil
}

// uploadToS3 uploads a file to S3
func (bs *BackupService) uploadToS3(localPath, s3Key string) error {
	if bs.S3Client == nil {
		return fmt.Errorf("S3 client not configured")
	}

	file, err := os.Open(localPath)
	if err != nil {
		return fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	_, err = bs.S3Client.PutObject(context.Background(), &s3.PutObjectInput{
		Bucket: aws.String(bs.BucketName),
		Key:    aws.String(s3Key),
		Body:   file,
	})
	if err != nil {
		return fmt.Errorf("failed to upload to S3: %w", err)
	}

	return nil
}

// ListBackups lists all available backups
func (bs *BackupService) ListBackups() ([]BackupResult, error) {
	var backups []BackupResult

	// List local backups
	files, err := os.ReadDir(bs.BackupDir)
	if err != nil {
		if os.IsNotExist(err) {
			return backups, nil
		}
		return nil, err
	}

	for _, file := range files {
		if !file.IsDir() && filepath.Ext(file.Name()) == ".zip" {
			info, err := file.Info()
			if err != nil {
				continue
			}
			backups = append(backups, BackupResult{
				Filename:  file.Name(),
				Size:      info.Size(),
				Provider:  "local",
				Location:  filepath.Join(bs.BackupDir, file.Name()),
				CreatedAt: info.ModTime(),
				Success:   true,
			})
		}
	}

	// List S3 backups if configured
	if bs.S3Client != nil {
		s3Backups, err := bs.listS3Backups()
		if err != nil {
			log.Printf("⚠️  Failed to list S3 backups: %v", err)
		} else {
			backups = append(backups, s3Backups...)
		}
	}

	return backups, nil
}

// listS3Backups lists backups from S3
func (bs *BackupService) listS3Backups() ([]BackupResult, error) {
	var backups []BackupResult

	result, err := bs.S3Client.ListObjectsV2(context.Background(), &s3.ListObjectsV2Input{
		Bucket: aws.String(bs.BucketName),
		Prefix: aws.String("backups/"),
	})
	if err != nil {
		return nil, err
	}

	for _, obj := range result.Contents {
		backups = append(backups, BackupResult{
			Filename:  filepath.Base(*obj.Key),
			Size:      *obj.Size,
			Provider:  "s3",
			Location:  fmt.Sprintf("s3://%s/%s", bs.BucketName, *obj.Key),
			CreatedAt: *obj.LastModified,
			Success:   true,
		})
	}

	return backups, nil
}

// CleanOldBackups removes backups older than retention period
func (bs *BackupService) CleanOldBackups() (int, error) {
	cutoff := time.Now().AddDate(0, 0, -bs.RetentionDays)
	deleted := 0

	// Clean local backups
	files, err := os.ReadDir(bs.BackupDir)
	if err != nil {
		return deleted, err
	}

	for _, file := range files {
		if file.IsDir() {
			continue
		}
		info, err := file.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			path := filepath.Join(bs.BackupDir, file.Name())
			if err := os.Remove(path); err == nil {
				deleted++
				log.Printf("🗑️  Deleted old backup: %s", file.Name())
			}
		}
	}

	// Clean S3 backups if configured
	if bs.S3Client != nil {
		s3Deleted, err := bs.cleanS3Backups(cutoff)
		if err != nil {
			log.Printf("⚠️  Failed to clean S3 backups: %v", err)
		} else {
			deleted += s3Deleted
		}
	}

	return deleted, nil
}

// cleanS3Backups removes old backups from S3
func (bs *BackupService) cleanS3Backups(cutoff time.Time) (int, error) {
	deleted := 0

	result, err := bs.S3Client.ListObjectsV2(context.Background(), &s3.ListObjectsV2Input{
		Bucket: aws.String(bs.BucketName),
		Prefix: aws.String("backups/"),
	})
	if err != nil {
		return deleted, err
	}

	for _, obj := range result.Contents {
		if obj.LastModified.Before(cutoff) {
			_, err := bs.S3Client.DeleteObject(context.Background(), &s3.DeleteObjectInput{
				Bucket: aws.String(bs.BucketName),
				Key:    obj.Key,
			})
			if err == nil {
				deleted++
				log.Printf("🗑️  Deleted old S3 backup: %s", *obj.Key)
			}
		}
	}

	return deleted, nil
}

// ScheduleBackups starts automatic backup scheduling
func (bs *BackupService) ScheduleBackups(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		log.Printf("⏰ Backup scheduler started (every %v)", interval)

		for range ticker.C {
			result, err := bs.CreateBackup()
			if err != nil {
				log.Printf("❌ Scheduled backup failed: %v", err)
			} else {
				log.Printf("✅ Scheduled backup completed: %s", result.Filename)
			}

			// Auto-cleanup disabled - keeping all backups for data protection
			// To manually clean old backups, use the /api/admin/backups/clean endpoint
		}
	}()
}
