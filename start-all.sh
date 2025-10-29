#!/bin/bash

# Start both Backend and Frontend
echo "🚀 Starting Digital Transaction Ledger CRM (Full Stack)"
echo "======================================================="
echo ""
echo "This will start both the backend and frontend servers."
echo "You'll need to keep this terminal open."
echo ""
echo "Backend will run on: http://localhost:8080"
echo "Frontend will run on: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo "======================================================="
echo ""

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    # Kill all child processes
    pkill -P $$
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# Start backend in background
echo "📦 Starting backend on port 8080..."
cd "$SCRIPT_DIR/backend"
go run cmd/server/main.go > /tmp/backend-output.log 2>&1 &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait a bit for backend to initialize
sleep 3

# Test if backend is running
if curl -s http://localhost:8080/api/health > /dev/null 2>&1; then
    echo "✅ Backend is healthy"
else
    echo "⚠️  Backend may still be starting..."
fi

echo ""
echo "⚛️  Starting frontend on port 3000..."
cd "$SCRIPT_DIR/frontend"
npm run dev > /tmp/frontend-output.log 2>&1 &
FRONTEND_PID=$!
echo "✅ Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "======================================================="
echo "✅ Both servers are running!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔌 Backend:  http://localhost:8080/api"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/backend-output.log"
echo "   Frontend: tail -f /tmp/frontend-output.log"
echo ""
echo "Press Ctrl+C or Command+C to stop both servers"
echo "======================================================="

# Wait for both processes
wait
