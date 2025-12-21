package models

import (
	"time"

	"gorm.io/gorm"
)

// TicketStatus represents the lifecycle state of a ticket
type TicketStatus string

const (
	TicketStatusOpen       TicketStatus = "OPEN"
	TicketStatusInProgress TicketStatus = "IN_PROGRESS"
	TicketStatusWaiting    TicketStatus = "WAITING_CUSTOMER"
	TicketStatusResolved   TicketStatus = "RESOLVED"
	TicketStatusClosed     TicketStatus = "CLOSED"
)

// TicketPriority represents urgency level
type TicketPriority string

const (
	TicketPriorityLow      TicketPriority = "LOW"
	TicketPriorityMedium   TicketPriority = "MEDIUM"
	TicketPriorityHigh     TicketPriority = "HIGH"
	TicketPriorityCritical TicketPriority = "CRITICAL"
)

// TicketCategory represents the type of issue
type TicketCategory string

const (
	TicketCategoryGeneral       TicketCategory = "GENERAL"
	TicketCategoryTransaction   TicketCategory = "TRANSACTION"
	TicketCategoryRemittance    TicketCategory = "REMITTANCE"
	TicketCategoryCompliance    TicketCategory = "COMPLIANCE"
	TicketCategoryTechnical     TicketCategory = "TECHNICAL"
	TicketCategoryBilling       TicketCategory = "BILLING"
	TicketCategoryAccountAccess TicketCategory = "ACCOUNT_ACCESS"
)

// Ticket represents a support ticket in the system
type Ticket struct {
	ID         uint           `gorm:"primaryKey;autoIncrement" json:"id"`
	TenantID   uint           `gorm:"type:bigint;not null;index" json:"tenantId"`
	TicketCode string         `gorm:"type:varchar(20);not null;uniqueIndex" json:"ticketCode"` // e.g., "TKT-20231220-0001"
	Subject    string         `gorm:"type:varchar(255);not null" json:"subject"`
	Status     TicketStatus   `gorm:"type:varchar(20);not null;default:'OPEN';index" json:"status"`
	Priority   TicketPriority `gorm:"type:varchar(10);not null;default:'MEDIUM'" json:"priority"`
	Category   TicketCategory `gorm:"type:varchar(20);not null;default:'GENERAL'" json:"category"`

	// Creator - can be a user (employee) or linked to a customer
	CreatedByUserID *uint `gorm:"type:bigint;index" json:"createdByUserId"`
	CustomerID      *uint `gorm:"type:bigint;index" json:"customerId"` // If ticket is about/from a customer

	// Assignment
	AssignedToUserID *uint `gorm:"type:bigint;index" json:"assignedToUserId"`

	// Related Entity - for context linking
	RelatedEntityType string `gorm:"type:varchar(50)" json:"relatedEntityType"` // "transaction", "remittance", "pickup"
	RelatedEntityID   uint   `gorm:"type:bigint" json:"relatedEntityId"`

	// Branch context
	BranchID *uint `gorm:"type:bigint;index" json:"branchId"`

	// Ticket content
	Description string `gorm:"type:text;not null" json:"description"`

	// Metadata
	Tags          string `gorm:"type:varchar(500)" json:"tags"`  // Comma-separated tags
	InternalNotes string `gorm:"type:text" json:"internalNotes"` // Not visible to customers

	// Resolution
	Resolution       string     `gorm:"type:text" json:"resolution"`
	ResolvedAt       *time.Time `gorm:"type:timestamp" json:"resolvedAt"`
	ResolvedByUserID *uint      `gorm:"type:bigint" json:"resolvedByUserId"`

	// SLA Tracking
	FirstResponseAt *time.Time `gorm:"type:timestamp" json:"firstResponseAt"`
	DueAt           *time.Time `gorm:"type:timestamp" json:"dueAt"`
	BreachedSLA     bool       `gorm:"type:boolean;default:false" json:"breachedSla"`

	// Timestamps
	CreatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	ClosedAt  *time.Time     `gorm:"type:timestamp" json:"closedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`

	// Relations
	Tenant         *Tenant            `gorm:"foreignKey:TenantID;constraint:OnDelete:CASCADE" json:"tenant,omitempty"`
	CreatedByUser  *User              `gorm:"foreignKey:CreatedByUserID;constraint:OnDelete:SET NULL" json:"createdByUser,omitempty"`
	AssignedToUser *User              `gorm:"foreignKey:AssignedToUserID;constraint:OnDelete:SET NULL" json:"assignedToUser,omitempty"`
	Customer       *Customer          `gorm:"foreignKey:CustomerID;constraint:OnDelete:SET NULL" json:"customer,omitempty"`
	Branch         *Branch            `gorm:"foreignKey:BranchID;constraint:OnDelete:SET NULL" json:"branch,omitempty"`
	Messages       []TicketMessage    `gorm:"foreignKey:TicketID" json:"messages,omitempty"`
	Attachments    []TicketAttachment `gorm:"foreignKey:TicketID" json:"attachments,omitempty"`
}

