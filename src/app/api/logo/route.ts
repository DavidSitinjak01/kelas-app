import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const size = parseInt(searchParams.get('size') || '0') || 0

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    // Try to get logo from Supabase directly
    let logodata: string | null = null

    if (supabaseUrl && supabaseKey) {
      try {
        const res = await fetch(`${supabaseUrl}/rest/v1/settings?id=eq.default&select=logodata`, {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        })
        if (res.ok) {
          const rows = await res.json()
          if (rows && rows.length > 0) {
            logodata = rows[0].logodata
          }
        }
      } catch {
        // Ignore errors
      }
    }

    if (!logodata) {
      // Return a simple 1x1 transparent PNG as fallback
      const transparentPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64'
      )
      return new Response(transparentPng, {
        headers: {
          'Content-Type': 'image/png',
          'Cache-Control': 'public, max-age=3600',
        },
      })
    }

    // Extract base64 data from data URL
    const matches = logodata.match(/^data:(.+);base64,(.+)$/)

    if (!matches) {
      return new Response('Invalid logo data', { status: 500 })
    }

    const mimeType = matches[1]
    const base64 = matches[2]
    let buffer = Buffer.from(base64, 'base64')

    // Resize if size is specified and sharp is available
    if (size > 0) {
      try {
        const sharp = await import('sharp')
        buffer = await sharp
          .default(buffer)
          .resize(size, size, {
            fit: 'contain',
            background: { r: 255, g: 255, b: 255, alpha: 0 },
          })
          .png()
          .toBuffer()
        return new Response(buffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=3600',
          },
        })
      } catch {
        // Sharp not available, return original
      }
    }

    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=3600',
      },
    })
  } catch (error) {
    console.error('Logo serve error:', error)
    return new Response('Logo not available', { status: 500 })
  }
}
