package api

import (
	"api/pkg/services"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/gorilla/mux"
	"gorm.io/gorm"
)

// ReceiptHandler handles receipt template API endpoints
type ReceiptHandler struct {
	receiptService *services.ReceiptService
	db             *gorm.DB
}

// NewReceiptHandler creates a new receipt handler
func NewReceiptHandler(db *gorm.DB) *ReceiptHandler {
	return &ReceiptHandler{
		receiptService: services.NewReceiptService(db),
		db:             db,
	}
}

// CreateTemplateHandler creates a new receipt template
// @Summary Create receipt template
// @Tags Receipts
// @Accept json
// @Produce json
// @Success 201 {object} models.ReceiptTemplate
// @Router /receipts/templates [post]
func (h *ReceiptHandler) CreateTemplateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)

	var req services.CreateTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	template, err := h.receiptService.CreateTemplate(tenantID, userID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(template)
}

// GetTemplateHandler retrieves a template by ID
// @Summary Get receipt template
// @Tags Receipts
// @Produce json
// @Param id path int true "Template ID"
// @Success 200 {object} models.ReceiptTemplate
// @Router /receipts/templates/{id} [get]
func (h *ReceiptHandler) GetTemplateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	templateID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid template ID", http.StatusBadRequest)
		return
	}

	template, err := h.receiptService.GetTemplate(tenantID, uint(templateID))
	if err != nil {
		http.Error(w, "Template not found", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(template)
}

// ListTemplatesHandler lists all templates
// @Summary List receipt templates
// @Tags Receipts
// @Produce json
// @Success 200 {array} models.ReceiptTemplate
// @Router /receipts/templates [get]
func (h *ReceiptHandler) ListTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	includeInactive := r.URL.Query().Get("includeInactive") == "true"

	templates, err := h.receiptService.ListTemplates(tenantID, includeInactive)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(templates)
}

// UpdateTemplateHandler updates a template
// @Summary Update receipt template
// @Tags Receipts
// @Accept json
// @Produce json
// @Router /receipts/templates/{id} [put]
func (h *ReceiptHandler) UpdateTemplateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)
	vars := mux.Vars(r)
	templateID, _ := strconv.ParseUint(vars["id"], 10, 32)

	var req services.CreateTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	template, err := h.receiptService.UpdateTemplate(tenantID, uint(templateID), userID, req)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(template)
}

// DeleteTemplateHandler deletes a template
// @Summary Delete receipt template
// @Tags Receipts
// @Router /receipts/templates/{id} [delete]
func (h *ReceiptHandler) DeleteTemplateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	templateID, _ := strconv.ParseUint(vars["id"], 10, 32)

	err := h.receiptService.DeleteTemplate(tenantID, uint(templateID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// SetDefaultHandler sets a template as default
// @Summary Set template as default
// @Tags Receipts
// @Router /receipts/templates/{id}/default [put]
func (h *ReceiptHandler) SetDefaultHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	templateID, _ := strconv.ParseUint(vars["id"], 10, 32)

	err := h.receiptService.SetDefaultTemplate(tenantID, uint(templateID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "Template set as default"})
}

// DuplicateTemplateHandler duplicates a template
// @Summary Duplicate template
// @Tags Receipts
// @Accept json
// @Produce json
// @Router /receipts/templates/{id}/duplicate [post]
func (h *ReceiptHandler) DuplicateTemplateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)
	vars := mux.Vars(r)
	templateID, _ := strconv.ParseUint(vars["id"], 10, 32)

	var req struct {
		Name string `json:"name"`
	}
	json.NewDecoder(r.Body).Decode(&req)

	template, err := h.receiptService.DuplicateTemplate(tenantID, uint(templateID), userID, req.Name)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(template)
}

// PreviewTemplateHandler generates a preview of a template
// @Summary Preview template with sample data
// @Tags Receipts
// @Produce html
// @Router /receipts/templates/{id}/preview [get]
func (h *ReceiptHandler) PreviewTemplateHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	templateID, _ := strconv.ParseUint(vars["id"], 10, 32)

	html, err := h.receiptService.PreviewReceipt(tenantID, uint(templateID))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

// GetVariablesHandler returns available template variables
// @Summary Get available template variables
// @Tags Receipts
// @Produce json
// @Router /receipts/variables [get]
func (h *ReceiptHandler) GetVariablesHandler(w http.ResponseWriter, r *http.Request) {
	templateType := r.URL.Query().Get("type")
	if templateType == "" {
		templateType = "transaction"
	}

	variables := h.receiptService.GetAvailableVariables(templateType)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(variables)
}

