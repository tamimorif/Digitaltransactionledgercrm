package services

import (
	"crypto/rand"
	"fmt"
	"log"
	"math/big"
	"net/smtp"
	"os"
	"strings"
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
		log.Printf("📧 Email provider: Resend (API key configured)")
	} else if smtpUsername != "" {
		provider = "smtp"
		log.Printf("📧 Email provider: SMTP (%s)", smtpUsername)
	} else {
		log.Printf("⚠️  Email provider: DEV MODE (no RESEND_API_KEY or SMTP configured)")
	}

	fromEmail := getEnv("FROM_EMAIL", "noreply@digitaltransactionledger.com")
	log.Printf("📧 From email: %s", fromEmail)

	return &EmailService{
		SMTPHost:     getEnv("SMTP_HOST", "smtp.gmail.com"),
		SMTPPort:     getEnv("SMTP_PORT", "587"),
		SMTPUsername: smtpUsername,
		SMTPPassword: getEnv("SMTP_PASSWORD", ""),
		FromEmail:    fromEmail,
		ResendAPIKey: resendKey,
		Provider:     provider,
	}
}

// IsConfigured reports whether a real email provider is configured.
func (es *EmailService) IsConfigured() bool {
	return es.Provider != "dev"
}

// AllowDevEmail controls whether dev-mode email logging is allowed.
func (es *EmailService) AllowDevEmail() bool {
	return strings.EqualFold(getEnv("ALLOW_DEV_EMAIL", "false"), "true")
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
		if !es.AllowDevEmail() {
			return fmt.Errorf("email provider not configured; set RESEND_API_KEY or SMTP credentials")
		}
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
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb; }
        .logo { max-height: 50px; width: auto; font-size: 24px; font-weight: 800; color: #4F46E5; text-decoration: none; }
        .content { padding: 40px 30px; text-align: center; }
        .title { font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 16px; }
        .text { color: #4b5563; font-size: 16px; margin-bottom: 24px; }
        .code-container { margin: 32px 0; }
        .code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 700; color: #4F46E5; letter-spacing: 8px; background: #EEF2FF; padding: 16px 32px; border-radius: 8px; display: inline-block; border: 1px dashed #4F46E5; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
        .expiry { color: #ef4444; font-size: 14px; margin-top: 16px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <!-- Replace with actual logo URL when available -->
            <div class="logo">Velopay</div>
        </div>
        <div class="content">
            <h1 class="title">Verify your email</h1>
            <p class="text">Thank you for joining Velopay. Please use the verification code below to complete your registration:</p>
            
            <div class="code-container">
                <div class="code">%s</div>
            </div>
            
            <p class="expiry">This code will expire in 10 minutes.</p>
            <p class="text" style="font-size: 14px; margin-top: 32px;">If you didn't create an account, you can safely ignore this email.</p>
        </div>
        <div class="footer">
            <p>&copy; %d Velopay / Digital Transaction Ledger. All rights reserved.</p>
            <p>Secure. Fast. Reliable.</p>
        </div>
    </div>
</body>
</html>
	`, code, time.Now().Year())
}

// sendViaResend sends email using Resend SDK
func (es *EmailService) sendViaResend(to, subject, body string) error {
	client := resend.NewClient(es.ResendAPIKey)

	// Log the attempt
	log.Printf("📧 Attempting to send email via Resend to: %s, from: %s", to, es.FromEmail)

	params := &resend.SendEmailRequest{
		From:    es.FromEmail,
		To:      []string{to},
		Subject: subject,
		Html:    body,
	}

	sent, err := client.Emails.Send(params)
	if err != nil {
		log.Printf("❌ Failed to send email via Resend to %s: %v", to, err)
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
	subject := "Reset your password - Velopay"
	body := es.getPasswordResetEmailHTML(code)

	// Development mode: Just log the code
	if es.Provider == "dev" {
		if !es.AllowDevEmail() {
			return fmt.Errorf("email provider not configured; set RESEND_API_KEY or SMTP credentials")
		}
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
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f5; }
        .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); }
        .header { background-color: #ffffff; padding: 30px 20px; text-align: center; border-bottom: 1px solid #e5e7eb; }
        .logo { max-height: 50px; width: auto; font-size: 24px; font-weight: 800; color: #4F46E5; text-decoration: none; }
        .content { padding: 40px 30px; text-align: center; }
        .title { font-size: 24px; font-weight: bold; color: #111827; margin-bottom: 16px; }
        .text { color: #4b5563; font-size: 16px; margin-bottom: 24px; }
        .code-container { margin: 32px 0; }
        .code { font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 700; color: #4F46E5; letter-spacing: 8px; background: #EEF2FF; padding: 16px 32px; border-radius: 8px; display: inline-block; border: 1px dashed #4F46E5; }
        .warning { background-color: #fffbeb; border-radius: 6px; padding: 16px; margin: 24px 0; border: 1px solid #fcd34d; text-align: left; }
        .warning-title { color: #b45309; font-weight: bold; font-size: 14px; margin-bottom: 8px; display: block; }
        .footer { background-color: #f9fafb; padding: 24px; text-align: center; font-size: 13px; color: #6b7280; border-top: 1px solid #e5e7eb; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <!-- Replace with actual logo URL when available -->
            <div class="logo">Velopay</div>
        </div>
        <div class="content">
            <h1 class="title">Reset your password</h1>
            <p class="text">We received a request to reset your password. Enter the following code to proceed:</p>
            
            <div class="code-container">
                <div class="code">%s</div>
            </div>
            
            <div class="warning">
                <span class="warning-title">⚠️ Security Notice:</span>
                <ul style="margin: 0; padding-left: 20px; color: #92400e; font-size: 14px;">
                    <li>This code expires in 15 minutes.</li>
                    <li>Never share this code with anyone.</li>
                </ul>
            </div>
            
            <p class="text" style="font-size: 14px; margin-top: 32px;">If you didn't request a password reset, please ignore this message.</p>
        </div>
        <div class="footer">
            <p>&copy; %d Velopay / Digital Transaction Ledger. All rights reserved.</p>
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
		if !es.AllowDevEmail() {
			return fmt.Errorf("email provider not configured; set RESEND_API_KEY or SMTP credentials")
		}
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
