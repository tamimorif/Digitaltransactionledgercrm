# 📋 System Architecture - Digital Transaction Ledger CRM

## 🏗️ System Overview

A comprehensive multi-tenant CRM system for money exchange businesses with branch management, pickup transactions, global customer tracking, cash balance management, and advanced reporting.

---

## 🎯 Core Features

### 1. **Multi-Tenant Architecture**
- Complete tenant isolation at database level
- Role-based access control (4 roles)
- License-based feature access
- Trial and subscription management

### 2. **Branch Management**
- Multiple branches per company
- License-based limits (Small=1, Professional=3, Enterprise=unlimited)
- User-branch assignments
- Branch-level transaction filtering
- Primary branch designation

### 3. **Transaction Management**
- 4 transaction types:
  - `CASH_EXCHANGE`: Simple currency exchange
  - `BANK_TRANSFER`: Transfer with beneficiary details
  - `MONEY_PICKUP`: Cross-branch money transfer with pickup codes
  - `WALK_IN_CUSTOMER`: Quick transactions
- Edit history tracking
- Multi-currency support
- Fee and rate tracking
- Status management (COMPLETED/CANCELLED)

### 4. **Pickup System**
- 6-digit unique pickup codes
- Cross-branch money transfer
- Phone and ID verification
- Real-time status tracking
- Pending pickup count

### 5. **Global Customer Database**
- Customer data NOT tenant-scoped (SuperAdmin visibility)
- Phone number as unique identifier
- Automatic customer-tenant linking
- Transaction history per tenant
- First/last transaction date tracking

### 6. **Cash Balance Management**
- Auto-calculation from transactions
- Multi-currency balancing
- Manual adjustments with audit trail
- Branch-level and company-wide views
- Adjustment history with pagination

### 7. **Reporting & Exports**
- Transaction statistics dashboard
- Date range and branch filtering
- Breakdown by type and currency
- CSV and JSON exports
- Automatic file naming with timestamps

### 8. **Audit & Security**
- Comprehensive audit logging
- IP address and user agent tracking
- Old/new value comparison
- Transaction cancellation tracking
- JWT authentication with expiration

---

## 🗄️ Database Schema

### **Core Tables**

#### **users**
```
id, email, password_hash, role, status, tenant_id, 
primary_branch_id, trial_ends_at, verification_code, 
verification_code_expires_at, email_verified
```

#### **tenants**
```
id, company_name, status, owner_id, current_license_id,
created_at, updated_at
```

#### **licenses**
```
id, license_key, license_type, status, tenant_id,
max_branches, valid_from, valid_until, generated_by
```

### **Branch System**

#### **branches**
```
id, tenant_id, name, code, location, is_active, 
contact_phone, contact_email, is_primary
```

#### **user_branches**
```
user_id, branch_id, assigned_at
```

### **Transaction System**

#### **transactions**
```
id, tenant_id, branch_id, client_id, type, 
send_currency, send_amount, receive_currency, receive_amount,
rate_applied, fee_charged, beneficiary_name, beneficiary_details,
user_notes, is_edited, last_edited_at, edit_history,
status, cancellation_reason, cancelled_at, cancelled_by,
transaction_date, created_at, updated_at
```

#### **clients**
```
id, tenant_id, name, phone_number, email, 
join_date, created_at, updated_at
```

#### **pickup_transactions**
```
id, tenant_id, pickup_code, sender_branch_id, receiver_branch_id,
amount, currency, status, sender_name, sender_phone, sender_id_number,
recipient_name, recipient_phone, recipient_id_number,
picked_up_at, picked_up_by, notes, created_at, updated_at
```

### **Customer System**

#### **customers** (NOT tenant-scoped)
```
id, phone, full_name, email, created_at, updated_at
```

#### **customer_tenant_links**
```
id, customer_id, tenant_id, first_transaction_at,
last_transaction_at, total_transactions
```

### **Cash Management**

#### **cash_balances**
```
id, tenant_id, branch_id, currency, 
auto_calculated_balance, manual_adjustment, final_balance,
last_calculated_at, last_manual_adjustment_at
```

#### **cash_adjustments**
```
id, cash_balance_id, amount, reason, adjusted_by,
balance_before, balance_after, created_at
```

