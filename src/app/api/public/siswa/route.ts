import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const nis = searchParams.get('nis')

    if (!nis) {
      return NextResponse.json({ error: 'NIS wajib diisi' }, { status: 400 })
    }

    const siswa = await db.siswa.findFirst({
      where: { nis },
      include: { rombel: true },
    })

    if (!siswa) {
      return NextResponse.json({ error: 'Siswa dengan NIS tersebut tidak ditemukan' }, { status: 404 })
    }

    return NextResponse.json({
      id: siswa.id,
      nis: siswa.nis,
      nisn: siswa.nisn,
      nama: siswa.nama,
      jeniskelamin: siswa.jeniskelamin,
      rombel: siswa.rombel ? {
        id: siswa.rombel.id,
        nama: siswa.rombel.nama,
        kelas: siswa.rombel.kelas,
        jurusan: siswa.rombel.jurusan,
      } : null,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal mencari data siswa' }, { status: 500 })
  }
}
