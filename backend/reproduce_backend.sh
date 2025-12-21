#!/bin/bash

BASE_URL="http://localhost:8080/api/v1"
EMAIL="test@example.com"
PASSWORD="Test@123456"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}Starting Multi-Payment Backend Verification...${NC}"

# 1. Login or Register
echo "Attempting Login..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\": \"backend_test_user@example.com\", \"password\": \"Test@123456\"}")

TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo "Login failed. Attempting Registration..."
  REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Backend Test User",
      "email": "backend_test_user@example.com",
      "password": "Test@123456",
      "companyName": "Test Company",
      "phoneNumber": "+15559998888"
    }')
  
  echo "Registration Response: $REGISTER_RESPONSE"
  
  # Fetch verification code from DB
  echo "Fetching verification code..."
  CODE=$(sqlite3 transactions.db "SELECT verification_code FROM users WHERE email='backend_test_user@example.com';")
  echo "Verification Code: $CODE"
  
  # Verify Email
  VERIFY_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/verify-email" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"backend_test_user@example.com\", \"code\": \"$CODE\"}")
  echo "Verify Response: $VERIFY_RESPONSE"

  echo "Logging in after verification..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\": \"backend_test_user@example.com\", \"password\": \"Test@123456\"}")
    
  TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.token')
fi

if [ "$TOKEN" == "null" ] || [ -z "$TOKEN" ]; then
  echo -e "${RED}Login/Registration failed.${NC}"
  echo $LOGIN_RESPONSE
  exit 1
fi
echo -e "${GREEN}Login successful.${NC}"

# 2. Create Client
echo "Creating Test Client..."
CLIENT_RESPONSE=$(curl -s -X POST "$BASE_URL/clients" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Backend Test Client",
    "phoneNumber": "+15550000001",
    "email": "backend_test@example.com"
  }')

CLIENT_ID=$(echo $CLIENT_RESPONSE | jq -r '.id')
if [ "$CLIENT_ID" == "null" ]; then
    # Try getting existing client if duplicate email
    echo "Client might exist, trying to find..."
    CLIENT_ID=$(curl -s -X GET "$BASE_URL/clients" -H "Authorization: Bearer $TOKEN" | jq -r '.[0].id')
fi

echo -e "${GREEN}Client ID: $CLIENT_ID${NC}"

# 3. Create Transaction (Multi-Payment)
echo "Creating Multi-Payment Transaction (1000 CAD -> IRR)..."
TRANS_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"clientId\": \"$CLIENT_ID\",
    \"paymentMethod\": \"CASH_EXCHANGE\",
    \"sendCurrency\": \"CAD\",
    \"sendAmount\": 1000,
    \"receiveCurrency\": \"IRR\",
    \"receiveAmount\": 45000000,
    \"rateApplied\": 45000,
    \"allowPartialPayment\": true
  }")

TRANS_ID=$(echo $TRANS_RESPONSE | jq -r '.id')
PAYMENT_STATUS=$(echo $TRANS_RESPONSE | jq -r '.paymentStatus')
REMAINING=$(echo $TRANS_RESPONSE | jq -r '.remainingBalance')

echo -e "Transaction Created: $TRANS_ID"
echo -e "Payment Status: $PAYMENT_STATUS"
echo -e "Remaining Balance: $REMAINING"

if [ "$PAYMENT_STATUS" != "OPEN" ]; then
  echo -e "${RED}Expected Payment Status OPEN, got $PAYMENT_STATUS${NC}"
  # Continue anyway to debug
fi

# 4. Add Payment 1 (500 CAD Cash)
echo "Adding Payment 1 (500 CAD Cash)..."
PAY1_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions/$TRANS_ID/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "CAD",
    "paymentMethod": "CASH",
    "exchangeRate": 1.0
  }')

PAY1_STATUS=$(echo $PAY1_RESPONSE | jq -r '.status')
if [ "$PAY1_STATUS" == "COMPLETED" ]; then
    echo -e "${GREEN}Payment 1 Successful.${NC}"
else
    echo -e "${RED}Payment 1 Failed:${NC} $PAY1_RESPONSE"
fi

# 5. Add Payment 2 (500 CAD Bank)
echo "Adding Payment 2 (500 CAD Bank)..."
PAY2_RESPONSE=$(curl -s -X POST "$BASE_URL/transactions/$TRANS_ID/payments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 500,
    "currency": "CAD",
    "paymentMethod": "BANK_TRANSFER",
    "exchangeRate": 1.0,
    "details": { "bankName": "Test Bank", "referenceId": "REF-12345" }
  }')

PAY2_STATUS=$(echo $PAY2_RESPONSE | jq -r '.status')
if [ "$PAY2_STATUS" == "COMPLETED" ]; then
    echo -e "${GREEN}Payment 2 Successful.${NC}"
else
    echo -e "${RED}Payment 2 Failed:${NC} $PAY2_RESPONSE"
fi

# 6. Verify Final Status
echo "Verifying Final Transaction Status..."
FINAL_TRANS=$(curl -s -X GET "$BASE_URL/transactions/$TRANS_ID" \
  -H "Authorization: Bearer $TOKEN")

FINAL_STATUS=$(echo $FINAL_TRANS | jq -r '.paymentStatus')
FINAL_REMAINING=$(echo $FINAL_TRANS | jq -r '.remainingBalance')

echo -e "Final Status: $FINAL_STATUS"
echo -e "Final Remaining: $FINAL_REMAINING"

if [ "$FINAL_STATUS" == "FULLY_PAID" ] && [ "$FINAL_REMAINING" == "0" ]; then
  echo -e "${GREEN}Backend Verification Passed!${NC}"
else
  echo -e "${RED}Backend Verification Failed.${NC}"
fi
