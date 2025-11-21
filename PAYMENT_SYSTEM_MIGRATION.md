# Multi-Payment System Migration Notes

**Date**: November 22, 2025  
**Feature**: Partial Payments Support for Transactions

---

## 📋 Overview

This migration adds support for **multi-payment transactions** where a single transaction can receive money in one step and pay it out over multiple partial payments in different currencies.

---

## 🗄️ Database Changes

### 1. New Table: `payments`

```sql
CREATE TABLE payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id BIGINT NOT NULL,
    transaction_id TEXT NOT NULL,
    branch_id BIGINT,
    
    -- Payment Details
    amount REAL NOT NULL,
    currency VARCHAR(10) NOT NULL,
    exchange_rate REAL DEFAULT 1,
    amount_in_base REAL NOT NULL,
    
    -- Payment Method
    payment_method VARCHAR(50) DEFAULT 'CASH',
    
    -- Tracking
    paid_by BIGINT NOT NULL,
    notes TEXT,
    receipt_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'COMPLETED',
    
    -- Timestamps
    paid_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Edit History
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    edited_by BIGINT,
    edit_reason TEXT,
    
    -- Cancellation
    cancelled_at TIMESTAMP,
    cancelled_by BIGINT,
    cancel_reason TEXT,
    
    -- Foreign Keys
    FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_branch_id ON payments(branch_id);
```

### 2. Updated Table: `transactions`

```sql
-- Add new columns to transactions table
ALTER TABLE transactions ADD COLUMN total_received REAL;
ALTER TABLE transactions ADD COLUMN received_currency VARCHAR(10);
ALTER TABLE transactions ADD COLUMN total_paid REAL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN remaining_balance REAL DEFAULT 0;
ALTER TABLE transactions ADD COLUMN payment_status VARCHAR(50) DEFAULT 'SINGLE';
ALTER TABLE transactions ADD COLUMN allow_partial_payment BOOLEAN DEFAULT FALSE;
```

---

## 🔄 For PostgreSQL (Production)

```sql
-- Create payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    tenant_id BIGINT NOT NULL,
    transaction_id TEXT NOT NULL,
    branch_id BIGINT,
    
    -- Payment Details
    amount DECIMAL(20,2) NOT NULL,
    currency VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(20,6) DEFAULT 1,
    amount_in_base DECIMAL(20,2) NOT NULL,
    
    -- Payment Method
    payment_method VARCHAR(50) DEFAULT 'CASH',
    
    -- Tracking
    paid_by BIGINT NOT NULL,
    notes TEXT,
    receipt_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'COMPLETED',
    
    -- Timestamps
    paid_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Edit History
    is_edited BOOLEAN DEFAULT FALSE,
    edited_at TIMESTAMP,
    edited_by BIGINT,
    edit_reason TEXT,
    
    -- Cancellation
    cancelled_at TIMESTAMP,
    cancelled_by BIGINT,
    cancel_reason TEXT,
    
    -- Foreign Keys
    CONSTRAINT fk_payments_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_payments_branch FOREIGN KEY (branch_id) REFERENCES branches(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_paid_by FOREIGN KEY (paid_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_edited_by FOREIGN KEY (edited_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_payments_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX idx_payments_tenant_id ON payments(tenant_id);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_branch_id ON payments(branch_id);

-- Add columns to transactions
ALTER TABLE transactions ADD COLUMN total_received DECIMAL(20,2);
ALTER TABLE transactions ADD COLUMN received_currency VARCHAR(10);
ALTER TABLE transactions ADD COLUMN total_paid DECIMAL(20,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN remaining_balance DECIMAL(20,2) DEFAULT 0;
ALTER TABLE transactions ADD COLUMN payment_status VARCHAR(50) DEFAULT 'SINGLE';
ALTER TABLE transactions ADD COLUMN allow_partial_payment BOOLEAN DEFAULT FALSE;
```

---

## 🚀 How to Apply

