import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const [totalRombel, totalSiswa, totalNilai, totalEligible] = await Promise.all([
      db.rombel.count(),
      db.siswa.count(),
      db.nilai.count(),
      db.eligible.count({ where: { status: 'eligible' } }),
    ])

    const siswaPerKelas = await db.siswa.groupBy({
      by: ['rombelId'],
      _count: { id: true },
    })

    const rombels = await db.rombel.findMany()
    const kelasMap = new Map(rombels.map(r => [r.id, r.kelas]))
    const kelasAgg: Record<number, number> = {}
    for (const item of siswaPerKelas) {
      const kelas = kelasMap.get(item.rombelId) ?? 0
      kelasAgg[kelas] = (kelasAgg[kelas] ?? 0) + item._count.id
    }
    const siswaPerKelasResult = Object.entries(kelasAgg)
      .map(([kelas, total]) => ({ kelas: Number(kelas), total }))
      .sort((a, b) => a.kelas - b.kelas)

    const jurusanAgg: Record<string, number> = {}
    for (const item of siswaPerKelas) {
      const rombel = rombels.find(r => r.id === item.rombelId)
      if (rombel) {
        jurusanAgg[rombel.jurusan] = (jurusanAgg[rombel.jurusan] ?? 0) + item._count.id
      }
    }
    const siswaPerJurusanResult = Object.entries(jurusanAgg)
      .map(([jurusan, total]) => ({ jurusan, total }))
      .sort((a, b) => b.total - a.total)

    const nilaiAvg = await db.nilai.aggregate({
      _avg: { nilaiAsli: true },
    })

    return NextResponse.json({
      totalRombel,
      totalSiswa,
      totalNilai,
      totalEligible,
      siswaPerKelas: siswaPerKelasResult,
      siswaPerJurusan: siswaPerJurusanResult,
      rataRataNilai: nilaiAvg._avg.nilaiAsli ?? 0,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal memuat data dashboard' }, { status: 500 })
  }
}
