import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Helper: verify student is logged in
async function getStudentSession(): Promise<{ id: string; type: string } | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('student-session')
    if (!session?.value) return null
    const data = JSON.parse(session.value)
    if (data.type !== 'student') return null
    return data
  } catch {
    return null
  }
}

// GET: Fetch all nilai for a student (requires student session)
export async function GET(request: Request) {
  try {
    const student = await getStudentSession()
    if (!student) {
      return NextResponse.json({ error: 'Siswa belum login' }, { status: 401 })
    }

    const siswaid = student.id

    // Verify student exists
    const siswa = await db.siswa.findFirst({
      where: { id: siswaid },
      include: { rombel: true },
    })

    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    // Get all nilai for this student
    const nilaiList = await db.nilai.findMany({
      where: { siswaid },
      orderBy: [{ matapelajaran: 'asc' }],
    })

    return NextResponse.json({
      siswa: {
        id: siswa.id,
        nis: siswa.nis,
        nisn: siswa.nisn,
        nama: siswa.nama,
        rombel: siswa.rombel ? {
          nama: siswa.rombel.nama,
          kelas: siswa.rombel.kelas,
          jurusan: siswa.rombel.jurusan,
        } : null,
      },
      nilai: nilaiList,
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal memuat data nilai' }, { status: 500 })
  }
}

// PUT: Update or create nilai entries for a student (requires student session)
export async function PUT(request: Request) {
  try {
    const student = await getStudentSession()
    if (!student) {
      return NextResponse.json({ error: 'Siswa belum login' }, { status: 401 })
    }

    const body = await request.json()
    const { nilai: nilaiData } = body
    const siswaid = student.id

    if (!Array.isArray(nilaiData)) {
      return NextResponse.json({ error: 'Data tidak valid' }, { status: 400 })
    }

    // Verify student exists
    const siswa = await db.siswa.findFirst({ where: { id: siswaid } })
    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    const results = []

    for (const item of nilaiData) {
      const smt1 = item.smt1 !== undefined && item.smt1 !== null && item.smt1 !== '' ? parseFloat(String(item.smt1)) : 0
      const smt2 = item.smt2 !== undefined && item.smt2 !== null && item.smt2 !== '' ? parseFloat(String(item.smt2)) : 0
      const smt3 = item.smt3 !== undefined && item.smt3 !== null && item.smt3 !== '' ? parseFloat(String(item.smt3)) : 0
      const smt4 = item.smt4 !== undefined && item.smt4 !== null && item.smt4 !== '' ? parseFloat(String(item.smt4)) : 0
      const smt5 = item.smt5 !== undefined && item.smt5 !== null && item.smt5 !== '' ? parseFloat(String(item.smt5)) : 0
      const smt6 = item.smt6 !== undefined && item.smt6 !== null && item.smt6 !== '' ? parseFloat(String(item.smt6)) : 0

      const vals = [smt1, smt2, smt3, smt4, smt5, smt6].filter(v => v > 0)
      const rerata = vals.length > 0
        ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100
        : 0

      if (item.id) {
        // Update existing nilai
        const updated = await db.nilai.update({
          where: { id: item.id },
          data: {
            smt1, smt2, smt3, smt4, smt5, smt6, rerata,
          },
        })
        results.push(updated)
      } else {
        // Create new nilai entry
        const created = await db.nilai.create({
          data: {
            siswaid,
            matapelajaran: item.matapelajaran,
            smt1, smt2, smt3, smt4, smt5, smt6, rerata,
          },
        })
        results.push(created)
      }
    }

    return NextResponse.json({ success: true, count: results.length })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal menyimpan data nilai' }, { status: 500 })
  }
}
