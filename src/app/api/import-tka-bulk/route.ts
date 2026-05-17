import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

export const dynamic = 'force-dynamic'

/**
 * Normalize NISN: strip whitespace, remove leading zeros, keep digits only.
 */
function normalizeNisn(nisn: string): string {
  return String(nisn).trim().replace(/^0+/, '').replace(/\s/g, '')
}

/**
 * Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Token-based similarity: compare sets of words in two names.
 */
function tokenSimilarity(a: string, b: string): number {
  const tokensA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const tokensB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (tokensA.size === 0 && tokensB.size === 0) return 1
  if (tokensA.size === 0 || tokensB.size === 0) return 0
  let common = 0
  for (const t of Array.from(tokensA)) {
    if (tokensB.has(t)) common++
  }
  const union = new Set(Array.from(tokensA).concat(Array.from(tokensB))).size
  return common / union
}

/**
 * Combined fuzzy name match: returns a score 0-1.
 */
function fuzzyNameMatch(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim()
  const bNorm = b.toLowerCase().trim()
  if (aNorm === bNorm) return 1
  const maxLen = Math.max(aNorm.length, bNorm.length)
  const levSim = maxLen > 0 ? 1 - levenshtein(aNorm, bNorm) / maxLen : 0
  const tokSim = tokenSimilarity(a, b)
  return 0.4 * levSim + 0.6 * tokSim
}

/**
 * Normalize a column header for flexible matching.
 */
function normalizeHeader(h: string): string {
  return String(h).toLowerCase().trim()
    .replace(/[^a-z0-9]/g, '') // remove non-alphanumeric
}

/**
 * Parse numeric value from cell, returning 0 if invalid.
 */
function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val))
  return isNaN(n) ? 0 : n
}

/**
 * Parse string value from cell, returning default if empty.
 */
function parseStr(val: unknown, defaultVal = '-'): string {
  if (val === null || val === undefined || val === '') return defaultVal
  return String(val).trim() || defaultVal
}

// Column header mappings - maps normalized header to our field key
const NISN_HEADERS = ['nisn', 'nomorinduksiswanasional', 'noinduksiswanasional']
const NIS_HEADERS = ['nis', 'nomorinduksiswa', 'noinduksiswa']
const NAMA_HEADERS = ['nama', 'namasiswa', 'namalengkap']
const BINDO_NILAI_HEADERS = ['bindonesia', 'bahasaindonesia', 'bindo', 'bindonesianilai', 'bahasaindonesianilai', 'b indonesia']
const MAT_NILAI_HEADERS = ['matematika', 'mat', 'matematikanilai', 'mtk']
const BING_NILAI_HEADERS = ['binggris', 'bahasainggris', 'bing', 'binggrisnilai', 'bahasainggrisnilai', 'b inggris']
const PILIHAN1_NAMA_HEADERS = ['pilihan1nama', 'pilihan1', 'mapelpilihan1', 'pilihan1namamapel']
const PILIHAN1_NILAI_HEADERS = ['pilihan1nilai', 'nilaipilihan1', 'pilihan1skor']
const PILIHAN2_NAMA_HEADERS = ['pilihan2nama', 'pilihan2', 'mapelpilihan2', 'pilihan2namamapel']
const PILIHAN2_NILAI_HEADERS = ['pilihan2nilai', 'nilaipilihan2', 'pilihan2skor']
const NOMOR_PESERTA_HEADERS = ['nomorpeserta', 'noPeserta', 'nomorpesertatka']
const TANGGAL_HEADERS = ['tanggalpelaksanaan', 'tanggal', 'tglpelaksanaan']

function findColumn(headers: string[], options: string[]): number {
  for (const opt of options) {
    const idx = headers.findIndex(h => normalizeHeader(h) === opt)
    if (idx !== -1) return idx
  }
  // Partial match
  for (const opt of options) {
    const idx = headers.findIndex(h => normalizeHeader(h).includes(opt) || opt.includes(normalizeHeader(h)))
    if (idx !== -1) return idx
  }
  return -1
}

