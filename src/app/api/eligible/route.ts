import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await db.eligible.findMany({
      include: { siswa: { include: { rombel: true } } },
      orderBy: [{ siswa: { nama: 'asc' } }],
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const data = await db.eligible.upsert({
      where: { siswaId: body.siswaId },
      update: {
        status: body.status,
        keterangan: body.keterangan ?? null,
      },
      create: {
        siswaId: body.siswaId,
        status: body.status,
        keterangan: body.keterangan ?? null,
      },
      include: { siswa: { include: { rombel: true } } },
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menyimpan eligible' }, { status: 500 })
  }
}
