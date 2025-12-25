# Build Stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

# Install build dependencies if needed (e.g. gcc for CGO)
RUN apk add --no-cache gcc musl-dev

# Copy module files
COPY go.mod ./
COPY go.sum* ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
# CGO_ENABLED=1 is often needed for sqlite (if used). 
# If utilizing generic sqlite driver without CGO, use 0. 
# But Mattn/go-sqlite3 requires CGO.
# Assuming CGO is needed.
RUN CGO_ENABLED=1 GOOS=linux go build -ldflags="-w -s" -o server ./backend/cmd/server

# Runtime Stage
FROM alpine:latest

WORKDIR /app

# Install runtime dependencies (sqlite usually needs libc)
RUN apk add --no-cache ca-certificates sqlite-libs

# Copy binary from builder
COPY --from=builder /app/server .

# Create uploads directory
RUN mkdir -p uploads

# Expose port (Backend uses 8080)
EXPOSE 8080

CMD ["./server"]