// RenderReceiptHandler renders a receipt with provided data
// @Summary Render receipt with data
// @Tags Receipts
// @Accept json
// @Produce html
// @Router /receipts/render [post]
func (h *ReceiptHandler) RenderReceiptHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)

	var req struct {
		TemplateID   *uint                  `json:"templateId"`
		TemplateType string                 `json:"templateType"`
		Data         map[string]interface{} `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	var html string
	var err error

	if req.TemplateID != nil {
		template, err := h.receiptService.GetTemplate(tenantID, *req.TemplateID)
		if err != nil {
			http.Error(w, "Template not found", http.StatusNotFound)
			return
		}
		html = h.receiptService.RenderWithTemplate(template, req.Data)
	} else {
		templateType := req.TemplateType
		if templateType == "" {
			templateType = "transaction"
		}
		html, err = h.receiptService.RenderReceipt(tenantID, templateType, req.Data)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

// CreateDefaultTemplatesHandler creates default templates for a tenant
// @Summary Create default templates
// @Tags Receipts
// @Router /receipts/templates/defaults [post]
func (h *ReceiptHandler) CreateDefaultTemplatesHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	userID := r.Context().Value("userID").(uint)

	err := h.receiptService.CreateDefaultTemplates(tenantID, userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Default templates created"})
}

// GetOutgoingRemittanceReceiptHandler generates a receipt for an outgoing remittance
// @Summary Get outgoing remittance receipt
// @Tags Receipts
// @Produce html
// @Router /receipts/outgoing/{id} [get]
func (h *ReceiptHandler) GetOutgoingRemittanceReceiptHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	remittanceID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid remittance ID", http.StatusBadRequest)
		return
	}

	// Get remittance data from database
	var remittance struct {
		ID           uint    `json:"id"`
		SenderName   string  `json:"senderName"`
		SenderPhone  string  `json:"senderPhone"`
		ReceiverName string  `json:"receiverName"`
		Amount       float64 `json:"amount"`
		Currency     string  `json:"currency"`
		Status       string  `json:"status"`
	}
	if err := h.db.Table("outgoing_remittances").Where("id = ? AND tenant_id = ?", remittanceID, tenantID).First(&remittance).Error; err != nil {
		http.Error(w, "Remittance not found", http.StatusNotFound)
		return
	}

	// Build data map
	data := map[string]interface{}{
		"transaction.id":     remittance.ID,
		"customer.name":      remittance.SenderName,
		"customer.phone":     remittance.SenderPhone,
		"beneficiary.name":   remittance.ReceiverName,
		"send.amount":        remittance.Amount,
		"send.currency":      remittance.Currency,
		"transaction.status": remittance.Status,
	}

	html, err := h.receiptService.RenderReceipt(tenantID, "remittance", data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

// GetIncomingRemittanceReceiptHandler generates a receipt for an incoming remittance
// @Summary Get incoming remittance receipt
// @Tags Receipts
// @Produce html
// @Router /receipts/incoming/{id} [get]
func (h *ReceiptHandler) GetIncomingRemittanceReceiptHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	remittanceID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid remittance ID", http.StatusBadRequest)
		return
	}

	var remittance struct {
		ID           uint    `json:"id"`
		SenderName   string  `json:"senderName"`
		ReceiverName string  `json:"receiverName"`
		Amount       float64 `json:"amount"`
		Currency     string  `json:"currency"`
		Status       string  `json:"status"`
	}
	if err := h.db.Table("incoming_remittances").Where("id = ? AND tenant_id = ?", remittanceID, tenantID).First(&remittance).Error; err != nil {
		http.Error(w, "Remittance not found", http.StatusNotFound)
		return
	}

	data := map[string]interface{}{
		"transaction.id":     remittance.ID,
		"beneficiary.name":   remittance.SenderName,
		"customer.name":      remittance.ReceiverName,
		"receive.amount":     remittance.Amount,
		"receive.currency":   remittance.Currency,
		"transaction.status": remittance.Status,
	}

	html, err := h.receiptService.RenderReceipt(tenantID, "remittance", data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

// GetTransactionReceiptHandler generates a receipt for a transaction
// @Summary Get transaction receipt
// @Tags Receipts
// @Produce html
// @Router /receipts/transaction/{id} [get]
func (h *ReceiptHandler) GetTransactionReceiptHandler(w http.ResponseWriter, r *http.Request) {
	tenantID := r.Context().Value("tenantID").(uint)
	vars := mux.Vars(r)
	transactionID, err := strconv.ParseUint(vars["id"], 10, 32)
	if err != nil {
		http.Error(w, "Invalid transaction ID", http.StatusBadRequest)
		return
	}

	var transaction struct {
		ID              uint    `json:"id"`
		TransactionType string  `json:"transactionType"`
		SendCurrency    string  `json:"sendCurrency"`
		ReceiveCurrency string  `json:"receiveCurrency"`
		SendAmount      float64 `json:"sendAmount"`
		ReceiveAmount   float64 `json:"receiveAmount"`
		ExchangeRate    float64 `json:"exchangeRate"`
		Status          string  `json:"status"`
	}
	if err := h.db.Table("transactions").Where("id = ? AND tenant_id = ?", transactionID, tenantID).First(&transaction).Error; err != nil {
		http.Error(w, "Transaction not found", http.StatusNotFound)
		return
	}

	data := map[string]interface{}{
		"transaction.id":     transaction.ID,
		"transaction.type":   transaction.TransactionType,
		"send.currency":      transaction.SendCurrency,
		"receive.currency":   transaction.ReceiveCurrency,
		"send.amount":        transaction.SendAmount,
		"receive.amount":     transaction.ReceiveAmount,
		"exchange.rate":      transaction.ExchangeRate,
		"transaction.status": transaction.Status,
	}

	html, err := h.receiptService.RenderReceipt(tenantID, "transaction", data)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}
