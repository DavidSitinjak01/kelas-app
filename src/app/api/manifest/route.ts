import { NextResponse } from 'next/server'

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  let appName = 'Kelas App'
  let hasLogo = false

  // Try to get settings from Supabase directly
  if (supabaseUrl && supabaseKey) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/settings?id=eq.default&select=namasekolah,logodata`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows && rows.length > 0) {
          appName = rows[0].namasekolah || 'Kelas App'
          hasLogo = !!rows[0].logodata
        }
      }
    } catch {
      // Settings table might not exist
    }
  }

  const icons = []

  if (hasLogo) {
    // Provide multiple icon sizes for different devices
    icons.push(
      { src: '/api/logo?size=48', sizes: '48x48', type: 'image/png', purpose: 'any' },
      { src: '/api/logo?size=72', sizes: '72x72', type: 'image/png', purpose: 'any' },
      { src: '/api/logo?size=96', sizes: '96x96', type: 'image/png', purpose: 'any' },
      { src: '/api/logo?size=144', sizes: '144x144', type: 'image/png', purpose: 'any' },
      { src: '/api/logo?size=192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/api/logo?size=512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/api/logo?size=512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
}
