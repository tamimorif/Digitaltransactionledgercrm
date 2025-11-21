# Database Migration Notes

## Recent Changes (November 19, 2025)

### Added Field: `EditedByBranchID` to `pickup_transactions` table

**Change:** Added audit trail field to track which branch edited a pickup transaction.

**Migration SQL:**
```sql
-- Add edited_by_branch_id column to pickup_transactions table
ALTER TABLE pickup_transactions 
ADD COLUMN edited_by_branch_id BIGINT NULL,
ADD CONSTRAINT fk_pickup_transactions_edited_by_branch 
    FOREIGN KEY (edited_by_branch_id) 
    REFERENCES branches(id) 
    ON DELETE SET NULL;

-- Add index for performance
CREATE INDEX idx_pickup_transactions_edited_by_branch 
ON pickup_transactions(edited_by_branch_id);
```

**Model Changes:**
- Backend: `backend/pkg/models/pickup_transaction.go`
  - Added `EditedByBranchID *uint`
  - Added `EditedByBranch *Branch` relation

**Service Changes:**
- `EditPickupTransaction` now captures branch ID when editing
- All pickup retrieval queries now preload `EditedByBranch` relation

**Frontend Changes:**
- `frontend/src/lib/models/pickup.model.ts` - added `editedByBranchId` and `editedByBranch` fields
- Pending pickups page displays edit history with branch name and timestamp

---

## How to Apply Migration

### Option 1: Manual SQL (Production)
Run the SQL commands above directly on your production database.

### Option 2: GORM Auto-Migrate (Development)
GORM will automatically add the column when you restart the server with the updated model.

### Option 3: Write a Custom Migration
Create a migration file in `backend/migrations/` following the existing pattern.

---

## Verification Steps

1. Check that the column exists:
   ```sql
   DESCRIBE pickup_transactions;
   -- OR
   SELECT column_name, data_type FROM information_schema.columns 
   WHERE table_name = 'pickup_transactions' AND column_name = 'edited_by_branch_id';
   ```

2. Test editing a pickup transaction and verify `edited_by_branch_id` is populated
3. Check frontend displays branch name in edit history

---

## Rollback (if needed)

```sql
-- Remove the column and foreign key
ALTER TABLE pickup_transactions 
DROP FOREIGN KEY fk_pickup_transactions_edited_by_branch;

ALTER TABLE pickup_transactions 
DROP COLUMN edited_by_branch_id;

DROP INDEX idx_pickup_transactions_edited_by_branch 
ON pickup_transactions;
```
