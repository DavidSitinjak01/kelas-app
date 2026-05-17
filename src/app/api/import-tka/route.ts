import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

interface ParsedTKA {
  nisn: string
  nama: string
  nomorPeserta: string
  tanggalPelaksanaan: string
  tkaId: string
  bindoNilai: number
  bindoKategori: string
  matNilai: number
  matKategori: string
  bingNilai: number
  bingKategori: string
  pilihan1Nama: string
  pilihan1Nilai: number
  pilihan1Kategori: string
  pilihan2Nama: string
  pilihan2Nilai: number
  pilihan2Kategori: string
}

/**
 * Normalize NISN: strip whitespace, remove leading zeros, keep digits only.
 * This handles cases like "0075541612" vs "75541612" or spaces/padding.
 */
function normalizeNisn(nisn: string): string {
  return nisn.trim().replace(/^0+/, '').replace(/\s/g, '')
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
 * Returns a score between 0 and 1, where 1 means all tokens match.
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
  // Jaccard-like: common tokens / unique tokens
  const union = new Set(Array.from(tokensA).concat(Array.from(tokensB))).size
  return common / union
}

/**
 * Combined fuzzy name match: returns a score 0-1 combining Levenshtein and token similarity.
 */
function fuzzyNameMatch(a: string, b: string): number {
  const aNorm = a.toLowerCase().trim()
  const bNorm = b.toLowerCase().trim()
  if (aNorm === bNorm) return 1

  // Levenshtein similarity
  const maxLen = Math.max(aNorm.length, bNorm.length)
  const levSim = maxLen > 0 ? 1 - levenshtein(aNorm, bNorm) / maxLen : 0

  // Token similarity
  const tokSim = tokenSimilarity(a, b)

  // Weight: 40% Levenshtein, 60% token (token is more reliable for name matching)
  return 0.4 * levSim + 0.6 * tokSim
}