### **Audit**

#### **audit_logs**
```
id, user_id, tenant_id, action, entity_type, entity_id,
description, old_values, new_values, ip_address, 
user_agent, created_at
```

---

## 🔌 API Endpoints

### **Public Endpoints**
```
POST   /api/auth/register
POST   /api/auth/verify-email
POST   /api/auth/resend-code
POST   /api/auth/login
```

### **Protected Endpoints (Authenticated Users)**

#### Authentication
```
GET    /api/auth/me
```

#### Licenses
```
POST   /api/licenses/activate
GET    /api/licenses/status
GET    /api/licenses/my-licenses
```

#### Transactions
```
GET    /api/transactions
POST   /api/transactions
GET    /api/transactions/{id}
PUT    /api/transactions/{id}
POST   /api/transactions/{id}/cancel
DELETE /api/transactions/{id}
GET    /api/transactions/search
```

#### Clients
```
GET    /api/clients
POST   /api/clients
GET    /api/clients/{id}
PUT    /api/clients/{id}
DELETE /api/clients/{id}
GET    /api/clients/{id}/transactions
GET    /api/clients/search
```

#### Branches
```
GET    /api/branches
POST   /api/branches
GET    /api/branches/my-branches
GET    /api/branches/{id}
PUT    /api/branches/{id}
POST   /api/branches/{id}/deactivate
POST   /api/branches/{id}/assign-user
```

#### Pickups
```
GET    /api/pickups
POST   /api/pickups
GET    /api/pickups/pending/count
GET    /api/pickups/search/{code}
GET    /api/pickups/{id}
POST   /api/pickups/{id}/pickup
POST   /api/pickups/{id}/cancel
```

#### Customers
```
GET    /api/customers
GET    /api/customers/search
GET    /api/customers/phone/{phone}
POST   /api/customers/find-or-create
PUT    /api/customers/{id}
```

#### Cash Balances
```
GET    /api/cash-balances
GET    /api/cash-balances/currencies
POST   /api/cash-balances/refresh-all
POST   /api/cash-balances/adjust
GET    /api/cash-balances/adjustments
GET    /api/cash-balances/{currency}
POST   /api/cash-balances/{id}/refresh
```

#### Statistics & Exports
```
GET    /api/statistics
GET    /api/export/csv
GET    /api/export/json
```

#### Audit Logs
```
GET    /api/audit-logs
```

#### Tenant Management
```
PUT    /api/tenant/update-name
```

### **SuperAdmin Endpoints**

#### License Management
```
POST   /api/admin/licenses/generate
GET    /api/admin/licenses
POST   /api/admin/licenses/{id}/revoke
```

#### Tenant Management
```
GET    /api/admin/tenants
GET    /api/admin/tenants/{id}
POST   /api/admin/tenants/{id}/suspend
POST   /api/admin/tenants/{id}/activate
```

#### User Management
```
GET    /api/admin/users
```

#### Transaction Management
```
GET    /api/admin/transactions
```

#### Customer Management
```
GET    /api/admin/customers/search
GET    /api/admin/customers/{id}
```

#### Dashboard
```
GET    /api/admin/dashboard/stats
```

---

## 🎭 User Roles & Permissions

### **SuperAdmin**
- Full system access
- License generation and management
- View all tenants and transactions
- Cross-tenant customer search
- Suspend/activate tenants
- View cancelled transactions

### **Tenant Owner**
- Company-wide access
- Branch management (CRUD)
- User-branch assignments
- License activation
- All transaction operations
- Cash balance management
- Company overview and exports

### **Tenant Admin**
- Branch-level management
- User assignments within branches
- Transaction operations
- Cash balance viewing
- Reporting access

### **Tenant User**
- Transaction creation and viewing
- Client management
- Pickup operations
- Limited reporting

---

## 🔄 Data Flow Examples

### **Transaction Creation Flow**
1. User selects branch (via BranchSelector)
2. User creates transaction with currency pair
3. Backend validates tenant and branch access
4. Transaction saved with branch_id and tenant_id
5. Cash balance auto-updated for currency
6. Audit log created
7. Frontend invalidates query cache
8. UI refreshes with new transaction

