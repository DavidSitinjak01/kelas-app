import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nama, nisn } = body

    if (!nama || !nisn) {
      return NextResponse.json(
        { error: 'Nama dan NISN wajib diisi' },
        { status: 400 }
      )
    }

    // Find student by NISN
    const siswa = await db.siswa.findFirst({
      where: { nisn },
      include: { rombel: true },
    })

    if (!siswa) {
      return NextResponse.json(
        { error: 'NISN tidak ditemukan' },
        { status: 401 }
      )
    }

    // Verify Nama as username (case-insensitive)
    if (siswa.nama.toLowerCase().trim() !== nama.toLowerCase().trim()) {
      return NextResponse.json(
        { error: 'Nama tidak sesuai dengan NISN' },
        { status: 401 }
      )
    }

    // Set student session cookie (valid for 7 days)
    const sessionData = JSON.stringify({
      id: siswa.id,
      nisn: siswa.nisn,
      nama: siswa.nama,
      type: 'student',
    })

    const cookieStore = await cookies()
    cookieStore.set('student-session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return NextResponse.json({
      success: true,
      student: {
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
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal login' }, { status: 500 })
  }
}
