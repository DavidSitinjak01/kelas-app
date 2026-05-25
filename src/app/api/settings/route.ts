import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// GET /api/settings - Get app settings (requires admin auth)
export async function GET() {
  try {
    const settings = await db.settings.findFirst({ where: { id: 'default' } })
    if (!settings) {
      return NextResponse.json({
        id: 'default',
        namasekolah: 'Kelas App',
        logopath: '',
      })
    }
    // Return school name and logo data URL for admin
    return NextResponse.json({
      id: settings.id,
      namasekolah: settings.namasekolah || 'Kelas App',
      logopath: settings.logodata || settings.logopath || '',
    })
  } catch (error) {
    console.error('Settings GET error:', error)
    return NextResponse.json({
      id: 'default',
      namasekolah: 'Kelas App',
      logopath: '',
    })
  }
}

// PUT /api/settings - Update app settings (requires admin auth)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { namasekolah, logopath } = body

    const updateData: Record<string, unknown> = {}
    if (namasekolah !== undefined) updateData.namasekolah = namasekolah
    if (logopath !== undefined) updateData.logopath = logopath

    // Try to update first, if the row doesn't exist, create it (upsert)
    try {
      const settings = await db.settings.update({
        where: { id: 'default' },
        data: updateData,
      })
      return NextResponse.json({
        id: settings.id,
        namasekolah: settings.namasekolah || 'Kelas App',
        logopath: settings.logodata || settings.logopath || '',
      })
    } catch {
      // Row might not exist, try to create it
      try {
        const settings = await db.settings.create({
          data: {
            id: 'default',
            namasekolah: (namasekolah as string) || 'Kelas App',
            logopath: (logopath as string) || '',
            ...updateData,
          },
        })
        return NextResponse.json({
          id: settings.id,
          namasekolah: settings.namasekolah || 'Kelas App',
          logopath: settings.logodata || settings.logopath || '',
        })
      } catch {
        // Table might not exist at all
        return NextResponse.json(
          { error: 'Tabel pengaturan belum tersedia. Jalankan SQL setup terlebih dahulu.' },
          { status: 503 }
        )
      }
    }
  } catch (error) {
    console.error('Settings PUT error:', error)
    return NextResponse.json({ error: 'Gagal menyimpan pengaturan' }, { status: 500 })
  }
}
