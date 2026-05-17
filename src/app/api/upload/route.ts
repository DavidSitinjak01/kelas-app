import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

// Allow up to 10MB per file upload
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Save to upload directory
    const uploadDir = path.join(process.cwd(), 'upload')
    // Sanitize filename - replace problematic characters
    const safeName = file.name.replace(/[^a-zA-Z0-9._\-\s]/g, '_')
    const filePath = safeName
    const fullPath = path.join(uploadDir, filePath)

    // Ensure upload directory exists
    const fsSync = await import('fs')
    if (!fsSync.existsSync(uploadDir)) {
      await import('fs/promises').then(fsp => fsp.mkdir(uploadDir, { recursive: true }))
    }

    await writeFile(fullPath, buffer)

    return NextResponse.json({
      success: true,
      filePath,
      fileName: file.name,
      fileSize: file.size,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json({ error: 'Gagal mengupload file' }, { status: 500 })
  }
}
