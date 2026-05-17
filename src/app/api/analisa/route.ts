import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelId = searchParams.get('rombelId')

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

    // Rata-rata per mapel (using rerata from each subject)
    const mapelAgg: Record<string, number[]> = {}
    for (const n of nilai) {
      if (!mapelAgg[n.mataPelajaran]) {
        mapelAgg[n.mataPelajaran] = []
      }
      mapelAgg[n.mataPelajaran].push(n.rerata)
    }
    const rataRataPerMapel = Object.entries(mapelAgg).map(([mapel, vals]) => ({
      mapel,
      rerata: Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100,
    })).sort((a, b) => b.rerata - a.rerata)

    // Distribusi nilai (based on rerata)
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
      jumlah: nilai.filter(n => n.rerata >= r.min && n.rerata <= r.max).length,
    }))

    // Per rombel
    const rombelAgg: Record<string, { vals: number[]; nama: string }> = {}
    for (const n of nilai) {
      const rId = n.siswa.rombelId
      const rNama = n.siswa.rombel?.nama ?? 'Unknown'
      if (!rombelAgg[rId]) rombelAgg[rId] = { vals: [], nama: rNama }
      rombelAgg[rId].vals.push(n.rerata)
    }
    const perRombel = Object.values(rombelAgg).map(r => ({
      rombel: r.nama,
      rataRata: Math.round((r.vals.reduce((a, b) => a + b, 0) / r.vals.length) * 100) / 100,
    }))

    // Top siswa
    const siswaAgg: Record<string, { nama: string; total: number; count: number }> = {}
    for (const n of nilai) {
      const sId = n.siswaId
      const sNama = n.siswa.nama
      if (!siswaAgg[sId]) siswaAgg[sId] = { nama: sNama, total: 0, count: 0 }
      siswaAgg[sId].total += n.rerata
      siswaAgg[sId].count += 1
    }
    const topSiswa = Object.values(siswaAgg)
      .map(s => ({ nama: s.nama, rataRata: Math.round((s.total / s.count) * 100) / 100 }))
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
