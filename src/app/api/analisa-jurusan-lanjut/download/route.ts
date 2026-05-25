import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Reuse classification & scoring from the main route by calling the API internally
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const kelas = parseInt(searchParams.get('kelas') || '11')
    const rombelid = searchParams.get('rombelid')

    if (![11, 12].includes(kelas)) {
      return NextResponse.json({ error: 'Kelas harus 11 atau 12' }, { status: 400 })
    }

    // Call the main analysis API internally
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'
    const apiUrl = `${baseUrl}/api/analisa-jurusan-lanjut?kelas=${kelas}${rombelid ? `&rombelid=${rombelid}` : ''}`

    const res = await fetch(apiUrl, {
      headers: request.headers,
    })

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Gagal mengambil data analisis' }))
      return NextResponse.json(errData, { status: res.status })
    }

    const data = await res.json()
    const students: any[] = data.students || []

    if (students.length === 0) {
      return NextResponse.json({ error: 'Tidak ada data siswa' }, { status: 404 })
    }

    // Build Excel rows
    const rows: Record<string, string | number>[] = []

    for (let idx = 0; idx < students.length; idx++) {
      const s = students[idx]
      const topMajors = (s.topMajors || []).slice(0, 5)
      const row: Record<string, string | number> = {
        'No': idx + 1,
        'Nama': s.nama,
        'NIS': s.nis,
        'NISN': s.nisn,
        'Rombel': s.rombelNama || '-',
        'Kelas': s.kelas || kelas,
        'Kecondongan': s.dominantTrack || '-',
        '% IPA': s.ipaInclination || 0,
        '% IPS': s.ipsInclination || 0,
        'Rata-Rata': s.overallAvg || 0,
        'Akurasi (%)': s.confidence || 0,
      }

      // Add top 5 major recommendations
      for (let i = 0; i < 5; i++) {
        const major = topMajors[i]
        row[`Jurusan #${i + 1}`] = major?.nama || '-'
        row[`Skor #${i + 1}`] = major?.skor || 0
      }

      // TKA data for class 12
      if (kelas === 12 && s.tkaData) {
        row['TKA B.Indo'] = s.tkaData.bindonilai || 0
        row['TKA Mat'] = s.tkaData.matnilai || 0
        row['TKA B.Inggris'] = s.tkaData.bingnilai || 0
        row['TKA Pilihan 1'] = s.tkaData.pilihan1nama || '-'
        row['TKA Nilai 1'] = s.tkaData.pilihan1nilai || 0
        row['TKA Pilihan 2'] = s.tkaData.pilihan2nama || '-'
        row['TKA Nilai 2'] = s.tkaData.pilihan2nilai || 0
      }

      rows.push(row)
    }

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)

    // Column widths
    const cols = [
      { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 }, { wch: 8 },
      { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 12 },
    ]
    for (let i = 0; i < 5; i++) {
      cols.push({ wch: 35 }, { wch: 10 })
    }
    if (kelas === 12) {
      cols.push(
        { wch: 12 }, { wch: 10 }, { wch: 12 },
        { wch: 18 }, { wch: 10 }, { wch: 18 }, { wch: 10 },
      )
    }
    ws['!cols'] = cols
    XLSX.utils.book_append_sheet(wb, ws, `Rekomendasi Kelas ${kelas}`)

    // Sheet 2: Detail per jurusan per siswa
    const detailRows: Record<string, string | number>[] = []
    for (const s of students) {
      if (!s.topMajors || s.topMajors.length === 0) continue
      for (const major of s.topMajors) {
        const specificJurusan = (major.specificJurusan || []).map(j => j.jurusan).join('; ')
        detailRows.push({
          'Nama Siswa': s.nama,
          'Rombel': s.rombelNama,
          'Kecondongan': s.dominantTrack,
          'Jurusan Rekomendasi': major.nama,
          'Skor': major.skor,
          'Prodi Spesifik': specificJurusan || '-',
        })
      }
    }
    if (detailRows.length > 0) {
      const ws2 = XLSX.utils.json_to_sheet(detailRows)
      ws2['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 14 }, { wch: 35 }, { wch: 10 }, { wch: 60 }]
      XLSX.utils.book_append_sheet(wb, ws2, 'Detail Jurusan')
    }

    // Sheet 3: Summary
    const summary = data.summary || {}
    const summaryRows = [
      { 'Kategori': 'Total Siswa', 'Jumlah': summary.total || 0 },
      { 'Kategori': 'Dengan Nilai', 'Jumlah': summary.withNilaiCount || 0 },
      { 'Kategori': 'Tanpa Nilai', 'Jumlah': summary.withoutNilaiCount || 0 },
      { 'Kategori': 'Bercocok IPA', 'Jumlah': summary.ipaTrackCount || 0 },
      { 'Kategori': 'Bercocok IPS', 'Jumlah': summary.ipsTrackCount || 0 },
      { 'Kategori': 'Seimbang', 'Jumlah': summary.balancedCount || 0 },
      { 'Kategori': 'Rata-Rata Akurasi', 'Jumlah': summary.avgConfidence || 0 },
    ]
    if (kelas === 12) {
      summaryRows.push({ 'Kategori': 'Memiliki Data TKA', 'Jumlah': summary.tkaCount || 0 })
    }
    const ws3 = XLSX.utils.json_to_sheet(summaryRows)
    ws3['!cols'] = [{ wch: 25 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Ringkasan')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `Rekomendasi_Jurusan_Kelas_${kelas}.xlsx`

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
