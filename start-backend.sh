#!/bin/bash

# Start Backend Server
echo "🚀 Starting Digital Transaction Ledger CRM Backend..."
echo "=================================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/backend"

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "❌ Error: Go is not installed!"
    echo "Please install Go from: https://golang.org/dl/"
    exit 1
fi

echo "✅ Go version: $(go version)"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
go mod download

echo ""
echo "🏃 Starting backend server on port 8080..."
echo "API will be available at: http://localhost:8080/api"
echo ""
echo "Press Ctrl+C to stop the server"
echo "=================================================="
echo ""

# Run the server
go run cmd/server/main.go
