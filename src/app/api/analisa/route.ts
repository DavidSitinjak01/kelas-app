import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelId = searchParams.get('rombelId')
    const tipe = searchParams.get('tipe') ?? 'asli'

    const where = rombelId && rombelId !== 'all'
      ? { siswa: { rombelId } }
      : {}

    const nilai = await db.nilai.findMany({
      where,
      include: { siswa: { include: { rombel: true } } },
    })

    if (nilai.length === 0) {
      return NextResponse.json({
        rataRataPerMapel: [],
        distribusiNilai: [],
        perRombel: [],
        topSiswa: [],
      })
    }

    // Rata-rata per mapel
    const mapelAgg: Record<string, { asli: number[]; up: number[] }> = {}
    for (const n of nilai) {
      if (!mapelAgg[n.mataPelajaran]) {
        mapelAgg[n.mataPelajaran] = { asli: [], up: [] }
      }
      mapelAgg[n.mataPelajaran].asli.push(n.nilaiAsli)
      mapelAgg[n.mataPelajaran].up.push(n.nilaiUp)
    }
    const rataRataPerMapel = Object.entries(mapelAgg).map(([mapel, vals]) => ({
      mapel,
      asli: Math.round((vals.asli.reduce((a, b) => a + b, 0) / vals.asli.length) * 10) / 10,
      up: Math.round((vals.up.reduce((a, b) => a + b, 0) / vals.up.length) * 10) / 10,
    })).sort((a, b) => b[tipe as keyof Pick<typeof a, 'asli' | 'up'>] as number - a[tipe as keyof Pick<typeof a, 'asli' | 'up'>] as number)

    // Distribusi nilai
    const ranges = [
      { range: '0-39', min: 0, max: 39 },
      { range: '40-59', min: 40, max: 59 },
      { range: '60-69', min: 60, max: 69 },
      { range: '70-79', min: 70, max: 79 },
      { range: '80-89', min: 80, max: 89 },
      { range: '90-100', min: 90, max: 100 },
    ]
    const distribusiNilai = ranges.map(r => ({
      range: r.range,
      jumlah: nilai.filter(n => {
        const val = tipe === 'asli' ? n.nilaiAsli : n.nilaiUp
        return val >= r.min && val <= r.max
      }).length,
    }))

    // Per rombel
    const rombelAgg: Record<string, { asli: number[]; up: number[]; nama: string }> = {}
    for (const n of nilai) {
      const rId = n.siswa.rombelId
      const rNama = n.siswa.rombel?.nama ?? 'Unknown'
      if (!rombelAgg[rId]) rombelAgg[rId] = { asli: [], up: [], nama: rNama }
      rombelAgg[rId].asli.push(n.nilaiAsli)
      rombelAgg[rId].up.push(n.nilaiUp)
    }
    const perRombel = Object.values(rombelAgg).map(r => ({
      rombel: r.nama,
      rataAsli: Math.round((r.asli.reduce((a, b) => a + b, 0) / r.asli.length) * 10) / 10,
      rataUp: Math.round((r.up.reduce((a, b) => a + b, 0) / r.up.length) * 10) / 10,
    }))

    // Top siswa
    const siswaAgg: Record<string, { nama: string; total: number; count: number }> = {}
    for (const n of nilai) {
      const sId = n.siswaId
      const sNama = n.siswa.nama
      const val = tipe === 'asli' ? n.nilaiAsli : n.nilaiUp
      if (!siswaAgg[sId]) siswaAgg[sId] = { nama: sNama, total: 0, count: 0 }
      siswaAgg[sId].total += val
      siswaAgg[sId].count += 1
    }
    const topSiswa = Object.values(siswaAgg)
      .map(s => ({ nama: s.nama, rataRata: Math.round((s.total / s.count) * 10) / 10 }))
      .sort((a, b) => b.rataRata - a.rataRata)
      .slice(0, 10)

    return NextResponse.json({
      rataRataPerMapel,
      distribusiNilai,
      perRombel,
      topSiswa,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menganalisis' }, { status: 500 })
  }
}
