package services

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

// VerificationProvider defines the interface for external KYC providers
type VerificationProvider interface {
	// CreateApplicant creates a new applicant in the provider's system
	CreateApplicant(request *CreateApplicantRequest) (*ApplicantResponse, error)
	// GetApplicantStatus retrieves the current verification status
	GetApplicantStatus(applicantID string) (*ApplicantStatusResponse, error)
	// GenerateAccessToken generates a token for the frontend SDK
	GenerateAccessToken(applicantID string, levelName string) (*AccessTokenResponse, error)
	// GetDocumentImage retrieves a document image
	GetDocumentImage(applicantID, docType string) ([]byte, error)
	// PerformAMLCheck performs an AML/sanctions screening
	PerformAMLCheck(applicantID string) (*AMLCheckResponse, error)
}

// CreateApplicantRequest represents a request to create an applicant
type CreateApplicantRequest struct {
	ExternalUserID string            `json:"externalUserId"`
	Email          string            `json:"email,omitempty"`
	Phone          string            `json:"phone,omitempty"`
	FirstName      string            `json:"firstName,omitempty"`
	LastName       string            `json:"lastName,omitempty"`
	DateOfBirth    string            `json:"dob,omitempty"`     // YYYY-MM-DD
	Country        string            `json:"country,omitempty"` // ISO 3166-1 alpha-3
	Metadata       map[string]string `json:"metadata,omitempty"`
}

// ApplicantResponse represents the provider's applicant response
type ApplicantResponse struct {
	ID             string    `json:"id"`
	ExternalUserID string    `json:"externalUserId"`
	CreatedAt      time.Time `json:"createdAt"`
	Email          string    `json:"email"`
	Phone          string    `json:"phone"`
	ReviewStatus   string    `json:"reviewStatus"` // init, pending, completed
}

// ApplicantStatusResponse represents status check response
type ApplicantStatusResponse struct {
	ApplicantID   string    `json:"applicantId"`
	ReviewStatus  string    `json:"reviewStatus"` // init, pending, completed
	ReviewResult  string    `json:"reviewResult"` // GREEN, RED, ERROR
	ReviewAnswer  string    `json:"reviewAnswer"` // GREEN (approved), RED (rejected)
	RejectLabels  []string  `json:"rejectLabels"` // Reason codes for rejection
	ModeratedAt   time.Time `json:"moderatedAt"`
	IDDocStatus   string    `json:"idDocStatus"` // APPROVED, REJECTED, PENDING
	SelfieStatus  string    `json:"selfieStatus"`
	AddressStatus string    `json:"addressStatus"`
	RiskScore     int       `json:"riskScore"` // 0-100
}

// AccessTokenResponse represents the SDK access token
type AccessTokenResponse struct {
	Token     string    `json:"token"`
	UserID    string    `json:"userId"`
	ExpiresAt time.Time `json:"expiresAt"`
}

// AMLCheckResponse represents AML screening results
type AMLCheckResponse struct {
	ApplicantID    string           `json:"applicantId"`
	ScreeningID    string           `json:"screeningId"`
	Status         string           `json:"status"` // CLEAR, MATCH, PENDING
	PEPMatch       bool             `json:"pepMatch"`
	SanctionsMatch bool             `json:"sanctionsMatch"`
	AdverseMedia   bool             `json:"adverseMedia"`
	Matches        []AMLMatchResult `json:"matches"`
	ScreenedAt     time.Time        `json:"screenedAt"`
}

// AMLMatchResult represents individual match in AML screening
type AMLMatchResult struct {
	MatchType   string  `json:"matchType"`  // PEP, SANCTIONS, ADVERSE_MEDIA
	MatchScore  float64 `json:"matchScore"` // 0-1
	MatchName   string  `json:"matchName"`
	ListName    string  `json:"listName"`
	Description string  `json:"description"`
}

// SumsubProvider implements Sumsub integration
type SumsubProvider struct {
	AppToken  string
	SecretKey string
	BaseURL   string
	Client    *http.Client
}

// NewSumsubProvider creates a new Sumsub provider
func NewSumsubProvider() *SumsubProvider {
	baseURL := os.Getenv("SUMSUB_BASE_URL")
	if baseURL == "" {
		baseURL = "https://api.sumsub.com"
	}

	return &SumsubProvider{
		AppToken:  os.Getenv("SUMSUB_APP_TOKEN"),
		SecretKey: os.Getenv("SUMSUB_SECRET_KEY"),
		BaseURL:   baseURL,
		Client:    &http.Client{Timeout: 30 * time.Second},
	}
}

// IsConfigured returns true if the provider credentials are set
func (s *SumsubProvider) IsConfigured() bool {
	return s.AppToken != "" && s.SecretKey != ""
}

