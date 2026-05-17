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
