import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelid = searchParams.get('rombelid')

    const where = rombelid && rombelid !== 'all'
      ? { siswa: { rombelid } }
      : {}

    const nilai = await db.nilai.findMany({
      where,
      include: { siswa: { include: { rombel: true } } },
    })

    const siswaAll = await db.siswa.findMany({
      where: rombelid && rombelid !== 'all' ? { rombelid } : {},
      include: { rombel: true, nilai: true },
    })

    if (siswaAll.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data siswa' }, { status: 404 })
    }

    // Get all unique subjects
    const allSubjects = [...new Set(nilai.map(n => n.matapelajaran))].sort()

    // Build rows: one row per student with all subject grades
    const rows = siswaAll.map((siswa, idx) => {
      const row: Record<string, string | number> = {
        'No': idx + 1,
        'Nama': siswa.nama,
        'NIS': siswa.nis,
        'NISN': siswa.nisn,
        'JK': siswa.jeniskelamin,
        'Rombel': siswa.rombel?.nama || '-',
        'Kelas': siswa.rombel?.kelas || '-',
      }

      // Add each subject's rerata
      let totalRerata = 0
      let countRerata = 0
      for (const subject of allSubjects) {
        const nilaiItem = siswa.nilai.find(n => n.matapelajaran === subject)
        const val = nilaiItem?.rerata || 0
        row[subject] = val > 0 ? Math.round(val * 100) / 100 : '-'
        if (val > 0) {
          totalRerata += val
          countRerata++
        }
      }

      row['Rata-Rata'] = countRerata > 0 ? Math.round((totalRerata / countRerata) * 100) / 100 : '-'
      row['Jumlah Mapel'] = countRerata

      return row
    })

    // Create workbook
    const wb = XLSX.utils.book_new()

    // Sheet 1: Nilai per siswa
    const ws1 = XLSX.utils.json_to_sheet(rows)

    // Set column widths
    const colWidths = [
      { wch: 5 },  // No
      { wch: 30 }, // Nama
      { wch: 10 }, // NIS
      { wch: 15 }, // NISN
      { wch: 5 },  // JK
      { wch: 20 }, // Rombel
      { wch: 8 },  // Kelas
      ...allSubjects.map(() => ({ wch: 14 } as { wch: number })),
      { wch: 12 }, // Rata-Rata
      { wch: 12 }, // Jumlah Mapel
    ]
    ws1['!cols'] = colWidths

    XLSX.utils.book_append_sheet(wb, ws1, 'Nilai Siswa')

    // Sheet 2: Rata-rata per Mata Pelajaran
    const mapelAgg: Record<string, { total: number; count: number }> = {}
    for (const n of nilai) {
      if (!mapelAgg[n.matapelajaran]) mapelAgg[n.matapelajaran] = { total: 0, count: 0 }
      if (n.rerata > 0) {
        mapelAgg[n.matapelajaran].total += n.rerata
        mapelAgg[n.matapelajaran].count++
      }
    }
    const mapelRows = Object.entries(mapelAgg)
      .map(([mapel, agg]) => ({
        'Mata Pelajaran': mapel,
        'Rata-Rata': agg.count > 0 ? Math.round((agg.total / agg.count) * 100) / 100 : 0,
        'Jumlah Siswa': agg.count,
      }))
      .sort((a, b) => b['Rata-Rata'] - a['Rata-Rata'])

    const ws2 = XLSX.utils.json_to_sheet(mapelRows)
    ws2['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 15 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Rata-Rata per Mapel')

    // Sheet 3: Per Rombel summary
    const rombelAgg: Record<string, { total: number; count: number; siswaCount: Set<string> }> = {}
    for (const n of nilai) {
      const rNama = n.siswa.rombel?.nama || 'Unknown'
      if (!rombelAgg[rNama]) rombelAgg[rNama] = { total: 0, count: 0, siswaCount: new Set() }
      if (n.rerata > 0) {
        rombelAgg[rNama].total += n.rerata
        rombelAgg[rNama].count++
      }
      rombelAgg[rNama].siswaCount.add(n.siswaid)
    }
    const rombelRows = Object.entries(rombelAgg)
      .map(([rombel, agg]) => ({
        'Rombel': rombel,
        'Rata-Rata Nilai': agg.count > 0 ? Math.round((agg.total / agg.count) * 100) / 100 : 0,
        'Jumlah Siswa': agg.siswaCount.size,
        'Jumlah Data Nilai': agg.count,
      }))
      .sort((a, b) => b['Rata-Rata Nilai'] - a['Rata-Rata Nilai'])

    const ws3 = XLSX.utils.json_to_sheet(rombelRows)
    ws3['!cols'] = [{ wch: 20 }, { wch: 18 }, { wch: 15 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Per Rombel')

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    // Return as downloadable file
    const rombelName = rombelid && rombelid !== 'all'
      ? siswaAll[0]?.rombel?.nama?.replace(/[^a-zA-Z0-9]/g, '_') || 'rombel'
      : 'semua'
    const filename = `Analisa_Nilai_${rombelName}.xlsx`

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal membuat file download' }, { status: 500 })
  }
}
