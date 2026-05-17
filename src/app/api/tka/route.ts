import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/tka - List all TKA records with siswa + rombel info
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelId = searchParams.get('rombelId')

    const where: Record<string, unknown> = {}
    if (rombelId) {
      where.siswa = { rombelId }
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

    return NextResponse.json(tkaRecords)
  } catch (error) {
    console.error('TKA GET error:', error)
    return NextResponse.json({ error: 'Gagal memuat data TKA' }, { status: 500 })
  }
}

// DELETE /api/tka - Delete a TKA record by siswaId
export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    const { siswaId, id } = body

    if (id) {
      await db.tKA.delete({ where: { id } })
    } else if (siswaId) {
      await db.tKA.delete({ where: { siswaId } })
    } else {
      return NextResponse.json({ error: 'siswaId atau id diperlukan' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('TKA DELETE error:', error)
    return NextResponse.json({ error: 'Gagal menghapus data TKA' }, { status: 500 })
  }
}
