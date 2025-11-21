#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# API Base URL
API_URL="http://localhost:8080/api"

# Test Results
PASS=0
FAIL=0
TOTAL=0

# Function to test an endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    local expected_codes=$5
    local description=$6
    
    TOTAL=$((TOTAL + 1))
    
    if [ -z "$token" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            ${data:+-d "$data"})
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$API_URL$endpoint" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $token" \
            ${data:+-d "$data"})
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    # Check if the status code is in the expected codes
    if [[ " ${expected_codes[@]} " =~ " ${http_code} " ]]; then
        echo -e "${GREEN}✓${NC} $description - Status: $http_code"
        PASS=$((PASS + 1))
        return 0
    else
        echo -e "${RED}✗${NC} $description - Expected one of: ${expected_codes}, Got: $http_code"
        echo "   Response: $body"
        FAIL=$((FAIL + 1))
        return 1
    fi
}

# Function to extract JSON value
extract_json() {
    echo "$1" | grep -o "\"$2\":\"[^\"]*\"" | sed "s/\"$2\":\"\([^\"]*\)\"/\1/"
}

echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}    Digital Transaction Ledger CRM - API Tests${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

# ============================================================================
# 1. Health Check
# ============================================================================
echo -e "\n${YELLOW}[1] Health Check${NC}"
test_endpoint "GET" "/health" "" "" "200" "Health check"

# ============================================================================
# 2. Authentication Tests
# ============================================================================
echo -e "\n${YELLOW}[2] Authentication Endpoints${NC}"

# Test login with SuperAdmin
login_response=$(curl -s -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "admin@digitaltransactionledger.com",
        "password": "Admin@123456"
    }')

login_http_code=$(echo "$login_response" | tail -n1)
TOTAL=$((TOTAL + 1))

# Extract token from login response
TOKEN=$(echo "$login_response" | grep -o '"token":"[^"]*"' | sed 's/"token":"\([^"]*\)"/\1/')

if [ ! -z "$TOKEN" ]; then
    echo -e "${GREEN}✓${NC} Login as SuperAdmin - Token obtained"
    PASS=$((PASS + 1))
else
    echo -e "${RED}✗${NC} Login as SuperAdmin - Failed to get token"
    echo "   Response: $login_response"
    FAIL=$((FAIL + 1))
fi

# Test Get Me endpoint
test_endpoint "GET" "/auth/me" "" "$TOKEN" "200" "Get current user info (/auth/me)"

# Test registration
test_endpoint "POST" "/auth/register" '{
    "email": "testuser_'$(date +%s)'@example.com",
    "password": "TestPassword123!",
    "organizationName": "Test Organization"
}' "" "201 200" "Register new user"

# Test forgot password
test_endpoint "POST" "/auth/forgot-password" '{
    "email": "admin@digitaltransactionledger.com"
}' "" "200 201" "Forgot password request"

# ============================================================================
# 3. Tenant Endpoints
# ============================================================================
echo -e "\n${YELLOW}[3] Tenant Endpoints${NC}"

test_endpoint "GET" "/tenant/info" "" "$TOKEN" "200" "Get tenant info"
test_endpoint "PUT" "/tenant/update-name" '{
    "name": "Updated Organization Name"
}' "$TOKEN" "200 403" "Update tenant name (owner only)"

# ============================================================================
# 4. Client Endpoints
# ============================================================================
echo -e "\n${YELLOW}[4] Client Endpoints${NC}"

test_endpoint "GET" "/clients" "" "$TOKEN" "200" "Get all clients"

# Create a test client
create_client_response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/clients" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{
        "name": "Test Client",
        "email": "testclient@example.com",
        "phoneNumber": "+1234567890",
        "address": "123 Test St"
    }')

client_http_code=$(echo "$create_client_response" | tail -n1)
TOTAL=$((TOTAL + 1))

if [ "$client_http_code" = "201" ] || [ "$client_http_code" = "200" ]; then
    echo -e "${GREEN}✓${NC} Create client - Status: $client_http_code"
    PASS=$((PASS + 1))
    CLIENT_ID=$(echo "$create_client_response" | head -n -1 | grep -o '"id":"[^"]*"' | sed 's/"id":"\([^"]*\)"/\1/')