export async function POST(request: Request) {
  try {
    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json({ error: 'File Excel/CSV diperlukan. Kirim file menggunakan multipart/form-data.' }, { status: 400 })
    }
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File Excel/CSV diperlukan' }, { status: 400 })
    }

    // Read file into buffer
    const buffer = Buffer.from(await file.arrayBuffer())
    const _fileName = file.name.toLowerCase()
    void _fileName

    // Parse Excel/CSV
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })

    if (rows.length === 0) {
      return NextResponse.json({ error: 'File kosong - tidak ada data ditemukan' }, { status: 400 })
    }

    // Map column headers to indices
    const headers = Object.keys(rows[0])
    const nisnIdx = findColumn(headers, NISN_HEADERS)
    const nisIdx = findColumn(headers, NIS_HEADERS)
    const namaIdx = findColumn(headers, NAMA_HEADERS)
    const bindoIdx = findColumn(headers, BINDO_NILAI_HEADERS)
    const matIdx = findColumn(headers, MAT_NILAI_HEADERS)
    const bingIdx = findColumn(headers, BING_NILAI_HEADERS)
    const p1NamaIdx = findColumn(headers, PILIHAN1_NAMA_HEADERS)
    const p1NilaiIdx = findColumn(headers, PILIHAN1_NILAI_HEADERS)
    const p2NamaIdx = findColumn(headers, PILIHAN2_NAMA_HEADERS)
    const p2NilaiIdx = findColumn(headers, PILIHAN2_NILAI_HEADERS)
    const noPesertaIdx = findColumn(headers, NOMOR_PESERTA_HEADERS)
    const tanggalIdx = findColumn(headers, TANGGAL_HEADERS)

    // Validate: need at least NISN or Nama
    if (nisnIdx === -1 && nisIdx === -1 && namaIdx === -1) {
      return NextResponse.json({
        error: 'Kolom NISN, NIS, atau Nama tidak ditemukan. Pastikan file memiliki kolom: NISN, Nama, B. Indonesia, Matematika, B. Inggris, dll.',
        detectedHeaders: headers,
      }, { status: 400 })
    }

    // Fetch all kelas 12 students for matching
    const kelas12Siswa = await db.siswa.findMany({
      where: { rombel: { kelas: 12 } },
      include: { rombel: true },
    })

    let totalProcessed = 0
    let totalCreated = 0
    let totalUpdated = 0
    let totalSkipped = 0
    const errors: string[] = []
    const details: { row: number; siswaNama: string; rombel: string; status: string; matchedBy: string }[] = []

    for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
      const row = rows[rowIdx]
      const rowNum = rowIdx + 2 // Excel row number (1-indexed + header)

      // Extract values from row
      const nisnVal = nisnIdx !== -1 ? parseStr(row[headers[nisnIdx]], '') : ''
      const nisVal = nisIdx !== -1 ? parseStr(row[headers[nisIdx]], '') : ''
      const namaVal = namaIdx !== -1 ? parseStr(row[headers[namaIdx]], '') : ''
      const bindoNilai = bindoIdx !== -1 ? parseNum(row[headers[bindoIdx]]) : 0
      const matNilai = matIdx !== -1 ? parseNum(row[headers[matIdx]]) : 0
      const bingNilai = bingIdx !== -1 ? parseNum(row[headers[bingIdx]]) : 0
      const p1Nama = p1NamaIdx !== -1 ? parseStr(row[headers[p1NamaIdx]], '-') : '-'
      const p1Nilai = p1NilaiIdx !== -1 ? parseNum(row[headers[p1NilaiIdx]]) : 0
      const p2Nama = p2NamaIdx !== -1 ? parseStr(row[headers[p2NamaIdx]], '-') : '-'
      const p2Nilai = p2NilaiIdx !== -1 ? parseNum(row[headers[p2NilaiIdx]]) : 0
      const nomorPeserta = noPesertaIdx !== -1 ? parseStr(row[headers[noPesertaIdx]]) : '-'
      const tanggalPelaksanaan = tanggalIdx !== -1 ? parseStr(row[headers[tanggalIdx]]) : '-'

      // Skip empty rows
      if (!nisnVal && !nisVal && !namaVal) {
        continue
      }

      // Find matching student
      let matchedSiswa: typeof kelas12Siswa[0] | null = null
      let matchedBy = ''

      // Strategy 1: Exact NISN match
      if (nisnVal) {
        matchedSiswa = kelas12Siswa.find(s => s.nisn === nisnVal) || null
        if (matchedSiswa) matchedBy = `NISN exact: ${nisnVal}`
      }

      // Strategy 2: Normalized NISN match (strip leading zeros)
      if (!matchedSiswa && nisnVal) {
        const normalizedInput = normalizeNisn(nisnVal)
        matchedSiswa = kelas12Siswa.find(s => normalizeNisn(s.nisn) === normalizedInput) || null
        if (matchedSiswa) matchedBy = `NISN normalized: ${nisnVal} -> ${normalizedInput}`
      }

      // Strategy 3: NIS match
      if (!matchedSiswa && nisVal) {
        matchedSiswa = kelas12Siswa.find(s => s.nis === nisVal) || null
        if (matchedSiswa) matchedBy = `NIS exact: ${nisVal}`
      }

      // Strategy 4: Exact name match (case insensitive)
      if (!matchedSiswa && namaVal) {
        matchedSiswa = kelas12Siswa.find(s => s.nama.toLowerCase().trim() === namaVal.toLowerCase().trim()) || null
        if (matchedSiswa) matchedBy = `Nama exact: "${namaVal}"`
      }

      // Strategy 5: Name contains match
      if (!matchedSiswa && namaVal) {
        matchedSiswa = kelas12Siswa.find(
          s => s.nama.toLowerCase().includes(namaVal.toLowerCase()) ||
               namaVal.toLowerCase().includes(s.nama.toLowerCase())
        ) || null
        if (matchedSiswa) matchedBy = `Nama contains: "${namaVal}" <-> "${matchedSiswa.nama}"`
      }

      // Strategy 6: Fuzzy name match
      if (!matchedSiswa && namaVal) {
        let bestMatch: typeof kelas12Siswa[0] | null = null
        let bestScore = 0
        const FUZZY_THRESHOLD = 0.65

        for (const s of kelas12Siswa) {
          const score = fuzzyNameMatch(namaVal, s.nama)
          if (score > bestScore && score >= FUZZY_THRESHOLD) {
            bestScore = score
            bestMatch = s
          }
        }

        if (bestMatch) {
          matchedSiswa = bestMatch
          matchedBy = `Nama fuzzy: "${namaVal}" <-> "${bestMatch.nama}" (skor: ${(bestScore * 100).toFixed(0)}%)`
        }
      }

      if (!matchedSiswa) {
        const identifier = nisnVal ? `NISN: ${nisnVal}` : nisVal ? `NIS: ${nisVal}` : `Nama: "${namaVal}"`
        errors.push(`Baris ${rowNum}: Siswa tidak ditemukan (${identifier})`)
        totalSkipped++
        continue
      }

      // Verify siswa is kelas 12
      if (matchedSiswa.rombel.kelas !== 12) {
        errors.push(`Baris ${rowNum}: ${matchedSiswa.nama} bukan kelas 12 (kelas: ${matchedSiswa.rombel.kelas}, rombel: ${matchedSiswa.rombel.nama})`)
        totalSkipped++
        continue
      }

      // Determine kategori based on nilai
      const getKategori = (nilai: number): string => {
        if (nilai >= 85) return 'Istimewa'
        if (nilai >= 70) return 'Baik'
        if (nilai >= 40) return 'Memadai'
        if (nilai > 0) return 'Kurang'
        return '-'
      }

      // Upsert TKA record
      const existingTka = await db.tKA.findUnique({
        where: { siswaId: matchedSiswa.id },
      })

      await db.tKA.upsert({
        where: { siswaId: matchedSiswa.id },
        create: {
          siswaId: matchedSiswa.id,
          nomorPeserta,
          tanggalPelaksanaan,
          bindoNilai,
          bindoKategori: getKategori(bindoNilai),
          matNilai,
          matKategori: getKategori(matNilai),
          bingNilai,
          bingKategori: getKategori(bingNilai),
          pilihan1Nama: p1Nama,
          pilihan1Nilai: p1Nilai,
          pilihan1Kategori: getKategori(p1Nilai),
          pilihan2Nama: p2Nama,
          pilihan2Nilai: p2Nilai,
          pilihan2Kategori: getKategori(p2Nilai),
        },
        update: {
          nomorPeserta,
          tanggalPelaksanaan,
          bindoNilai,
          bindoKategori: getKategori(bindoNilai),
          matNilai,
          matKategori: getKategori(matNilai),
          bingNilai,
          bingKategori: getKategori(bingNilai),
          pilihan1Nama: p1Nama,
          pilihan1Nilai: p1Nilai,
          pilihan1Kategori: getKategori(p1Nilai),
          pilihan2Nama: p2Nama,
          pilihan2Nilai: p2Nilai,
          pilihan2Kategori: getKategori(p2Nilai),
        },
      })

      if (existingTka) {
        totalUpdated++
      } else {
        totalCreated++
      }
      totalProcessed++

      details.push({
        row: rowNum,
        siswaNama: matchedSiswa.nama,
        rombel: matchedSiswa.rombel.nama,
        status: existingTka ? 'updated' : 'created',
        matchedBy,
      })
    }

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalCreated,
      totalUpdated,
      totalSkipped,
      errors: errors.slice(0, 100),
      details,
      detectedHeaders: headers,
      columnMapping: {
        nisn: nisnIdx !== -1 ? headers[nisnIdx] : '(tidak ditemukan)',
        nis: nisIdx !== -1 ? headers[nisIdx] : '(tidak ditemukan)',
        nama: namaIdx !== -1 ? headers[namaIdx] : '(tidak ditemukan)',
        bindoNilai: bindoIdx !== -1 ? headers[bindoIdx] : '(tidak ditemukan)',
        matNilai: matIdx !== -1 ? headers[matIdx] : '(tidak ditemukan)',
        bingNilai: bingIdx !== -1 ? headers[bingIdx] : '(tidak ditemukan)',
        pilihan1Nama: p1NamaIdx !== -1 ? headers[p1NamaIdx] : '(tidak ditemukan)',
        pilihan1Nilai: p1NilaiIdx !== -1 ? headers[p1NilaiIdx] : '(tidak ditemukan)',
        pilihan2Nama: p2NamaIdx !== -1 ? headers[p2NamaIdx] : '(tidak ditemukan)',
        pilihan2Nilai: p2NilaiIdx !== -1 ? headers[p2NilaiIdx] : '(tidak ditemukan)',
        nomorPeserta: noPesertaIdx !== -1 ? headers[noPesertaIdx] : '(tidak ditemukan)',
        tanggalPelaksanaan: tanggalIdx !== -1 ? headers[tanggalIdx] : '(tidak ditemukan)',
      },
    })
  } catch (error) {
    console.error('Import TKA Bulk error:', error)
    const msg = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: `Gagal mengimport file TKA: ${msg}` }, { status: 500 })
  }
}
