# Digital Transaction Ledger CRM - API Documentation

## 🚀 Getting Started

### Default SuperAdmin Credentials
After running the server for the first time, a default SuperAdmin account is created:

```
Email: admin@digitaltransactionledger.com
Password: Admin@123456
```

⚠️ **IMPORTANT:** Please change the password after first login!

---

## 📋 API Endpoints

### Base URL
```
http://localhost:8080/api
```

---

## 🔐 Authentication Endpoints

### 1. Register
Creates a new user and tenant with 7-day trial period.

**POST** `/auth/register`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "YourPassword123",
  "name": "Your Name"
}
```

**Response:**
```json
{
  "message": "Registration successful. Please check your email for verification code.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "emailVerified": false,
    "role": "tenant_owner",
    "tenantId": 1,
    "trialEndsAt": "2025-11-14T..."
  }
}
```

---

### 2. Verify Email
Verifies user email with 6-digit code sent to email.

**POST** `/auth/verify-email`

**Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response:**
```json
{
  "message": "Email verified successfully. You can now login."
}
```

---

### 3. Resend Verification Code
Resends verification code to email.

**POST** `/auth/resend-code`

**Body:**
```json
{
  "email": "user@example.com"
}
```

---

### 4. Login
Authenticates user and returns JWT token.

**POST** `/auth/login`

**Body:**
```json
{
  "email": "user@example.com",
  "password": "YourPassword123"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "role": "tenant_owner",
    "tenantId": 1,
    "status": "active",
    "trialEndsAt": "2025-11-14T...",
    "emailVerified": true
  },
  "tenant": {
    "id": 1,
    "name": "Your Name's Organization",
    "status": "trial",
    "userLimit": 1
  }
}
```

---

### 5. Get Current User
Returns authenticated user information.

**GET** `/auth/me`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 🎫 License Endpoints

### 1. Activate License
Activates a license for current tenant (Tenant Owner only).

**POST** `/licenses/activate`

**Headers:**
```
Authorization: Bearer <token>
```

**Body:**
```json
{
  "licenseKey": "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
}
```

---

### 2. Get License Status
Returns current license status for tenant.

**GET** `/licenses/status`

**Headers:**
```
Authorization: Bearer <token>
```

---

## 👨‍💼 SuperAdmin Endpoints

All SuperAdmin endpoints require `Authorization: Bearer <superadmin-token>` header.

### License Management

#### Generate License
**POST** `/admin/licenses/generate`

**Body:**
```json
{
  "licenseType": "professional",
  "userLimit": 20,
  "durationType": "lifetime",
  "notes": "Custom notes for this license"
}
```

**License Types:**
- `trial` - 1 user, 7 days
- `starter` - 5 users, lifetime
- `professional` - 20 users, lifetime
- `business` - 50 users, lifetime
- `enterprise` - Unlimited users, lifetime
- `custom` - Custom configuration

**Duration Types:**
- `lifetime` - Never expires
- `monthly` - 1 month
- `yearly` - 1 year
- `custom_days` - Specify custom days in `durationValue`

---

#### Get All Licenses
**GET** `/admin/licenses`

---

#### Revoke License
**POST** `/admin/licenses/{id}/revoke`

---

### Tenant Management

#### Get All Tenants
**GET** `/admin/tenants`

---

#### Get Tenant by ID
**GET** `/admin/tenants/{id}`

---

#### Suspend Tenant
**POST** `/admin/tenants/{id}/suspend`

---

#### Activate Tenant
**POST** `/admin/tenants/{id}/activate`

---

### User Management

#### Get All Users
**GET** `/admin/users`

---

### Dashboard

#### Get Statistics
**GET** `/admin/dashboard/stats`

**Response:**
```json
{
  "tenants": {
    "total": 10,
    "active": 7,
    "trial": 3
  },
  "users": {
    "total": 50,
    "active": 45
  },
  "licenses": {
    "total": 20,
    "active": 10,
    "unused": 8
  }
}
```

---

## 💼 Client & Transaction Endpoints

All these endpoints require authentication and respect tenant isolation.

### Clients

- **GET** `/clients` - Get all clients
- **POST** `/clients` - Create client
- **GET** `/clients/{id}` - Get client by ID
- **PUT** `/clients/{id}` - Update client
- **DELETE** `/clients/{id}` - Delete client
- **GET** `/clients/search?q=<query>` - Search clients

### Transactions

- **GET** `/transactions` - Get all transactions
- **POST** `/transactions` - Create transaction
- **GET** `/transactions/{id}` - Get transaction by ID
- **PUT** `/transactions/{id}` - Update transaction
- **DELETE** `/transactions/{id}` - Delete transaction
- **GET** `/transactions/search?q=<query>` - Search transactions
- **GET** `/clients/{id}/transactions` - Get client's transactions

---

## 🔑 User Roles

### SuperAdmin
- Full access to all features
- Can manage all tenants and users
- Can generate and manage licenses
- No tenant restriction

### Tenant Owner
- Full access to own tenant's data
- Can manage tenant users
- Can activate licenses
- Can manage tenant settings

### Tenant Admin
- Can manage transactions and clients
- Can manage other users
- Cannot change tenant settings

### Tenant User
- Can view and create transactions
- Can view clients
- Limited access

---

## 🛡️ Security Features

1. **JWT Authentication** - 24-hour token expiration
2. **Email Verification** - 6-digit OTP with 10-minute expiration
3. **Password Hashing** - bcrypt with default cost
4. **Tenant Isolation** - Each tenant's data is completely separate
5. **Role-Based Access Control** - Fine-grained permissions
6. **Trial Period** - Automatic 7-day trial for new signups
7. **License Validation** - Automatic expiration checks

---

## 📧 Email Configuration

Set these environment variables for email functionality:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@digitaltransactionledger.com
```

