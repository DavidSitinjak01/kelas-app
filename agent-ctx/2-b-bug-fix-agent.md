# Task 2-b: Bug Fixes, Middleware, and Security Improvements

**Task ID:** 2-b
**Agent:** Bug Fix Agent
**Status:** Completed

## Summary

Fixed all 8 issues as specified:

1. **Middleware** — Created `src/middleware.ts` protecting all `/api/` routes except login, me, and setup. Checks `admin-session` cookie, returns 401 if missing.

2. **Double logout** — Removed explicit `fetch('/api/auth/logout')` from `app-sidebar.tsx` handleLogout, since `logout()` already calls it.

3. **Async logout** — Made `logout()` in `auth-store.ts` async with `await` on the fetch call, wrapped in try/catch.

4. **Deleted leftover files** — Removed `create-admin-table.js` and `generate-sql-migration.js`.

5. **Login bcrypt** — Login route now uses `bcrypt.compare(password, admin.password)` instead of plaintext comparison.

6. **Settings bcrypt** — Settings route uses `bcrypt.compare` for current password verification and `bcrypt.hash(newPassword, 10)` for new passwords.

7. **Setup bcrypt** — Setup route hashes default admin password with `bcrypt.hash('admin123', 10)`. SQL instructions in table_missing response include dynamically generated bcrypt hash.

8. **Setup page + page.tsx** — Created `setup-page.tsx` component with clean UI for setup flow. Updated `page.tsx` with `setupNeeded` state that checks `/api/setup` when auth fails.

## Lint
- `bun run lint` — passed with no errors
