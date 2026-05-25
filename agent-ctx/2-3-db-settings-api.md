# Task 2-3: Create the settings database table and API endpoints

## Work Log

### Step 1: Prisma Schema Update
- Added `Settings` model to `prisma/schema.prisma` with fields: `id` (TEXT PK DEFAULT 'default'), `namasekolah`, `logopath`, `createdat`, `updatedat`
- Could not run `prisma db push` from sandbox (direct DB unreachable)

### Step 2: Supabase REST Client Update
- Added `settings` model config to `src/lib/supabase-db.ts` MODELS and factory
- Config: tableName 'settings', uniqueFields ['id'], no relations

### Step 3: SQL Migration Script
- Created `scripts/create-settings-table.sql` with:
  - CREATE TABLE IF NOT EXISTS settings
  - ALTER TABLE settings DISABLE ROW LEVEL SECURITY
  - INSERT default row ON CONFLICT DO NOTHING

### Step 4: API Routes Created
- `/api/settings/route.ts` — GET (public) returns settings with fallback; PUT (auth) uses upsert pattern
- `/api/settings/upload-logo/route.ts` — POST (auth) validates file, saves to /public/uploads/, generates PWA icons with sharp, upserts to DB
- `/api/public/settings/route.ts` — GET (public, no auth) returns settings with graceful fallback
- `/api/manifest/route.ts` — GET returns dynamic PWA manifest using DB settings

### Step 5: Proxy Update
- Added `/api/public/settings` to PUBLIC_API_ROUTES in `src/proxy.ts`

### Step 6: Setup Endpoint Update
- Updated `/api/setup/route.ts` to include settings table creation SQL in setup instructions

### Step 7: Lint Check
- `bun run lint` passes with 0 errors

## Table Creation Status
The `settings` table could NOT be created from this sandbox because:
- Direct DB connection (db.gybmzmxeknsbypthdvwr.supabase.co:5432) is IPv6-only and unreachable
- PgBouncer pooler doesn't support DDL in transaction mode
- Supabase Management API requires a personal access token
- Supabase REST API (PostgREST) doesn't support table creation

The table CAN be created via:
1. Supabase Dashboard → SQL Editor → run `scripts/create-settings-table.sql`
2. `prisma db push` on Vercel where direct DB connection is reachable
3. The `/api/setup` endpoint which provides the SQL instructions

All API routes are resilient and return defaults when the table doesn't exist.