else
    echo -e "${RED}✗${NC} Create client - Expected: 201/200, Got: $client_http_code"
    FAIL=$((FAIL + 1))
fi

# Test client operations if we have a client ID
if [ ! -z "$CLIENT_ID" ]; then
    test_endpoint "GET" "/clients/$CLIENT_ID" "" "$TOKEN" "200" "Get client by ID"
    test_endpoint "PUT" "/clients/$CLIENT_ID" '{
        "name": "Updated Test Client",
        "email": "updated@example.com"
    }' "$TOKEN" "200" "Update client"
    test_endpoint "GET" "/clients/$CLIENT_ID/transactions" "" "$TOKEN" "200" "Get client transactions"
fi

test_endpoint "GET" "/clients/search?q=Test" "" "$TOKEN" "200" "Search clients"

# ============================================================================
# 5. Transaction Endpoints
# ============================================================================
echo -e "\n${YELLOW}[5] Transaction Endpoints${NC}"

test_endpoint "GET" "/transactions" "" "$TOKEN" "200" "Get all transactions"
test_endpoint "GET" "/transactions?startDate=2024-01-01&endDate=2024-12-31" "" "$TOKEN" "200" "Get transactions with date filter"

# Create a test transaction if we have a client
if [ ! -z "$CLIENT_ID" ]; then
    create_txn_response=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/transactions" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer $TOKEN" \
        -d '{
            "clientId": "'$CLIENT_ID'",
            "type": "CASH_EXCHANGE",
            "sendCurrency": "USD",
            "sendAmount": 100,
            "receiveCurrency": "CAD",
            "receiveAmount": 130,
            "rateApplied": 1.3,
            "transactionDate": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
        }')
    
    txn_http_code=$(echo "$create_txn_response" | tail -n1)
    TOTAL=$((TOTAL + 1))
    
    if [ "$txn_http_code" = "201" ] || [ "$txn_http_code" = "200" ]; then
        echo -e "${GREEN}✓${NC} Create transaction - Status: $txn_http_code"
        PASS=$((PASS + 1))
        TXN_ID=$(echo "$create_txn_response" | head -n -1 | grep -o '"id":"[^"]*"' | sed 's/"id":"\([^"]*\)"/\1/')
    else
        echo -e "${RED}✗${NC} Create transaction - Expected: 201/200, Got: $txn_http_code"
        FAIL=$((FAIL + 1))
    fi
    
    # Test transaction operations if we have a transaction ID
    if [ ! -z "$TXN_ID" ]; then
        test_endpoint "GET" "/transactions/$TXN_ID" "" "$TOKEN" "200" "Get transaction by ID"
        test_endpoint "PUT" "/transactions/$TXN_ID" '{
            "sendAmount": 110,
            "receiveAmount": 143
        }' "$TOKEN" "200" "Update transaction"
        test_endpoint "POST" "/transactions/$TXN_ID/cancel" '{
            "reason": "Test cancellation"
        }' "$TOKEN" "200" "Cancel transaction"
    fi
fi

test_endpoint "GET" "/transactions/search?q=USD" "" "$TOKEN" "200" "Search transactions"

# ============================================================================
# 6. Branch Endpoints
# ============================================================================
echo -e "\n${YELLOW}[6] Branch Endpoints${NC}"

test_endpoint "GET" "/branches" "" "$TOKEN" "200" "Get all branches"
test_endpoint "GET" "/branches/my-branches" "" "$TOKEN" "200" "Get my branches"

# ============================================================================
# 7. User Management Endpoints
# ============================================================================
echo -e "\n${YELLOW}[7] User Management Endpoints${NC}"

test_endpoint "GET" "/users" "" "$TOKEN" "200" "Get all users"
test_endpoint "GET" "/users/check-username?username=testuser" "" "" "200" "Check username availability"

# ============================================================================
# 8. Ledger Endpoints
# ============================================================================
echo -e "\n${YELLOW}[8] Ledger Endpoints${NC}"

