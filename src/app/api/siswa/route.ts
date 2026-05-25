import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelid = searchParams.get('rombelid')
    const search = searchParams.get('search')
    const limit = parseInt(searchParams.get('limit') || '0') // 0 means all
    const page = parseInt(searchParams.get('page') || '1')

    const where: Record<string, unknown> = {}
    
    if (rombelid) {
      where.rombelid = rombelid
    }
    
    if (search) {
      where.OR = [
        { nama: { contains: search } },
        { nis: { contains: search } },
        { nisn: { contains: search } },
      ]
    }

    const [data, total] = await Promise.all([
      db.siswa.findMany({
        where,
        include: { rombel: true },
        orderBy: [{ nama: 'asc' }],
        ...(limit > 0 ? { take: limit, skip: (page - 1) * limit } : {}),
      }),
      db.siswa.count({ where }),
    ])

    return NextResponse.json(limit > 0 ? { data, total, page, limit } : data)
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
        nisn: body.nisn || '-',
        nik: body.nik || '-',
        nama: body.nama,
        jeniskelamin: body.jeniskelamin,
        tempatlahir: body.tempatlahir || '-',
        tanggallahir: body.tanggallahir || '-',
        rombelid: body.rombelid,
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
        nisn: body.nisn || '-',
        nik: body.nik || '-',
        nama: body.nama,
        jeniskelamin: body.jeniskelamin,
        tempatlahir: body.tempatlahir || '-',
        tanggallahir: body.tanggallahir || '-',
        rombelid: body.rombelid,
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
