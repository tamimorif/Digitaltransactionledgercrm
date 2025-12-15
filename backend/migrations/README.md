# Fix Owner Branch Migration

This migration script creates a "Head Office" branch for existing owner accounts that don't have a primary branch set.

## Problem
Existing owner accounts (like tamimarif03@gmail.com) were created before the system auto-created Head Office branches. This means they can't send money because they don't have a sender branch.

## Solution
This script will:
1. Find all tenant_owner accounts without a primary_branch_id
2. For each owner:
   - If they have existing branches: set the first one as "Head Office" and mark it as primary
   - If they have no branches: create a new "Head Office" branch
3. Assign the Head Office branch as their primary_branch_id

## How to Run

### Option 1: Run the Go Script (Recommended)
```bash
cd backend
go run migrations/fix_owner_branch.go
```

### Option 2: Direct SQL (Quick Fix)
If you just want to fix your account quickly, run this in your PostgreSQL database:

```sql
-- Step 1: Create Head Office branch for your tenant
INSERT INTO branches (tenant_id, name, location, branch_code, is_primary, status, created_at, updated_at)
SELECT 
    u.tenant_id,
    'Head Office',
    '',
    'HQ',
    true,
    'active',
    NOW(),
    NOW()
FROM users u
WHERE u.email = 'tamimarif03@gmail.com' AND u.tenant_id IS NOT NULL
RETURNING id;

-- Step 2: Get the branch ID from above and update your user
-- Replace <BRANCH_ID> with the ID returned from above
UPDATE users 
SET primary_branch_id = <BRANCH_ID>
WHERE email = 'tamimarif03@gmail.com';
```

### Option 3: Using the API (Frontend)
You can also fix this through the frontend by:
1. Going to Admin > Branches
2. Creating a "Head Office" branch
3. Going to Settings > Account
4. Setting "Head Office" as your primary branch

## Verification
After running, verify your account has a primary branch:
```sql
SELECT id, email, primary_branch_id 
FROM users 
WHERE email = 'tamimarif03@gmail.com';
```

You should see a primary_branch_id value. Then verify the branch exists:
```sql
SELECT * FROM branches WHERE id = <your_primary_branch_id>;
```

## What This Fixes
- ✅ Owner can now send money (has a sender branch)
- ✅ Owner shows up in branch list as "Head Office"
- ✅ Owner can receive money transfers to their branch
- ✅ Consistent with new registrations (all new owners automatically get Head Office)

## Notes
- This is a one-time migration
- Safe to run multiple times (won't create duplicates)
- New registrations automatically get Head Office - this is only for existing accounts
