# 🚀 Deployment Guide - Currency Exchange CRM

## ✅ Your Code is Ready for Deployment!

Your application now supports:
- ✅ SQLite for local development
- ✅ PostgreSQL for production
- ✅ Docker containers
- ✅ Render.com one-click deployment

---

## 🎯 Option 1: Deploy to Render.com (Easiest)

### Prerequisites:
1. GitHub account
2. Code pushed to GitHub
3. Render.com account (free)

### Steps:

1. **Push your code to GitHub:**
   ```bash
   git add .
   git commit -m "Ready for production deployment"
   git push origin main
   ```

2. **Go to Render.com:**
   - Visit: https://render.com
   - Sign up with GitHub
   - Click "New +"
   - Select "Blueprint"

3. **Connect Repository:**
   - Select your repository: `Digitaltransactionledgercrm`
   - Render will auto-detect the `render.yaml` file
   - Click "Apply"

4. **Done!** 🎉
   - Backend will be at: `https://currency-exchange-backend.onrender.com`
   - Frontend will be at: `https://currency-exchange-frontend.onrender.com`
   - Database automatically created and connected

### Cost:
- Free tier (services sleep after 15 min)
- PostgreSQL: Free for 90 days, then $7/month

---

## 🎯 Option 2: Deploy to Railway.app

### Steps:

1. **Install Railway CLI:**
   ```bash
   npm i -g @railway/cli
   ```

2. **Login:**
   ```bash
   railway login
   ```

3. **Deploy:**
   ```bash
   # Deploy backend
   cd backend
   railway up
   
   # Deploy frontend
   cd ../frontend
   railway up
   ```

4. **Set Environment Variables:**
   ```bash
   railway variables set DATABASE_URL=<postgres-url>
   railway variables set NEXT_PUBLIC_API_URL=<backend-url>
   ```

### Cost:
- $5 free credit per month
- No sleeping
- Better performance

---

## 🎯 Option 3: Manual Deployment

### Backend:

1. **Build:**
   ```bash
   cd backend
   go build -o server cmd/server/main.go
   ```

2. **Run with PostgreSQL:**
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:5432/db"
   ./server
   ```

### Frontend:

1. **Build:**
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Run:**
   ```bash
   export NEXT_PUBLIC_API_URL="https://your-backend-url.com"
   npm start
   ```

---

## 🐳 Docker Deployment

### Build and Run:

```bash
# Backend
cd backend
docker build -t currency-exchange-backend .
docker run -p 8080:8080 \
  -e DATABASE_URL="postgresql://..." \
  currency-exchange-backend

# Frontend
cd frontend
docker build -t currency-exchange-frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL="https://..." \
  currency-exchange-frontend
```

---

## 📝 Environment Variables Reference

### Backend (.env or hosting settings):
```
PORT=8080
DATABASE_URL=postgresql://user:password@host:5432/database
```

### Frontend (.env.local or hosting settings):
```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
NODE_ENV=production
```

---

## ✅ Pre-Deployment Checklist

- [ ] Code pushed to GitHub
- [ ] PostgreSQL database created (Render/Railway does this automatically)
- [ ] Environment variables configured
- [ ] Backend health check works: `/api/health`
- [ ] Frontend connects to backend
- [ ] CORS allows your frontend domain

---

## 🔧 Testing Production Locally

Test with PostgreSQL before deploying:

1. **Start PostgreSQL (Docker):**
   ```bash
   docker run --name postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres
   ```

2. **Set DATABASE_URL:**
   ```bash
   export DATABASE_URL="postgresql://postgres:password@localhost:5432/postgres"
   ```

3. **Run backend:**
   ```bash
   cd backend
   go run cmd/server/main.go
   ```

4. **Run frontend:**
   ```bash
   cd frontend
   NEXT_PUBLIC_API_URL=http://localhost:8080 npm run dev
   ```

---

## 🆘 Troubleshooting

### Backend won't start:
- Check DATABASE_URL format
- Ensure PostgreSQL is accessible
- Check logs: `railway logs` or Render dashboard

### Frontend can't connect:
- Verify NEXT_PUBLIC_API_URL is correct
- Check CORS settings in backend
- Ensure backend is running

### Database migration fails:
- Check PostgreSQL version compatibility
- Ensure database user has CREATE TABLE permissions

---

## 📞 Need Help?

Common issues:
1. **CORS errors**: Add your frontend domain to backend CORS settings
2. **Connection refused**: Backend not started or wrong URL
3. **Database errors**: Check DATABASE_URL format and credentials

---

## 🎉 You're Ready!

Choose your deployment method:
- **Easiest**: Render.com (use render.yaml)
- **Best Free Tier**: Railway.app
- **Most Control**: Manual deployment or Docker

Your application will automatically:
- ✅ Use PostgreSQL in production
- ✅ Use SQLite in local development
- ✅ Auto-migrate database schema
- ✅ Handle CORS properly

**Good luck with your deployment!** 🚀
