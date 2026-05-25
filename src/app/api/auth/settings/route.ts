import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('admin-session')
    
    if (!session?.value) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const currentUser = JSON.parse(session.value)
    const body = await request.json()
    const { username, currentPassword, newPassword } = body

    // Find admin
    const admins = await db.admin.findMany({ where: { id: currentUser.id } })
    if (!admins || admins.length === 0) {
      return NextResponse.json({ error: 'User tidak ditemukan' }, { status: 404 })
    }

    const admin = admins[0]

    // If changing password, verify current password
    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Password saat ini diperlukan' }, { status: 400 })
      }
      if (admin.password !== currentPassword) {
        return NextResponse.json({ error: 'Password saat ini salah' }, { status: 400 })
      }
    }

    // Update admin
    const updateData: Record<string, any> = {}
    if (username && username !== admin.username) {
      // Check if username already taken
      const existing = await db.admin.findMany({ where: { username } })
      if (existing && existing.length > 0 && existing[0].id !== currentUser.id) {
        return NextResponse.json({ error: 'Username sudah digunakan' }, { status: 400 })
      }
      updateData.username = username
    }
    if (newPassword) {
      updateData.password = newPassword
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Tidak ada perubahan' }, { status: 400 })
    }

    await db.admin.update({ where: { id: currentUser.id }, data: updateData })

    // Update session if username changed
    if (updateData.username) {
      const sessionData = JSON.stringify({ id: currentUser.id, username: updateData.username })
      cookieStore.set('admin-session', sessionData, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
        path: '/',
      })
    }

    return NextResponse.json({ success: true, user: { id: currentUser.id, username: updateData.username || currentUser.username } })
  } catch (error) {
    console.error('Settings error:', error)
    return NextResponse.json({ error: 'Gagal memperbarui pengaturan' }, { status: 500 })
  }
}
