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
