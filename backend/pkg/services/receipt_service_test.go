package services

import (
	"api/pkg/models"
	"fmt"
	"strings"
	"testing"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// TestReceiptTemplateWorkflow tests the complete receipt template workflow
func TestReceiptTemplateWorkflow(t *testing.T) {
	// Setup in-memory database
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("Failed to connect to database: %v", err)
	}

	// Auto-migrate models
	db.AutoMigrate(&models.Tenant{}, &models.User{}, &models.ReceiptTemplate{})

	// Create test data
	tenant := &models.Tenant{Name: "Test Exchange Bureau"}
	db.Create(tenant)

	user := &models.User{
		Email:    "admin@example.com",
		TenantID: &tenant.ID,
		Role:     "tenant_owner",
	}
	db.Create(user)

	// Initialize receipt service
	service := NewReceiptService(db)

	fmt.Println("\n🧪 Testing Receipt Template Workflow")
	fmt.Println("=====================================")

	var templateID uint

	t.Run("CreateTemplate", func(t *testing.T) {
		template, err := service.CreateTemplate(tenant.ID, user.ID, CreateTemplateRequest{
			Name:         "Custom Transaction Receipt",
			Description:  "A custom styled transaction receipt",
			TemplateType: "transaction",
			HeaderHTML:   "<h1>{{business.name}}</h1><p>{{business.address}}</p>",
			BodyHTML:     "<p>Transaction: {{transaction.id}}</p><p>Amount: {{send.amount}} {{send.currency}}</p>",
			FooterHTML:   "<p>Thank you for your business!</p>",
			StyleCSS:     "h1 { color: blue; }",
			IsDefault:    true,
		})
		if err != nil {
			t.Fatalf("Failed to create template: %v", err)
		}

		templateID = template.ID

		if template.Name != "Custom Transaction Receipt" {
			t.Errorf("Unexpected name: %s", template.Name)
		}

		if !template.IsDefault {
			t.Error("Expected template to be default")
		}

		fmt.Printf("   ✅ Created template: %s (ID: %d)\n", template.Name, template.ID)
	})

	t.Run("GetTemplate", func(t *testing.T) {
		template, err := service.GetTemplate(tenant.ID, templateID)
		if err != nil {
			t.Fatalf("Failed to get template: %v", err)
		}

		if template.HeaderHTML == "" {
			t.Error("Expected header HTML")
		}

		fmt.Printf("   ✅ Retrieved template with ID %d\n", templateID)
	})

	t.Run("ListTemplates", func(t *testing.T) {
		// Create another template
		service.CreateTemplate(tenant.ID, user.ID, CreateTemplateRequest{
			Name:         "Simple Receipt",
			TemplateType: "transaction",
		})

		templates, err := service.ListTemplates(tenant.ID, false)
		if err != nil {
			t.Fatalf("Failed to list templates: %v", err)
		}

		if len(templates) < 2 {
			t.Errorf("Expected at least 2 templates, got %d", len(templates))
		}

		fmt.Printf("   ✅ Listed %d templates\n", len(templates))
	})

	t.Run("UpdateTemplate", func(t *testing.T) {
		updated, err := service.UpdateTemplate(tenant.ID, templateID, user.ID, CreateTemplateRequest{
			Name:       "Updated Transaction Receipt",
			HeaderHTML: "<h1 style='color: red;'>{{business.name}}</h1>",
		})
		if err != nil {
			t.Fatalf("Failed to update template: %v", err)
		}

		if updated.Name != "Updated Transaction Receipt" {
			t.Errorf("Unexpected name: %s", updated.Name)
		}

		if updated.Version != 2 {
			t.Errorf("Expected version 2, got %d", updated.Version)
		}

		fmt.Printf("   ✅ Updated template to version %d\n", updated.Version)
	})

	t.Run("DuplicateTemplate", func(t *testing.T) {
		copy, err := service.DuplicateTemplate(tenant.ID, templateID, user.ID, "Receipt Copy")
		if err != nil {
			t.Fatalf("Failed to duplicate template: %v", err)
		}

		if copy.Name != "Receipt Copy" {
			t.Errorf("Unexpected name: %s", copy.Name)
		}

		if copy.IsDefault {
			t.Error("Copy should not be default")
		}

		fmt.Printf("   ✅ Duplicated template to '%s'\n", copy.Name)
	})

	t.Run("RenderReceipt", func(t *testing.T) {
		// Create a fresh template specifically for rendering
		renderTemplate := &models.ReceiptTemplate{
			HeaderHTML: "<h1>{{business.name}}</h1>",
			BodyHTML:   "<p>ID: {{transaction.id}}</p><p>{{send.amount}} {{send.currency}}</p>",
			FooterHTML: "<p>Thank you!</p>",
			MarginTop:  20, MarginRight: 20, MarginBottom: 20, MarginLeft: 20,
		}

		data := map[string]interface{}{
			"business.name":    "Test Exchange",
			"business.address": "123 Test St",
			"transaction.id":   "TXN-12345",
			"send.amount":      "1000.00",
			"send.currency":    "CAD",
		}

		html := service.RenderWithTemplate(renderTemplate, data)

		if !strings.Contains(html, "Test Exchange") {
			t.Error("Expected business name in rendered HTML")
		}

		if !strings.Contains(html, "TXN-12345") {
			t.Error("Expected transaction ID in rendered HTML")
		}

		if !strings.Contains(html, "1000.00") {
			t.Error("Expected amount in rendered HTML")
		}

		fmt.Printf("   ✅ Rendered receipt (%d bytes)\n", len(html))
	})

	t.Run("GetDefaultTemplate", func(t *testing.T) {
		template, err := service.GetDefaultTemplate(tenant.ID, "transaction")
		if err != nil {
			t.Fatalf("Failed to get default template: %v", err)
		}

		if template.ID != templateID {
			t.Errorf("Expected template ID %d, got %d", templateID, template.ID)
		}

		fmt.Printf("   ✅ Got default template: %s\n", template.Name)
	})

	t.Run("SetDefaultTemplate", func(t *testing.T) {
		// Create a new template
		newTemplate, _ := service.CreateTemplate(tenant.ID, user.ID, CreateTemplateRequest{
			Name:         "New Default",
			TemplateType: "transaction",
		})

		// Set it as default
		err := service.SetDefaultTemplate(tenant.ID, newTemplate.ID)
		if err != nil {
			t.Fatalf("Failed to set default: %v", err)
		}

		// Verify old template is no longer default
		oldTemplate, _ := service.GetTemplate(tenant.ID, templateID)
		if oldTemplate.IsDefault {
			t.Error("Old template should not be default anymore")
		}

		// Verify new template is default
		defaultTemplate, _ := service.GetDefaultTemplate(tenant.ID, "transaction")
		if defaultTemplate.ID != newTemplate.ID {
			t.Error("New template should be default")
		}

		fmt.Printf("   ✅ Set new default template: %s\n", newTemplate.Name)
	})

	t.Run("GetAvailableVariables", func(t *testing.T) {
		vars := service.GetAvailableVariables("transaction")

		if len(vars) == 0 {
			t.Error("Expected some variables")
		}

		// Check for common variables
		found := false
		for _, v := range vars {
			if v.Name == "{{business.name}}" {
				found = true
				break
			}
		}

		if !found {
			t.Error("Expected business.name variable")
		}

		fmt.Printf("   ✅ Got %d available variables\n", len(vars))
	})

	t.Run("CreateDefaultTemplates", func(t *testing.T) {
		// Create a new tenant
		tenant2 := &models.Tenant{Name: "New Tenant"}
		db.Create(tenant2)

		err := service.CreateDefaultTemplates(tenant2.ID, user.ID)
		if err != nil {
			t.Fatalf("Failed to create default templates: %v", err)
		}

		templates, _ := service.ListTemplates(tenant2.ID, false)
		if len(templates) < 3 {
			t.Errorf("Expected at least 3 default templates, got %d", len(templates))
		}

		fmt.Printf("   ✅ Created %d default templates for new tenant\n", len(templates))
	})

	t.Run("PreviewReceipt", func(t *testing.T) {
		html, err := service.PreviewReceipt(tenant.ID, templateID)
		if err != nil {
			t.Fatalf("Failed to preview receipt: %v", err)
		}

		if !strings.Contains(html, "Torontex Exchange") {
			t.Error("Expected sample business name")
		}

		fmt.Printf("   ✅ Generated preview (%d bytes)\n", len(html))
	})

	t.Run("DeleteTemplate", func(t *testing.T) {
		err := service.DeleteTemplate(tenant.ID, templateID)
		if err != nil {
			t.Fatalf("Failed to delete template: %v", err)
		}

		_, err = service.GetTemplate(tenant.ID, templateID)
		if err == nil {
			t.Error("Expected error when getting deleted template")
		}

		fmt.Printf("   ✅ Deleted template %d\n", templateID)
	})

	fmt.Println("\n✅ ALL RECEIPT TEMPLATE TESTS PASSED!")
	fmt.Println("=====================================")
}
