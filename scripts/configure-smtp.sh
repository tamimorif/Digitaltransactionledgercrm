#!/bin/bash

echo "📧 SMTP Setup for Email Verification"
echo "====================================="
echo ""
echo "Choose your email provider:"
echo "1) Gmail (recommended for testing)"
echo "2) Mailtrap (for testing only - emails won't actually send)"
echo "3) Custom SMTP server"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        echo ""
        echo "📧 Gmail SMTP Setup"
        echo "==================="
        echo ""
        echo "First, get your Gmail App Password:"
        echo "1. Go to: https://myaccount.google.com/apppasswords"
        echo "2. Enable 2-Step Verification (if not enabled)"
        echo "3. Create an App Password for 'Mail'"
        echo "4. Copy the 16-character password (remove spaces!)"
        echo ""
        read -p "Enter your Gmail address: " gmail_address
        echo ""
        read -p "Enter your Gmail App Password (16 chars, no spaces): " gmail_password
        echo ""
        
        cat > backend/.env << EOF
# Database Configuration
DATABASE_URL=./transactions.db

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=$(openssl rand -base64 32)

# SMTP Configuration - Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=$gmail_address
SMTP_PASSWORD=$gmail_password
FROM_EMAIL=$gmail_address

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Server Port (optional)
PORT=8080
EOF
        
        echo "✅ Gmail SMTP configured successfully!"
        echo ""
        echo "Your settings:"
        echo "  Email: $gmail_address"
        echo "  SMTP: smtp.gmail.com:587"
        echo ""
        ;;
        
    2)
        echo ""
        echo "📬 Mailtrap SMTP Setup"
        echo "======================"
        echo ""
        echo "1. Sign up at: https://mailtrap.io/"
        echo "2. Go to your inbox and copy SMTP credentials"
        echo ""
        read -p "Enter Mailtrap username: " mailtrap_user
        read -p "Enter Mailtrap password: " mailtrap_pass
        echo ""
        
        cat > backend/.env << EOF
# Database Configuration
DATABASE_URL=./transactions.db

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=$(openssl rand -base64 32)

# SMTP Configuration - Mailtrap (Testing)
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USERNAME=$mailtrap_user
SMTP_PASSWORD=$mailtrap_pass
FROM_EMAIL=noreply@digitaltransactionledger.com

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Server Port (optional)
PORT=8080
EOF
        
        echo "✅ Mailtrap configured successfully!"
        echo ""
        echo "📬 All emails will appear in your Mailtrap inbox"
        echo ""
        ;;
        
    3)
        echo ""
        echo "🔧 Custom SMTP Setup"
        echo "===================="
        echo ""
        read -p "SMTP Host (e.g., smtp.gmail.com): " smtp_host
        read -p "SMTP Port (e.g., 587): " smtp_port
        read -p "SMTP Username: " smtp_user
        read -p "SMTP Password: " smtp_pass
        read -p "From Email: " from_email
        echo ""
        
        cat > backend/.env << EOF
# Database Configuration
DATABASE_URL=./transactions.db

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=$(openssl rand -base64 32)

# SMTP Configuration - Custom
SMTP_HOST=$smtp_host
SMTP_PORT=$smtp_port
SMTP_USERNAME=$smtp_user
SMTP_PASSWORD=$smtp_pass
FROM_EMAIL=$from_email

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Server Port (optional)
PORT=8080
EOF
        
        echo "✅ Custom SMTP configured successfully!"
        echo ""
        ;;
        
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo "🔄 Next steps:"
echo "1. Restart your backend server (Ctrl+C and run again)"
echo "2. Register a new user"
echo "3. Check your email for the verification code!"
echo ""
echo "💡 Backend restart command:"
echo "   cd backend && go run cmd/server/main.go"
echo ""