### **Pickup Transaction Flow**
1. **Branch A**: User creates pickup transaction
2. System generates unique 6-digit code
3. Transaction saved with sender_branch_id = Branch A
4. **Branch B**: User searches by pickup code
5. System displays sender details and verification info
6. Branch B user verifies phone and ID
7. User marks as picked up
8. Status updated to PICKED_UP, receiver_branch_id = Branch B
9. Pickup timestamp and user recorded
10. Both branches see updated status

### **Customer Auto-Link Flow**
1. User enters customer phone number
2. System searches global customers table
3. If found: Display customer details (auto-fill)
4. If not found: Create new customer record
5. Transaction created with customer reference
6. CustomerTenantLink automatically updated:
   - Increment total_transactions
   - Update last_transaction_at
   - Set first_transaction_at if first time
7. SuperAdmin can search customer across all tenants

### **Cash Balance Calculation**
1. Transaction created/updated
2. System triggers balance refresh
3. Service queries all COMPLETED transactions for currency
4. SUM(send_amount) for transactions
5. Auto_calculated_balance updated
6. If manual adjustment exists, final_balance = auto + manual
7. Last_calculated_at timestamp updated
8. UI displays auto vs manual separation

---

## 🚀 Technology Stack

### **Backend**
- **Language**: Go 1.24+
- **Framework**: Gorilla Mux
- **ORM**: GORM
- **Database**: SQLite (transactions.db)
- **Authentication**: JWT with bcrypt
- **Documentation**: Swagger/OpenAPI

### **Frontend**
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **State Management**: React Query v5
- **Styling**: TailwindCSS
- **UI Components**: shadcn/ui
- **HTTP Client**: Axios
- **Forms**: React Hook Form (implicit)

---

## 📦 Key Design Patterns

### **Backend Patterns**
1. **Service Layer Pattern**: Business logic separated from handlers
2. **Repository Pattern**: GORM as data access layer
3. **Middleware Chain**: Auth → Tenant Isolation → Handler
4. **Audit Trail**: Automatic logging on critical operations
5. **Find-or-Create**: Prevents duplicate customer records

### **Frontend Patterns**
1. **React Query**: Server state management with caching
2. **Provider Pattern**: Auth context for global state
3. **Compound Components**: Reusable UI component composition
4. **Optimistic Updates**: UI updates before server confirmation
5. **Error Boundaries**: Graceful error handling

---

## 🔐 Security Measures

1. **Authentication**: JWT tokens with expiration
2. **Password Security**: Bcrypt hashing
3. **Tenant Isolation**: Middleware-enforced data separation
4. **Role-Based Access**: Permission checks on all endpoints
5. **Input Validation**: Server-side validation on all inputs
6. **SQL Injection Protection**: GORM parameterized queries
7. **XSS Protection**: React automatic escaping
8. **CORS**: Configured for specific origins
9. **Audit Logging**: All critical actions tracked
10. **Token Refresh**: Automatic re-authentication

---

## 📊 Performance Optimizations

1. **Database Indexes**: On tenant_id, branch_id, transaction_date, status
2. **Query Optimization**: Selective field loading with GORM
3. **React Query Caching**: Reduced API calls
4. **Lazy Loading**: Dashboard cards load on-demand
5. **Debounced Search**: Reduced server load on search inputs
6. **Pagination**: Large datasets paginated (audit logs, adjustments)
7. **Connection Pooling**: GORM manages DB connections

---

## 🎯 Future Enhancements

1. **Notifications**: Email/SMS for pickup transactions
2. **Advanced Charts**: Visual reporting with Chart.js
3. **Custom Rates**: Admin-configured exchange rates
4. **Multi-Language**: i18n support
5. **Dark Mode**: Theme switcher
6. **Mobile App**: React Native version
7. **Real-time Updates**: WebSocket for live pickup status
8. **Document Upload**: Store ID copies, receipts
9. **API Rate Limiting**: Protect against abuse
10. **Backup System**: Automated database backups

---

## 📞 Support & Contact

For issues, feature requests, or questions:
- GitHub Issues: [Repository Issues](https://github.com/tamimorif/Digitaltransactionledgercrm/issues)
- Documentation: See README.md and QUICKSTART.md

---

**Built with ❤️ for money exchange businesses worldwide** 🌍💱
