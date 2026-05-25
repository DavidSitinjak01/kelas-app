import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export const maxDuration = 300 // 5 minutes timeout

export async function POST(request: Request) {
  try {
    let filePath: string | null = null
    let clearExisting = false
    let fileBuffer: Buffer

    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Mode 1: FormData with file directly
      const formData = await request.formData()
      const file = formData.get('file') as File | null
      clearExisting = formData.get('clearExisting') === 'true'
      filePath = formData.get('filePath') as string | null

      if (file) {
        fileBuffer = Buffer.from(await file.arrayBuffer())
        // Also save to upload dir for reference
        const uploadDir = path.join(process.cwd(), 'upload')
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const savedName = `${Date.now()}_${sanitizedName}`
        fs.writeFileSync(path.join(uploadDir, savedName), fileBuffer)
      } else if (filePath) {
        // Use existing server file
        const fullPath = path.join(process.cwd(), 'upload', filePath)
        if (!fs.existsSync(fullPath)) {
          return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
        }
        fileBuffer = fs.readFileSync(fullPath)
      } else {
        return NextResponse.json({ error: 'File atau filePath diperlukan' }, { status: 400 })
      }
    } else {
      // Mode 2: JSON with filePath (backward compatible)
      const body = await request.json()
      filePath = body.filePath as string
      clearExisting = Boolean(body.clearExisting)

      if (!filePath) {
        return NextResponse.json({ error: 'filePath diperlukan' }, { status: 400 })
      }

      const fullPath = path.join(process.cwd(), 'upload', filePath)
      if (!fs.existsSync(fullPath)) {
        return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 404 })
      }
      fileBuffer = fs.readFileSync(fullPath)
    }

    // Read Excel file

    const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]

    // Parse to JSON - Dapodik format: row 0 & 1 are headers, data starts from row 2 (index 2)
    const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

    if (rawData.length < 3) {
      return NextResponse.json({ error: 'File Excel kosong atau format tidak sesuai' }, { status: 400 })
    }

    // Column mapping based on Dapodik format:
    // 0: No, 1: Nama, 2: NIPD, 3: JK, 4: NISN, 5: Tempat Lahir, 6: Tanggal Lahir, 42: Rombel Saat Ini
    const COL_NAMA = 1
    const COL_NIPD = 2
    const COL_JK = 3
    const COL_NISN = 4
    const COL_TEMPAT_LAHIR = 5
    const COL_TANGGAL_LAHIR = 6
    const COL_ROMBEL = 42

    // Extract unique rombel names and student data
    const rombelSet = new Map<string, { kelas: number; nama: string; jurusan: string }>()
    const siswaData: {
      nama: string
      nipd: string
      nisn: string
      jk: string
      tempatlahir: string
      tanggallahir: string
      rombelNama: string
    }[] = []

    for (let i = 2; i < rawData.length; i++) {
      const row = rawData[i]
      if (!row || !row[COL_NAMA]) continue

      const nama = String(row[COL_NAMA] || '').trim()
      const nipd = String(row[COL_NIPD] || '').trim()
      const nisn = String(row[COL_NISN] || '').trim()
      const jk = String(row[COL_JK] || '').trim().toUpperCase()
      const tempatlahir = String(row[COL_TEMPAT_LAHIR] || '').trim()
      const tanggallahir = row[COL_TANGGAL_LAHIR] ? formatDate(row[COL_TANGGAL_LAHIR]) : ''
      const rombelNama = String(row[COL_ROMBEL] || '').trim()

      if (!nama || !rombelNama) continue

      // Parse rombel name to extract kelas and jurusan info
      if (!rombelSet.has(rombelNama)) {
        const kelas = parseKelas(rombelNama)
        const jurusan = parseJurusan(rombelNama)
        rombelSet.set(rombelNama, { kelas, nama: rombelNama, jurusan })
      }

      siswaData.push({
        nama,
        nipd,
        nisn,
        jk: jk === 'L' ? 'L' : 'P',
        tempatlahir,
        tanggallahir,
        rombelNama,
      })
    }

    if (siswaData.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data siswa yang valid di file Excel' }, { status: 400 })
    }

    // Clear existing data if requested
    if (clearExisting) {
      await db.eligible.deleteMany({})
      await db.nilai.deleteMany({})
      await db.siswa.deleteMany({})
      await db.rombel.deleteMany({})
    }

    // Create all rombels using batch for performance
    const rombelMap = new Map<string, string>() // rombelNama -> rombelid
    let rombelCreated = 0

    // Get all existing rombels in one query
    const existingRombels = await db.rombel.findMany()
    for (const r of existingRombels) {
      rombelMap.set(r.nama, r.id)
    }

    for (const [nama, info] of rombelSet) {
      if (rombelMap.has(nama)) continue

      const rombel = await db.rombel.create({
        data: {
          nama: info.nama,
          kelas: info.kelas,
          jurusan: info.jurusan,
          tahunajaran: '2024/2025',
          walikelas: '-',
        },
      })
      rombelMap.set(nama, rombel.id)
      rombelCreated++
    }

    // Create siswa - batch process for better performance
    let siswaCreated = 0
    let siswaUpdated = 0
    let siswaSkipped = 0
    const errors: string[] = []

    // Get all existing NIS values for duplicate checking
    const existingNisList = await db.siswa.findMany({ select: { id: true, nis: true, nisn: true } })
    const nisMap = new Map(existingNisList.map(s => [s.nis, s.id]))

    // Process in batches of 50
    const BATCH_SIZE = 50
    for (let batch = 0; batch < siswaData.length; batch += BATCH_SIZE) {
      const batchData = siswaData.slice(batch, batch + BATCH_SIZE)

      for (const siswa of batchData) {
        const rombelid = rombelMap.get(siswa.rombelNama)
        if (!rombelid) {
          errors.push(`Rombel tidak ditemukan untuk ${siswa.nama}: ${siswa.rombelNama}`)
          siswaSkipped++
          continue
        }

        // Use NIPD as NIS (it's the student ID number in Dapodik)
        const nis = siswa.nipd || siswa.nisn

        if (!nis) {
          errors.push(`NIS kosong untuk ${siswa.nama}`)
          siswaSkipped++
          continue
        }

        // Check if siswa already exists by NIS
        const existingId = nisMap.get(nis)
        if (existingId) {
          // Update existing siswa
          try {
            await db.siswa.update({
              where: { id: existingId },
              data: {
                nisn: siswa.nisn || undefined,
                nama: siswa.nama,
                jeniskelamin: siswa.jk,
                tempatlahir: siswa.tempatlahir || undefined,
                tanggallahir: siswa.tanggallahir || undefined,
                rombelid,
              },
            })
            siswaUpdated++
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error'
            errors.push(`Gagal update siswa ${siswa.nama}: ${msg}`)
            siswaSkipped++
          }
          continue
        }

        try {
          await db.siswa.create({
            data: {
              nis,
              nisn: siswa.nisn || '-',
              nama: siswa.nama,
              jeniskelamin: siswa.jk,
              tempatlahir: siswa.tempatlahir || '-',
              tanggallahir: siswa.tanggallahir || '-',
              rombelid,
            },
          })
          nisMap.set(nis, 'created')
          siswaCreated++
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : 'Unknown error'
          errors.push(`Gagal membuat siswa ${siswa.nama}: ${msg}`)
          siswaSkipped++
        }
      }
    }

    return NextResponse.json({
      success: true,
      rombelCreated,
      rombelTotal: rombelSet.size,
      siswaCreated,
      siswaUpdated,
      siswaSkipped,
      siswaTotal: siswaData.length,
      errors: errors.slice(0, 20),
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
  // The rombel names in this school use cultural/regional names
  // like "Lasara", "Kalabubu", "Toho", "Baluse", etc.
  // Default to 'Umum' since the names don't indicate specific jurusan
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
