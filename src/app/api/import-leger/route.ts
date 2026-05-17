import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'
import path from 'path'
import fs from 'fs'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const filePaths = body.filePaths as string[]
    const clearExisting = body.clearExisting as boolean | undefined

    if (!filePaths || filePaths.length === 0) {
      return NextResponse.json({ error: 'filePaths diperlukan' }, { status: 400 })
    }

    // Clear existing nilai data if requested
    if (clearExisting) {
      await db.nilai.deleteMany({})
    }

    let totalSiswaProcessed = 0
    let totalNilaiCreated = 0
    let totalNilaiSkipped = 0
    const errors: string[] = []
    const subjectSet = new Set<string>()

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
      // Row 0: Title, Row 1: School info, Row 2: Class name
      // Row 3: NO, NAMA SISWA, NISN, NIS, MATA PELAJARAN
      // Row 4: Subject names (each subject spans 7 cols: Smt1-6 + rerata)
      // Row 5: Empty, Row 6: Smt1-Smt6 + rerata sub-headers
      // Row 7+: Data rows
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

          try {
            await db.nilai.upsert({
              where: {
                siswaId_mataPelajaran: {
                  siswaId,
                  mataPelajaran: subject.name,
                },
              },
              create: {
                siswaId,
                mataPelajaran: subject.name,
                smt1,
                smt2,
                smt3,
                smt4,
                smt5,
                smt6,
                rerata: Math.round(calcRerata * 100) / 100,
              },
              update: {
                smt1,
                smt2,
                smt3,
                smt4,
                smt5,
                smt6,
                rerata: Math.round(calcRerata * 100) / 100,
              },
            })
            totalNilaiCreated++
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : 'Unknown error'
            errors.push(`Gagal simpan nilai ${nama} - ${subject.name}: ${msg}`)
            totalNilaiSkipped++
          }
        }

        totalSiswaProcessed++
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
