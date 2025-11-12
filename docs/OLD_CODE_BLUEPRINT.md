# Digital Transaction Ledger CRM - Code Blueprint

A single-file, high-level blueprint of the codebase that explains what it is, what it does, and how the pieces fit together. Use this as a quick orientation for contributors and as an engineering reference.

## 1) Executive summary

Digital Transaction Ledger CRM is a multi-tenant platform for currency exchange and remittance businesses. It provides:
- Tenant and branch management with license-based limits
- End-to-end transaction management (cash exchange, bank transfer, money pickup, walk-in)
- Inter-branch pickup workflow with 6-digit codes
- Global customer directory with per-tenant linkage
- Cash balance auto-calculation + manual adjustments with audit trail
- Admin features: licensing, tenant oversight, audit logs, exports, and statistics

Stack:
- Backend: Go 1.24+, Gorilla Mux, GORM, SQLite (default, Postgres-ready), JWT, bcrypt, Swagger
- Frontend: Next.js (App Router) + TypeScript, React Query v5, TailwindCSS, shadcn/ui, Axios

---

## 2) System diagram (runtime)

```
┌──────────────┐     HTTPS      ┌────────────────────┐      DB Driver      ┌────────────────┐
│   Browser    │ ─────────────▶ │ Next.js Frontend   │ ──────────────────▶ │ SQLite/Postgres│
│ (localhost)  │                │ (port 3000)        │                     │  (GORM)        │
└──────────────┘                └─────────▲──────────┘                     └────────────────┘
                      REST /api          │
                                        │
                                   ┌─────┴─────┐
                                   │ Go Backend│
                                   │ (port 8080)
                                   │ Gorilla Mux + GORM + JWT
                                   └───────────┘
```

---

## 3) Backend architecture

Entrypoint:
- `backend/cmd/server/main.go`
  - Loads env via `godotenv`
  - Initializes DB via `database.InitDB`
  - Builds HTTP router via `api.NewRouter(db)`
  - Serves on `PORT` (default 8080)

Routing:
- `backend/pkg/api/router.go`
  - Public: auth endpoints, health, swagger
  - Protected (auth + tenant isolation): transactions, clients, users, branches, pickups, customers, cash-balances, statistics, exports, audit logs, tenant ops
  - SuperAdmin: licenses, tenants, users, dashboard stats
  - CORS: `http://localhost:3000`, `http://localhost:3001`

Middleware:
- Auth: validates JWT, loads user, status checks
- Tenant isolation: scopes data by tenant unless SuperAdmin
- Role helpers: SuperAdmin / TenantOwner, feature gate stub

Models (selected):
- User: roles, trial, primary branch, status
- Transaction: types, edit/cancel metadata, branch/client relations
- License: activation, limits, duration types
- Plus: tenant, branch, pickup_transaction, customer (global), cash_balance, adjustments, audit_log

Services (selected):
- Auth: register (creates tenant), verify email (6-digit, 10 min), login (24h JWT), trial expiry logic
- License, Statistics, Cash Balance, Pickup, Branch, Customer, etc.

Handlers (HTTP adapters):
- Auth, License, Transaction/Client, Admin, Branch, User, Pickup, Customer, Cash Balance, Statistics, Audit

Database:
- GORM + SQLite default; Postgres driver included
- Indexed on tenant_id, dates, status

Security:
- JWT HS256 24h expiry
- Bcrypt password hashing
- Role-based + tenant isolation

---

## 4) Request lifecycle (protected route)
1. Authorization header parsed
2. JWT validated -> user loaded
3. Tenant ID placed in context (nil for SuperAdmin)
4. Handler invokes service with scoped queries
5. JSON response returned

---

## 5) License and limits
- Types: trial, starter, professional, business, enterprise, custom
- Durations: lifetime, monthly, yearly, custom_days
- Limits: user count, max branches; activation updates tenant status

---

## 6) Key workflows
Transactions: create/edit/cancel, status + history, cash balance refresh.
Pickup: create (sender branch) -> code -> search -> verify -> pick-up.
Customers: global phone uniqueness, per-tenant linkage updates stats.
Cash balances: auto from transactions + manual adjustments with audit trail.
Audit: logs sensitive actions with context.

---

## 7) API surface (high-level)
Public: register, verify-email, resend-code, login, health.
Protected: transactions, clients, users, branches, pickups, customers, cash-balances, statistics, exports, tenant updates, audit logs.
SuperAdmin: licenses, tenants, users, dashboard.
Swagger: `/swagger/*`.

---

## 8) Frontend architecture
- Layout: `frontend/app/layout.tsx` (providers + toaster)
- Landing: `frontend/app/page.tsx`
- Auth pages: `login`, `register`, `verify-email`
- Dashboard area: `(dashboard)` pages (account, admin, cash-balance, company-overview, etc.)
- State: React Query for caching and invalidations
- Forms: React Hook Form + Zod
- UI: TailwindCSS + shadcn/ui + Lucide icons
- Env: `NEXT_PUBLIC_API_URL` for backend base

---

## 9) Local development
Backend:
- `cd backend`
- `go mod download`
- `go run cmd/server/main.go`
Frontend:
- `cd frontend`
- `npm install`
- `npm run dev`

---

## 10) Error handling & security
- Unified JSON error responses
- Suspended / trial-expired checks during auth
- Tenant scoping enforced early
- CORS restricted dev origins

---

## 11) Performance & scalability
- Indexes for query speed
- React Query reduces redundant calls
- Pagination on heavy collections
- Postgres option for production scaling

---

## 12) Testing guidance (suggested)
- Auth: register/verify/login + invalid code
- Tenant isolation: ensure cross-tenant access blocked
- Pickup lifecycle: create->search->pickup
- Cash balance recalculation accuracy
- License activation & revocation side effects

---

## 13) Extension points
- Password reset & invitations
- Rate limiting & hardening
- WebSocket real-time updates
- i18n, dark mode, richer charts
- Automated backups

---

## 14) File map
Backend: entry (`cmd/server`), router & handlers (`pkg/api`), services (`pkg/services`), models (`pkg/models`), middleware (`pkg/middleware`), db init (`pkg/database`), docs (`docs/`).
Frontend: app routes (`app/`), components/providers (`src/components`), config (`package.json`, `next.config.js`, `tsconfig.json`).

---

## 15) Glossary
- Tenant: organization instance
- Branch: subdivision of tenant
- License: feature/limit grant
- Pickup: cross-branch transfer redeemed via code
- Cash balance: computed + adjusted currency totals

---

References: `README.md`, `SYSTEM_ARCHITECTURE.md`, `backend/API_DOCUMENTATION.md`.
