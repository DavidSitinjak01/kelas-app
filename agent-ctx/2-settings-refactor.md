# Task 2 - Settings Backend Refactor (Base64 Logo Storage)

## Task
Refactor the settings backend to store the logo as base64 in the database instead of writing to the filesystem (which doesn't work on Vercel).

## Changes Made

### 1. `/api/settings/upload-logo/route.ts` — Replaced entirely
- Removed filesystem writes (`writeFile`, `mkdir`, `fs/promises`, `path` imports)
- Now converts uploaded file to base64 data URL (`data:${mimeType};base64,${base64}`)
- Stores in `logodata` and `logomimetype` DB columns
- Uses upsert pattern (try update → try create → return 503)

### 2. `/api/logo/route.ts` — New file
- Serves logo as actual image response from DB base64 data
- Supports `?size=` query param for PWA icon resizing (uses sharp if available)
- Returns 1x1 transparent PNG as fallback when no logo exists
- Sets proper Content-Type and Cache-Control headers

### 3. `/api/manifest/route.ts` — Replaced entirely
- Uses `/api/logo?size=192` and `/api/logo?size=512` for PWA icons when logo exists
- Always includes SVG fallback icon
- Checks `settings.logodata` to determine if logo is available

### 4. `/api/public/settings/route.ts` — Replaced entirely
- Returns `logodata` (data URL) as `logopath` field for frontend consumption
- Graceful fallback to defaults

### 5. `/api/settings/route.ts` — Replaced entirely
- GET/PUT both return `logodata || logopath` as `logopath` field
- Upsert pattern preserved
- Consistent response shape with public settings

### 6. `/api/setup/route.ts` — Updated SQL section
- Added `logodata TEXT DEFAULT ''` and `logomimetype TEXT DEFAULT ''` to CREATE TABLE
- Updated INSERT to include both new columns
- Added `ALTER TABLE settings ADD COLUMN IF NOT EXISTS` for both columns (migration for existing tables)

### 7. `src/proxy.ts` — Updated PUBLIC_API_ROUTES
- Added `'/api/logo'` to the array

### 8. Verified existing files
- `src/lib/supabase-db.ts`: settings model already in MODELS and createSupabaseDB()
- `prisma/schema.prisma`: logodata and logomimetype fields already present

## Lint Result
- `bun run lint` passes with 0 errors

## Key Benefits
- No filesystem writes — fully compatible with Vercel/serverless
- Logo stored as base64 data URL in database
- `/api/logo` endpoint serves logo as actual image (for PWA manifest, img src)
- Backward compatible: existing `logopath` field still used as fallback
- Setup SQL includes migration for existing tables
