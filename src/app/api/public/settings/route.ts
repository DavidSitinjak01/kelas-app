import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/public/settings - Get app settings (public, no auth required)
export async function GET() {
  try {
    const settings = await db.settings.findFirst({ where: { id: 'default' } })
    if (!settings) {
      return NextResponse.json({ namasekolah: 'Kelas App', logopath: '' })
    }
    // Return school name and logo data URL (don't expose raw base64 separately)
    return NextResponse.json({
      namasekolah: settings.namasekolah || 'Kelas App',
      logopath: settings.logodata || settings.logopath || '',
    })
  } catch (error) {
    console.error('Public settings GET error:', error)
    return NextResponse.json({ namasekolah: 'Kelas App', logopath: '' })
  }
}