if [ ! -z "$CLIENT_ID" ]; then
    test_endpoint "GET" "/clients/$CLIENT_ID/ledger/balance" "" "$TOKEN" "200" "Get client ledger balance"
    test_endpoint "GET" "/clients/$CLIENT_ID/ledger/entries" "" "$TOKEN" "200" "Get client ledger entries"
    test_endpoint "POST" "/clients/$CLIENT_ID/ledger/entry" '{
        "currency": "USD",
        "amount": 100,
        "entryType": "DEPOSIT",
        "description": "Test deposit"
    }' "$TOKEN" "200 201" "Add ledger entry"
fi

# ============================================================================
# 9. Pickup Transaction Endpoints
# ============================================================================
echo -e "\n${YELLOW}[9] Pickup Transaction Endpoints${NC}"

test_endpoint "GET" "/pickups" "" "$TOKEN" "200" "Get all pickup transactions"
test_endpoint "GET" "/pickups/pending/count" "" "$TOKEN" "200" "Get pending pickups count"

# ============================================================================
# 10. Customer Endpoints
# ============================================================================
echo -e "\n${YELLOW}[10] Customer Endpoints${NC}"

test_endpoint "GET" "/customers" "" "$TOKEN" "200" "Get all customers"
test_endpoint "GET" "/customers/search?q=test" "" "$TOKEN" "200" "Search customers"

# ============================================================================
# 11. Cash Balance Endpoints
# ============================================================================
echo -e "\n${YELLOW}[11] Cash Balance Endpoints${NC}"

test_endpoint "GET" "/cash-balances" "" "$TOKEN" "200" "Get all cash balances"
test_endpoint "GET" "/cash-balances/currencies" "" "$TOKEN" "200" "Get active currencies"

# ============================================================================
# 12. Statistics & Export Endpoints
# ============================================================================
echo -e "\n${YELLOW}[12] Statistics & Export Endpoints${NC}"

test_endpoint "GET" "/statistics" "" "$TOKEN" "200" "Get statistics"
test_endpoint "GET" "/export/csv" "" "$TOKEN" "200" "Export CSV"
test_endpoint "GET" "/export/json" "" "$TOKEN" "200" "Export JSON"

# ============================================================================
# 13. Audit Log Endpoints
# ============================================================================
echo -e "\n${YELLOW}[13] Audit Log Endpoints${NC}"

test_endpoint "GET" "/audit-logs" "" "$TOKEN" "200" "Get audit logs"

# ============================================================================
# 14. License Endpoints
# ============================================================================
echo -e "\n${YELLOW}[14] License Endpoints${NC}"

test_endpoint "GET" "/licenses/status" "" "$TOKEN" "200" "Get license status"
test_endpoint "GET" "/licenses/my-licenses" "" "$TOKEN" "200" "Get my licenses"

# ============================================================================
# 15. SuperAdmin Endpoints
# ============================================================================
echo -e "\n${YELLOW}[15] SuperAdmin Endpoints${NC}"

test_endpoint "GET" "/admin/tenants" "" "$TOKEN" "200" "Get all tenants (SuperAdmin)"
test_endpoint "GET" "/admin/users" "" "$TOKEN" "200" "Get all users (SuperAdmin)"
test_endpoint "GET" "/admin/transactions" "" "$TOKEN" "200" "Get all transactions (SuperAdmin)"
test_endpoint "GET" "/admin/dashboard/stats" "" "$TOKEN" "200" "Get dashboard stats (SuperAdmin)"

# ============================================================================
# Results Summary
# ============================================================================
echo -e "\n${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}    Test Results${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
echo -e "Total Tests: $TOTAL"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"

if [ $FAIL -eq 0 ]; then
    echo -e "\n${GREEN}✓ All tests passed!${NC}\n"
    exit 0
else
    PASS_RATE=$((PASS * 100 / TOTAL))
    echo -e "\n${YELLOW}⚠ Pass rate: $PASS_RATE%${NC}\n"
    exit 1
fi