func (Ticket) TableName() string {
	return "tickets"
}

// TicketMessage represents a message/reply in a ticket thread
type TicketMessage struct {
	ID       uint `gorm:"primaryKey;autoIncrement" json:"id"`
	TicketID uint `gorm:"type:bigint;not null;index" json:"ticketId"`
	TenantID uint `gorm:"type:bigint;not null;index" json:"tenantId"`

	// Author
	AuthorUserID *uint  `gorm:"type:bigint" json:"authorUserId"`
	AuthorName   string `gorm:"type:varchar(100)" json:"authorName"`          // For display if user deleted
	IsInternal   bool   `gorm:"type:boolean;default:false" json:"isInternal"` // Internal notes not visible to customer

	// Content
	Content     string `gorm:"type:text;not null" json:"content"`
	ContentType string `gorm:"type:varchar(20);default:'text'" json:"contentType"` // text, html

	// System messages
	IsSystemMessage bool   `gorm:"type:boolean;default:false" json:"isSystemMessage"`
	SystemAction    string `gorm:"type:varchar(50)" json:"systemAction"` // status_change, assignment, etc.

	// Read tracking
	ReadAt       *time.Time `gorm:"type:timestamp" json:"readAt"`
	ReadByUserID *uint      `gorm:"type:bigint" json:"readByUserId"`

	// Timestamps
	CreatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`
	UpdatedAt time.Time      `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"updatedAt"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deletedAt,omitempty"`

	// Relations
	Ticket     *Ticket `gorm:"foreignKey:TicketID;constraint:OnDelete:CASCADE" json:"ticket,omitempty"`
	AuthorUser *User   `gorm:"foreignKey:AuthorUserID;constraint:OnDelete:SET NULL" json:"authorUser,omitempty"`
}

func (TicketMessage) TableName() string {
	return "ticket_messages"
}

// TicketAttachment represents a file attached to a ticket
type TicketAttachment struct {
	ID              uint  `gorm:"primaryKey;autoIncrement" json:"id"`
	TicketID        uint  `gorm:"type:bigint;not null;index" json:"ticketId"`
	TicketMessageID *uint `gorm:"type:bigint;index" json:"ticketMessageId"` // If attached to specific message
	TenantID        uint  `gorm:"type:bigint;not null;index" json:"tenantId"`

	FileName         string `gorm:"type:varchar(255);not null" json:"fileName"`
	OriginalFileName string `gorm:"type:varchar(255);not null" json:"originalFileName"`
	FilePath         string `gorm:"type:text;not null" json:"filePath"`
	FileSize         int64  `gorm:"type:bigint" json:"fileSize"`
	MimeType         string `gorm:"type:varchar(100)" json:"mimeType"`

	UploadedByUserID *uint     `gorm:"type:bigint" json:"uploadedByUserId"`
	CreatedAt        time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`

	// Relations
	Ticket        *Ticket        `gorm:"foreignKey:TicketID;constraint:OnDelete:CASCADE" json:"ticket,omitempty"`
	TicketMessage *TicketMessage `gorm:"foreignKey:TicketMessageID;constraint:OnDelete:SET NULL" json:"ticketMessage,omitempty"`
}

func (TicketAttachment) TableName() string {
	return "ticket_attachments"
}

// TicketActivity tracks all changes to a ticket for audit
type TicketActivity struct {
	ID       uint `gorm:"primaryKey;autoIncrement" json:"id"`
	TicketID uint `gorm:"type:bigint;not null;index" json:"ticketId"`
	TenantID uint `gorm:"type:bigint;not null;index" json:"tenantId"`

	Action      string `gorm:"type:varchar(50);not null" json:"action"` // created, status_changed, assigned, comment_added, etc.
	Field       string `gorm:"type:varchar(50)" json:"field"`           // Which field changed
	OldValue    string `gorm:"type:text" json:"oldValue"`
	NewValue    string `gorm:"type:text" json:"newValue"`
	Description string `gorm:"type:text" json:"description"`

	PerformedByUserID *uint     `gorm:"type:bigint" json:"performedByUserId"`
	IsSystemAction    bool      `gorm:"type:boolean;default:false" json:"isSystemAction"`
	CreatedAt         time.Time `gorm:"type:timestamp;default:CURRENT_TIMESTAMP" json:"createdAt"`

	// Relations
	Ticket          *Ticket `gorm:"foreignKey:TicketID;constraint:OnDelete:CASCADE" json:"ticket,omitempty"`
	PerformedByUser *User   `gorm:"foreignKey:PerformedByUserID;constraint:OnDelete:SET NULL" json:"performedByUser,omitempty"`
}

func (TicketActivity) TableName() string {
	return "ticket_activities"
}
