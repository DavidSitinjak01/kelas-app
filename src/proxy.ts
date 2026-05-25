import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes that don't require admin authentication
const PUBLIC_API_ROUTES = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/setup',
  '/api/public/siswa',
  '/api/public/nilai',
  '/api/public/student-login',
  '/api/public/student-me',
  '/api/public/student-logout',
  '/api/public/student-report',
  '/api/public/settings',
  '/api/logo',
  '/api/manifest',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Only protect /api/ routes
  if (pathname.startsWith('/api/')) {
    // Check if this is a public route (exact match or sub-path)
    const isPublic = PUBLIC_API_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + '/')
    )

    if (!isPublic) {
      // Check for admin-session cookie
      const session = request.cookies.get('admin-session')

      if (!session?.value) {
        return NextResponse.json(
          { error: 'Not authenticated' },
          { status: 401 }
        )
      }
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}
