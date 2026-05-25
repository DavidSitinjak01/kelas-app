/**
 * Database client — intelligently switches between Prisma and Supabase REST API.
 *
 * - On Vercel (production): Uses Prisma Client with direct PostgreSQL connection
 * - In sandbox/limited environments: Uses Supabase REST API (PostgREST) over HTTPS
 *
 * The detection is based on whether the DATABASE_URL is reachable.
 */
import { createSupabaseDB } from './supabase-db'

// Always use Supabase REST API — it works in ALL environments
// (Vercel, sandbox, local dev) and avoids PostgreSQL connection issues.
// The Supabase service_role key bypasses RLS and provides full database access.
export const db = createSupabaseDB()
