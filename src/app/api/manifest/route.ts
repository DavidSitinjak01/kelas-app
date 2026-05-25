import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    let appName = 'Kelas App'
    let hasLogo = false

    try {
      const settings = await db.settings.findFirst({ where: { id: 'default' } })
      if (settings) {
        appName = (settings.namasekolah as string) || 'Kelas App'
        hasLogo = !!(settings.logodata)
      }
    } catch {
      // Settings table might not exist
    }

    const icons = []

    if (hasLogo) {
      icons.push(
        {
          src: '/api/logo?size=192',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/api/logo?size=512',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        },
        {
          src: '/api/logo?size=512',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }
      )
    }

    // Always include SVG fallback
    icons.push({
      src: '/logo.svg',
      sizes: 'any',
      type: 'image/svg+xml',
      purpose: 'any',
    })

    const manifest = {
      name: `${appName} - Manajemen Kelas`,
      short_name: appName,
      description: `Aplikasi manajemen kelas ${appName} untuk guru dan wali kelas.`,
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#059669',
      orientation: 'any',
      icons,
      categories: ['education', 'productivity'],
      lang: 'id',
      dir: 'ltr',
    }

    return NextResponse.json(manifest)
  } catch {
    const manifest = {
      name: 'Kelas App - Manajemen Kelas',
      short_name: 'Kelas App',
      description: 'Aplikasi manajemen kelas untuk guru dan wali kelas.',
      start_url: '/',
      display: 'standalone',
      background_color: '#ffffff',
      theme_color: '#059669',
      orientation: 'any',
      icons: [{ src: '/logo.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      categories: ['education', 'productivity'],
      lang: 'id',
      dir: 'ltr',
    }
    return NextResponse.json(manifest)
  }
}
