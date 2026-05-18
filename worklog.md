---
Task ID: 1
Agent: main
Task: Fix AI analysis failing with red notification + Add more jurusan recommendation mappings

Work Log:
- Investigated the AI analysis failure by checking dev logs, testing API endpoints directly
- Found that the API route was working but LLM calls were taking 2+ minutes causing timeouts
- Rewrote `/api/analisa-jurusan-lanjut/detail/route.ts` with:
  - Added explicit LLM call timeout (120s per attempt)
  - Increased maxDuration to 300s
  - Reduced retry count from 3 to 2 to avoid extremely long waits
  - Optimized the prompt to be more concise (shorter system prompt, compressed data format)
  - Added pre-check for students with no grades (400 error with clear message)
  - Added logging for analysis start/completion times
  - Added validation for empty AI responses
  - Better error messages for timeout, rate limit, network, and empty response errors
- Updated frontend component (`analisa-jurusan-lanjut-page.tsx`):
  - Increased frontend timeout from 3 minutes to 5 minutes
  - Added success toast notification when AI analysis completes
  - Better error messages for abort timeout
  - Updated loading progress bar timing (15s instead of 30s before showing)
  - Added "proses masih berjalan" message after 60s
  - Validation for empty AI response
- Expanded jurusan recommendation mappings:
  - IPA: 10 → 14 categories (added: Gizi & Kesehatan Masyarakat, Bioteknologi & Ilmu Genetik, Teknik Geofisika & Geologi, Ilmu Keolahragaan)
  - IPS: 10 → 14 categories (added: Kriminologi & Kepolisian, Perencanaan Wilayah & Kota, Ilmu Perpustakaan & Informasi, Desain Komunikasi Visual & Kreatif)
  - Added specific jurusan entries for all 8 new categories
  - Expanded TKA pilihan mapping with new categories + added Bahasa Inggris and Bahasa Indonesia mappings
  - Updated AI prompt with more comprehensive subject→jurusan mapping (17 examples vs 8)

Stage Summary:
- AI analysis is now faster (~104s vs ~144-240s before)
- More robust error handling with specific error messages
- 28 total major categories (14 IPA + 14 IPS) with 84+ specific jurusan recommendations
- Frontend has better UX with success notifications and progress feedback
- Lint passes, dev server running correctly
