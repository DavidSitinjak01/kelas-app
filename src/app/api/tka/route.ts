import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tka - List all TKA records with siswa + rombel info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelid = searchParams.get('rombelid')
    const includeCoverage = searchParams.get('coverage') === 'true'

    const where: Record<string, unknown> = {}
    if (rombelid) {
      where.siswa = { rombelid }
    }

    const tkaRecords = await db.tKA.findMany({
      where,
      include: {
        siswa: {
          include: {
            rombel: true,
          },
        },
      },
      orderBy: {
        siswa: {
          nama: 'asc',
        },
      },
    })

    // If coverage requested, also return per-rombel stats for XII
    if (includeCoverage) {
      const xiiRombels = await db.rombel.findMany({
        where: { kelas: 12 },
        include: {
          siswa: {
            select: { id: true }
          }
        }
      })

      const tkaSiswaIds = new Set(tkaRecords.map(t => t.siswaid))

      const coverage = xiiRombels.map(r => ({
        rombelid: r.id,
        rombelNama: r.nama,
        totalSiswa: r.siswa.length,
        tkaCount: r.siswa.filter(s => tkaSiswaIds.has(s.id)).length,
        missingCount: r.siswa.filter(s => !tkaSiswaIds.has(s.id)).length,
      }))

      return NextResponse.json({
        data: tkaRecords,
        coverage,
      })
    }

    return NextResponse.json(tkaRecords)
  } catch (error) {
    console.error('TKA GET error:', error)
    return NextResponse.json({ error: 'Gagal memuat data TKA' }, { status: 500 })
  }
}

// DELETE /api/tka - Delete a TKA record by siswaid
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { siswaid, id } = body

    if (id) {
      await db.tKA.delete({ where: { id } })
    } else if (siswaid) {
      await db.tKA.delete({ where: { siswaid } })
    } else {
      return NextResponse.json({ error: 'siswaid atau id diperlukan' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('TKA DELETE error:', error)
    return NextResponse.json({ error: 'Gagal menghapus data TKA' }, { status: 500 })
  }
}
