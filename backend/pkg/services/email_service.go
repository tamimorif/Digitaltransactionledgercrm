package services

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/smtp"
	"os"
	"time"

	"github.com/resend/resend-go/v2"
)

// EmailService handles email sending operations
type EmailService struct {
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string
	FromEmail    string
	ResendAPIKey string
	Provider     string // "smtp", "resend", or "dev"
}

// NewEmailService creates a new email service instance
func NewEmailService() *EmailService {
	resendKey := getEnv("RESEND_API_KEY", "")
	smtpUsername := getEnv("SMTP_USERNAME", "")

	provider := "dev"
	if resendKey != "" {
		provider = "resend"
	} else if smtpUsername != "" {
		provider = "smtp"
	}

	return &EmailService{
		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUsername: smtpUsername,
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		FromEmail:    getEnv("FROM_EMAIL", "noreply@digitaltransactionledger.com"),
		ResendAPIKey: resendKey,
		Provider:     provider,
	}
}

// GenerateVerificationCode generates a 6-digit verification code
func GenerateVerificationCode() (string, error) {
	code := ""
	for i := 0; i < 6; i++ {
		num, err := rand.Int(rand.Reader, big.NewInt(10))
		if err != nil {
			return "", err
		}
		code += num.String()
	}
	return code, nil
}

// SendVerificationEmail sends a verification code to the user's email
func (es *EmailService) SendVerificationEmail(toEmail, code string) error {
	subject := "Email Verification Code - Digital Transaction Ledger"
	body := es.getVerificationEmailHTML(code)

	// Development mode: Just log the code
	if es.Provider == "dev" {
		log.Printf("📧 [DEV MODE] Verification code for %s: %s", toEmail, code)
		log.Printf("⚠️  Email provider not configured. Set RESEND_API_KEY or SMTP credentials.")
		return nil
	}

	// Send via configured provider
	if es.Provider == "resend" {
		return es.sendViaResend(toEmail, subject, body)
	}

	return es.sendViasmtp(toEmail, subject, body)
}

// getVerificationEmailHTML returns the HTML template for verification email
func (es *EmailService) getVerificationEmailHTML(code string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
        .code { font-size: 32px; font-weight: bold; color: #4F46E5; text-align: center; letter-spacing: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Email Verification</h1>
        </div>
        <div class="content">
            <p>Thank you for registering with Digital Transaction Ledger!</p>
            <p>Your verification code is:</p>
            <div class="code">%s</div>
            <p>This code will expire in <strong>10 minutes</strong>.</p>
            <p>If you didn't request this code, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>© %d Digital Transaction Ledger. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, code, time.Now().Year())
}

// sendViaResend sends email using Resend SDK
func (es *EmailService) sendViaResend(to, subject, body string) error {
	client := resend.NewClient(es.ResendAPIKey)

	params := &resend.SendEmailRequest{
		From:    es.FromEmail,
		To:      []string{to},
		Subject: subject,
		Html:    body,
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		log.Printf("Failed to send email via Resend to %s: %v", to, err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("✅ Email sent via Resend to %s (ID: %s)", to, sent.Id)
	return nil
}

// sendViasmtp sends an email using SMTP
func (es *EmailService) sendViasmtp(to, subject, body string) error {
	auth := smtp.PlainAuth("", es.SMTPUsername, es.SMTPPassword, es.SMTPHost)

	msg := []byte(fmt.Sprintf("From: %s\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-version: 1.0;\r\n"+
		"Content-Type: text/html; charset=\"UTF-8\";\r\n"+
		"\r\n"+
		"%s\r\n", es.FromEmail, to, subject, body))

	err := smtp.SendMail(
		es.SMTPHost+":"+es.SMTPPort,
		auth,
		es.FromEmail,
		[]string{to},
		msg,
	)

	if err != nil {
		log.Printf("Failed to send email to %s: %v", to, err)
		return fmt.Errorf("failed to send email: %w", err)
	}

	log.Printf("✅ Email sent via SMTP to %s", to)
	return nil
}

// SendPasswordResetCode sends a password reset code to the user's email
func (es *EmailService) SendPasswordResetCode(toEmail, code string) error {
	subject := "Password Reset Code - Digital Transaction Ledger"
	body := es.getPasswordResetEmailHTML(code)

	// Development mode: Just log the code
	if es.Provider == "dev" {
		log.Printf("📧 [DEV MODE] Password reset code for %s: %s", toEmail, code)
		log.Printf("⚠️  Email provider not configured. Set RESEND_API_KEY or SMTP credentials.")
		return nil
	}

	// Send via configured provider
	if es.Provider == "resend" {
		return es.sendViaResend(toEmail, subject, body)
	}

	return es.sendViasmtp(toEmail, subject, body)
}

// getPasswordResetEmailHTML returns the HTML template for password reset email
func (es *EmailService) getPasswordResetEmailHTML(code string) string {
	return fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
        .code { font-size: 32px; font-weight: bold; color: #4F46E5; text-align: center; letter-spacing: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
        .warning { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
            <p>You requested to reset your password.</p>
            <p>Use the verification code below to reset your password:</p>
            <div class="code">%s</div>
            <div class="warning">
                <strong>⚠️ Important:</strong>
                <ul style="margin: 10px 0; padding-left: 20px;">
                    <li>This code will expire in <strong>15 minutes</strong></li>
                    <li>Do not share this code with anyone</li>
                    <li>If you didn't request this, please ignore this email</li>
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>© %d Digital Transaction Ledger. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, code, time.Now().Year())
}

// SendPasswordResetEmail sends a password reset email (for future use)
func (es *EmailService) SendPasswordResetEmail(toEmail, resetToken string) error {
	subject := "Password Reset Request - Digital Transaction Ledger"
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", getEnv("FRONTEND_URL", "http://localhost:3000"), resetToken)

	// Development mode: Just log the token
	if es.Provider == "dev" {
		log.Printf("📧 [DEV MODE] Password reset token for %s: %s", toEmail, resetToken)
		log.Printf("Reset URL: %s", resetURL)
		return nil
	}

	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 5px; margin-top: 20px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Password Reset Request</h1>
        </div>
        <div class="content">
            <p>We received a request to reset your password.</p>
            <p>Click the button below to reset your password:</p>
            <a href="%s" class="button">Reset Password</a>
            <p>This link will expire in <strong>1 hour</strong>.</p>
            <p>If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
            <p>© %d Digital Transaction Ledger. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
	`, resetURL, time.Now().Year())

	// Send via configured provider
	if es.Provider == "resend" {
		return es.sendViaResend(toEmail, subject, body)
	}

	return es.sendViasmtp(toEmail, subject, body)
}

// getEnv gets environment variable with a default fallback
func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