// CreateApplicant creates a new applicant in Sumsub
func (s *SumsubProvider) CreateApplicant(request *CreateApplicantRequest) (*ApplicantResponse, error) {
	endpoint := "/resources/applicants?levelName=basic-kyc-level"

	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	resp, err := s.makeRequest("POST", endpoint, body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("sumsub API error: %s - %s", resp.Status, string(bodyBytes))
	}

	var result ApplicantResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetApplicantStatus retrieves applicant verification status
func (s *SumsubProvider) GetApplicantStatus(applicantID string) (*ApplicantStatusResponse, error) {
	endpoint := fmt.Sprintf("/resources/applicants/%s/status", applicantID)

	resp, err := s.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("sumsub API error: %s - %s", resp.Status, string(bodyBytes))
	}

	var result ApplicantStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GenerateAccessToken generates SDK access token for frontend
func (s *SumsubProvider) GenerateAccessToken(applicantID string, levelName string) (*AccessTokenResponse, error) {
	endpoint := fmt.Sprintf("/resources/accessTokens?userId=%s&levelName=%s", applicantID, levelName)

	resp, err := s.makeRequest("POST", endpoint, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("sumsub API error: %s - %s", resp.Status, string(bodyBytes))
	}

	var result AccessTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// GetDocumentImage retrieves a document image
func (s *SumsubProvider) GetDocumentImage(applicantID, docType string) ([]byte, error) {
	endpoint := fmt.Sprintf("/resources/applicants/%s/info/idDoc/%s", applicantID, docType)

	resp, err := s.makeRequest("GET", endpoint, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("sumsub API error: %s - %s", resp.Status, string(bodyBytes))
	}

	return io.ReadAll(resp.Body)
}

// PerformAMLCheck performs AML screening
func (s *SumsubProvider) PerformAMLCheck(applicantID string) (*AMLCheckResponse, error) {
	endpoint := fmt.Sprintf("/resources/applicants/%s/amlCheck", applicantID)

	resp, err := s.makeRequest("POST", endpoint, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("sumsub API error: %s - %s", resp.Status, string(bodyBytes))
	}

	var result AMLCheckResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	return &result, nil
}

// makeRequest makes an authenticated request to Sumsub API
func (s *SumsubProvider) makeRequest(method, endpoint string, body []byte) (*http.Response, error) {
	url := s.BaseURL + endpoint
	ts := fmt.Sprintf("%d", time.Now().Unix())

	var req *http.Request
	var err error

	if body != nil {
		req, err = http.NewRequest(method, url, bytes.NewReader(body))
	} else {
		req, err = http.NewRequest(method, url, nil)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Generate signature
	signature := s.generateSignature(ts, method, endpoint, body)

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-App-Token", s.AppToken)
	req.Header.Set("X-App-Access-Ts", ts)
	req.Header.Set("X-App-Access-Sig", signature)

	return s.Client.Do(req)
}

// generateSignature generates HMAC signature for Sumsub API
func (s *SumsubProvider) generateSignature(ts, method, endpoint string, body []byte) string {
	data := ts + method + endpoint
	if body != nil {
		data += string(body)
	}

	h := hmac.New(sha256.New, []byte(s.SecretKey))
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// MockVerificationProvider is a mock provider for testing
type MockVerificationProvider struct {
	Applicants map[string]*ApplicantResponse
	Statuses   map[string]*ApplicantStatusResponse
}

// NewMockVerificationProvider creates a mock provider
func NewMockVerificationProvider() *MockVerificationProvider {
	return &MockVerificationProvider{
		Applicants: make(map[string]*ApplicantResponse),
		Statuses:   make(map[string]*ApplicantStatusResponse),
	}
}

// CreateApplicant creates a mock applicant
func (m *MockVerificationProvider) CreateApplicant(request *CreateApplicantRequest) (*ApplicantResponse, error) {
	id := fmt.Sprintf("mock-%s", request.ExternalUserID)
	resp := &ApplicantResponse{
		ID:             id,
		ExternalUserID: request.ExternalUserID,
		CreatedAt:      time.Now(),
		Email:          request.Email,
		Phone:          request.Phone,
		ReviewStatus:   "init",
	}
	m.Applicants[id] = resp
	m.Statuses[id] = &ApplicantStatusResponse{
		ApplicantID:  id,
		ReviewStatus: "init",
	}
	return resp, nil
}

// GetApplicantStatus returns mock status
func (m *MockVerificationProvider) GetApplicantStatus(applicantID string) (*ApplicantStatusResponse, error) {
	status, ok := m.Statuses[applicantID]
	if !ok {
		return nil, fmt.Errorf("applicant not found: %s", applicantID)
	}
	return status, nil
}

// GenerateAccessToken returns mock token
func (m *MockVerificationProvider) GenerateAccessToken(applicantID string, levelName string) (*AccessTokenResponse, error) {
	return &AccessTokenResponse{
		Token:     fmt.Sprintf("mock-token-%s", applicantID),
		UserID:    applicantID,
		ExpiresAt: time.Now().Add(1 * time.Hour),
	}, nil
}

// GetDocumentImage returns empty bytes for mock
func (m *MockVerificationProvider) GetDocumentImage(applicantID, docType string) ([]byte, error) {
	return []byte{}, nil
}

// PerformAMLCheck returns mock AML check
func (m *MockVerificationProvider) PerformAMLCheck(applicantID string) (*AMLCheckResponse, error) {
	return &AMLCheckResponse{
		ApplicantID:    applicantID,
		ScreeningID:    fmt.Sprintf("mock-screening-%s", applicantID),
		Status:         "CLEAR",
		PEPMatch:       false,
		SanctionsMatch: false,
		AdverseMedia:   false,
		Matches:        []AMLMatchResult{},
		ScreenedAt:     time.Now(),
	}, nil
}

// SetMockStatus allows tests to set a mock status
func (m *MockVerificationProvider) SetMockStatus(applicantID string, status *ApplicantStatusResponse) {
	m.Statuses[applicantID] = status
}
