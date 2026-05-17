import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Get all kelas 12 students with their nilai
    const siswaKelas12 = await db.siswa.findMany({
      where: { rombel: { kelas: 12 } },
      include: { rombel: true, nilai: true },
    })

    let updated = 0

    for (const siswa of siswaKelas12) {
      if (siswa.nilai.length === 0) continue

      const rataRata = siswa.nilai.reduce((sum, n) => sum + n.rerata, 0) / siswa.nilai.length
      const diBawahKKM = siswa.nilai.filter(n => n.rerata < 60).length

      let status: string
      let keterangan: string

      if (rataRata >= 75 && diBawahKKM === 0) {
        status = 'eligible'
        keterangan = `Rata-rata ${rataRata.toFixed(1)}, tidak ada nilai di bawah KKM`
      } else if (rataRata >= 70 && diBawahKKM <= 2) {
        status = 'bersyarat'
        keterangan = `Rata-rata ${rataRata.toFixed(1)}, ${diBawahKKM} mapel di bawah KKM`
      } else {
        status = 'tidak'
        keterangan = `Rata-rata ${rataRata.toFixed(1)}, ${diBawahKKM} mapel di bawah KKM`
      }

      await db.eligible.upsert({
        where: { siswaId: siswa.id },
        update: { status, keterangan },
        create: { siswaId: siswa.id, status, keterangan },
      })
      updated++
    }

    return NextResponse.json({ updated, total: siswaKelas12.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal auto-eligible' }, { status: 500 })
  }
}
