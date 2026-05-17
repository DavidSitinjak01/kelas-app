---
Task ID: 1
Agent: main
Task: Build complete Kelas App (classroom management application)

Work Log:
- Designed and implemented Prisma schema with 4 models: Rombel, Siswa, Nilai, Eligible
- Created Zustand store for navigation state management
- Built sidebar navigation component using shadcn/ui Sidebar
- Built main page.tsx with SidebarProvider, SidebarInset, and page routing
- Created Dashboard page with stat cards and progress bars
- Created Rombel page with full CRUD (add, edit, delete) using Dialog and AlertDialog
- Created Siswa page with CRUD, search, and filter by rombel
- Created Nilai page with tabs for Nilai Asli and Nilai Up, filters for rombel/mapel/semester
- Created Eligible page (kelas 12 only) with status management and auto-eligible feature
- Created Analisa Nilai page with 5 charts (bar chart, pie chart, per-rombel, radar, top students)
- Created Rekomendasi Jurusan page with AI-powered recommendations via z-ai-web-dev-sdk
- Created Rekomendasi PT page with AI-powered university recommendations
- Built all API routes: dashboard, rombel, siswa, nilai, eligible, eligible/auto, analisa, rekomendasi-jurusan, rekomendasi-pt
- Updated globals.css with emerald/green theme
- Updated layout.tsx metadata
- Seeded database with 7 rombel, 40 siswa, 400 nilai, 22 eligible records
- Lint check passes

Stage Summary:
- Complete classroom management app with 8 menu pages
- All CRUD operations working
- AI-powered recommendations for jurusan and perguruan tinggi
- Charts and analysis with Recharts
- Dark emerald green sidebar theme
- Sample data seeded for demo