function parseNum(val: string): number {
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

/**
 * Extract value after the LAST colon on a line that contains the label.
 * Format: "Label                 : value"
 */
function extractAfterColon(lines: string[], label: string): string {
  for (const line of lines) {
    if (line.includes(label) && line.includes(':')) {
      // Find the last colon position (some lines have multiple colons like NPSN)
      const lastColonIdx = line.lastIndexOf(':')
      if (lastColonIdx !== -1) {
        return line.substring(lastColonIdx + 1).trim()
      }
    }
  }
  return ''
}

function extractTKAFromText(text: string): ParsedTKA | null {
  try {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

    // Extract NISN - "Nomor Induk Siswa Nasional           : 0075541612"
    const nisn = extractAfterColon(lines, 'Nomor Induk Siswa Nasional')

    // Extract Nama - "Nama                                 : YOHANA RIZKIE CELESTIA ANJELI HONDRO"
    const nama = extractAfterColon(lines, 'Nama')

    // Extract Nomor Peserta TKA - "Nomor Peserta TKA                    : T3-25-07-24-0001-0002-7"
    const nomorPeserta = extractAfterColon(lines, 'Nomor Peserta TKA')

    // Extract Tanggal Pelaksanaan - "Tanggal Pelaksanaan TKA              : 3 s.d 4 November 2025"
    const tanggalPelaksanaan = extractAfterColon(lines, 'Tanggal Pelaksanaan TKA')

    // Extract TKA ID - "ID : TKA25-U2UVHL96R"
    let tkaId = ''
    for (const line of lines) {
      const match = line.match(/ID\s*:\s*(TKA\d+-\w+)/)
      if (match) { tkaId = match[1]; break }
    }

    // Extract subjects and scores
    // Format from pdftotext -layout:
    //  1    Bahasa Indonesia                                 66.52          Istimewa
    //  2    Matematika                                       49.53          Baik
    //  3    Bahasa Inggris                                   30.85          Baik
    //  4    Matematika Tingkat Lanjut                        42.76          Memadai
    //  5    Sejarah                                          81.32          Baik
    const subjects: { no: number; nama: string; nilai: number; kategori: string }[] = []

    // Strategy: find lines that start with a number (1-5) followed by subject name and score
    for (const line of lines) {
      // Match: leading number + subject name + decimal number + category
      const match = line.match(/^\s*(\d+)\s+(.+?)\s+([\d.]+)\s+(Istimewa|Baik|Memadai|Kurang)\s*$/i)
      if (match) {
        subjects.push({
          no: parseInt(match[1]),
          nama: match[2].trim(),
          nilai: parseNum(match[3]),
          kategori: match[4].trim(),
        })
      }
    }

    // Sort subjects by their number
    subjects.sort((a, b) => a.no - b.no)

    // Identify wajib vs pilihan
    // First 3 are wajib: Bahasa Indonesia, Matematika, Bahasa Inggris
    // Last 2 are pilihan (after "Mata Pelajaran Pilihan" marker)
    const wajibSubjects = subjects.filter(s => s.no <= 3)
    const pilihanSubjects = subjects.filter(s => s.no > 3)

    // Map wajib subjects by name
    let bindoNilai = 0, bindoKategori = '-'
    let matNilai = 0, matKategori = '-'
    let bingNilai = 0, bingKategori = '-'

    for (const s of wajibSubjects) {
      const nameLower = s.nama.toLowerCase()
      if (nameLower.includes('bahasa indonesia') || nameLower.includes('b. indonesia') || nameLower.includes('bindo')) {
        bindoNilai = s.nilai
        bindoKategori = s.kategori
      } else if (nameLower.includes('bahasa inggris') || nameLower.includes('b. inggris') || nameLower.includes('bing')) {
        bingNilai = s.nilai
        bingKategori = s.kategori
      } else if (nameLower.includes('matematika') && !nameLower.includes('lanjut')) {
        matNilai = s.nilai
        matKategori = s.kategori
      }
    }

    // Map pilihan subjects
    const p1 = pilihanSubjects[0]
    const p2 = pilihanSubjects[1]

    if (!nisn || subjects.length < 5) {
      console.error('Incomplete TKA data:', { nisn, nama, subjectsCount: subjects.length, subjects })
      return null
    }

    return {
      nisn,
      nama,
      nomorPeserta: nomorPeserta || '-',
      tanggalPelaksanaan: tanggalPelaksanaan || '-',
      tkaId: tkaId || '-',
      bindoNilai,
      bindoKategori,
      matNilai,
      matKategori,
      bingNilai,
      bingKategori,
      pilihan1Nama: p1?.nama || '-',
      pilihan1Nilai: p1?.nilai || 0,
      pilihan1Kategori: p1?.kategori || '-',
      pilihan2Nama: p2?.nama || '-',
      pilihan2Nilai: p2?.nilai || 0,
      pilihan2Kategori: p2?.kategori || '-',
    }
  } catch (error) {
    console.error('Error extracting TKA from text:', error)
    return null
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const filePaths = body.filePaths as string[]

    if (!filePaths || filePaths.length === 0) {
      return NextResponse.json({ error: 'filePaths diperlukan' }, { status: 400 })
    }

    let totalProcessed = 0
    let totalCreated = 0
    let totalUpdated = 0
    let totalSkipped = 0
    const errors: string[] = []
    const details: { fileName: string; siswaNama: string; rombel: string; status: string }[] = []

    for (const filePath of filePaths) {
      const fullPath = path.join(process.cwd(), 'upload', filePath)
      if (!fs.existsSync(fullPath)) {
        errors.push(`File tidak ditemukan: ${filePath}`)
        totalSkipped++
        continue
      }

      try {
        // Extract text from PDF using pdftotext with -layout flag for better formatting
        const result = spawnSync('pdftotext', ['-layout', fullPath, '-'], {
          encoding: 'utf-8',
          maxBuffer: 5 * 1024 * 1024,
          timeout: 30000,
        })
        if (result.error) {
          throw new Error(`pdftotext failed: ${result.error.message}`)
        }
        const textOutput = result.stdout || ''

        const parsed = extractTKAFromText(textOutput)
        if (!parsed) {
          errors.push(`Gagal memparse TKA dari file: ${filePath} - Pastikan file PDF adalah Sertifikat Hasil TKA (SHTKA) yang valid`)
          totalSkipped++
          continue
        }

        // Find siswa by NISN with robust matching
        const cleanNisn = parsed.nisn.trim()
        const normalizedNisn = normalizeNisn(cleanNisn)

        // Step 1: Exact NISN match
        let siswa = await db.siswa.findFirst({
          where: { nisn: cleanNisn },
          include: { rombel: true },
        })

        // Step 2: Try normalized NISN (strip leading zeros) if exact match fails
        if (!siswa && normalizedNisn !== cleanNisn) {
          // Find all kelas 12 students and match by normalized NISN
          const kelas12Siswa = await db.siswa.findMany({
            where: { rombel: { kelas: 12 } },
            include: { rombel: true },
          })
          siswa = kelas12Siswa.find(s => normalizeNisn(s.nisn) === normalizedNisn) || null
        }

        // Step 3: Try NIS (not NISN) as fallback — sometimes PDF has NIS listed as NISN
        if (!siswa && cleanNisn) {
          siswa = await db.siswa.findFirst({
            where: { nis: cleanNisn },
            include: { rombel: true },
          })
        }

        // Step 4: Fuzzy name matching as last resort
        if (!siswa) {
          const kelas12Siswa = await db.siswa.findMany({
            where: { rombel: { kelas: 12 } },
            include: { rombel: true },
          })

          // Find best fuzzy name match
          let bestMatch: typeof kelas12Siswa[0] | null = null
          let bestScore = 0
          const FUZZY_THRESHOLD = 0.65

          for (const s of kelas12Siswa) {
            const score = fuzzyNameMatch(parsed.nama, s.nama)
            if (score > bestScore && score >= FUZZY_THRESHOLD) {
              bestScore = score
              bestMatch = s
            }
          }

          if (bestMatch) {
            errors.push(`NISN ${cleanNisn} tidak cocok. Nama "${parsed.nama}" mirip dengan "${bestMatch.nama}" (NISN: ${bestMatch.nisn}, Rombel: ${bestMatch.rombel.nama}, skor kecocokan: ${(bestScore * 100).toFixed(0)}%). Namun, kecocokan nama tidak cukup untuk import otomatis - mohon perbaiki NISN di Data Siswa atau gunakan Import Excel/CSV.`)
          } else {
            errors.push(`Siswa tidak ditemukan: "${parsed.nama}" (NISN: ${cleanNisn}) - Pastikan NISN siswa sudah terdaftar di Data Siswa. Tip: Coba Import Excel/CSV jika NISN berbeda.`)
          }
          totalSkipped++
          continue
        }

        // Verify siswa is kelas 12
        if (siswa.rombel.kelas !== 12) {
          errors.push(`Siswa ${parsed.nama} bukan kelas 12 (kelas: ${siswa.rombel.kelas}, rombel: ${siswa.rombel.nama})`)
          totalSkipped++
          continue
        }

        // Check if TKA record already exists for this student
        const existingTka = await db.tKA.findUnique({
          where: { siswaId: siswa.id },
        })

        // Upsert TKA record
        await db.tKA.upsert({
          where: { siswaId: siswa.id },
          create: {
            siswaId: siswa.id,
            nomorPeserta: parsed.nomorPeserta,
            tanggalPelaksanaan: parsed.tanggalPelaksanaan,
            tkaId: parsed.tkaId,
            bindoNilai: parsed.bindoNilai,
            bindoKategori: parsed.bindoKategori,
            matNilai: parsed.matNilai,
            matKategori: parsed.matKategori,
            bingNilai: parsed.bingNilai,
            bingKategori: parsed.bingKategori,
            pilihan1Nama: parsed.pilihan1Nama,
            pilihan1Nilai: parsed.pilihan1Nilai,
            pilihan1Kategori: parsed.pilihan1Kategori,
            pilihan2Nama: parsed.pilihan2Nama,
            pilihan2Nilai: parsed.pilihan2Nilai,
            pilihan2Kategori: parsed.pilihan2Kategori,
          },
          update: {
            nomorPeserta: parsed.nomorPeserta,
            tanggalPelaksanaan: parsed.tanggalPelaksanaan,
            tkaId: parsed.tkaId,
            bindoNilai: parsed.bindoNilai,
            bindoKategori: parsed.bindoKategori,
            matNilai: parsed.matNilai,
            matKategori: parsed.matKategori,
            bingNilai: parsed.bingNilai,
            bingKategori: parsed.bingKategori,
            pilihan1Nama: parsed.pilihan1Nama,
            pilihan1Nilai: parsed.pilihan1Nilai,
            pilihan1Kategori: parsed.pilihan1Kategori,
            pilihan2Nama: parsed.pilihan2Nama,
            pilihan2Nilai: parsed.pilihan2Nilai,
            pilihan2Kategori: parsed.pilihan2Kategori,
          },
        })

        if (existingTka) {
          totalUpdated++
        } else {
          totalCreated++
        }
        totalProcessed++

        details.push({
          fileName: filePath,
          siswaNama: siswa.nama,
          rombel: siswa.rombel.nama,
          status: existingTka ? 'updated' : 'created',
        })
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        errors.push(`Error processing ${filePath}: ${msg}`)
        totalSkipped++
      }
    }

    return NextResponse.json({
      success: true,
      totalProcessed,
      totalCreated,
      totalUpdated,
      totalSkipped,
      errors: errors.slice(0, 50),
      details,
    })
  } catch (error) {
    console.error('Import TKA error:', error)
    return NextResponse.json({ error: 'Gagal mengimport file TKA' }, { status: 500 })
  }
}
