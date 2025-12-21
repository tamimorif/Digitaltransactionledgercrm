package services

import (
	"api/pkg/models"
	"fmt"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestTicketWorkflow tests the complete ticket lifecycle
func TestTicketWorkflow(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate models
	db.AutoMigrate(
		&models.Tenant{},
		&models.User{},
		&models.Customer{},
		&models.Branch{},
		&models.Ticket{},
		&models.TicketMessage{},
		&models.TicketAttachment{},
		&models.TicketActivity{},
	)

	// Create test data
	tenant := &models.Tenant{Name: "Test Exchange Bureau"}
	db.Create(tenant)

	user := &models.User{
		Email:    "agent@example.com",
		TenantID: &tenant.ID,
		Role:     "tenant_user",
	}
	db.Create(user)

	supportUser := &models.User{
		Email:    "support@example.com",
		TenantID: &tenant.ID,
		Role:     "tenant_admin",
	}
	db.Create(supportUser)

	customer := &models.Customer{
		FullName: "John Doe",
		Phone:    "+14165551234",
	}
	db.Create(customer)

	// Initialize ticket service
	service := NewTicketService(db)

	fmt.Println("\n🧪 Testing Ticket Workflow")
	fmt.Println("=====================================")

	var ticketID uint

	t.Run("CreateTicket", func(t *testing.T) {
		ticket, err := service.CreateTicket(tenant.ID, user.ID, CreateTicketRequest{
			Subject:     "Transaction issue",
			Description: "Customer reported incorrect exchange rate applied to transaction #12345",
			Priority:    models.TicketPriorityHigh,
			Category:    models.TicketCategoryTransaction,
			CustomerID:  &customer.ID,
		})
		if err != nil {
			t.Fatalf("Failed to create ticket: %v", err)
		}

		ticketID = ticket.ID

		if ticket.TicketCode == "" {
			t.Error("Expected ticket code to be generated")
		}

		if ticket.Status != models.TicketStatusOpen {
			t.Errorf("Expected status OPEN, got %s", ticket.Status)
		}

		if ticket.Priority != models.TicketPriorityHigh {
			t.Errorf("Expected priority HIGH, got %s", ticket.Priority)
		}

		fmt.Printf("   ✅ Created ticket: %s\n", ticket.TicketCode)
		fmt.Printf("      Subject: %s\n", ticket.Subject)
		fmt.Printf("      Priority: %s\n", ticket.Priority)
	})

	t.Run("GetTicket", func(t *testing.T) {
		ticket, err := service.GetTicket(tenant.ID, ticketID)
		if err != nil {
			t.Fatalf("Failed to get ticket: %v", err)
		}

		if ticket.Subject != "Transaction issue" {
			t.Errorf("Unexpected subject: %s", ticket.Subject)
		}

		fmt.Printf("   ✅ Retrieved ticket #%d\n", ticketID)
	})

	t.Run("AssignTicket", func(t *testing.T) {
		err := service.AssignTicket(tenant.ID, ticketID, supportUser.ID, user.ID)
		if err != nil {
			t.Fatalf("Failed to assign ticket: %v", err)
		}

		ticket, _ := service.GetTicket(tenant.ID, ticketID)
		if ticket.AssignedToUserID == nil || *ticket.AssignedToUserID != supportUser.ID {
			t.Error("Ticket not assigned correctly")
		}

		// Should auto-change to In Progress
		if ticket.Status != models.TicketStatusInProgress {
			t.Errorf("Expected status IN_PROGRESS after assignment, got %s", ticket.Status)
		}

		fmt.Printf("   ✅ Ticket assigned to user %d\n", supportUser.ID)
		fmt.Printf("      Status changed to: %s\n", ticket.Status)
	})

	t.Run("AddMessage", func(t *testing.T) {
		message, err := service.AddMessage(tenant.ID, ticketID, supportUser.ID, "Looking into this issue now. Let me check the transaction details.", false)
		if err != nil {
			t.Fatalf("Failed to add message: %v", err)
		}

		if message.AuthorName != "support@example.com" {
			t.Errorf("Unexpected author name: %s", message.AuthorName)
		}

		fmt.Printf("   ✅ Added message from %s\n", message.AuthorName)
	})

	t.Run("AddInternalNote", func(t *testing.T) {
		message, err := service.AddMessage(tenant.ID, ticketID, supportUser.ID, "Customer was rude on the phone. Need to escalate if issue continues.", true)
		if err != nil {
			t.Fatalf("Failed to add internal note: %v", err)
		}

		if !message.IsInternal {
			t.Error("Expected message to be internal")
		}

		fmt.Printf("   ✅ Added internal note\n")
	})

	t.Run("GetMessages", func(t *testing.T) {
		// Get all messages including internal
		allMessages, err := service.GetMessages(tenant.ID, ticketID, true)
		if err != nil {
			t.Fatalf("Failed to get messages: %v", err)
		}

		if len(allMessages) != 2 {
			t.Errorf("Expected 2 messages, got %d", len(allMessages))
		}

		// Get only external messages
		externalMessages, err := service.GetMessages(tenant.ID, ticketID, false)
		if err != nil {
			t.Fatalf("Failed to get external messages: %v", err)
		}

		if len(externalMessages) != 1 {
			t.Errorf("Expected 1 external message, got %d", len(externalMessages))
		}

		fmt.Printf("   ✅ Retrieved %d total messages (%d internal filtered)\n", len(allMessages), len(allMessages)-len(externalMessages))
	})

	t.Run("UpdateStatus", func(t *testing.T) {
		err := service.UpdateTicketStatus(tenant.ID, ticketID, models.TicketStatusWaiting, supportUser.ID)
		if err != nil {
			t.Fatalf("Failed to update status: %v", err)
		}

		ticket, _ := service.GetTicket(tenant.ID, ticketID)
		if ticket.Status != models.TicketStatusWaiting {
			t.Errorf("Expected status WAITING_CUSTOMER, got %s", ticket.Status)
		}

		fmt.Printf("   ✅ Status updated to %s\n", ticket.Status)
	})

	t.Run("UpdatePriority", func(t *testing.T) {
		err := service.UpdateTicketPriority(tenant.ID, ticketID, models.TicketPriorityCritical, supportUser.ID)
		if err != nil {
			t.Fatalf("Failed to update priority: %v", err)
		}

		ticket, _ := service.GetTicket(tenant.ID, ticketID)
		if ticket.Priority != models.TicketPriorityCritical {
			t.Errorf("Expected priority CRITICAL, got %s", ticket.Priority)
		}

		fmt.Printf("   ✅ Priority updated to %s\n", ticket.Priority)
	})

	t.Run("ResolveTicket", func(t *testing.T) {
		err := service.ResolveTicket(tenant.ID, ticketID, "Applied correct exchange rate and refunded $5.00 to customer", supportUser.ID)
		if err != nil {
			t.Fatalf("Failed to resolve ticket: %v", err)
		}

		ticket, _ := service.GetTicket(tenant.ID, ticketID)
		if ticket.Status != models.TicketStatusResolved {
			t.Errorf("Expected status RESOLVED, got %s", ticket.Status)
		}

		if ticket.ResolvedAt == nil {
			t.Error("Expected resolved timestamp")
		}

		if ticket.Resolution == "" {
			t.Error("Expected resolution text")
		}

		fmt.Printf("   ✅ Ticket resolved\n")
		fmt.Printf("      Resolution: %s\n", ticket.Resolution)
	})

	t.Run("GetActivityLog", func(t *testing.T) {
		activities, err := service.GetTicketActivity(tenant.ID, ticketID, 50)
		if err != nil {
			t.Fatalf("Failed to get activity log: %v", err)
		}

		if len(activities) < 5 {
			t.Errorf("Expected at least 5 activities, got %d", len(activities))
		}

		fmt.Printf("   ✅ Activity log has %d entries\n", len(activities))
		for i, act := range activities {
			if i < 5 {
				fmt.Printf("      - %s: %s\n", act.Action, act.Description)
			}
		}
	})

	t.Run("ListTickets", func(t *testing.T) {
		// Create a few more tickets
		service.CreateTicket(tenant.ID, user.ID, CreateTicketRequest{
			Subject:  "Another issue",
			Priority: models.TicketPriorityLow,
			Category: models.TicketCategoryGeneral,
		})
		service.CreateTicket(tenant.ID, user.ID, CreateTicketRequest{
			Subject:  "Billing question",
			Priority: models.TicketPriorityMedium,
			Category: models.TicketCategoryBilling,
		})

		tickets, total, err := service.ListTickets(tenant.ID, TicketFilter{}, 1, 10)
		if err != nil {
			t.Fatalf("Failed to list tickets: %v", err)
		}

		if total < 3 {
			t.Errorf("Expected at least 3 tickets, got %d", total)
		}

		fmt.Printf("   ✅ Listed %d tickets (total: %d)\n", len(tickets), total)
	})

	t.Run("GetMyTickets", func(t *testing.T) {
		myTickets, err := service.GetMyTickets(tenant.ID, supportUser.ID, false)
		if err != nil {
			t.Fatalf("Failed to get my tickets: %v", err)
		}

		// Should include the resolved ticket
		if len(myTickets) < 1 {
			t.Error("Expected at least 1 assigned ticket")
		}

		fmt.Printf("   ✅ Found %d tickets assigned to support user\n", len(myTickets))
	})

	t.Run("GetTicketStats", func(t *testing.T) {
		stats, err := service.GetTicketStats(tenant.ID)
		if err != nil {
			t.Fatalf("Failed to get stats: %v", err)
		}

		if stats.ResolvedCount < 1 {
			t.Error("Expected at least 1 resolved ticket")
		}

		if stats.OpenCount < 2 {
			t.Errorf("Expected at least 2 open tickets, got %d", stats.OpenCount)
		}

		fmt.Printf("   ✅ Ticket Stats:\n")
		fmt.Printf("      Open: %d\n", stats.OpenCount)
		fmt.Printf("      In Progress: %d\n", stats.InProgressCount)
		fmt.Printf("      Resolved: %d\n", stats.ResolvedCount)
		fmt.Printf("      Critical: %d\n", stats.CriticalCount)
		fmt.Printf("      Unassigned: %d\n", stats.UnassignedCount)
	})

	t.Run("SearchTickets", func(t *testing.T) {
		results, err := service.SearchTickets(tenant.ID, "transaction", 10)
		if err != nil {
			t.Fatalf("Failed to search tickets: %v", err)
		}

		if len(results) != 1 {
			t.Errorf("Expected 1 search result, got %d", len(results))
		}

		fmt.Printf("   ✅ Search found %d matching tickets\n", len(results))
	})

	t.Run("CreateQuickTicket", func(t *testing.T) {
		ticket, err := service.CreateQuickTicket(tenant.ID, user.ID, "transaction", 12345, "Exchange rate was wrong")
		if err != nil {
			t.Fatalf("Failed to create quick ticket: %v", err)
		}

		if ticket.RelatedEntityType != "transaction" {
			t.Errorf("Expected entity type transaction, got %s", ticket.RelatedEntityType)
		}

		if ticket.RelatedEntityID != 12345 {
			t.Errorf("Expected entity ID 12345, got %d", ticket.RelatedEntityID)
		}

		fmt.Printf("   ✅ Created quick ticket for transaction #12345\n")
	})

	fmt.Println("\n✅ ALL TICKET TESTS PASSED!")
	fmt.Println("=====================================")
}
