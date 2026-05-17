---
Task ID: 1
Agent: Main
Task: Add Nilai TKA feature for kelas 12 with PDF import

Work Log:
- Analyzed 3 uploaded TKA PDF files to understand the format (Sertifikat Hasil TKA)
- Each PDF contains 1 student's TKA scores: 3 wajib (B.Indo, Mat, B.Ing) + 2 pilihan (varies per student)
- Added TKA model to Prisma schema with all subject fields
- Created /api/tka route for GET (list with siswa+rombel) and DELETE operations
- Created /api/import-tka route with PDF text extraction using pdftotext
- Parser extracts NISN, nama, nomor peserta, tanggal pelaksanaan, TKA ID, and all 5 subject scores + categories
- Fixed parser: used extractAfterColon helper with lastIndexOf(':') for reliable field extraction
- Used spawnSync instead of execSync to avoid server crashes
- Added "Nilai TKA" tab in nilai-page.tsx with table showing all subjects per student
- Added "Import TKA" button and dialog for PDF upload (supports multiple files)
- Added TKA summary stats (average scores for wajib subjects)
- Added delete confirmation dialog per TKA record
- Tested with all 3 uploaded PDFs - all data imported correctly

Stage Summary:
- TKA feature fully implemented: PDF import, data display, delete
- 3 students successfully imported: YOHANA, MARGARETA, CLAUDYA
- Pilihan subjects correctly identified: Matematika Tingkat Lanjut+Sejarah (2 students), Kimia+Biologi (1 student)
- Lint passes, dev server running

---
Task ID: 2
Agent: Main
Task: Fix TKA import for XII Lasara and XII Rai - add bulk Excel/CSV import and improve matching

Problem:
- XII Lasara (33 students) and XII Rai (35 students) have 0 TKA records
- Existing PDF import only works with individual PDF certificates (108 PDFs exist for the 3 working classes)
- NISN matching was too strict (exact match only)
- No fallback for when PDFs aren't available

Work Log:
1. Improved /api/import-tka/route.ts - Better NISN matching and fuzzy name fallback:
   - Added normalizeNisn() function: strips whitespace and leading zeros (e.g., "0075541612" → "75541612")
   - Added Levenshtein distance algorithm for string similarity
   - Added token-based similarity (Jaccard-like) for name matching
   - Added fuzzyNameMatch() combining Levenshtein (40%) + token similarity (60%)
   - Multi-step matching: exact NISN → normalized NISN → NIS fallback → fuzzy name match
   - Fuzzy name matching shows detailed error with similarity score but doesn't auto-import (safety)
   - Better error messages: suggest using Excel/CSV import as alternative
   - Set iteration fixed for downlevelIteration compatibility (Array.from)

2. Created /api/import-tka-bulk/route.ts - New Excel/CSV bulk import endpoint:
   - Accepts Excel (.xlsx, .xls) or CSV files via multipart/form-data
   - Uses xlsx library (already in dependencies) for parsing
   - Flexible column header matching: supports many variants (NISN, NIS, Nama, Bindo, Mat, Bing, etc.)
   - 6-strategy student matching: exact NISN → normalized NISN → NIS → exact name → contains name → fuzzy name
   - Auto-determines kategori based on nilai (Istimewa/Baik/Memadai/Kurang)
   - Returns detailed results: column mapping, per-row match details, matched-by info
   - Graceful error handling for missing Content-Type
   - Tested with CSV file: column mapping correctly detected, proper error for unknown student

3. Updated nilai-page.tsx - Enhanced TKA import dialog:
   - Added mode toggle: "Sertifikat PDF" and "Excel / CSV" buttons
   - PDF mode: same as before (upload multiple PDFs)
   - Excel/CSV mode:
     - Shows template format card with required/optional column descriptions
     - Example header row display
     - Single file upload for .xlsx, .xls, .csv
     - Shows detected column mapping after import
     - Shows per-student import details (created/updated) with rombel info
   - Both modes share the same dialog with proper state management
   - Added tkaImportMode, tkaBulkFile, tkaBulkResult state variables
   - Updated all "Import TKA" button click handlers to reset all states
   - Existing PDF import functionality preserved unchanged

4. Lint and compatibility:
   - All files pass ESLint
   - TypeScript compatibility: fixed Set iteration with Array.from()
   - Fixed pilihan1Nilai/pilihan2Nilai shorthand property names (explicit values needed)
   - Both API endpoints tested and returning correct responses
   - No Prisma schema changes required

Stage Summary:
- TKA import now robust with multi-strategy NISN/name matching
- New bulk Excel/CSV import path available for XII Lasara and XII Rai
- UI provides clear guidance on Excel template format
- Existing PDF import functionality preserved
- Lint passes, API endpoints verified