**Note:** If not configured, verification codes will be logged to console (development mode).

---

## 🔧 Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/dbname  # For production (PostgreSQL)
# If not set, uses SQLite: ./transactions.db

# Server
PORT=8080

# JWT
JWT_SECRET=your-secret-key-change-in-production

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=noreply@digitaltransactionledger.com

# Frontend URL (for password reset links)
FRONTEND_URL=http://localhost:3000
```

---

## 📊 Database Schema

### Main Tables:
- `users` - User accounts
- `tenants` - Organizations/Companies
- `licenses` - License keys and activations
- `roles` - User roles (tenant_owner, tenant_admin, tenant_user)
- `role_permissions` - Role-Feature mappings
- `clients` - Client information (tenant-specific)
- `transactions` - Financial transactions (tenant-specific)
- `ownership_transfer_logs` - Tenant ownership changes (future use)

---

## 🧪 Testing

### Quick Test Flow:

1. **Register a new user:**
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456",
    "name": "Test User"
  }'
```

2. **Check console for verification code** (if SMTP not configured)

3. **Verify email:**
```bash
curl -X POST http://localhost:8080/api/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "code": "123456"
  }'
```

4. **Login:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test@123456"
  }'
```

5. **Use returned token for authenticated requests:**
```bash
curl http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer <your-token>"
```

---

## 🎯 Next Steps

- [ ] Implement frontend with React/Next.js
- [ ] Add user invitation system
- [ ] Add password reset functionality
- [ ] Implement audit logging
- [ ] Add email notifications for trial/license expiration
- [ ] Add payment integration (Stripe/etc)
- [ ] Implement rate limiting
- [ ] Add API documentation with Swagger UI

---

## 📝 Notes

- Trial period is automatically set to 7 days after registration
- Each tenant's data is completely isolated from others
- SuperAdmin can access all data across all tenants
- License activation automatically upgrades tenant from trial to active
- Expired licenses automatically suspend the tenant

---

## 🐛 Troubleshooting

### Issue: "Email not verified"
- Check console for verification code if SMTP is not configured
- Use `/auth/resend-code` to get a new code

### Issue: "Trial period expired"
- User needs to activate a license using `/licenses/activate`
- SuperAdmin can generate licenses via `/admin/licenses/generate`

### Issue: "Tenant ID required"
- Make sure user is logged in and has a tenant assigned
- SuperAdmin users may not have a tenant (they can access all)

---

**Built with ❤️ using Go, GORM, and JWT**
