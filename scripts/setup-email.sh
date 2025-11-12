#!/bin/bash

# Email Testing Script
# This script helps you test email verification

echo "🔧 Email Verification Testing Tool"
echo "===================================="
echo ""

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
    echo "⚠️  No .env file found in backend/"
    echo ""
    echo "Choose your setup method:"
    echo "1) Development Mode (codes in terminal logs) - NO SETUP NEEDED"
    echo "2) Gmail Setup (real emails)"
    echo "3) Mailtrap Setup (testing emails)"
    echo ""
    read -p "Enter your choice (1-3): " choice
    
    case $choice in
        1)
            echo ""
            echo "✅ You're already in Development Mode!"
            echo ""
            echo "How to use:"
            echo "1. Start your backend: cd backend && go run cmd/server/main.go"
            echo "2. Register a new user"
            echo "3. Check your backend terminal for this message:"
            echo "   📧 [DEV MODE] Verification code for your@email.com: 123456"
            echo "4. Copy the 6-digit code and verify your email"
            echo ""
            ;;
        2)
            echo ""
            echo "📧 Gmail Setup Instructions:"
            echo ""
            echo "Step 1: Get Gmail App Password"
            echo "  1. Go to: https://myaccount.google.com/security"
            echo "  2. Enable 2-Step Verification (if not enabled)"
            echo "  3. Go to 'App passwords'"
            echo "  4. Generate a new app password for 'Mail'"
            echo "  5. Copy the 16-character password"
            echo ""
            read -p "Enter your Gmail address: " gmail_address
            read -p "Enter your 16-char app password (no spaces): " gmail_password
            
            cat > backend/.env << EOF
# Database
DATABASE_URL=./transactions.db

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# SMTP Configuration - Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=$gmail_address
SMTP_PASSWORD=$gmail_password
FROM_EMAIL=$gmail_address

# Frontend URL
FRONTEND_URL=http://localhost:3000
EOF
            
            echo ""
            echo "✅ .env file created successfully!"
            echo "🔄 Restart your backend server to apply changes"
            ;;
        3)
            echo ""
            echo "📬 Mailtrap Setup Instructions:"
            echo ""
            echo "1. Sign up at: https://mailtrap.io/"
            echo "2. Go to your inbox and get SMTP credentials"
            echo ""
            read -p "Enter Mailtrap username: " mailtrap_user
            read -p "Enter Mailtrap password: " mailtrap_pass
            
            cat > backend/.env << EOF
# Database
DATABASE_URL=./transactions.db

# JWT Secret
JWT_SECRET=$(openssl rand -base64 32)

# SMTP Configuration - Mailtrap (Testing)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USERNAME=$mailtrap_user
SMTP_PASSWORD=$mailtrap_pass
FROM_EMAIL=noreply@digitaltransactionledger.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
EOF
            
            echo ""
            echo "✅ .env file created successfully!"
            echo "📬 All emails will appear in your Mailtrap inbox"
            echo "🔄 Restart your backend server to apply changes"
            ;;
        *)
            echo "Invalid choice"
            exit 1
            ;;
    esac
else
    echo "✅ .env file already exists"
    echo ""
    echo "Current SMTP settings:"
    grep "SMTP_" backend/.env | sed 's/SMTP_PASSWORD=.*/SMTP_PASSWORD=***hidden***/'
    echo ""
fi

echo ""
echo "📝 Testing Instructions:"
echo "1. Start backend: cd backend && go run cmd/server/main.go"
echo "2. Register a new user on http://localhost:3000/register"
echo "3. Check for verification code:"
echo "   - Development Mode: Check backend terminal logs"
echo "   - Gmail: Check your email inbox (and spam folder)"
echo "   - Mailtrap: Check your Mailtrap inbox"
echo ""
echo "For detailed setup: See backend/EMAIL_SETUP.md"
echo ""
