# Task 5 - Full-stack Developer: Supabase REST API Database Client

## Summary
Created a Supabase REST API client that mimics the Prisma Client interface, enabling the application to work in environments where direct PostgreSQL connections are blocked. The client uses PostgREST over HTTPS to perform all database operations.

## What was done

### 1. Created `/src/lib/supabase-db.ts`
A comprehensive PostgREST client that provides a Prisma-like interface:

- **SupabaseModel class** with all Prisma-compatible methods:
  - `findMany({ where?, select?, include?, orderBy?, take?, skip?, distinct? })`
  - `findFirst({ where?, include?, select? })`
  - `findUnique({ where, include? })`
  - `count({ where? })`
  - `create({ data, include? })`
  - `createMany({ data })`
  - `update({ where, data, include? })`
  - `delete({ where })`
  - `deleteMany({ where? })`
  - `upsert({ where, create, update, include? })`
  - `aggregate({ _avg?, _count?, _sum?, _min?, _max?, where? })`
  - `groupBy({ by, where?, _count?, _avg?, _sum?, _min?, _max? })`

- **Where clause support:**
  - Simple equality: `{ rombelid: "abc" }` → `?rombelid=eq.abc`
  - String contains: `{ nama: { contains: "search" } }` → `?nama=ilike.*search*`
  - Not equals: `{ id: { not: "abc" } }` → `?id=neq.abc`
  - IN operator: `{ siswaid: { in: [...] } }` → `?siswaid=in.(val1,val2,...)`
  - OR conditions: `{ OR: [...] }` → `?or=(field1.eq.val1,...)`
  - Relation filters: `{ rombel: { kelas: 12 } }` → inner join + `?rombel.kelas=eq.12`

- **Include/Select support:**
  - Simple include: `include: { rombel: true }` → `?select=*,rombel(*)`
  - Nested include: `include: { siswa: { include: { rombel: true } } }` → `?select=*,siswa(*,rombel(*))`
  - Select fields: `select: { id: true, nama: true }` → `?select=id,nama`
  - _count: `include: { _count: { select: { siswa: true } } }` → uses `siswa(count)` aggregation

- **Aggregate/GroupBy** computed in JavaScript after fetching data

- **Model configuration** for all 5 tables: rombel, siswa, nilai, eligible, tka

### 2. Modified `/src/lib/db.ts`
Changed from Prisma Client to Supabase REST API client:
```typescript
import { createSupabaseDB } from './supabase-db'
export const db = createSupabaseDB()
```

### 3. Bug fixes during testing
- Fixed `orderBy` to support both array and object syntax (Prisma accepts both)
- Fixed ESLint warning about unused eslint-disable directive

## Test Results

### Successfully tested APIs:
| API | Status | Response |
|-----|--------|----------|
| `/api/dashboard` | ✅ 200 | `{ totalRombel: 23, totalSiswa: 818, totalNilai: 14220, totalEligible: 13, rataRataNilai: 81.434 }` |
| `/api/rombel` | ✅ 200 | Returns 23 rombels with `_count.siswa` working correctly |
| `/api/siswa?limit=3` | ✅ 200 | Returns paginated siswa with `rombel` include |
| `/api/eligible` | ✅ 200 | Returns eligible records with nested `siswa → rombel` include |
| `/api/tka` | ✅ 200 | Returns TKA records with nested `siswa → rombel` include |

### Direct Supabase REST API tests:
- Basic select with relations: ✅
- OR conditions with ilike: ✅
- Inner join filters: ✅
- Nested includes: ✅

## Files Changed
- **NEW**: `src/lib/supabase-db.ts` - Supabase REST API client (~550 lines)
- **MODIFIED**: `src/lib/db.ts` - Changed from Prisma to Supabase REST client

## Known Issues
- Dev server may crash under memory pressure in the sandbox due to Turbopack compilation overhead. The `run-dev.sh` auto-restart script handles this.
- `aggregate` and `groupBy` methods fetch all matching rows and compute in JavaScript. For very large datasets, this could be optimized by creating Supabase RPC functions.
