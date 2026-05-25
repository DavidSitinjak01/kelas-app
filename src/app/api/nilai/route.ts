import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const distinct = searchParams.get('distinct')

    // Return distinct mata pelajaran list
    if (distinct === 'matapelajaran') {
      const rombelid = searchParams.get('rombelid')
      const where: Record<string, unknown> = {}
      if (rombelid) where.siswa = { rombelid }

      const result = await db.nilai.findMany({
        where,
        select: { matapelajaran: true },
        distinct: ['matapelajaran'],
        orderBy: [{ matapelajaran: 'asc' }],
      })
      return NextResponse.json(result.map(r => r.matapelajaran))
    }

    const siswaid = searchParams.get('siswaid')
    const rombelid = searchParams.get('rombelid')
    const matapelajaran = searchParams.get('matapelajaran')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    const where: Record<string, unknown> = {}
    if (siswaid) where.siswaid = siswaid
    if (rombelid) where.siswa = { rombelid }
    if (matapelajaran) where.matapelajaran = matapelajaran

    const [data, total] = await Promise.all([
      db.nilai.findMany({
        where,
        include: { siswa: { include: { rombel: true } } },
        orderBy: [{ matapelajaran: 'asc' }, { siswa: { nama: 'asc' } }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.nilai.count({ where }),
    ])
    return NextResponse.json({ data, total, page, limit })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal memuat data' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Handle leger-format nilai (with semester values)
    const smt1 = body.smt1 !== undefined ? parseFloat(body.smt1) : 0
    const smt2 = body.smt2 !== undefined ? parseFloat(body.smt2) : 0
    const smt3 = body.smt3 !== undefined ? parseFloat(body.smt3) : 0
    const smt4 = body.smt4 !== undefined ? parseFloat(body.smt4) : 0
    const smt5 = body.smt5 !== undefined ? parseFloat(body.smt5) : 0
    const smt6 = body.smt6 !== undefined ? parseFloat(body.smt6) : 0

    const vals = [smt1, smt2, smt3, smt4, smt5, smt6].filter(v => v > 0)
    const rerata = body.rerata !== undefined ? parseFloat(body.rerata) :
      (vals.length > 0 ? vals.reduce((a: number, b: number) => a + b, 0) / vals.length : 0)

    const data = await db.nilai.create({
      data: {
        siswaid: body.siswaid,
        matapelajaran: body.matapelajaran,
        smt1,
        smt2,
        smt3,
        smt4,
        smt5,
        smt6,
        rerata: Math.round(rerata * 100) / 100,
      },
      include: { siswa: { include: { rombel: true } } },
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menambahkan nilai' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()

    const smt1 = body.smt1 !== undefined ? parseFloat(body.smt1) : undefined
    const smt2 = body.smt2 !== undefined ? parseFloat(body.smt2) : undefined
    const smt3 = body.smt3 !== undefined ? parseFloat(body.smt3) : undefined
    const smt4 = body.smt4 !== undefined ? parseFloat(body.smt4) : undefined
    const smt5 = body.smt5 !== undefined ? parseFloat(body.smt5) : undefined
    const smt6 = body.smt6 !== undefined ? parseFloat(body.smt6) : undefined

    const rerata = body.rerata !== undefined ? parseFloat(body.rerata) : undefined

    const updateData: Record<string, unknown> = {
      matapelajaran: body.matapelajaran,
    }
    if (smt1 !== undefined) updateData.smt1 = smt1
    if (smt2 !== undefined) updateData.smt2 = smt2
    if (smt3 !== undefined) updateData.smt3 = smt3
    if (smt4 !== undefined) updateData.smt4 = smt4
    if (smt5 !== undefined) updateData.smt5 = smt5
    if (smt6 !== undefined) updateData.smt6 = smt6
    if (rerata !== undefined) updateData.rerata = Math.round(rerata * 100) / 100

    const data = await db.nilai.update({
      where: { id: body.id },
      data: updateData,
      include: { siswa: { include: { rombel: true } } },
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal memperbarui nilai' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    await db.nilai.delete({ where: { id: body.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menghapus' }, { status: 500 })
  }
}
