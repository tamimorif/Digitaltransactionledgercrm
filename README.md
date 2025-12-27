# VeloPay - Digital Transaction Ledger

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Go](https://img.shields.io/badge/backend-Go_1.24-00ADD8.svg?logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/frontend-Next.js_16-black.svg?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/library-React_19-61DAFB.svg?logo=react&logoColor=black)

🌐 **Live at: [velopay.ca](https://velopay.ca)** | Powered by **Yas Exchange**

A powerful digital transaction ledger designed for money exchange businesses. Replace spreadsheets with real-time transaction tracking, automated profit calculations, and comprehensive reporting. Built with a robust **Go** backend and a modern **Next.js** frontend.

## 🚀 Key Features

- **Multi-Currency Ledger**: Real-time tracking of balances across multiple currencies (USD, EUR, CAD, IRR, etc.).
- **Smart Remittances**: End-to-end management of remittance flows with automated settlement tracking and profit calculation.
- **Role-Based Access Control (RBAC)**: Secure hierarchy including SuperAdmin, Tenant Owner, Admin, and Standard User roles.
- **Real-Time Updates**: WebSocket integration for instant dashboard and transaction updates across all connected clients.
- **Advanced Reporting**: Comprehensive financial reports, daily/monthly statements, and profit/loss analysis.
- **Accounting & Reconciliation**: Built-in tools for verifying transaction logs and reconciling discrepancies.
- **Multi-Tenant Architecture**: Support for multiple isolated organizations within a single deployment.

## 🛠 Tech Stack

### Backend
- **Language**: Go (Golang) 1.24
- **Router**: Gorilla Mux
- **Database ORM**: GORM
- **Database**: SQLite (Development) / PostgreSQL (Production)
- **Authentication**: JWT (JSON Web Tokens) with Refresh Token rotation
- **Real-time**: Gorilla WebSocket
- **Email**: Resend API

### Frontend
- **Framework**: Next.js 16 (App Router + Turbopack)
- **Library**: React 19
- **Language**: TypeScript
- **Styling**: TailwindCSS & Shadcn/UI
- **State Management**: TanStack Query v5 (React Query)
- **Testing**: Playwright (E2E)
- **PWA**: Progressive Web App support

## 🌐 Production Deployment

| Service | URL | Platform |
|---------|-----|----------|
| **Frontend** | [velopay.ca](https://velopay.ca) | Vercel |
| **Backend API** | [api.velopay.ca](https://api.velopay.ca/api/health) | Railway |
| **Database** | PostgreSQL | Railway |

## 📦 Prerequisites

Before you begin, ensure you have the following installed:
- [Go](https://go.dev/dl/) (v1.24 or higher)
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## ⚡ Getting Started (Local Development)

### 1. Backend Setup

```bash
cd backend
go mod download
cp .env.example .env  # Configure your environment variables
go run ./cmd/server/main.go
```
The server will start on `http://localhost:8080`.

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
```

Run the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

## 🧪 Testing

### Backend Tests
```bash
cd backend
go test ./...
```

### Frontend E2E Tests
```bash
cd frontend
npx playwright test
```

## 📂 Project Structure

```
.
├── backend/                # Go Backend
│   ├── cmd/                # Entry points
│   ├── pkg/
│   │   ├── api/            # HTTP Handlers & Routers
│   │   ├── models/         # Database Models
│   │   ├── services/       # Business Logic
│   │   └── middleware/     # Auth, Rate Limiting, etc.
│   └── railway.toml        # Railway deployment config
├── frontend/               # Next.js Frontend
│   ├── app/                # App Router Pages & Layouts
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── lib/            # Utilities & API Clients
│   │   └── queries/        # React Query Hooks
│   ├── e2e/                # Playwright Tests
│   └── vercel.json         # Vercel deployment config
└── README.md               # Project Documentation
```

## 🚀 Deployment

### Auto-Deploy Workflow
Push to `main` branch triggers automatic deployment:
- **Vercel** rebuilds frontend → velopay.ca
- **Railway** rebuilds backend → api.velopay.ca

### Environment Variables

**Backend (Railway):**
- `DATABASE_URL` - PostgreSQL connection (auto-set by Railway)
- `JWT_SECRET` - Secret key for JWT tokens
- `FRONTEND_URL` - https://velopay.ca
- `RESEND_API_KEY` - For email verification

**Frontend (Vercel):**
- `NEXT_PUBLIC_API_URL` - https://api.velopay.ca/api

## 📄 License

This project is licensed under the MIT License.
