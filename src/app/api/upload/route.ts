import { NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import path from 'path'

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
    const filePath = file.name
    const fullPath = path.join(uploadDir, filePath)

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
