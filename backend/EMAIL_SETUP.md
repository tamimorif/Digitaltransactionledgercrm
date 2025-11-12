# Email Configuration Guide

## Problem
When users register, they don't receive verification emails because SMTP is not configured.

## Quick Fix (Development)
**The verification code is printed in your backend terminal logs!**

When a user registers, check your backend server terminal. You'll see:
```
📧 [DEV MODE] Verification code for user@example.com: 123456
⚠️  SMTP not configured. Email not sent. Set SMTP_USERNAME and SMTP_PASSWORD env vars.
```

Just copy the 6-digit code and use it for verification.

---

## Production Solution: Configure Email Sending

### Option 1: Gmail (Recommended for Testing)

#### Step 1: Get Gmail App Password
1. Go to your Google Account: https://myaccount.google.com/
2. Navigate to **Security** → **2-Step Verification** (enable if not already)
3. Scroll to **App passwords** → Click on it
4. Select **App**: Mail, **Device**: Other (custom name)
5. Click **Generate**
6. Copy the 16-character password (e.g., `abcd efgh ijkl mnop`)

#### Step 2: Create `.env` File
In the `backend/` directory, create a file named `.env`:

```bash
# Database
DATABASE_URL=./database.db

# JWT Secret (change this in production!)
JWT_SECRET=your-super-secret-jwt-key-change-this

# SMTP Configuration - Gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=youremail@gmail.com
SMTP_PASSWORD=abcdefghijklmnop  # The 16-char app password (no spaces)
FROM_EMAIL=youremail@gmail.com

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

Replace:
- `youremail@gmail.com` with your actual Gmail address
- `abcdefghijklmnop` with the app password you generated

#### Step 3: Load Environment Variables
Update `backend/cmd/server/main.go` to load the `.env` file.

Install godotenv:
```bash
cd backend
go get github.com/joho/godotenv
```

#### Step 4: Restart Backend
```bash
cd backend
go run cmd/server/main.go
```

Now emails will be sent automatically!

---

### Option 2: SendGrid (Recommended for Production)

SendGrid offers 100 free emails/day.

1. Sign up at https://sendgrid.com/
2. Create an API key
3. Update your `.env`:
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USERNAME=apikey
SMTP_PASSWORD=your-sendgrid-api-key
FROM_EMAIL=noreply@yourdomain.com
```

---

### Option 3: Mailtrap (Best for Testing)

Mailtrap catches emails without sending them (perfect for development).

1. Sign up at https://mailtrap.io/
2. Get your SMTP credentials from the inbox
3. Update your `.env`:
```bash
SMTP_HOST=sandbox.smtp.mailtrap.io
SMTP_PORT=2525
SMTP_USERNAME=your-mailtrap-username
SMTP_PASSWORD=your-mailtrap-password
FROM_EMAIL=noreply@digitaltransactionledger.com
```

All emails will appear in Mailtrap's inbox (won't actually send to users).

---

### Option 4: AWS SES (Production Scale)

For production with high volume:
1. Set up AWS SES
2. Verify your domain/email
3. Get SMTP credentials
4. Update `.env` with AWS SES settings

---

## Testing

After configuration:
1. Restart your backend server
2. Register a new user
3. Check:
   - Your email inbox (for real SMTP)
   - Mailtrap inbox (if using Mailtrap)
   - Backend logs (should say "✅ Email sent successfully")

---

## Troubleshooting

### "Failed to send email" error:
- Check your SMTP credentials are correct
- Ensure 2FA is enabled for Gmail
- Verify the app password has no spaces
- Check firewall/network allows port 587

### Still not receiving emails:
- Check spam/junk folder
- Verify FROM_EMAIL is correct
- Look at backend logs for specific error messages
- Try sending a test email using an SMTP testing tool

### Gmail "Less secure app" error:
- Don't use your regular Gmail password
- Must use App Password (see Step 1 above)
- Ensure 2-Step Verification is enabled

---

## Current Implementation

The email service (`backend/pkg/services/email_service.go`) already supports:
- ✅ Email verification codes
- ✅ HTML email templates
- ✅ Development mode (logs codes to console)
- ✅ Production mode (sends real emails when SMTP configured)

The system automatically falls back to development mode (logging codes) when SMTP is not configured, so your app won't break.
