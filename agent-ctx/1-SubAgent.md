# Task 1 - SubAgent: Fix AI analysis 'Gagal' error

## Summary
Fixed the "Gagal" error when clicking "Mulai Analisis AI" button by making the API route more resilient.

## Changes Made
- **File**: `/home/z/my-project/src/app/api/analisa-jurusan-lanjut/detail/route.ts`
- Added `export const maxDuration = 120` to prevent Next.js serverless function timeout (default is ~10s on Vercel, 60s locally)
- Added `retryWithBackoff<T>()` generic helper function with exponential backoff (3 retries, 2s initial delay → 2s, 4s, 8s)
- Wrapped both `ZAI.create()` and `zai.chat.completions.create()` inside the retry helper
- Improved catch block to return specific error messages based on error type:
  - Timeout → "Analisis AI timeout — server membutuhkan waktu terlalu lama"
  - Rate limit (429) → "Server AI sedang sibuk"
  - Network error → "Koneksi ke server AI gagal"
  - All retries exhausted → "Analisis AI gagal setelah beberapa percobaan"
  - Fallback → "Gagal menghasilkan analisis AI"
  - Also includes `detail` field with raw error message for debugging
- Lint passes clean
