# Task 4-5: Settings Context/Provider & Dynamic App Name & Logo

## Work Log

### Step 1: Created Settings Store (Zustand)
- Created `/home/z/my-project/src/store/settings-store.ts`
- Store manages `namasekolah`, `logopath`, `isLoaded` state
- `loadSettings()` fetches from `/api/public/settings` (public, no auth)
- `setSettings()` allows updating store from UI (e.g., after saving in settings page)
- Caches loaded settings (skips re-fetch if `isLoaded` is true)

### Step 2: Added Settings Model to Database
- Added `Settings` model to `prisma/schema.prisma` with fields: `id`, `namasekolah`, `logopath`, `createdat`, `updatedat`
- Added `settings` model config to `src/lib/supabase-db.ts` MODELS and factory
- Created SQL migration file at `sql-migration/06_settings.sql`
- Note: `prisma db push` fails from sandbox (DB not directly accessible). Table needs to be created via Supabase dashboard or when deployed to Vercel.

### Step 3: Created API Routes
- `/api/public/settings/route.ts` - GET: Returns app settings (namasekolah, logopath) with no auth required. Falls back to defaults if table doesn't exist.
- `/api/settings/route.ts` - GET/PUT: Auth-required endpoints. GET returns settings, PUT updates namasekolah.
- `/api/settings/upload-logo/route.ts` - POST: Auth-required. Accepts FormData with logo file, validates type/size, converts to base64 data URL, stores in database.
- `/api/manifest/route.ts` - GET: Dynamic PWA manifest that uses settings from DB for app name and icons.

### Step 4: Updated Login Page
- Added `useSettingsStore` import and `useEffect` to load settings on mount
- Replaced hardcoded "Kelas App" with dynamic `namasekolah` from store
- Logo: Shows `<img>` if `logopath` exists, otherwise keeps `<GraduationCap>` icon
- Footer: Shows `© 2025 {namasekolah}` dynamically

### Step 5: Updated App Sidebar
- Added `useSettingsStore` import and `useEffect` to load settings on mount
- Sidebar header badge: Shows `<img>` if `logopath` exists, otherwise first letter of `namasekolah`
- Replaced "Kelas App" text with `namasekolah` from store
- Share Form Nilai title uses `namasekolah` dynamically

### Step 6: Updated Settings Page
- Added new "Pengaturan Aplikasi" card at the TOP of the settings page
- Features: app preview, school name input, logo upload with preview, save button
- Logo upload: Validates file type (PNG, JPG, WebP, SVG) and size (3MB max)
- Save flow: First uploads logo if changed (POST /api/settings/upload-logo), then saves name (PUT /api/settings)
- After saving, updates the settings store so the whole app updates immediately
- Imports: Added `School`, `GraduationCap` from lucide-react, `useSettingsStore`, `useRef`

### Step 7: Updated Form-Nilai Page
- Added `useSettingsStore` import
- Calls `loadSettings()` in the existing `useEffect`
- Header: Shows logo if available, otherwise GraduationCap icon
- Header title: Dynamic `namasekolah`
- Footer: Shows `© 2025 {namasekolah}`

### Step 8: Updated Layout
- Changed `manifest: "/manifest.json"` to `manifest: "/api/manifest"` for dynamic PWA manifest

### Lint Status
- `bun run lint` passes with 0 errors

## Notes
- The `settings` database table needs to be created in Supabase. Migration SQL is at `sql-migration/06_settings.sql`. Until the table is created, all API routes gracefully fall back to defaults ("Kelas App", empty logopath).
- Logo storage uses base64 data URLs stored directly in the database (avoids filesystem dependency, works on Vercel/serverless).
- The settings store caches results (only fetches once per session) to avoid unnecessary API calls.
