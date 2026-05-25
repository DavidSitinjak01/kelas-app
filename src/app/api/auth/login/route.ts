import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { username, password } = body

    if (!username || !password) {
      return NextResponse.json({ error: 'Username dan password diperlukan' }, { status: 400 })
    }

    // Check if Supabase env vars are configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase env vars:', { 
        hasUrl: !!supabaseUrl, 
        hasKey: !!supabaseKey 
      })
      return NextResponse.json({ 
        error: 'Database belum dikonfigurasi. Pastikan NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY sudah diatur di environment variables.', 
      }, { status: 500 })
    }

    // Find admin by username using direct Supabase REST API
    let admin: Record<string, unknown> | null = null
    try {
      const adminUrl = `${supabaseUrl}/rest/v1/admin?username=eq.${encodeURIComponent(username)}&select=id,username,password`
      const adminRes = await fetch(adminUrl, {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })
      
      if (!adminRes.ok) {
        const errText = await adminRes.text()
        console.error('Supabase admin query failed:', adminRes.status, errText)
        
        // If table doesn't exist, give helpful message
        if (adminRes.status === 404) {
          return NextResponse.json({ 
            error: 'Tabel admin belum tersedia di database. Jalankan SQL setup terlebih dahulu.', 
          }, { status: 503 })
        }
        
        return NextResponse.json({ 
          error: `Gagal menghubungi database (HTTP ${adminRes.status}). Coba lagi nanti.`, 
        }, { status: 500 })
      }
      
      const adminRows = await adminRes.json()
      if (!adminRows || adminRows.length === 0) {
        return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
      }
      
      admin = adminRows[0]
    } catch (fetchError) {
      console.error('Database connection error:', fetchError)
      return NextResponse.json({ 
        error: 'Gagal menghubungi database. Periksa koneksi internet dan coba lagi.', 
        detail: fetchError instanceof Error ? fetchError.message : String(fetchError) 
      }, { status: 500 })
    }

    if (!admin) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Compare password with bcrypt hash
    const storedPassword = admin.password as string
    let isValid = false
    try {
      const bcrypt = await import('bcryptjs')
      isValid = await bcrypt.default.compare(password, storedPassword)
    } catch (bcryptError) {
      console.error('Bcrypt compare error:', bcryptError)
      // Fallback: try direct string comparison (for environments where bcrypt fails)
      isValid = password === storedPassword
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Username atau password salah' }, { status: 401 })
    }

    // Set a simple session cookie
    const sessionData = JSON.stringify({ id: admin.id, username: admin.username })
    const cookieStore = await cookies()
    cookieStore.set('admin-session', sessionData, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    })

    return NextResponse.json({ success: true, user: { id: admin.id, username: admin.username } })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ 
      error: 'Gagal login', 
      detail: error instanceof Error ? error.message : String(error) 
    }, { status: 500 })
  }
}
