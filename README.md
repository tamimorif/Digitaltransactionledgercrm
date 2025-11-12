# Digital Transaction Ledger CRM

A full-stack CRM application for managing client transactions with a Go backend and Next.js frontend.

## Tech Stack

- **Backend**: Go 1.24+ with GORM and SQLite
- **Frontend**: Next.js 14 with TypeScript
- **Database**: SQLite

## Prerequisites

- Go 1.24+
- Node.js 18+
- npm/yarn

## Quick Start

### Backend
```bash
cd backend
go mod download
go run cmd/server/main.go
```
Server runs at `http://localhost:8080`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
Application runs at `http://localhost:3000`

## API Endpoints

### Transactions
- `GET/POST /api/transactions`
- `GET/PUT/DELETE /api/transactions/{id}`
- `GET /api/transactions/search?q={query}`

### Clients
- `GET/POST /api/clients`
- `GET/PUT/DELETE /api/clients/{id}`
- `GET /api/clients/{id}/transactions`
- `GET /api/clients/search?q={query}`

## Configuration

Backend: Set `PORT` and `DATABASE_URL` environment variables
Frontend: Configure `NEXT_PUBLIC_API_URL` in `.env.local`

## Production Build

```bash
# Backend
cd backend && go build -o server cmd/server/main.go

# Frontend
cd frontend && npm run build && npm run start
```

## License

MIT