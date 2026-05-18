import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const uploadDir = path.join(process.cwd(), 'upload')
    if (!fs.existsSync(uploadDir)) {
      return NextResponse.json({ files: [] })
    }

    const files = fs.readdirSync(uploadDir)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv'))
      .map(f => {
        const stat = fs.statSync(path.join(uploadDir, f))
        return {
          name: f,
          size: stat.size,
          modified: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime())

    return NextResponse.json({ files })
  } catch (error) {
    console.error('List upload error:', error)
    return NextResponse.json({ files: [] })
  }
}
