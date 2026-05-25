import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('logo') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File logo tidak ditemukan' }, { status: 400 })
    }

    // Validate file size (3MB max)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Ukuran file maksimal 3 MB' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan PNG, JPG, WebP, atau SVG' },
        { status: 400 }
      )
    }

    // Convert file to base64
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64Data = buffer.toString('base64')
    const dataUrl = `data:${file.type};base64,${base64Data}`

    // Try to update settings in database
    try {
      await db.settings.update({
        where: { id: 'default' },
        data: {
          logodata: dataUrl,
          logomimetype: file.type,
        },
      })
    } catch {
      // Row might not exist, try to create it
      try {
        await db.settings.create({
          data: {
            id: 'default',
            namasekolah: 'Kelas App',
            logopath: '',
            logodata: dataUrl,
            logomimetype: file.type,
          },
        })
      } catch {
        return NextResponse.json(
          { error: 'Tabel pengaturan belum tersedia. Jalankan setup terlebih dahulu.' },
          { status: 503 }
        )
      }
    }

    return NextResponse.json({ success: true, logopath: dataUrl })
  } catch (error) {
    console.error('Upload logo error:', error)
    return NextResponse.json({ error: 'Gagal mengupload logo' }, { status: 500 })
  }
}
