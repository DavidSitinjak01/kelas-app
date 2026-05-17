---
Task ID: 1
Agent: Main Agent
Task: Remove dummy data, add Excel import feature, and optimize app for 818 students

Work Log:
- Cleared all existing database data (818 siswa, 23 rombel, 0 nilai, 0 eligible)
- Updated seed script to be empty (no more dummy data generation)
- Updated Prisma schema to add NISN, tempatLahir, tanggalLahir fields to Siswa model
- Ran db:push to apply schema changes
- Updated /api/import route to support clearExisting option and update existing siswa
- Updated /api/siswa route to support server-side pagination (limit, page, search, rombelId params)
- Updated siswa-page.tsx with:
  - Server-side pagination (50 per page) for performance with 818 students
  - New fields: NISN, tempatLahir, tanggalLahir in add/edit dialog and table
  - Rombel summary badges with click-to-filter
  - Stats cards showing total students, rombels, kelas 10/12 counts
  - Clear existing data option in import dialog
  - Import result showing created/updated/skipped counts
- Imported Excel data directly using bun script (818 students, 23 rombels, 0 errors)
- Updated eligible-page.tsx to fetch siswa per rombel instead of all at once
- Updated nilai-page.tsx to use paginated API
- Updated rekomendasi-jurusan-page.tsx and rekomendasi-pt-page.tsx to load siswa per rombel
- Ran lint check - no errors
- Verified all APIs work correctly

Stage Summary:
- Database now contains real data from the uploaded Dapodik Excel file
- 818 students across 23 rombels (9 kelas 10, 9 kelas 11, 5 kelas 12)
- Excel import feature matches Dapodik format exactly (columns: No, Nama, NIPD, JK, NISN, Tempat Lahir, Tanggal Lahir, Rombel Saat Ini)
- Rombels auto-created from Excel data with parsed kelas (X→10, XI→11, XII→12) and jurusan=Umum
- Server-side pagination added to handle large datasets without crashing
- All pages updated to use paginated/filtered API calls

---
Task ID: 2
Agent: Main Agent
Task: Add ranking features to Nilai page and import leger Excel data

Work Log:
- Analyzed 3 uploaded leger Excel files (X Baluse, XI Kalabubu, XII Baluse)
- Discovered format: Row 0-3 headers, Row 4=subject names, Row 5=empty, Row 6=Smt headers, Row 7+=data
- Each subject has 7 columns: Smt1-Smt6 + rerata
- Redesigned Prisma Nilai model: removed nilaiAsli/nilaiUp/semester/tahunAjaran, added smt1-smt6 + rerata + unique(siswaId, mataPelajaran)
- Ran db:push to apply schema changes
- Created /api/import-leger route for importing leger Excel files matching exact Dapodik format
- Created /api/peringkat route with optimized groupBy queries (type=kelas & type=tingkat)
- Imported all 3 leger files: 108 students with nilai, 1931 total nilai records
  - X Baluse: 36 siswa, 17 mapel, 576 nilai
  - XI Kalabubu: 36 siswa, 18 mapel, 648 nilai
  - XII Baluse: 36 siswa, 21 mapel, 707 nilai
- Completely redesigned nilai-page.tsx with 3 tabs:
  - Peringkat Kelas: select rombel → see student rankings within class
  - Peringkat Tingkat: select kelas (X/XI/XII) → see rankings across all rombels in that grade
  - Detail Nilai: full grade details with Smt1-6 and rerata per subject
- Added Top 3 podium cards with trophy/medal icons for both ranking tabs
- Added rombel summary badges in Peringkat Tingkat showing avg per rombel
- Updated dashboard API to use rerata instead of nilaiAsli
- Fixed analisa API and page to use rerata instead of asli/up
- Fixed eligible auto API to use rerata
- Fixed rekomendasi-jurusan and rekomendasi-pt APIs and pages to use rerata
- Added Import Leger dialog with multi-file upload support
- Ran lint check - no errors

Stage Summary:
- Nilai model redesigned to match Dapodik leger format (smt1-smt6 + rerata)
- 1931 nilai records imported from 3 leger files for 108 students
- Peringkat per Kelas feature: ranking within a specific rombel
- Peringkat per Tingkat feature: ranking across all rombels of a grade level (X/XI/XII)
- Import Leger feature: upload multiple .xlsx leger files at once
- All old nilaiAsli/nilaiUp references replaced with rerata throughout codebase
- Peringkat API optimized with Prisma groupBy for memory efficiency
