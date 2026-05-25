import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await db.rombel.findMany({
      include: { _count: { select: { siswa: true } } },
      orderBy: [{ kelas: 'asc' }, { nama: 'asc' }],
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
    const data = await db.rombel.create({
      data: {
        nama: body.nama,
        kelas: parseInt(body.kelas),
        jurusan: body.jurusan,
        tahunajaran: body.tahunajaran,
        walikelas: body.walikelas,
      },
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menambahkan rombel' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const data = await db.rombel.update({
      where: { id: body.id },
      data: {
        nama: body.nama,
        kelas: parseInt(body.kelas),
        jurusan: body.jurusan,
        tahunajaran: body.tahunajaran,
        walikelas: body.walikelas,
      },
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal memperbarui rombel' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    await db.rombel.delete({ where: { id: body.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menghapus rombel' }, { status: 500 })
  }
}
