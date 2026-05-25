import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password diperlukan' }, { status: 400 })
    }

    // Find admin by username
    let admins: any[]
    try {
      admins = await db.admin.findMany({ where: { username } })
    } catch (dbError) {
      console.error('Database query error:', dbError)
      return NextResponse.json({ 
        error: 'Gagal menghubungi database. Coba lagi nanti.', 
        detail: dbError instanceof Error ? dbError.message : String(dbError) 
      }, { status: 500 })
    }

    if (!admins || admins.length === 0) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    const admin = admins[0]

    // Compare password with bcrypt hash
    let isValid = false
    try {
      const bcrypt = await import('bcryptjs')
      isValid = await bcrypt.default.compare(password, admin.password)
    } catch (bcryptError) {
      console.error('Bcrypt compare error:', bcryptError)
      // Fallback: try direct string comparison (for environments where bcrypt fails)
      try {
        isValid = password === admin.password
      } catch {
        return NextResponse.json({ 
          error: 'Server error: gagal memverifikasi password', 
          detail: bcryptError instanceof Error ? bcryptError.message : String(bcryptError) 
        }, { status: 500 })
      }
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Set a simple session cookie
    const sessionData = JSON.stringify({ id: admin.id, username: admin.username })
    const cookieStore = await cookies()
    cookieStore.set('admin-session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return NextResponse.json({ success: true, user: { id: admin.id, username: admin.username } })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ 
      error: 'Gagal login', 
      detail: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}
