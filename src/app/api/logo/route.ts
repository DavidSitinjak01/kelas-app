import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const size = parseInt(searchParams.get('size') || '0') || 0

    const settings = await db.settings.findFirst({ where: { id: 'default' } })

    if (!settings || !(settings as any).logodata) {
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
    const dataUrl = settings.logodata as string
    const matches = dataUrl.match(/^data:(.+);base64,(.+)$/)

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
