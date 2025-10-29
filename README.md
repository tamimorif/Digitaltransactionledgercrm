# Digital Transaction Ledger CRM

A full-stack application with Go backend and Next.js frontend for managing client transactions.

## 🏗️ Architecture

- **Backend**: Go (Golang) REST API with GORM and SQLite
- **Frontend**: Next.js 14 (React) with TypeScript
- **Database**: SQLite (Development)

## 📋 Prerequisites

Before running this project, make sure you have installed:

- **Go** (version 1.24+): [Download Go](https://golang.org/dl/)
- **Node.js** (version 18+): [Download Node.js](https://nodejs.org/)
- **npm** or **yarn** (comes with Node.js)

### Check if installed:
```bash
go version          # Should show go1.24 or higher
node --version      # Should show v18.0.0 or higher
npm --version       # Should show 9.0.0 or higher
```

## 🚀 Quick Start Guide

### Step 1: Start the Backend (Go API Server)

Open a terminal and run:

```bash
# Navigate to backend directory
cd backend

# Install Go dependencies
go mod download

# Run the server
go run cmd/server/main.go
```

**Expected output:**
```
Starting server on :8080
API available at http://localhost:8080/api
```

**Backend API will be available at:** `http://localhost:8080`

**Test if backend is running:**
```bash
# In a new terminal
curl http://localhost:8080/api/health
```

### Step 2: Start the Frontend (Next.js)

Open a **NEW terminal** (keep the backend running) and run:

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (first time only)
npm install

# Start the development server
npm run dev
```

**Expected output:**
```
Ready - started server on 0.0.0.0:3000, url: http://localhost:3000
```

**Frontend will be available at:** `http://localhost:3000`

### Step 3: Access the Application

Open your browser and go to: **http://localhost:3000**

## 🔧 Configuration

### Backend Configuration

The backend can be configured using environment variables:

```bash
# Optional: Set custom port (default is 8080)
export PORT=8080

# Optional: Set custom database path (default is ./transactions.db)
export DATABASE_URL=./transactions.db
```

### Frontend Configuration

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

## 📡 API Endpoints

### Health Check
- `GET /api/health` - Check if server is running

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create new transaction
- `GET /api/transactions/{id}` - Get specific transaction
- `PUT /api/transactions/{id}` - Update transaction
- `DELETE /api/transactions/{id}` - Delete transaction
- `GET /api/transactions/search?q={query}` - Search transactions

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create new client
- `GET /api/clients/{id}` - Get specific client
- `PUT /api/clients/{id}` - Update client
- `DELETE /api/clients/{id}` - Delete client
- `GET /api/clients/{id}/transactions` - Get client's transactions
- `GET /api/clients/search?q={query}` - Search clients

## 🐛 Troubleshooting

### Backend Issues

**Problem: "cannot find module" or "package not found"**
```bash
cd backend
go mod download
go mod tidy
```

**Problem: "port 8080 already in use"**
```bash
# Find and kill the process using port 8080
lsof -ti:8080 | xargs kill -9

# Or use a different port
export PORT=8081
go run cmd/server/main.go
```

**Problem: "database is locked"**
```bash
# Remove the database file and restart
rm backend/transactions.db
go run cmd/server/main.go
```

### Frontend Issues

**Problem: "Cannot connect to API" or "Network Error"**
1. Make sure backend is running on port 8080
2. Check `frontend/.env.local` has the correct API URL
3. Check browser console for CORS errors

**Problem: "Module not found" errors**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

**Problem: "Port 3000 already in use"**
```bash
# Kill the process using port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
npm run dev -- -p 3001
```

### CORS Issues

If you see CORS errors in the browser console, the backend already has CORS configured for `localhost:3000` and `localhost:3001`. If you need to add more origins, edit `backend/pkg/api/router.go`:

```go
AllowedOrigins: []string{"http://localhost:3000", "http://localhost:3001", "http://localhost:YOUR_PORT"},
```

## 📂 Project Structure

```
├── backend/
│   ├── cmd/
│   │   └── server/
│   │       └── main.go          # Entry point
│   ├── pkg/
│   │   ├── api/
│   │   │   ├── handler.go       # HTTP handlers
│   │   │   └── router.go        # Routes & CORS
│   │   ├── database/
│   │   │   └── db.go            # Database initialization
│   │   ├── models/
│   │   │   └── transaction.go   # Data models
│   │   ├── services/
│   │   │   └── transaction.go   # Business logic
│   │   └── utils/
│   │       └── helper.go        # Utility functions
│   ├── go.mod                   # Go dependencies
│   └── transactions.db          # SQLite database (auto-generated)
│
└── frontend/
    ├── app/
    │   ├── page.tsx             # Main page
    │   └── layout.tsx           # App layout
    ├── src/
    │   ├── components/          # React components
    │   └── lib/
    │       └── api.ts           # API client
    ├── .env.local               # Environment variables
    └── package.json             # Node dependencies
```

## 🔄 Development Workflow

1. **Start backend first** (terminal 1):
   ```bash
   cd backend && go run cmd/server/main.go
   ```

2. **Start frontend** (terminal 2):
   ```bash
   cd frontend && npm run dev
   ```

3. **Make changes:**
   - Backend changes: Server auto-restarts with each `go run`
   - Frontend changes: Hot reload is automatic

4. **Test the API:**
   ```bash
   # Create a client
   curl -X POST http://localhost:8080/api/clients \
     -H "Content-Type: application/json" \
     -d '{"name":"John Doe","email":"john@example.com"}'
   
   # Get all clients
   curl http://localhost:8080/api/clients
   ```

## 🏗️ Building for Production

### Backend
```bash
cd backend
go build -o server cmd/server/main.go
./server
```

### Frontend
```bash
cd frontend
npm run build
npm run start
```

## 📝 Common Commands

### Backend
```bash
go run cmd/server/main.go    # Run server
go build cmd/server/main.go  # Build binary
go test ./...                # Run tests
go mod tidy                  # Clean dependencies
```

### Frontend
```bash
npm run dev      # Development server
npm run build    # Production build
npm run start    # Start production server
npm run lint     # Run linter
```

## 💡 Tips

1. **Always start the backend before the frontend**
2. **Keep both terminals open** while developing
3. **Check both terminal outputs** for errors
4. **Use browser DevTools** to check network requests
5. **Database is created automatically** on first run

## 🆘 Need Help?

If you're still having issues:

1. Check that both servers are running (backend on 8080, frontend on 3000)
2. Check the terminal outputs for error messages
3. Check browser console (F12) for frontend errors
4. Verify `.env.local` exists and has the correct API URL
5. Try clearing the database: `rm backend/transactions.db`

---

## Quick Checklist ✅

- [ ] Go installed (1.24+)
- [ ] Node.js installed (18+)
- [ ] Backend running on port 8080
- [ ] Frontend running on port 3000
- [ ] `.env.local` configured with API URL
- [ ] Both terminals open and showing no errors
- [ ] Browser can access http://localhost:3000
