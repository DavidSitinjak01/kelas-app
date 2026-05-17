import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Get all kelas 12 students with their nilai
    const siswaKelas12 = await db.siswa.findMany({
      where: { rombel: { kelas: 12 } },
      include: { rombel: true, nilai: true },
    })

    if (siswaKelas12.length === 0) {
      return NextResponse.json({ updated: 0, total: 0, top20Count: 0, message: 'Tidak ada siswa kelas 12' })
    }

    // Calculate rata-rata for each student
    const ranked = siswaKelas12
      .map(siswa => {
        if (siswa.nilai.length === 0) {
          return {
            siswa,
            rataRata: 0,
            subjectCount: 0,
            diBawahKKM: 0,
          }
        }
        const rataRata = siswa.nilai.reduce((sum, n) => sum + n.rerata, 0) / siswa.nilai.length
        const diBawahKKM = siswa.nilai.filter(n => n.rerata < 60).length
        return {
          siswa,
          rataRata: Math.round(rataRata * 100) / 100,
          subjectCount: siswa.nilai.length,
          diBawahKKM,
        }
      })
      .sort((a, b) => b.rataRata - a.rataRata) // Sort descending by rata-rata

    // Calculate top 20% cutoff
    const totalSiswa = ranked.length
    const top20Count = Math.floor(totalSiswa * 0.2) // 20% of total, rounded down
    // If top20Count is 0 but we have students, at least 1
    const eligibleCount = Math.max(top20Count, totalSiswa > 0 ? 1 : 0)

    let updated = 0

    for (let i = 0; i < ranked.length; i++) {
      const { siswa, rataRata, subjectCount, diBawahKKM } = ranked[i]
      const peringkat = i + 1 // 1-based rank

      let status: string
      let keterangan: string

      if (peringkat <= eligibleCount) {
        // Top 20% → Eligible
        status = 'eligible'
        keterangan = `Top 20% - Peringkat ${peringkat} dari ${totalSiswa} (Rata-rata: ${rataRata.toFixed(1)}, ${subjectCount} mapel)`
      } else if (rataRata >= 70 && diBawahKKM <= 2) {
        // Not top 20% but meets conditional criteria → Bersyarat
        status = 'bersyarat'
        keterangan = `Peringkat ${peringkat} dari ${totalSiswa} - Rata-rata: ${rataRata.toFixed(1)}, ${diBawahKKM} mapel di bawah KKM`
      } else {
        // Does not meet criteria → Tidak
        status = 'tidak'
        keterangan = `Peringkat ${peringkat} dari ${totalSiswa} - Rata-rata: ${rataRata.toFixed(1)}, ${diBawahKKM} mapel di bawah KKM`
      }

      await db.eligible.upsert({
        where: { siswaId: siswa.id },
        update: { status, keterangan },
        create: { siswaId: siswa.id, status, keterangan },
      })
      updated++
    }

    return NextResponse.json({
      updated,
      total: totalSiswa,
      top20Count: eligibleCount,
      top20Cutoff: ranked[eligibleCount - 1]?.rataRata ?? 0,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal auto-eligible' }, { status: 500 })
  }
}
