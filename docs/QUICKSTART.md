# 🚀 Quick Start Guide

## The Problem You Were Having

Your backend (Go) and frontend (Next.js) weren't connected because:
1. ✅ **Missing API URL**: Your `.env.local` file was empty
2. ✅ **No run instructions**: No clear guide on starting both servers
3. ✅ **Two separate servers**: Backend and frontend run independently

## ✨ I've Fixed Everything!

### What I Did:
1. ✅ Created `.env.local` with correct API URL
2. ✅ Created easy-to-use startup scripts
3. ✅ Created comprehensive README with troubleshooting

---

## 🎯 How to Run Your Project (3 Options)

### Option 1: Automatic (Easiest) ⭐
Run both servers with one command:
```bash
./start-all.sh
```

### Option 2: Separate Terminals (Recommended for Development)
**Terminal 1** (Backend):
```bash
./start-backend.sh
```

**Terminal 2** (Frontend):
```bash
./start-frontend.sh
```

### Option 3: Manual
**Terminal 1** (Backend):
```bash
cd backend
go run cmd/server/main.go
```

**Terminal 2** (Frontend):
```bash
cd frontend
npm install  # first time only
npm run dev
```

---

## 📍 Access Your App

After starting both servers:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api
- **Health Check**: http://localhost:8080/api/health

---

## 🔍 Why It Might Not Work

### Check #1: Prerequisites Installed?
```bash
go version    # Should show go1.24+
node --version # Should show v18.0+
```

**Not installed?**
- Go: https://golang.org/dl/
- Node.js: https://nodejs.org/

### Check #2: Ports Available?
Your app needs ports 8080 and 3000 to be free.

**If port is busy:**
```bash
# Kill process on port 8080 (backend)
lsof -ti:8080 | xargs kill -9

# Kill process on port 3000 (frontend)
lsof -ti:3000 | xargs kill -9
```

### Check #3: Dependencies Installed?
```bash
# Backend
cd backend && go mod download

# Frontend
cd frontend && npm install
```

---

## 🎓 Understanding Your Setup

### Your Architecture:
```
┌─────────────┐         ┌─────────────┐         ┌──────────┐
│   Browser   │  HTTP   │   Frontend  │   API   │  Backend │
│ (localhost: │ ───────>│   Next.js   │ ───────>│    Go    │
│    3000)    │         │ (port 3000) │         │ (port    │
└─────────────┘         └─────────────┘         │  8080)   │
                                                 └────┬─────┘
                                                      │
                                                 ┌────▼─────┐
                                                 │  SQLite  │
                                                 │ Database │
                                                 └──────────┘
```

### What Each Part Does:

1. **Backend (Go)** - Port 8080
   - Handles data operations
   - REST API endpoints
   - Database management
   - File: `backend/cmd/server/main.go`

2. **Frontend (Next.js)** - Port 3000
   - User interface
   - React components
   - Calls backend API
   - File: `frontend/src/lib/api.ts`

3. **Connection** - `.env.local`
   - Contains: `NEXT_PUBLIC_API_URL=http://localhost:8080`
   - Tells frontend where backend is

---

## 🐛 Common Errors & Solutions

### Error: "Cannot connect to backend"
**Solution:**
1. Make sure backend is running (check terminal 1)
2. Check if http://localhost:8080/api/health works
3. Verify `.env.local` exists with correct URL

### Error: "Module not found" (Frontend)
**Solution:**
```bash
cd frontend
rm -rf node_modules
npm install
```

### Error: "Package not found" (Backend)
**Solution:**
```bash
cd backend
go mod tidy
go mod download
```

### Error: "Port already in use"
**Solution:**
```bash
# Find what's using the port
lsof -ti:8080  # or :3000

# Kill it
lsof -ti:8080 | xargs kill -9
```

### Error: "CORS policy" in browser
**Solution:** This is already configured! If you still see it:
- Make sure backend is on port 8080
- Make sure frontend is on port 3000
- Check `backend/pkg/api/router.go` CORS settings

---

## 🎯 Testing the Connection

### 1. Test Backend is Running:
```bash
curl http://localhost:8080/api/health
```
**Should return:** `{"status":"ok","timestamp":"..."}`

### 2. Test API Endpoints:
```bash
# Get all clients
curl http://localhost:8080/api/clients

# Create a test client
curl -X POST http://localhost:8080/api/clients \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Client","email":"test@example.com"}'
```

### 3. Test Frontend:
- Open http://localhost:3000
- Open browser console (F12)
- Should see no errors
- Try creating a client/transaction

---

## 📚 Next Steps

1. **Read the full README.md** for detailed documentation
2. **Explore the API** endpoints
3. **Check the code structure** in both backend and frontend
4. **Start developing!**

---

## 💡 Pro Tips

1. **Always start backend first**, then frontend
2. **Keep both terminals visible** to see logs
3. **Use browser DevTools** (F12) to debug frontend
4. **Check terminal output** for backend errors
5. **Database auto-creates** on first run (transactions.db)

---

## 📞 Still Stuck?

Run this diagnostic:
```bash
# Check what's running
lsof -ti:8080  # Backend port
lsof -ti:3000  # Frontend port

# Check if files exist
ls backend/cmd/server/main.go
ls frontend/.env.local
cat frontend/.env.local

# Check dependencies
cd backend && go mod verify
cd frontend && npm list --depth=0
```

Send me the output and I can help debug!

---

**Remember:** You need BOTH servers running at the same time! 🚀
