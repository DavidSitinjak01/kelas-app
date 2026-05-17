import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const filePath = body.filePath as string

    if (!filePath) {
      return NextResponse.json({ error: 'filePath diperlukan' }, { status: 400 })
    }

    const fullPath = path.join(process.cwd(), 'upload', filePath)
    
    if (!fs.existsSync(fullPath)) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
    }

    // Read Excel file using readFileSync + XLSX.read (works in serverless/edge)
    const fileBuffer = fs.readFileSync(fullPath)
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Parse to JSON - header is row 1 & 2, data starts from row 3
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    if (rawData.length < 3) {
      return NextResponse.json({ error: 'File Excel kosong atau format tidak sesuai' }, { status: 400 })
    }

    // Column mapping based on the Dapodik format:
    // 0: No, 1: Nama, 2: NIPD, 3: JK, 4: NISN, 5: Tempat Lahir, 6: Tanggal Lahir, 42: Rombel Saat Ini
    const COL_NO = 0
    const COL_NAMA = 1
    const COL_NIPD = 2
    const COL_JK = 3
    const COL_NISN = 4
    const COL_TEMPAT_LAHIR = 5
    const COL_TANGGAL_LAHIR = 6
    const COL_ROMBEL = 42

    // Extract unique rombel names and student data
    const rombelSet = new Map<string, { kelas: number; nama: string; jurusan: string }>()
    const siswaData: { no: number; nama: string; nipd: string; nisn: string; jk: string; tempatLahir: string; tanggalLahir: string; rombelNama: string }[] = []

    for (let i = 2; i < rawData.length; i++) { // Start from row 3 (index 2)
      const row = rawData[i]
      if (!row || !row[COL_NAMA]) continue

      const nama = String(row[COL_NAMA] || '').trim()
      const nipd = String(row[COL_NIPD] || '').trim()
      const nisn = String(row[COL_NISN] || '').trim()
      const jk = String(row[COL_JK] || '').trim().toUpperCase()
      const tempatLahir = String(row[COL_TEMPAT_LAHIR] || '').trim()
      const tanggalLahir = row[COL_TANGGAL_LAHIR] ? formatDate(row[COL_TANGGAL_LAHIR]) : ''
      const rombelNama = String(row[COL_ROMBEL] || '').trim()

      if (!nama || !rombelNama) continue

      // Parse rombel name to extract kelas and jurusan info
      if (!rombelSet.has(rombelNama)) {
        const kelas = parseKelas(rombelNama)
        const jurusan = parseJurusan(rombelNama)
        rombelSet.set(rombelNama, { kelas, nama: rombelNama, jurusan })
      }

      siswaData.push({
        no: Number(row[COL_NO]) || i - 1,
        nama,
        nipd,
        nisn,
        jk: jk === 'L' ? 'L' : 'P',
        tempatLahir,
        tanggalLahir,
        rombelNama,
      })
    }

    if (siswaData.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data siswa yang valid di file Excel' }, { status: 400 })
    }

    // Check for existing data
    const existingRombel = await db.rombel.count()
    const existingSiswa = await db.siswa.count()

    // Create rombels
    const rombelMap = new Map<string, string>() // rombelNama -> rombelId
    let rombelCreated = 0

    for (const [nama, info] of rombelSet) {
      const existing = await db.rombel.findFirst({ where: { nama: nama } })
      if (existing) {
        rombelMap.set(nama, existing.id)
      } else {
        const rombel = await db.rombel.create({
          data: {
            nama: info.nama,
            kelas: info.kelas,
            jurusan: info.jurusan,
            tahunAjaran: '2024/2025',
            waliKelas: '-',
          },
        })
        rombelMap.set(nama, rombel.id)
        rombelCreated++
      }
    }

    // Create siswa
    let siswaCreated = 0
    let siswaSkipped = 0
    const errors: string[] = []

    for (const siswa of siswaData) {
      const rombelId = rombelMap.get(siswa.rombelNama)
      if (!rombelId) {
        errors.push(`Rombel tidak ditemukan untuk ${siswa.nama}: ${siswa.rombelNama}`)
        siswaSkipped++
        continue
      }

      // Use NIPD as NIS (it's the student ID number)
      const nis = siswa.nipd || siswa.nisn || String(siswa.no)

      if (!nis) {
        errors.push(`NIS kosong untuk ${siswa.nama}`)
        siswaSkipped++
        continue
      }

      // Check if siswa already exists by NIS
      const existingSiswa = await db.siswa.findUnique({ where: { nis } })
      if (existingSiswa) {
        siswaSkipped++
        continue
      }

      try {
        await db.siswa.create({
          data: {
            nis,
            nama: siswa.nama,
            jenisKelamin: siswa.jk,
            rombelId,
          },
        })
        siswaCreated++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        errors.push(`Gagal membuat siswa ${siswa.nama}: ${msg}`)
        siswaSkipped++
      }
    }

    return NextResponse.json({
      success: true,
      rombelCreated,
      rombelTotal: rombelSet.size,
      siswaCreated,
      siswaSkipped,
      siswaTotal: siswaData.length,
      errors: errors.slice(0, 20),
      existingRombel,
      existingSiswa,
    })
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json({ error: 'Gagal mengimport file Excel' }, { status: 500 })
  }
}

function parseKelas(rombelNama: string): number {
  const upper = rombelNama.toUpperCase()
  if (upper.startsWith('XII')) return 12
  if (upper.startsWith('XI')) return 11
  if (upper.startsWith('X')) return 10
  return 10
}

function parseJurusan(rombelNama: string): string {
  // The rombel names in this school don't follow IPA/IPS/Bahasa pattern
  // They use regional names like "Lasara", "Kalabubu", etc.
  // We'll just use a generic classification based on the school type
  const upper = rombelNama.toUpperCase()
  // Default to 'Umum' since SMA Negeri doesn't have specific jurusan in class names
  return 'Umum'
}

function formatDate(value: unknown): string {
  if (!value) return ''
  if (typeof value === 'number') {
    // Excel date serial number
    const date = new Date((value - 25569) * 86400 * 1000)
    return date.toISOString().split('T')[0]
  }
  if (typeof value === 'string') {
    return value
  }
  return String(value)
}
