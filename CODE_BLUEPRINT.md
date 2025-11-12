# 🏗️ Code Blueprint - Digital Transaction Ledger CRM# Digital Transaction Ledger CRM - Code Blueprint



> **Last Updated**: November 11, 2025  A single-file, high-level blueprint of the codebase that explains what it is, what it does, and how the pieces fit together. Use this as a quick orientation for contributors and as an engineering reference.

> **Version**: 1.0.0  

> **Architecture**: Multi-tenant SaaS CRM## 1) Executive summary



---Digital Transaction Ledger CRM is a multi-tenant platform for currency exchange and remittance businesses. It provides:

- Tenant and branch management with license-based limits

## 📋 Table of Contents- End-to-end transaction management (cash exchange, bank transfer, money pickup, walk-in)

- Inter-branch pickup workflow with 6-digit codes

1. [System Overview](#system-overview)- Global customer directory with per-tenant linkage

2. [Technology Stack](#technology-stack)- Cash balance auto-calculation + manual adjustments with audit trail

3. [Backend Architecture](#backend-architecture)- Admin features: licensing, tenant oversight, audit logs, exports, and statistics

4. [Frontend Architecture](#frontend-architecture)

5. [Database Schema](#database-schema)Stack:

6. [API Endpoints](#api-endpoints)- Backend: Go 1.24+, Gorilla Mux, GORM, SQLite (default, Postgres-ready), JWT, bcrypt, Swagger

7. [Security Implementation](#security-implementation)- Frontend: Next.js (App Router) + TypeScript, React Query v5, TailwindCSS, shadcn/ui, Axios

8. [Key Features Implementation](#key-features-implementation)

9. [Data Flow](#data-flow)---

10. [File Structure](#file-structure)

## 2) System diagram (runtime)

---

```

## System Overview┌──────────────┐     HTTPS      ┌────────────────────┐      DB Driver      ┌────────────────┐

│   Browser    │ ─────────────▶ │ Next.js Frontend   │ ──────────────────▶ │ SQLite/Postgres│

### High-Level Architecture│ (localhost)  │                │ (port 3000)        │                     │  (GORM)        │

└──────────────┘                └─────────▲──────────┘                     └────────────────┘

```                      REST /api          │

┌─────────────────────────────────────────────────────────────────┐                                        │

│                         CLIENT LAYER                             │                                   ┌─────┴─────┐

│  ┌──────────────────────────────────────────────────────────┐   │                                   │ Go Backend│

│  │  Next.js 15 Frontend (TypeScript)                        │   │                                   │ (port 8080)

│  │  • React 19 Components                                    │   │                                   │ Gorilla Mux + GORM + JWT

│  │  • TanStack Query (State Management)                     │   │                                   └───────────┘

│  │  • shadcn/ui + Radix UI (Components)                     │   │```

│  │  • TailwindCSS 4 (Styling)                               │   │

│  └──────────────────────────────────────────────────────────┘   │---

└─────────────────────────────────────────────────────────────────┘

                              ↕ HTTPS/REST## 3) Backend architecture

┌─────────────────────────────────────────────────────────────────┐

│                         API LAYER                                │Entrypoint:

│  ┌──────────────────────────────────────────────────────────┐   │- `backend/cmd/server/main.go`

│  │  Go 1.24+ REST API                                       │   │  - Loads env via `godotenv`

│  │  • Gorilla Mux Router                                    │   │  - Initializes DB via `database.InitDB`

│  │  • JWT Authentication Middleware                         │   │  - Builds HTTP router via `api.NewRouter(db)`

│  │  • Tenant Isolation Middleware                           │   │  - Serves on `PORT` (default 8080)

│  │  • CORS Middleware                                       │   │

│  └──────────────────────────────────────────────────────────┘   │Routing:

│  ┌──────────────────────────────────────────────────────────┐   │- `backend/pkg/api/router.go`

│  │  Handler Layer (HTTP Controllers)                        │   │  - Public: auth endpoints, health, swagger

│  │  • auth_handler.go       • transaction_handler.go        │   │  - Protected (auth + tenant isolation): transactions, clients, users, branches, pickups, customers, cash-balances, statistics, exports, audit logs, tenant ops

│  │  • customer_handler.go   • pickup_handler.go             │   │  - SuperAdmin: licenses, tenants, users, dashboard stats

│  │  • branch_handler.go     • cash_balance_handler.go       │   │  - CORS: `http://localhost:3000`, `http://localhost:3001`

│  │  • statistics_handler.go • admin_handler.go              │   │

│  │  • user_handler.go       • license_handler.go            │   │Middleware:

│  │  • audit_handler.go                                      │   │- Auth: validates JWT, loads user, status checks

│  └──────────────────────────────────────────────────────────┘   │- Tenant isolation: scopes data by tenant unless SuperAdmin

└─────────────────────────────────────────────────────────────────┘- Role helpers: SuperAdmin / TenantOwner, feature gate stub

                              ↕

┌─────────────────────────────────────────────────────────────────┐Models (selected):

│                      BUSINESS LOGIC LAYER                        │- User: roles, trial, primary branch, status

│  ┌──────────────────────────────────────────────────────────┐   │- Transaction: types, edit/cancel metadata, branch/client relations

│  │  Service Layer (Business Logic)                          │   │- License: activation, limits, duration types

│  │  • auth_service.go       • transaction.go                │   │- Plus: tenant, branch, pickup_transaction, customer (global), cash_balance, adjustments, audit_log

│  │  • customer_service.go   • pickup_service.go             │   │

│  │  • branch_service.go     • cash_balance_service.go       │   │Services (selected):

│  │  • statistics_service.go • license_service.go            │   │- Auth: register (creates tenant), verify email (6-digit, 10 min), login (24h JWT), trial expiry logic

│  │  • email_service.go      • audit_service.go              │   │- License, Statistics, Cash Balance, Pickup, Branch, Customer, etc.

│  └──────────────────────────────────────────────────────────┘   │

└─────────────────────────────────────────────────────────────────┘Handlers (HTTP adapters):

                              ↕- Auth, License, Transaction/Client, Admin, Branch, User, Pickup, Customer, Cash Balance, Statistics, Audit

┌─────────────────────────────────────────────────────────────────┐

│                      DATA ACCESS LAYER                           │Database:

│  ┌──────────────────────────────────────────────────────────┐   │- GORM + SQLite default; Postgres driver included

│  │  GORM ORM + Models                                       │   │- Indexed on tenant_id, dates, status

│  │  • User, Tenant, Branch                                  │   │

│  │  • Transaction, Customer, PickupTransaction              │   │Security:

│  │  • CashBalance, License, AuditLog                        │   │- JWT HS256 24h expiry

│  │  • PasswordResetCode, OwnershipTransferLog               │   │- Bcrypt password hashing

│  └──────────────────────────────────────────────────────────┘   │- Role-based + tenant isolation

└─────────────────────────────────────────────────────────────────┘

                              ↕---

┌─────────────────────────────────────────────────────────────────┐

│                      DATABASE LAYER                              │## 4) Request lifecycle (protected route)

│  ┌──────────────────────────────────────────────────────────┐   │1. Authorization header parsed

│  │  SQLite Database (transactions.db)                       │   │2. JWT validated -> user loaded

│  │  • 15+ Tables with Foreign Keys & Indexes                │   │3. Tenant ID placed in context (nil for SuperAdmin)

│  │  • ACID Compliance                                       │   │4. Handler invokes service with scoped queries

│  │  • Auto-migrations via GORM                              │   │5. JSON response returned

│  └──────────────────────────────────────────────────────────┘   │

└─────────────────────────────────────────────────────────────────┘---

```

## 5) License and limits

---- Types: trial, starter, professional, business, enterprise, custom

- Durations: lifetime, monthly, yearly, custom_days

## Technology Stack- Limits: user count, max branches; activation updates tenant status



### Backend Stack---



| Technology | Version | Purpose |## 6) Key workflows

|------------|---------|---------|Transactions: create/edit/cancel, status + history, cash balance refresh.

| **Go** | 1.24+ | Primary backend language |Pickup: create (sender branch) -> code -> search -> verify -> pick-up.

| **Gorilla Mux** | 1.8.1 | HTTP routing and URL matching |Customers: global phone uniqueness, per-tenant linkage updates stats.

| **GORM** | 1.31.1 | ORM and database migrations |Cash balances: auto from transactions + manual adjustments with audit trail.

| **SQLite** | 3.x | Embedded relational database |Audit: logs sensitive actions with context.

| **JWT (golang-jwt)** | 5.3.0 | Authentication tokens |

| **Bcrypt (crypto)** | 0.43.0 | Password hashing |---

| **UUID (google/uuid)** | 1.6.0 | Unique identifier generation |

| **CORS (rs/cors)** | 1.11.1 | Cross-origin resource sharing |## 7) API surface (high-level)

| **Swagger (swaggo)** | 1.16.6 | API documentation |Public: register, verify-email, resend-code, login, health.

| **Resend** | 2.28.0 | Email delivery service |Protected: transactions, clients, users, branches, pickups, customers, cash-balances, statistics, exports, tenant updates, audit logs.

| **godotenv** | 1.5.1 | Environment variable management |SuperAdmin: licenses, tenants, users, dashboard.

Swagger: `/swagger/*`.

### Frontend Stack

---

| Technology | Version | Purpose |

|------------|---------|---------|## 8) Frontend architecture

| **Next.js** | 15.5.6 | React framework with App Router |- Layout: `frontend/app/layout.tsx` (providers + toaster)

| **React** | 19.0.0 | UI library |- Landing: `frontend/app/page.tsx`

| **TypeScript** | 5.7.2 | Type-safe JavaScript |- Auth pages: `login`, `register`, `verify-email`

| **TanStack Query** | 5.90.7 | Data fetching & state management |- Dashboard area: `(dashboard)` pages (account, admin, cash-balance, company-overview, etc.)

| **TailwindCSS** | 4.0.0 | Utility-first CSS framework |- State: React Query for caching and invalidations

| **shadcn/ui** | Latest | Pre-built component library |- Forms: React Hook Form + Zod

| **Radix UI** | Latest | Accessible component primitives |- UI: TailwindCSS + shadcn/ui + Lucide icons

| **React Hook Form** | 7.66.0 | Form state management |- Env: `NEXT_PUBLIC_API_URL` for backend base

| **Zod** | 4.1.12 | Schema validation |

| **Axios** | 1.13.2 | HTTP client |---

| **Recharts** | 2.15.2 | Data visualization |

| **Lucide React** | 0.487.0 | Icon library |## 9) Local development

| **date-fns** | 4.1.0 | Date manipulation |Backend:

- `cd backend`

---- `go mod download`

- `go run cmd/server/main.go`

## Backend ArchitectureFrontend:

- `cd frontend`

### Project Structure- `npm install`

- `npm run dev`

```

backend/---

├── cmd/

│   └── server/## 10) Error handling & security

│       └── main.go                    # Application entry point- Unified JSON error responses

├── pkg/- Suspended / trial-expired checks during auth

│   ├── api/                           # HTTP handlers (controllers)- Tenant scoping enforced early

│   │   ├── router.go                  # Route definitions & middleware setup- CORS restricted dev origins

│   │   ├── handler.go                 # Base handler utilities

│   │   ├── auth_handler.go            # Authentication endpoints---

│   │   ├── transaction_handler.go     # Transaction CRUD

│   │   ├── customer_handler.go        # Customer management## 11) Performance & scalability

│   │   ├── pickup_handler.go          # Pickup transactions- Indexes for query speed

│   │   ├── branch_handler.go          # Branch management- React Query reduces redundant calls

│   │   ├── cash_balance_handler.go    # Balance management- Pagination on heavy collections

│   │   ├── statistics_handler.go      # Reports & analytics- Postgres option for production scaling

│   │   ├── admin_handler.go           # Admin operations

│   │   ├── user_handler.go            # User management---

│   │   ├── license_handler.go         # License operations

│   │   └── audit_handler.go           # Audit log queries## 12) Testing guidance (suggested)

│   ├── database/- Auth: register/verify/login + invalid code

│   │   ├── db.go                      # Database initialization & migrations- Tenant isolation: ensure cross-tenant access blocked

│   │   └── seeder.go                  # Seed data for development- Pickup lifecycle: create->search->pickup

│   ├── middleware/- Cash balance recalculation accuracy

│   │   ├── auth_middleware.go         # JWT validation & role checking- License activation & revocation side effects

│   │   └── tenant_middleware.go       # Tenant isolation enforcement

│   ├── models/                        # GORM models (database schema)---

│   │   ├── user.go                    # User model & authentication

│   │   ├── tenant.go                  # Multi-tenant model## 13) Extension points

│   │   ├── branch.go                  # Branch model- Password reset & invitations

│   │   ├── transaction.go             # Transaction model- Rate limiting & hardening

│   │   ├── customer.go                # Customer model (global)- WebSocket real-time updates

│   │   ├── pickup_transaction.go      # Pickup-specific model- i18n, dark mode, richer charts

│   │   ├── cash_balance.go            # Cash balance tracking- Automated backups

│   │   ├── license.go                 # License management

│   │   ├── audit_log.go               # Audit trail---

│   │   ├── role.go                    # Role enumeration

│   │   ├── ownership_transfer_log.go  # License transfer tracking## 14) File map

│   │   └── password_reset_code.go     # Password reset tokensBackend: entry (`cmd/server`), router & handlers (`pkg/api`), services (`pkg/services`), models (`pkg/models`), middleware (`pkg/middleware`), db init (`pkg/database`), docs (`docs/`).

│   ├── services/                      # Business logic layerFrontend: app routes (`app/`), components/providers (`src/components`), config (`package.json`, `next.config.js`, `tsconfig.json`).

│   │   ├── auth_service.go            # Authentication business logic

│   │   ├── email_service.go           # Email sending (Resend)---

│   │   ├── transaction.go             # Transaction business logic

│   │   ├── customer_service.go        # Customer business logic## 15) Glossary

│   │   ├── pickup_service.go          # Pickup business logic- Tenant: organization instance

│   │   ├── branch_service.go          # Branch business logic- Branch: subdivision of tenant

│   │   ├── cash_balance_service.go    # Balance calculations- License: feature/limit grant

│   │   ├── statistics_service.go      # Report generation- Pickup: cross-branch transfer redeemed via code

│   │   ├── license_service.go         # License validation- Cash balance: computed + adjusted currency totals

│   │   └── audit_service.go           # Audit logging

│   └── utils/---

│       └── helper.go                  # Utility functions

├── docs/                              # Swagger documentation (auto-generated)References: `README.md`, `SYSTEM_ARCHITECTURE.md`, `backend/API_DOCUMENTATION.md`.

│   ├── docs.go
│   ├── swagger.json
│   └── swagger.yaml
├── go.mod                             # Go dependencies
└── go.sum                             # Dependency checksums
```

### Core Backend Components

#### 1. **Router (`router.go`)**
```go
// Purpose: Define all HTTP routes and apply middleware
// Key responsibilities:
// - Route registration
// - Middleware application (CORS, Auth, Tenant)
// - Swagger documentation setup
// - Static file serving
```

#### 2. **Middleware**

**Auth Middleware (`auth_middleware.go`)**
```go
// Purpose: JWT validation and role-based access control
// Key functions:
// - AuthMiddleware() - Validates JWT token
// - RequireRole() - Checks user role permissions
// - extractUserFromToken() - Parses JWT claims
```

**Tenant Middleware (`tenant_middleware.go`)**
```go
// Purpose: Enforce tenant isolation
// Key functions:
// - TenantMiddleware() - Ensures tenant_id isolation
// - SuperAdminOverride() - Allows SuperAdmin cross-tenant access
```

#### 3. **Handlers (API Controllers)**

Each handler follows this pattern:
```go
type HandlerStruct struct {
    DB *gorm.DB
}

func NewHandler(db *gorm.DB) *HandlerStruct {
    return &HandlerStruct{DB: db}
}

// HTTP endpoint methods
func (h *HandlerStruct) GetResource(w http.ResponseWriter, r *http.Request) {
    // 1. Extract parameters from request
    // 2. Call service layer
    // 3. Handle errors
    // 4. Return JSON response
}
```

#### 4. **Services (Business Logic)**

Services contain all business rules:
```go
// Example: transaction.go
func CreateTransaction(db *gorm.DB, transaction *models.Transaction) error {
    // 1. Validate input
    // 2. Check business rules
    // 3. Update related entities
    // 4. Log audit trail
    // 5. Save to database
}
```

#### 5. **Models (Database Schema)**

GORM models with tags:
```go
type Transaction struct {
    ID              uuid.UUID `gorm:"type:uuid;primary_key"`
    TenantID        uuid.UUID `gorm:"type:uuid;not null;index"`
    BranchID        uuid.UUID `gorm:"type:uuid;not null"`
    CustomerID      uuid.UUID `gorm:"type:uuid;not null"`
    TransactionType string    `gorm:"type:varchar(50);not null"`
    // ... more fields
    CreatedAt       time.Time
    UpdatedAt       time.Time
}
```

---

## Frontend Architecture

### Project Structure

```
frontend/
├── app/                               # Next.js App Router
│   ├── (auth)/                        # Authentication routes (no layout)
│   │   ├── login/
│   │   │   └── page.tsx              # Login page
│   │   ├── register/
│   │   │   └── page.tsx              # Registration page
│   │   ├── verify-email/
│   │   │   └── page.tsx              # Email verification
│   │   ├── forgot-password/
│   │   │   └── page.tsx              # Password reset request
│   │   └── reset-password/
│   │       └── page.tsx              # Password reset form
│   ├── (dashboard)/                   # Protected routes (with layout)
│   │   ├── layout.tsx                # Dashboard layout (sidebar, header)
│   │   ├── dashboard/
│   │   │   └── page.tsx              # Main dashboard
│   │   ├── company-overview/
│   │   │   └── page.tsx              # Company statistics
│   │   ├── send-pickup/
│   │   │   └── page.tsx              # Create pickup transaction
│   │   ├── pending-pickups/
│   │   │   └── page.tsx              # List pending pickups
│   │   ├── pickup-search/
│   │   │   └── page.tsx              # Search pickup by code
│   │   ├── cash-balance/
│   │   │   └── page.tsx              # Cash balance management
│   │   ├── users/
│   │   │   └── page.tsx              # User management
│   │   ├── settings/
│   │   │   └── page.tsx              # System settings
│   │   ├── account/
│   │   │   └── page.tsx              # User account settings
│   │   ├── admin/
│   │   │   └── page.tsx              # Admin panel
│   │   └── panel/
│   │       └── page.tsx              # Control panel
│   ├── layout.tsx                     # Root layout
│   ├── page.tsx                       # Landing page
│   ├── loading.tsx                    # Loading state
│   └── globals.css                    # Global styles
├── src/
│   ├── components/                    # React components
│   │   ├── ui/                       # shadcn/ui components
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── table.tsx
│   │   │   └── ... (50+ components)
│   │   ├── BuySellRatesWidget.tsx    # Exchange rate widget
│   │   ├── Navigation.tsx            # Sidebar navigation
│   │   ├── TransactionForm.tsx       # Transaction creation form
│   │   └── ... (custom components)
│   ├── lib/
│   │   ├── api.ts                    # Axios API client
│   │   └── utils.ts                  # Utility functions
│   ├── models/                       # TypeScript interfaces
│   │   ├── transaction.ts
│   │   ├── customer.ts
│   │   ├── user.ts
│   │   └── ...
│   └── queries/                      # TanStack Query hooks
│       ├── useTransactions.ts
│       ├── useCustomers.ts
│       ├── usePickups.ts
│       └── ...
├── package.json
├── tsconfig.json
├── next.config.js
└── tailwind.config.js
```

### Frontend Patterns

#### 1. **API Client (`lib/api.ts`)**
```typescript
// Axios instance with interceptors
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

// Request interceptor (add JWT token)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor (handle errors)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
    }
    return Promise.reject(error);
  }
);
```

#### 2. **TanStack Query Hooks (`queries/`)**
```typescript
// Example: useTransactions.ts
export const useTransactions = (filters: TransactionFilters) => {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateTransaction = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries(['transactions']);
    },
  });
};
```

#### 3. **Component Structure**
```typescript
// Typical page component structure
export default function DashboardPage() {
  // 1. State management
  const [filters, setFilters] = useState({});
  
  // 2. Data fetching
  const { data, isLoading, error } = useTransactions(filters);
  
  // 3. Mutations
  const createMutation = useCreateTransaction();
  
  // 4. Event handlers
  const handleCreate = (data) => {
    createMutation.mutate(data);
  };
  
  // 5. Render
  return (
    <div>
      {/* Component JSX */}
    </div>
  );
}
```

---

## Database Schema

### Entity Relationship Diagram (ERD)

```
┌─────────────────┐
│     TENANTS     │
├─────────────────┤
│ id (PK)         │
│ company_name    │
│ status          │
│ owner_id (FK)   │──────────┐
│ license_id (FK) │──┐       │
└─────────────────┘  │       │
         ↑           │       │
         │           │       │
┌─────────────────┐  │       │
│     USERS       │  │       │
├─────────────────┤  │       │
│ id (PK)         │←─┘       │
│ email           │          │
│ password_hash   │          │
│ role            │          │
│ tenant_id (FK)  │──────────┘
│ branch_id (FK)  │──┐
└─────────────────┘  │
                     │
┌─────────────────┐  │
│    BRANCHES     │←─┘
├─────────────────┤
│ id (PK)         │
│ tenant_id (FK)  │
│ name            │
│ code            │
│ location        │
└─────────────────┘
         ↑
         │
┌─────────────────┐
│  TRANSACTIONS   │
├─────────────────┤
│ id (PK)         │
│ tenant_id (FK)  │
│ branch_id (FK)  │──────────┘
│ customer_id(FK) │──┐
│ type            │  │
│ amount          │  │
│ currency        │  │
│ status          │  │
└─────────────────┘  │
                     │
┌─────────────────┐  │
│   CUSTOMERS     │←─┘
├─────────────────┤
│ id (PK)         │
│ name            │
│ phone (UNIQUE)  │  # Global, not tenant-scoped
│ email           │
└─────────────────┘
         ↑
         │
┌─────────────────┐
│PICKUP_TRANS     │
├─────────────────┤
│ id (PK)         │
│ tenant_id (FK)  │
│ sender_branch   │
│ receiver_branch │
│ customer_id(FK) │──────────┘
│ pickup_code     │  # 6-digit unique code
│ status          │  # PENDING/PICKED_UP
└─────────────────┘

┌─────────────────┐
│ CASH_BALANCES   │
├─────────────────┤
│ id (PK)         │
│ tenant_id (FK)  │
│ branch_id (FK)  │
│ currency        │
│ balance         │
│ last_updated    │
└─────────────────┘

┌─────────────────┐
│   LICENSES      │
├─────────────────┤
│ id (PK)         │
│ license_key     │
│ type            │  # SMALL/PROFESSIONAL/ENTERPRISE
│ tenant_id (FK)  │
│ max_branches    │
│ valid_from      │
│ valid_until     │
└─────────────────┘

┌─────────────────┐
│  AUDIT_LOGS     │
├─────────────────┤
│ id (PK)         │
│ tenant_id (FK)  │
│ user_id (FK)    │
│ action          │
│ resource_type   │
│ resource_id     │
│ old_value       │
│ new_value       │
│ ip_address      │
│ user_agent      │
│ timestamp       │
└─────────────────┘
```

### Database Tables (15 Total)

| Table Name | Records (Dev) | Purpose |
|------------|---------------|---------|
| **tenants** | Variable | Companies using the system |
| **users** | Variable | System users |
| **branches** | Variable | Branch locations |
| **transactions** | Variable | All transactions (4 types) |
| **customers** | Variable | Global customer database |
| **pickup_transactions** | Variable | Pickup-specific data |
| **cash_balances** | Variable | Multi-currency balances |
| **licenses** | Variable | License management |
| **audit_logs** | Variable | Complete audit trail |
| **roles** | 4 | Role definitions (enum) |
| **password_reset_codes** | Variable | Password reset tokens |
| **ownership_transfer_logs** | Variable | License transfer history |
| **customer_tenant_links** | Variable | Customer-tenant associations |
| **transaction_edit_histories** | Variable | Transaction modification logs |
| **cash_balance_adjustments** | Variable | Manual balance adjustment logs |

---

## API Endpoints

### Complete API Reference

#### **Authentication Endpoints**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | User login | No |
| POST | `/api/auth/verify-email` | Verify email with code | No |
| POST | `/api/auth/resend-verification` | Resend verification email | No |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password with code | No |
| GET | `/api/auth/me` | Get current user info | Yes |

#### **Transaction Endpoints**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/transactions` | List all transactions | Yes | User+ |
| POST | `/api/transactions` | Create transaction | Yes | User+ |
| GET | `/api/transactions/{id}` | Get transaction details | Yes | User+ |
| PUT | `/api/transactions/{id}` | Update transaction | Yes | Admin+ |
| DELETE | `/api/transactions/{id}` | Cancel transaction | Yes | Admin+ |
| GET | `/api/transactions/{id}/history` | Get edit history | Yes | Admin+ |

#### **Customer Endpoints**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/customers` | List customers | Yes | User+ |
| POST | `/api/customers` | Create customer | Yes | User+ |
| GET | `/api/customers/{id}` | Get customer details | Yes | User+ |
| PUT | `/api/customers/{id}` | Update customer | Yes | User+ |
| DELETE | `/api/customers/{id}` | Delete customer | Yes | Admin+ |
| GET | `/api/customers/search` | Search by phone | Yes | User+ |
| GET | `/api/customers/{id}/transactions` | Get customer transactions | Yes | User+ |

#### **Pickup Transaction Endpoints**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/api/pickups` | Create pickup transaction | Yes | User+ |
| GET | `/api/pickups/pending` | List pending pickups | Yes | User+ |
| GET | `/api/pickups/search` | Search by code/phone | Yes | User+ |
| POST | `/api/pickups/{code}/complete` | Complete pickup | Yes | User+ |
| GET | `/api/pickups/{code}` | Get pickup details | Yes | User+ |

#### **Branch Endpoints**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/branches` | List branches | Yes | User+ |
| POST | `/api/branches` | Create branch | Yes | TenantOwner+ |
| GET | `/api/branches/{id}` | Get branch details | Yes | User+ |
| PUT | `/api/branches/{id}` | Update branch | Yes | Admin+ |
| DELETE | `/api/branches/{id}` | Delete branch | Yes | TenantOwner+ |
| GET | `/api/branches/{id}/users` | List branch users | Yes | Admin+ |

#### **Cash Balance Endpoints**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/cash-balance` | Get cash balance | Yes | User+ |
| POST | `/api/cash-balance/adjust` | Manual adjustment | Yes | Admin+ |
| GET | `/api/cash-balance/history` | Adjustment history | Yes | Admin+ |
| GET | `/api/cash-balance/branch/{id}` | Branch-specific balance | Yes | User+ |

#### **Statistics & Reports**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/statistics` | Get transaction statistics | Yes | User+ |
| GET | `/api/statistics/export` | Export reports (CSV/JSON) | Yes | Admin+ |
| GET | `/api/statistics/dashboard` | Dashboard summary | Yes | User+ |

#### **User Management**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/users` | List users | Yes | Admin+ |
| POST | `/api/users` | Create user | Yes | Admin+ |
| GET | `/api/users/{id}` | Get user details | Yes | Admin+ |
| PUT | `/api/users/{id}` | Update user | Yes | Admin+ |
| DELETE | `/api/users/{id}` | Delete user | Yes | TenantOwner+ |
| PUT | `/api/users/{id}/branch` | Assign branch | Yes | Admin+ |

#### **License Management**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| POST | `/api/licenses/generate` | Generate license | Yes | SuperAdmin |
| GET | `/api/licenses/{key}` | Get license details | Yes | TenantOwner+ |
| PUT | `/api/licenses/{key}/assign` | Assign to tenant | Yes | SuperAdmin |
| POST | `/api/licenses/{key}/transfer` | Transfer ownership | Yes | SuperAdmin |

#### **Audit Log**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/audit-logs` | List audit logs | Yes | Admin+ |
| GET | `/api/audit-logs/{id}` | Get log details | Yes | Admin+ |

#### **Admin Panel**

| Method | Endpoint | Description | Auth Required | Role |
|--------|----------|-------------|---------------|------|
| GET | `/api/admin/tenants` | List all tenants | Yes | SuperAdmin |
| GET | `/api/admin/statistics` | Global statistics | Yes | SuperAdmin |

---

## Security Implementation

### Authentication Flow

```
1. User Registration
   ├─→ POST /api/auth/register
   ├─→ Hash password (bcrypt, cost 10)
   ├─→ Generate verification code (6 digits)
   ├─→ Send verification email
   └─→ Return user_id

2. Email Verification
   ├─→ POST /api/auth/verify-email
   ├─→ Validate code & expiration
   ├─→ Mark email as verified
   └─→ Return success

3. Login
   ├─→ POST /api/auth/login
   ├─→ Validate credentials
   ├─→ Check email verification
   ├─→ Generate JWT token (24h expiry)
   └─→ Return token + user data

4. Authenticated Request
   ├─→ Include Authorization: Bearer <token>
   ├─→ JWT validation middleware
   ├─→ Extract user & tenant info
   ├─→ Apply tenant isolation
   └─→ Process request
```

### Role-Based Access Control (RBAC)

| Role | Level | Permissions |
|------|-------|-------------|
| **SuperAdmin** | 4 | Full system access, cross-tenant visibility, license management |
| **TenantOwner** | 3 | Full tenant access, user management, branch creation, license assignment |
| **Admin** | 2 | Transaction management, reports, user viewing, cash balance adjustments |
| **User** | 1 | Basic transactions, customer management, view own data |

### Middleware Chain

```
HTTP Request
    ↓
CORS Middleware (rs/cors)
    ↓
Auth Middleware (JWT validation)
    ↓
Tenant Isolation Middleware
    ↓
Role Check Middleware
    ↓
Handler Function
    ↓
HTTP Response
```

### Security Features

1. **Password Security**
   - Bcrypt hashing (cost factor 10)
   - Minimum 8 characters
   - Requires: uppercase, lowercase, number, symbol

2. **JWT Tokens**
   - HS256 signing algorithm
   - 24-hour expiration
   - Claims: user_id, tenant_id, role, email

3. **Tenant Isolation**
   - Automatic tenant_id filtering on all queries
   - SuperAdmin bypass for cross-tenant access
   - Middleware enforcement

4. **Audit Logging**
   - All sensitive operations logged
   - IP address & user agent captured
   - Old/new value comparison
   - Immutable log entries

---

## Key Features Implementation

### 1. Multi-Tenant System

**Implementation**:
- Every database query includes `tenant_id` filter (except SuperAdmin)
- Middleware automatically injects tenant context
- Customer table is global but linked via `customer_tenant_links`

**Code Example**:
```go
// Tenant isolation in queries
var transactions []models.Transaction
db.Where("tenant_id = ?", user.TenantID).Find(&transactions)

// SuperAdmin override
if user.Role == "SuperAdmin" {
    db.Find(&transactions) // No tenant filter
}
```

### 2. Pickup Transaction System

**Implementation**:
- 6-digit unique code generation
- Cross-branch transfer capability
- Phone & ID verification

**Code Flow**:
```go
1. Create Pickup
   ├─→ Generate unique 6-digit code
   ├─→ Link sender & receiver branches
   ├─→ Store customer info (phone, ID)
   ├─→ Set status = PENDING
   └─→ Return pickup code

2. Complete Pickup
   ├─→ Search by code + phone verification
   ├─→ Validate ID number
   ├─→ Check branch authorization
   ├─→ Update status = PICKED_UP
   ├─→ Create completion transaction
   └─→ Log audit trail
```

### 3. Global Customer Database

**Implementation**:
- Customers stored globally (no tenant_id on customer table)
- `customer_tenant_links` table for associations
- SuperAdmin can see all customers
- Tenants only see their linked customers

**Code Example**:
```go
// For SuperAdmin
db.Find(&customers)

// For Tenant
db.Joins("JOIN customer_tenant_links ON customers.id = customer_tenant_links.customer_id").
   Where("customer_tenant_links.tenant_id = ?", tenantID).
   Find(&customers)
```

### 4. Cash Balance Auto-Calculation

**Implementation**:
- Calculated from transaction data
- Multi-currency support
- Real-time updates on transaction creation/modification

**Calculation Logic**:
```go
func CalculateCashBalance(db *gorm.DB, branchID, tenantID, currency string) float64 {
    var total float64
    
    // Sum all completed transactions for this branch + currency
    db.Model(&models.Transaction{}).
       Where("branch_id = ? AND tenant_id = ? AND currency = ? AND status = 'COMPLETED'").
       Select("SUM(amount)").
       Scan(&total)
    
    return total
}
```

### 5. Audit Logging

**Implementation**:
- Automatic logging on sensitive operations
- Middleware-based capture
- Immutable records

**Logged Operations**:
- User login/logout
- Transaction create/update/delete
- Cash balance adjustments
- User role changes
- Branch creation/modification

---

## Data Flow

### Transaction Creation Flow

```
User (Frontend)
    ↓ POST /api/transactions
Frontend (Next.js)
    ↓ axios.post with JWT token
Backend Router
    ↓
Auth Middleware (JWT validation)
    ↓
Tenant Middleware (isolation)
    ↓
Transaction Handler
    ↓
Transaction Service
    ├─→ Validate input
    ├─→ Check customer exists (or create)
    ├─→ Verify branch access
    ├─→ Create transaction record
    ├─→ Update cash balance
    ├─→ Log audit trail
    └─→ Return transaction
        ↓
Database (GORM)
    ↓ Save to SQLite
Response (JSON)
    ↓
Frontend (React Query cache update)
    ↓
UI Update (Real-time)
```

### Pickup Completion Flow

```
User enters pickup code + phone
    ↓ POST /api/pickups/{code}/complete
Search pickup by code
    ↓
Verify phone number matches
    ↓
Check receiver branch access
    ↓
Validate ID number (optional)
    ↓
Update pickup status = PICKED_UP
    ↓
Create completion transaction
    ↓
Update cash balance
    ↓
Log audit trail
    ↓
Return success + transaction details
```

---

## File Structure

### Backend Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `cmd/server/main.go` | Application entry point | ~60 |
| `pkg/api/router.go` | Route definitions & middleware | ~300 |
| `pkg/middleware/auth_middleware.go` | JWT validation | ~150 |
| `pkg/middleware/tenant_middleware.go` | Tenant isolation | ~100 |
| `pkg/models/transaction.go` | Transaction model | ~200 |
| `pkg/models/customer.go` | Customer model | ~100 |
| `pkg/models/user.go` | User model | ~150 |
| `pkg/services/transaction.go` | Transaction business logic | ~400 |
| `pkg/services/auth_service.go` | Authentication logic | ~300 |
| `pkg/database/db.go` | Database initialization | ~200 |

### Frontend Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `app/layout.tsx` | Root layout | ~50 |
| `app/(dashboard)/layout.tsx` | Dashboard layout | ~200 |
| `app/(dashboard)/dashboard/page.tsx` | Main dashboard | ~400 |
| `src/lib/api.ts` | API client | ~100 |
| `src/queries/useTransactions.ts` | Transaction hooks | ~200 |
| `src/components/TransactionForm.tsx` | Transaction form | ~500 |

---

## Environment Variables

### Backend (.env)

```bash
# Database
DATABASE_URL=./transactions.db

# Server
PORT=8080

# JWT
JWT_SECRET=your-super-secret-key-change-in-production

# Email (Resend)
RESEND_API_KEY=re_your_api_key
FROM_EMAIL=noreply@yourdomain.com

# Frontend URL (for email links)
FRONTEND_URL=http://localhost:3000
```

### Frontend (.env.local)

```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

---

## Build & Deployment

### Development

**Backend:**
```bash
cd backend
go run cmd/server/main.go
```

**Frontend:**
```bash
cd frontend
npm run dev
```

### Production Build

**Backend:**
```bash
cd backend
go build -o server cmd/server/main.go
./server
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

---

## Testing Strategy

### Backend Tests
- Unit tests for services
- Integration tests for handlers
- Database transaction tests

### Frontend Tests
- Component tests (React Testing Library)
- Integration tests (Cypress/Playwright)
- E2E tests for critical flows

---

## Performance Considerations

1. **Database Indexing**
   - All foreign keys indexed
   - Composite indexes on frequently queried columns
   - `tenant_id` indexed on all tenant-scoped tables

2. **Caching (Frontend)**
   - TanStack Query with 5-minute stale time
   - Optimistic updates for mutations

3. **Query Optimization**
   - Eager loading with GORM Preload
   - Pagination on large datasets
   - Selective field queries

---

## Future Enhancements

- [ ] Real-time notifications (WebSocket)
- [ ] Advanced reporting with charts
- [ ] Mobile app (React Native)
- [ ] Payment gateway integration
- [ ] Multi-language support (i18n)
- [ ] Dark mode theme
- [ ] Two-factor authentication (2FA)
- [ ] API rate limiting
- [ ] Redis caching layer
- [ ] PostgreSQL migration option

---

## Changelog

### Version 1.0.0 (November 11, 2025)
- Initial release
- Multi-tenant CRM system
- 4 transaction types
- Pickup transaction system
- Global customer database
- Cash balance management
- License system
- Audit logging
- Email verification
- Swagger documentation

---

<div align="center">

**📘 Code Blueprint - Digital Transaction Ledger CRM**

*Last Updated: November 11, 2025*

Made with ❤️ by Tamim Orif

</div>
