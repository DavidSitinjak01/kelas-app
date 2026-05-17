import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const siswaId = searchParams.get('siswaId')

    const where = siswaId ? { siswaId } : {}
    const data = await db.nilai.findMany({
      where,
      include: { siswa: { include: { rombel: true } } },
      orderBy: [{ mataPelajaran: 'asc' }],
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
    const data = await db.nilai.create({
      data: {
        siswaId: body.siswaId,
        mataPelajaran: body.mataPelajaran,
        nilaiAsli: parseFloat(body.nilaiAsli),
        nilaiUp: parseFloat(body.nilaiUp),
        semester: body.semester,
        tahunAjaran: body.tahunAjaran,
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
    const data = await db.nilai.update({
      where: { id: body.id },
      data: {
        siswaId: body.siswaId,
        mataPelajaran: body.mataPelajaran,
        nilaiAsli: parseFloat(body.nilaiAsli),
        nilaiUp: parseFloat(body.nilaiUp),
        semester: body.semester,
        tahunAjaran: body.tahunAjaran,
      },
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
    return NextResponse.json({ error: 'Gagal menghapus nilai' }, { status: 500 })
  }
}
