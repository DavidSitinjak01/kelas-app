---
Task ID: 1
Agent: main
Task: Fix TypeScript build errors causing Vercel deployment failure (15 errors)

Work Log:
- Ran `npx tsc --noEmit` to identify all TypeScript errors
- Found 7 errors in project source code (plus 3 in examples/skills which don't affect Vercel build)
- Fixed `@types/bcryptjs` v3.0.0 → v2.4.2 (stub type was incompatible with bcryptjs v2.4.3)
- Fixed `boolean | undefined` not assignable to `boolean` in import and import-leger routes
- Fixed `AnyRecord` not assignable to `never` in public/nilai route by adding explicit type annotation
- Fixed `string | number | boolean | undefined` not assignable to Input `value` prop in form-nilai page by using `as const` for semesterFields
- Fixed `Symbol.iterator` missing on `orderBy` type in supabase-db.ts by casting to `AnyRecord[]`
- Committed and pushed to GitHub (commit bfe2ec4)

Stage Summary:
- All TypeScript errors resolved (0 errors in `npx tsc --noEmit` for project code)
- Changes pushed to GitHub → Vercel will auto-deploy
- Dev server in sandbox keeps crashing due to memory limits (not a code issue)
