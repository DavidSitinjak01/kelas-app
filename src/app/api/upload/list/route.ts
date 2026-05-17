import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const uploadDir = path.join(process.cwd(), 'upload')
    
    if (!fs.existsSync(uploadDir)) {
      return NextResponse.json({ files: [] })
    }

    const files = fs.readdirSync(uploadDir)
      .filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'))
      .map(f => {
        const stat = fs.statSync(path.join(uploadDir, f))
        return {
          name: f,
          size: stat.size,
          lastModified: stat.mtime.toISOString(),
        }
      })
      .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())

    return NextResponse.json({ files })
  } catch (error) {
    console.error('List files error:', error)
    return NextResponse.json({ files: [] })
  }
}
