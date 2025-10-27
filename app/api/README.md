# Go Transaction Service

This is a Go-based transaction service that provides APIs for managing transactions and related operations.

## Project Structure

- **cmd/**: Contains the entry point of the application.
- **internal/**: Contains the core business logic, including models, handlers, and repository interfaces.
- **pkg/**: Contains utility packages and database connection logic.
- **go.mod**: Go module file that defines the module's dependencies.
- **go.sum**: Contains the checksums for the module's dependencies.
- **.env**: Environment variables for the application.
- **Dockerfile**: Docker configuration for containerizing the application.

## Getting Started

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd go-transaction-service
   ```

2. Install dependencies:
   ```bash
   go mod tidy
   ```

3. Run the application:
   ```bash
   go run cmd/server/main.go
   ```

## API Endpoints

- **Transactions**: Manage transactions.
- **Rates**: Manage daily rates.

## Contributing

Feel free to submit issues and pull requests. 

## License

This project is licensed under the MIT License.



<!-- # Create main directory structure in app/api
mkdir -p app/api/internal/{models,services,api}
mkdir -p app/api/pkg/database
mkdir -p app/api/cmd/server

# Create model files
touch app/api/internal/models/daily_rate.go
touch app/api/internal/models/transaction.go

# Create service files
touch app/api/internal/services/daily_rate_service.go
touch app/api/internal/services/transaction_service.go

# Create API handler files
touch app/api/internal/api/daily_rate_handler.go
touch app/api/internal/api/router.go

# Create database connection file
touch app/api/pkg/database/db.go

# Create main entry point
touch app/api/cmd/server/main.go

# Create config files
touch app/api/go.mod
touch app/api/.env
touch app/api/Dockerfile -->