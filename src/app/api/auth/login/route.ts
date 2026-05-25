import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'

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
    const isValid = await bcrypt.compare(password, admin.password)
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
    return NextResponse.json({ error: 'Gagal login' }, { status: 500 })
  }
}
