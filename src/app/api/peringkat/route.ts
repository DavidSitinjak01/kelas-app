import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'kelas'
    const rombelId = searchParams.get('rombelId')
    const tingkat = searchParams.get('tingkat')

    // Summary: which tingkat levels and rombels have nilai data
    if (type === 'summary') {
      const rombels = await db.rombel.findMany({ orderBy: [{ kelas: 'asc' }, { nama: 'asc' }] })
      const allRombelIds = rombels.map(r => r.id)

      // Get siswa counts per rombel
      const siswaCounts = await db.siswa.groupBy({
        by: ['rombelId'],
        where: { rombelId: { in: allRombelIds } },
        _count: { id: true },
      })
      const siswaCountMap = new Map(siswaCounts.map(s => [s.rombelId, s._count.id]))

      // Get nilai counts per rombel (via siswa)
      const nilaiPerSiswa = await db.nilai.findMany({
        select: { siswaId: true },
      })
      // Get rombelId for each siswa that has nilai
      const siswaIdsWithNilai = [...new Set(nilaiPerSiswa.map(n => n.siswaId))]
      const siswaWithNilai = await db.siswa.findMany({
        where: { id: { in: siswaIdsWithNilai } },
        select: { id: true, rombelId: true },
      })
      const siswaRombelMap = new Map(siswaWithNilai.map(s => [s.id, s.rombelId]))

      // Count nilai per rombel
      const nilaiPerRombel = new Map<string, number>()
      for (const n of nilaiPerSiswa) {
        const rId = siswaRombelMap.get(n.siswaId)
        if (rId) {
          nilaiPerRombel.set(rId, (nilaiPerRombel.get(rId) || 0) + 1)
        }
      }

      // Build tingkat summary
      const tingkatMap = new Map<number, { rombelCount: number; siswaCount: number; nilaiCount: number; rombels: { id: string; nama: string; siswaCount: number; nilaiCount: number }[] }>()
      for (const r of rombels) {
        if (!tingkatMap.has(r.kelas)) {
          tingkatMap.set(r.kelas, { rombelCount: 0, siswaCount: 0, nilaiCount: 0, rombels: [] })
        }
        const t = tingkatMap.get(r.kelas)!
        const sCount = siswaCountMap.get(r.id) || 0
        const nCount = nilaiPerRombel.get(r.id) || 0
        t.rombelCount++
        t.siswaCount += sCount
        t.nilaiCount += nCount
        t.rombels.push({ id: r.id, nama: r.nama, siswaCount: sCount, nilaiCount: nCount })
      }

      const tingkatSummary = Array.from(tingkatMap.entries()).map(([kelas, data]) => ({
        kelas,
        ...data,
      }))

      // Find first tingkat with data
      const firstWithNilai = tingkatSummary.find(t => t.nilaiCount > 0)

      return NextResponse.json({
        tingkatSummary,
        firstTingkatWithNilai: firstWithNilai?.kelas || null,
      })
    }

    if (type === 'kelas' && rombelId) {
      // Get rombel info
      const rombel = await db.rombel.findUnique({ where: { id: rombelId } })
      if (!rombel) {
        return NextResponse.json({ type: 'kelas', rombel: null, data: [] })
      }

      // Get siswa in this rombel
      const siswaList = await db.siswa.findMany({
        where: { rombelId },
        select: { id: true, nama: true, nis: true, nisn: true, rombelId: true },
      })

      if (siswaList.length === 0) {
        return NextResponse.json({
          type: 'kelas',
          rombel: { id: rombel.id, nama: rombel.nama, kelas: rombel.kelas },
          data: [],
        })
      }

      // Get nilai for these siswa using groupBy
      const nilaiAgg = await db.nilai.groupBy({
        by: ['siswaId'],
        where: { siswaId: { in: siswaList.map(s => s.id) } },
        _sum: { rerata: true },
        _count: { rerata: true },
      })

      const siswaMap = new Map(siswaList.map(s => [s.id, s]))
      const ranked = nilaiAgg
        .map(n => {
          const siswa = siswaMap.get(n.siswaId)
          return {
            siswaId: n.siswaId,
            nama: siswa?.nama || '-',
            nis: siswa?.nis || '-',
            nisn: siswa?.nisn || '-',
            rombelId: rombelId,
            rombelNama: rombel.nama,
            kelas: rombel.kelas,
            rataRata: n._count.rerata > 0 ? Math.round((n._sum.rerata! / n._count.rerata) * 100) / 100 : 0,
            subjectCount: n._count.rerata,
          }
        })
        .sort((a, b) => b.rataRata - a.rataRata)
        .map((s, idx) => ({ ...s, peringkat: idx + 1 }))

      // Also add siswa without nilai
      const siswaWithNilai = new Set(nilaiAgg.map(n => n.siswaId))
      const siswaWithoutNilai = siswaList
        .filter(s => !siswaWithNilai.has(s.id))
        .map((s, idx) => ({
          siswaId: s.id,
          nama: s.nama,
          nis: s.nis,
          nisn: s.nisn,
          rombelId: rombelId,
          rombelNama: rombel.nama,
          kelas: rombel.kelas,
          rataRata: 0,
          subjectCount: 0,
          peringkat: ranked.length + idx + 1,
        }))

      return NextResponse.json({
        type: 'kelas',
        rombel: { id: rombel.id, nama: rombel.nama, kelas: rombel.kelas },
        data: [...ranked, ...siswaWithoutNilai],
      })
    }

    if (type === 'tingkat' && tingkat) {
      const kelasNum = parseInt(tingkat)

      // Get rombels of this tingkat
      const rombels = await db.rombel.findMany({ where: { kelas: kelasNum } })
      const rombelIds = rombels.map(r => r.id)
      const rombelMap = new Map(rombels.map(r => [r.id, r]))

      if (rombelIds.length === 0) {
        return NextResponse.json({ type: 'tingkat', tingkat: kelasNum, totalSiswa: 0, rombelSummary: [], data: [] })
      }

      // Get siswa in these rombels
      const siswaList = await db.siswa.findMany({
        where: { rombelId: { in: rombelIds } },
        select: { id: true, nama: true, nis: true, nisn: true, rombelId: true },
      })

      if (siswaList.length === 0) {
        return NextResponse.json({ type: 'tingkat', tingkat: kelasNum, totalSiswa: 0, rombelSummary: [], data: [] })
      }

      // Use groupBy for aggregation
      const nilaiAgg = await db.nilai.groupBy({
        by: ['siswaId'],
        where: { siswaId: { in: siswaList.map(s => s.id) } },
        _sum: { rerata: true },
        _count: { rerata: true },
      })

      const siswaMap = new Map(siswaList.map(s => [s.id, s]))
      const ranked = nilaiAgg
        .map(n => {
          const siswa = siswaMap.get(n.siswaId)
          const rombel = siswa ? rombelMap.get(siswa.rombelId) : null
          return {
            siswaId: n.siswaId,
            nama: siswa?.nama || '-',
            nis: siswa?.nis || '-',
            nisn: siswa?.nisn || '-',
            rombelId: siswa?.rombelId || '-',
            rombelNama: rombel?.nama || '-',
            kelas: kelasNum,
            rataRata: n._count.rerata > 0 ? Math.round((n._sum.rerata! / n._count.rerata) * 100) / 100 : 0,
            subjectCount: n._count.rerata,
          }
        })
        .sort((a, b) => b.rataRata - a.rataRata)
        .map((s, idx) => ({ ...s, peringkat: idx + 1 }))

      // Rombel summary
      const rombelSummaryMap = new Map<string, { rombelNama: string; count: number; totalRataRata: number }>()
      for (const s of ranked) {
        if (!rombelSummaryMap.has(s.rombelId)) {
          rombelSummaryMap.set(s.rombelId, { rombelNama: s.rombelNama, count: 0, totalRataRata: 0 })
        }
        const r = rombelSummaryMap.get(s.rombelId)!
        r.count++
        r.totalRataRata += s.rataRata
      }
      const rombelSummary = Array.from(rombelSummaryMap.entries()).map(([id, r]) => ({
        rombelId: id,
        rombelNama: r.rombelNama,
        count: r.count,
        avgRataRata: r.count > 0 ? Math.round((r.totalRataRata / r.count) * 100) / 100 : 0,
      }))

      return NextResponse.json({
        type: 'tingkat',
        tingkat: kelasNum,
        totalSiswa: ranked.length,
        rombelSummary,
        data: ranked,
      })
    }

    return NextResponse.json({ error: 'Parameter tidak valid' }, { status: 400 })
  } catch (error) {
    console.error('Peringkat error:', error)
    return NextResponse.json({ error: 'Gagal memuat peringkat' }, { status: 500 })
  }
}
