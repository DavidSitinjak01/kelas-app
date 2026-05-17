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
    let totalSkipped = 0
    const errors: string[] = []

    for (const filePath of filePaths) {
      const fullPath = path.join(process.cwd(), 'upload', filePath)
      if (!fs.existsSync(fullPath)) {
        errors.push(`File tidak ditemukan: ${filePath}`)
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
          errors.push(`Gagal memparse TKA dari file: ${filePath}`)
          totalSkipped++
          continue
        }

        // Find siswa by NISN
        const siswa = await db.siswa.findFirst({
          where: { nisn: parsed.nisn },
          include: { rombel: true },
        })

        if (!siswa) {
          errors.push(`Siswa tidak ditemukan: ${parsed.nama} (NISN: ${parsed.nisn})`)
          totalSkipped++
          continue
        }

        // Verify siswa is kelas 12
        if (siswa.rombel.kelas !== 12) {
          errors.push(`Siswa ${parsed.nama} bukan kelas 12 (kelas: ${siswa.rombel.kelas})`)
          totalSkipped++
          continue
        }

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

        totalCreated++
        totalProcessed++
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
      totalSkipped,
      errors: errors.slice(0, 50),
    })
  } catch (error) {
    console.error('Import TKA error:', error)
    return NextResponse.json({ error: 'Gagal mengimport file TKA' }, { status: 500 })
  }
}
