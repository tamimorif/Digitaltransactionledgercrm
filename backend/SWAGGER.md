# Swagger API Documentation

Your API now has Swagger documentation!

## Access Swagger UI

Once the backend server is running, you can access the Swagger UI at:

**http://localhost:8080/swagger/index.html**

## What is Swagger?

Swagger provides interactive API documentation where you can:
- 📖 View all available API endpoints
- 🧪 Test API calls directly from the browser
- 📝 See request/response examples
- 🔍 Understand data models and schemas

## API Endpoints

### Clients
- `GET /api/clients` - Get all clients
- `POST /api/clients` - Create a new client
- `GET /api/clients/{id}` - Get a specific client
- `PUT /api/clients/{id}` - Update a client
- `DELETE /api/clients/{id}` - Delete a client
- `GET /api/clients/search?q={query}` - Search clients
- `GET /api/clients/{id}/transactions` - Get client's transactions

### Transactions
- `GET /api/transactions` - Get all transactions
- `POST /api/transactions` - Create a new transaction
- `GET /api/transactions/{id}` - Get a specific transaction
- `PUT /api/transactions/{id}` - Update a transaction
- `DELETE /api/transactions/{id}` - Delete a transaction
- `GET /api/transactions/search?q={query}` - Search transactions

### Health Check
- `GET /api/health` - Check API status

## How to Use

1. Start your backend server:
   ```bash
   cd backend
   go run cmd/server/main.go
   ```

2. Open your browser and go to:
   ```
   http://localhost:8080/swagger/index.html
   ```

3. You'll see an interactive interface where you can:
   - Click on any endpoint to expand it
   - Click "Try it out" button
   - Fill in parameters
   - Click "Execute" to test the API
   - View the response

## Regenerating Swagger Docs

If you make changes to the API, regenerate the docs:

```bash
cd backend
swag init -g cmd/server/main.go -o docs
```

## Files Generated

- `docs/docs.go` - Go documentation
- `docs/swagger.json` - Swagger JSON spec
- `docs/swagger.yaml` - Swagger YAML spec
