# Work Log — Task 1: Create Admin Table in Supabase

**Task ID:** 1
**Date:** 2026-03-06
**Agent:** General Purpose Agent

---

## Summary

Attempted to create the `admin` table in Supabase PostgreSQL and insert a default admin user. Due to Supabase Supavisor pooler connectivity issues (tenant not found error), the table could not be created remotely from the sandbox. SQL migration file and helper script were created as alternatives.

## Steps Attempted

### 1. REST API Insert (Failed — expected)
- Attempted `POST /rest/v1/admin` to insert a record
- Result: `PGRST205 — Could not find the table 'public.admin' in the schema cache`
- This was expected — PostgREST doesn't support DDL (CREATE TABLE)

### 2. Supabase Management API SQL Endpoint (Failed)
- Tried `POST https://api.supabase.com/v1/projects/{ref}/database/query`
- Result: `JWT could not be decoded` — the service role key is not a JWT personal access token
- The Management API requires a `sbp_...` format personal access token from the dashboard

### 3. Direct PostgreSQL Connection via `pg` Module (Failed)
- Tried multiple connection configurations:
  - Pooler transaction mode (port 6543) with `postgres.gybmzmxeknsbypthdvwr` user
  - Pooler session mode (port 5432)
  - Direct DB hostname `db.gybmzmxeknsbypthdvwr.supabase.co` (IPv6 only, not reachable from sandbox)
  - Multiple pooler IPs (54.255.219.82, 52.74.252.201, 52.77.146.31)
  - Various SSL configurations (rejectUnauthorized, servername, etc.)
  - Different username formats (postgres, gybmzmxeknsbypthdvwr, etc.)
- **All attempts returned**: `(ENOTFOUND) tenant/user postgres.gybmzmxeknsbypthdvwr not found (SQLSTATE XX000)`
- The Supabase Supavisor pooler cannot find this project's tenant
- REST API works fine (verified: `GET /rest/v1/rombel` returns data)
- This is a **Supabase-side configuration issue** — the project's pooler routing may be misconfigured

### 4. Supabase CLI (Failed)
- `supabase db query --db-url` — same pooler error
- `supabase link` — requires personal access token (`sbp_...` format)
- `supabase db push` — same pooler connection error

## Files Created

### `/home/z/my-project/sql-migration/00_admin.sql`
SQL migration file to create the admin table, disable RLS, and insert default admin user:

```sql
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE admin DISABLE ROW LEVEL SECURITY;
INSERT INTO admin (id, username, password) VALUES ('admin1', 'admin', 'admin123') ON CONFLICT (id) DO NOTHING;
```

### `/home/z/my-project/create-admin-table.js`
Node.js script that can be run from an environment with direct database access to create the admin table.

## Existing Configuration (Already Done)

The admin model is already configured in `/home/z/my-project/src/lib/supabase-db.ts`:
- `admin: { tableName: 'admin', uniqueFields: ['id', 'username'], uniqueConstraints: {}, relations: {} }`
- `admin: new SupabaseModel('admin')` in the `createSupabaseDB()` return object

## Action Required

**The user must manually run the SQL in `sql-migration/00_admin.sql` via the Supabase SQL Editor:**
1. Go to https://supabase.com/dashboard/project/gybmzmxeknsbypthdvwr/sql
2. Paste the contents of `sql-migration/00_admin.sql`
3. Click "Run"

After the table is created, the existing REST API client (`supabase-db.ts`) will immediately be able to interact with the `admin` table.

---

# Work Log — Task 2: Authentication API Routes

## Summary
Created authentication API routes for the Kelas App using the custom Supabase REST API client.

## Changes Made

### 1. Updated `/home/z/my-project/src/lib/supabase-db.ts`
- Added `admin` model to the `MODELS` configuration object with:
  - `tableName: 'admin'`
  - `uniqueFields: ['id', 'username']`
  - `uniqueConstraints: {}`
  - `relations: {}`
- Added `admin: new SupabaseModel('admin')` to the `createSupabaseDB()` return object

### 2. Created `/home/z/my-project/src/app/api/auth/login/route.ts`
- POST endpoint for admin login
- Validates username and password are provided
- Finds admin by username via `db.admin.findMany`
- Compares plaintext password (to be hashed later)
- Sets `admin-session` httpOnly cookie with 7-day expiry
- Returns user object on success

### 3. Created `/home/z/my-project/src/app/api/auth/me/route.ts`
- GET endpoint to check current authentication status
- Reads `admin-session` cookie and returns parsed user data
- Returns 401 if not authenticated

### 4. Created `/home/z/my-project/src/app/api/auth/logout/route.ts`
- POST endpoint to logout
- Deletes `admin-session` cookie
- Returns success response

### 5. Created `/home/z/my-project/src/app/api/auth/settings/route.ts`
- PUT endpoint for changing username and/or password
- Requires authentication via session cookie
- Verifies current password before allowing password change
- Checks username uniqueness before allowing username change
- Updates session cookie if username is changed

### 6. Created `/home/z/my-project/src/store/auth-store.ts`
- Zustand store for client-side auth state management
- Tracks `user`, `isLoading`, and `isAuthenticated` states
- Provides `setUser`, `setLoading`, and `logout` actions
- `logout` action calls the logout API and clears local state

## Files Modified
- `src/lib/supabase-db.ts` (added admin model)

## Files Created
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/me/route.ts`
- `src/app/api/auth/logout/route.ts`
- `src/app/api/auth/settings/route.ts`
- `src/store/auth-store.ts`
