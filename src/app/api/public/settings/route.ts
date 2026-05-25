import { NextResponse } from 'next/server'

// GET /api/public/settings - Get app settings (public, no auth required)
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  try {
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/settings?id=eq.default&select=namasekolah,logodata,logopath`, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      })
      if (res.ok) {
        const rows = await res.json()
        if (rows && rows.length > 0) {
          return NextResponse.json({
            namasekolah: rows[0].namasekolah || 'Kelas App',
            logopath: rows[0].logodata || rows[0].logopath || '',
          })
        }
      }
    }

    return NextResponse.json({ namasekolah: 'Kelas App', logopath: '' })
  } catch (error) {
    console.error('Public settings GET error:', error)
    return NextResponse.json({ namasekolah: 'Kelas App', logopath: '' })
  }
}
