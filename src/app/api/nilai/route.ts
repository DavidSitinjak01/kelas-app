import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siswaId = searchParams.get('siswaId')
    const rombelId = searchParams.get('rombelId')
    const limit = parseInt(searchParams.get('limit') || '0')

    const where: Record<string, unknown> = {}
    if (siswaId) where.siswaId = siswaId
    if (rombelId) where.siswa = { rombelId }

    const data = await db.nilai.findMany({
      where,
      include: { siswa: { include: { rombel: true } } },
      orderBy: [{ mataPelajaran: 'asc' }],
      ...(limit > 0 ? { take: limit } : {}),
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
        siswaId: body.siswaId,
        mataPelajaran: body.mataPelajaran,
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
      mataPelajaran: body.mataPelajaran,
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
