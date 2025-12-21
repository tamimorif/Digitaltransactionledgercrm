# Digital Transaction Ledger CRM

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Go](https://img.shields.io/badge/backend-Go_1.24-00ADD8.svg?logo=go&logoColor=white)
![Next.js](https://img.shields.io/badge/frontend-Next.js_15-black.svg?logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/library-React_19-61DAFB.svg?logo=react&logoColor=black)

A high-performance, enterprise-grade CRM and ledger system designed for managing complex digital transactions, remittances, and multi-currency financial operations. Built with a robust **Go** backend and a modern, responsive **Next.js** frontend.

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

### Frontend
- **Framework**: Next.js 15 (App Router)
- **Library**: React 19
- **Language**: TypeScript
- **Styling**: TailwindCSS & Shadcn/UI
- **State Management**: TanStack Query v5 (React Query)
- **Testing**: Playwright (E2E)

## 📦 Prerequisites

Before you begin, ensure you have the following installed:
- [Go](https://go.dev/dl/) (v1.24 or higher)
- [Node.js](https://nodejs.org/) (v18.0.0 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

## ⚡ Getting Started

### 1. Backend Setup

Navigate to the backend directory and install dependencies:

```bash
cd backend
go mod download
```

Create a `.env` file in the `backend` folder (copy from example if available, or set manually):
```env
# Example .env configuration
PORT=8080
DB_PATH=dev.db
JWT_SECRET=your-secret-key-change-in-production
# SMTP Configuration (Optional - for email features)
# SMTP_HOST=smtp.example.com
# ...
```

Run the backend server:
```bash
go run ./cmd/server/main.go
```
The server will start on `http://localhost:8080`.

### 2. Frontend Setup

Navigate to the frontend directory and install dependencies:

```bash
cd frontend
npm install
```

Create a `.env.local` file in the `frontend` folder:
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
Run the Go test suite:
```bash
cd backend
go test ./...
```

### Frontend E2E Tests
Run the Playwright end-to-end tests:
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
│   └── ...
├── frontend/               # Next.js Frontend
│   ├── app/                # App Router Pages & Layouts
│   ├── src/
│   │   ├── components/     # UI Components
│   │   ├── lib/            # Utilities & API Clients
│   │   └── queries/        # React Query Hooks
│   ├── e2e/                # Playwright Tests
│   └── ...
└── README.md               # Project Documentation
```

## 📄 License

This project is licensed under the MIT License.
