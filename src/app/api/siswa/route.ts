import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const data = await db.siswa.findMany({
      include: { rombel: true },
      orderBy: [{ nama: 'asc' }],
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
    // Check NIS uniqueness
    const existing = await db.siswa.findUnique({ where: { nis: body.nis } })
    if (existing) {
      return NextResponse.json({ error: 'NIS sudah terdaftar' }, { status: 400 })
    }
    const data = await db.siswa.create({
      data: {
        nis: body.nis,
        nama: body.nama,
        jenisKelamin: body.jenisKelamin,
        rombelId: body.rombelId,
      },
      include: { rombel: true },
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menambahkan siswa' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    // Check NIS uniqueness (exclude current)
    const existing = await db.siswa.findFirst({
      where: { nis: body.nis, id: { not: body.id } },
    })
    if (existing) {
      return NextResponse.json({ error: 'NIS sudah digunakan siswa lain' }, { status: 400 })
    }
    const data = await db.siswa.update({
      where: { id: body.id },
      data: {
        nis: body.nis,
        nama: body.nama,
        jenisKelamin: body.jenisKelamin,
        rombelId: body.rombelId,
      },
      include: { rombel: true },
    })
    return NextResponse.json(data)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal memperbarui siswa' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json()
    await db.siswa.delete({ where: { id: body.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menghapus siswa' }, { status: 500 })
  }
}
