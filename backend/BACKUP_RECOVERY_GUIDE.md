# 🔐 Velopay Backup & Recovery Guide

## Where Are Your Backups Stored?

### Option 1: Local Backups (Default)
- **Location**: `./backups/` folder in the backend directory
- **Format**: ZIP files named `velopay_backup_YYYY-MM-DD_HH-MM-SS.zip`
- **Contains**: Your SQLite database (`transactions.db`) + metadata

### Option 2: AWS S3 Cloud Backups (Recommended for Production)
- **Location**: Your configured S3 bucket under `backups/` prefix
- **Same format**: ZIP files with timestamps

---

## 🚨 CRITICAL: Off-Site Backup Setup

**Your local backups are on the same server as your website.** If a hacker compromises your server, they can delete these too!

### Recommended: Set Up AWS S3 Cloud Backups

1. **Create an AWS Account** at https://aws.amazon.com

2. **Create an S3 Bucket**:
   - Go to S3 Console → Create Bucket
   - Name it something like `velopay-backups-yourname`
   - Enable versioning (protects against deletion)
   - Block all public access

3. **Create an IAM User for Backups**:
   - Go to IAM → Users → Create User
   - Name: `velopay-backup-user`
   - Attach policy: `AmazonS3FullAccess` (or create a custom policy for just your bucket)
   - Create access keys

4. **Configure Your .env File**:
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=AKIA...your-key...
   AWS_SECRET_ACCESS_KEY=your-secret-key
   BACKUP_S3_BUCKET=velopay-backups-yourname
   ```

5. **Restart your server** - Backups will now go to S3!

---

## 📥 How to Download Your Backups

### From Local Server:
```bash
# List backups
ls -la ./backups/

# Copy to your computer via SCP (from your local machine)
scp user@yourserver:/path/to/backend/backups/*.zip ~/Desktop/
```

### From AWS S3:
```bash
# Using AWS CLI
aws s3 ls s3://your-bucket-name/backups/

# Download all backups
aws s3 sync s3://your-bucket-name/backups/ ~/Desktop/velopay-backups/

# Download specific backup
aws s3 cp s3://your-bucket-name/backups/velopay_backup_2025-12-24_22-43-37.zip ~/Desktop/
```

### From AWS Console (Web Browser):
1. Go to https://s3.console.aws.amazon.com
2. Navigate to your bucket → backups folder
3. Select the backup file → Click "Download"

---

## 🔄 How to Restore from Backup

### Step 1: Get Your Backup File
Download the most recent backup ZIP file to your computer or new server.

### Step 2: Extract the Database
```bash
# Unzip the backup
unzip velopay_backup_2025-12-24_22-43-37.zip

# You'll get:
# - transactions.db (your database)
# - backup_info.txt (metadata)
```

### Step 3: Stop the Server
```bash
# If running as a process
pkill -f "server"

# If using systemd
sudo systemctl stop velopay
```

### Step 4: Replace the Database
```bash
# Backup current (possibly corrupted) database first
mv ./transactions.db ./transactions.db.corrupted

# Copy restored database
cp /path/to/extracted/transactions.db ./transactions.db
```

### Step 5: Restart the Server
```bash
# Start the server
./server

# Or with systemd
sudo systemctl start velopay
```

### Step 6: Verify
- Log in to the admin panel
- Check that your data is restored
- Verify user accounts work

---

## 🛡️ Security Best Practices

### 1. Enable S3 Versioning
If a hacker deletes your S3 backups, versioning lets you recover them:
```bash
aws s3api put-bucket-versioning \
  --bucket your-bucket-name \
  --versioning-configuration Status=Enabled
```

### 2. Set Up S3 Object Lock (Immutable Backups)
Prevents deletion even with valid credentials:
- Enable when creating bucket
- Set retention period (e.g., 30 days)

### 3. Use a Separate AWS Account
Create a completely separate AWS account just for backups. Even if your main account is compromised, backups remain safe.

### 4. Download Backups Regularly
Keep copies on:
- Your local computer
- An external hard drive
- A different cloud provider (Google Drive, Dropbox)

### 5. Test Your Backups!
Periodically restore a backup to a test environment to ensure it works.

---

## 📱 Quick Recovery Checklist

If you've been hacked:

- [ ] 1. **Don't panic** - Your data is backed up
- [ ] 2. **Secure a new server** (or clean the compromised one)
- [ ] 3. **Download latest backup from S3** (not from compromised server!)
- [ ] 4. **Deploy fresh code** from your GitHub repository
- [ ] 5. **Restore the database** from backup
- [ ] 6. **Change ALL credentials**:
   - [ ] JWT_SECRET
   - [ ] Database password (if PostgreSQL)
   - [ ] AWS keys
   - [ ] Resend API key
   - [ ] Admin passwords
- [ ] 7. **Review audit logs** to understand the breach
- [ ] 8. **Enable additional security** (2FA, IP restrictions, etc.)

---

## 🔗 API Endpoints for Backup Management

```bash
# Create a manual backup (requires superadmin token)
curl -X POST http://localhost:8080/api/admin/backup \
  -H "Authorization: Bearer YOUR_TOKEN"

# List all backups
curl http://localhost:8080/api/admin/backups \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check backup status
curl http://localhost:8080/api/admin/backup/status \
  -H "Authorization: Bearer YOUR_TOKEN"

# Clean old backups (keeps last 30 days)
curl -X POST http://localhost:8080/api/admin/backups/clean \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## ⏰ Automatic Backup Schedule

- **Frequency**: Every 24 hours
- **Retention**: 30 days (configurable)
- **Storage**: Local + S3 (if configured)

The backup scheduler starts automatically when the server starts.

---

## Need Help?

If you lose access to everything:
1. Your code is on GitHub - you can always redeploy
2. Your backups are on S3 - download and restore
3. User passwords are hashed - users will need to reset passwords

**The only thing you cannot recover**: User passwords (by design - they're securely hashed)