### Option 1: Auto-Migration (GORM)
The migration will **automatically run** when you restart the Go server:

```bash
cd backend
go run cmd/server/main.go
```

GORM's `AutoMigrate` will detect the new `Payment` model and updated `Transaction` fields.

### Option 2: Manual SQL
Run the SQL commands above directly on your database.

---

## 📊 Data Migration (if needed)

If you have existing transactions that need to be converted:

```sql
-- For existing single-payment transactions, set defaults
UPDATE transactions 
SET 
    total_received = send_amount,
    received_currency = send_currency,
    total_paid = 0,
    remaining_balance = send_amount,
    payment_status = 'SINGLE',
    allow_partial_payment = FALSE
WHERE total_received IS NULL;
```

---

## ✅ Verification Steps

1. **Check tables exist:**
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name='payments';
   ```

2. **Check transactions columns:**
   ```sql
   PRAGMA table_info(transactions);
   ```

3. **Test creating a payment:**
   - Create a transaction with `allowPartialPayment: true`
   - Add a payment via API
   - Verify totals are calculated correctly

---

## 🔙 Rollback (if needed)

```sql
-- Drop payments table
DROP TABLE IF EXISTS payments;

-- Remove new columns from transactions
ALTER TABLE transactions DROP COLUMN total_received;
ALTER TABLE transactions DROP COLUMN received_currency;
ALTER TABLE transactions DROP COLUMN total_paid;
ALTER TABLE transactions DROP COLUMN remaining_balance;
ALTER TABLE transactions DROP COLUMN payment_status;
ALTER TABLE transactions DROP COLUMN allow_partial_payment;
```

---

## 📚 API Endpoints Added

```
POST   /api/transactions/{id}/payments       - Create payment
GET    /api/transactions/{id}/payments       - List payments
GET    /api/payments/{id}                    - Get payment
PUT    /api/payments/{id}                    - Update payment
DELETE /api/payments/{id}                    - Delete payment
POST   /api/payments/{id}/cancel             - Cancel payment
POST   /api/transactions/{id}/complete       - Complete transaction
```

---

## 🎯 Usage Example

```json
// 1. Create multi-payment transaction
POST /api/transactions
{
  "clientId": "customer-123",
  "totalReceived": 120000000,
  "receivedCurrency": "IRR",
  "allowPartialPayment": true,
  "type": "MULTI_PAYMENT"
}

// 2. Add first payment
POST /api/transactions/TRX-001/payments
{
  "amount": 50000000,
  "currency": "IRR",
  "exchangeRate": 1,
  "paymentMethod": "CASH",
  "notes": "First payment"
}

// 3. Add second payment (different currency)
POST /api/transactions/TRX-001/payments
{
  "amount": 500,
  "currency": "CAD",
  "exchangeRate": 84100,  // 1 CAD = 84,100 IRR
  "paymentMethod": "BANK_TRANSFER",
  "notes": "Second payment in CAD"
}
// This adds 42,050,000 IRR equivalent

// 4. Check remaining
GET /api/transactions/TRX-001
// Returns: remainingBalance = 27,950,000 IRR

// 5. Complete when done
POST /api/transactions/TRX-001/complete
```

---

## ⚠️ Important Notes

1. **Automatic Calculation**: `totalPaid` and `remainingBalance` are calculated automatically
2. **Currency Conversion**: Each payment can be in different currency with its own exchange rate
3. **Validation**: System prevents over-payment
4. **Audit Trail**: All edits and cancellations are logged
5. **Transaction Safety**: All operations use database transactions
6. **Tolerance**: Completion allows 1% difference for floating-point precision

---

## 🎨 Frontend Components (To Be Built)

- `PaymentList` - Display all payments
- `AddPaymentDialog` - Form to add new payment
- `PaymentCard` - Individual payment display
- `PaymentProgressBar` - Visual progress indicator
- `CompleteTransactionDialog` - Confirm completion

---

**Status**: Backend ✅ Complete | Frontend 🚧 In Progress
