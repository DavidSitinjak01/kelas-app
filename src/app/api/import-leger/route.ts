import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    let filePaths: string[] = []
    let clearExisting = false

    // Support two modes:
    // 1. FormData with files directly (preferred - no separate upload needed)
    // 2. JSON with filePaths (backward compatible with old flow)
    const contentType = request.headers.get('content-type') || ''

    if (contentType.includes('multipart/form-data')) {
      // Mode 1: FormData with files
      const formData = await request.formData()
      const files = formData.getAll('files') as File[]
      clearExisting = formData.get('clearExisting') === 'true'

      if (files.length === 0) {
        return NextResponse.json({ error: 'Pilih file terlebih dahulu' }, { status: 400 })
      }

      // Save uploaded files to disk
      const uploadDir = path.join(process.cwd(), 'upload')
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true })
      }

      for (const file of files) {
        const timestamp = Date.now()
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const fileName = `${timestamp}_${sanitizedName}`
        const fullPath = path.join(uploadDir, fileName)

        const buffer = Buffer.from(await file.arrayBuffer())
        fs.writeFileSync(fullPath, buffer)
        filePaths.push(fileName)
      }
    } else {
      // Mode 2: JSON with filePaths (backward compatible)
      const body = await request.json()
      filePaths = body.filePaths as string[]
      clearExisting = body.clearExisting as boolean | undefined
    }

    if (filePaths.length === 0) {
      return NextResponse.json({ error: 'filePaths diperlukan' }, { status: 400 })
    }

    let totalSiswaProcessed = 0
    let totalNilaiCreated = 0
    let totalNilaiSkipped = 0
    const errors: string[] = []
    const subjectSet = new Set<string>()

    // Phase 1: Parse all Excel files and collect siswa IDs
    const siswaIdsToReplace: string[] = []
    const parsedRows: {
      siswaId: string
      nama: string
      subject: string
      smt1: number; smt2: number; smt3: number; smt4: number; smt5: number; smt6: number
      rerata: number
    }[] = []

    for (const filePath of filePaths) {
      const fullPath = path.join(process.cwd(), 'upload', filePath)
      if (!fs.existsSync(fullPath)) {
        errors.push(`File tidak ditemukan: ${filePath}`)
        continue
      }

      const fileBuffer = fs.readFileSync(fullPath)
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const rawData: unknown[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

      if (rawData.length < 7) {
        errors.push(`File ${filePath} kosong atau format tidak sesuai`)
        continue
      }

      // Parse subject names from row 4 (index 4)
      const subjects: { name: string; startCol: number }[] = []
      let col = 4
      while (col < (rawData[4]?.length || 0)) {
        const subjectName = String(rawData[4]?.[col] || '').trim()
        if (subjectName) {
          subjects.push({ name: subjectName, startCol: col })
          subjectSet.add(subjectName)
        }
        col += 7 // each subject has 7 columns
      }

      if (subjects.length === 0) {
        errors.push(`Tidak ada mata pelajaran ditemukan di ${filePath}`)
        continue
      }

      // Data rows start from row 7
      for (let i = 7; i < rawData.length; i++) {
        const row = rawData[i]
        if (!row || !row[1]) continue

        const nama = String(row[1] || '').trim()
        const nisn = String(row[2] || '').trim()
        const nis = String(row[3] || '').trim()

        if (!nama || !nis) continue

        // Find the siswa by NIS first, then by NISN
        let siswaId: string | null = null
        const siswaByNis = await db.siswa.findFirst({ where: { nis } })
        if (siswaByNis) {
          siswaId = siswaByNis.id
        } else if (nisn && nisn !== '-') {
          const siswaByNisn = await db.siswa.findFirst({ where: { nisn } })
          if (siswaByNisn) {
            siswaId = siswaByNisn.id
          }
        }

        if (!siswaId) {
          errors.push(`Siswa tidak ditemukan: ${nama} (NIS: ${nis}, NISN: ${nisn})`)
          totalNilaiSkipped += subjects.length
          continue
        }

        // Track siswa ID for scoped deletion
        siswaIdsToReplace.push(siswaId)

        for (const subject of subjects) {
          const sc = subject.startCol
          const smt1 = parseNum(row[sc])
          const smt2 = parseNum(row[sc + 1])
          const smt3 = parseNum(row[sc + 2])
          const smt4 = parseNum(row[sc + 3])
          const smt5 = parseNum(row[sc + 4])
          const smt6 = parseNum(row[sc + 5])
          const rerata = parseNum(row[sc + 6])

          // If all values are 0, skip (subject not applicable)
          if (smt1 === 0 && smt2 === 0 && smt3 === 0 && smt4 === 0 && smt5 === 0 && smt6 === 0 && rerata === 0) {
            continue
          }

          // Calculate rerata if not provided in Excel
          const vals = [smt1, smt2, smt3, smt4, smt5, smt6].filter(v => v > 0)
          const calcRerata = rerata > 0 ? rerata : (vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0)

          parsedRows.push({
            siswaId,
            nama,
            subject: subject.name,
            smt1,
            smt2,
            smt3,
            smt4,
            smt5,
            smt6,
            rerata: Math.round(calcRerata * 100) / 100,
          })
        }

        totalSiswaProcessed++
      }
    }

    // Phase 2: If clearExisting, only delete nilai for the siswa being imported
    if (clearExisting && siswaIdsToReplace.length > 0) {
      const batchSize = 500
      const uniqueSiswaIds = [...new Set(siswaIdsToReplace)]
      for (let i = 0; i < uniqueSiswaIds.length; i += batchSize) {
        const batch = uniqueSiswaIds.slice(i, i + batchSize)
        await db.nilai.deleteMany({
          where: { siswaId: { in: batch } },
        })
      }
    }

    // Phase 3: Upsert all parsed nilai data
    for (const row of parsedRows) {
      try {
        await db.nilai.upsert({
          where: {
            siswaId_mataPelajaran: {
              siswaId: row.siswaId,
              mataPelajaran: row.subject,
            },
          },
          create: {
            siswaId: row.siswaId,
            mataPelajaran: row.subject,
            smt1: row.smt1,
            smt2: row.smt2,
            smt3: row.smt3,
            smt4: row.smt4,
            smt5: row.smt5,
            smt6: row.smt6,
            rerata: row.rerata,
          },
          update: {
            smt1: row.smt1,
            smt2: row.smt2,
            smt3: row.smt3,
            smt4: row.smt4,
            smt5: row.smt5,
            smt6: row.smt6,
            rerata: row.rerata,
          },
        })
        totalNilaiCreated++
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'Unknown error'
        errors.push(`Gagal simpan nilai ${row.nama} - ${row.subject}: ${msg}`)
        totalNilaiSkipped++
      }
    }

    return NextResponse.json({
      success: true,
      totalSiswaProcessed,
      totalNilaiCreated,
      totalNilaiSkipped,
      subjects: Array.from(subjectSet),
      errors: errors.slice(0, 30),
    })
  } catch (error) {
    console.error('Import leger error:', error)
    return NextResponse.json({ error: 'Gagal mengimport file leger' }, { status: 500 })
  }
}

function parseNum(val: unknown): number {
  if (val === null || val === undefined || val === '') return 0
  const n = parseFloat(String(val))
  return isNaN(n) ? 0 : n
}
