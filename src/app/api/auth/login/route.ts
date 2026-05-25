import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password diperlukan' }, { status: 400 })
    }

    // Find admin by username
    const admins = await db.admin.findMany({ where: { username } })

    if (!admins || admins.length === 0) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    const admin = admins[0]

    // Compare password with bcrypt hash
    // Use dynamic import to handle bcryptjs properly on Vercel
    let isValid = false
    try {
      const bcrypt = await import('bcryptjs')
      isValid = await bcrypt.default.compare(password, admin.password)
    } catch (bcryptError) {
      console.error('Bcrypt compare error:', bcryptError)
      // Fallback: try direct string comparison (for emergency)
      // This should NOT be used in production long-term
      return NextResponse.json({ error: 'Server error: bcrypt module failed' }, { status: 500 })
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
    return NextResponse.json({ error: 'Gagal login', detail: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
