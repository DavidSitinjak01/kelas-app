import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

/**
 * Setup endpoint — checks if admin table exists and provides SQL instructions.
 * Also includes NIK column addition for the siswa table (student login).
 */
export async function GET() {
  try {
    // Check if admin table already has records
    try {
      const admins = await db.admin.findMany({ take: 1 })
      if (admins && admins.length > 0) {
        return NextResponse.json({
          status: 'already_setup',
          message: 'Admin table already exists with at least one user',
          adminCount: admins.length,
        })
      }
    } catch {
      // Table doesn't exist yet, need to create it
    }

    // Hash the default password using dynamic import
    let hashedPassword: string
    try {
      const bcrypt = await import('bcryptjs')
      hashedPassword = await bcrypt.default.hash('admin123', 10)
    } catch {
      // Fallback hash for admin123
      hashedPassword = '$2a$10$WmsEU9nPJhNB4wplxbvjdOtjIcJD0bMW5CMeGA9wD0MoaXGrgGYOW'
    }

    // Try to create the default admin via REST API (this only works if table exists)
    try {
      const admin = await db.admin.create({
        data: {
          id: 'admin1',
          username: 'admin',
          password: hashedPassword,
        },
      })
      return NextResponse.json({
        status: 'seeded',
        message: 'Default admin created successfully',
        admin: { id: admin.id, username: admin.username },
      })
    } catch (createError: unknown) {
      const errMsg = createError instanceof Error ? createError.message : String(createError)

      // If the error indicates the table doesn't exist, return SQL instructions
      if (errMsg.includes('PGRST205') || errMsg.includes('Could not find') || errMsg.includes('not found')) {
        return NextResponse.json({
          status: 'table_missing',
          message: 'Admin table does not exist. Please run the SQL in Supabase SQL Editor.',
          sql: `-- =============================================
-- Kelas App: Database Setup Script
-- Run this in Supabase SQL Editor
-- =============================================

-- 1. Create admin table for admin login
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

-- Insert default admin (password: admin123, bcrypt hashed)
INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', '${hashedPassword}')
ON CONFLICT (id) DO NOTHING;

-- 2. Add NIK column to siswa table for student login
-- (NISN = username, NIK = password)
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS nik TEXT NOT NULL DEFAULT '-';
`,
        }, { status: 503 })
      }

      // If it's a unique constraint violation (admin already exists), that's OK
      if (errMsg.includes('duplicate') || errMsg.includes('unique') || errMsg.includes('23505')) {
        return NextResponse.json({
          status: 'already_setup',
          message: 'Default admin already exists',
        })
      }

      throw createError
    }
  } catch (error: unknown) {
    console.error('Setup error:', error)
    return NextResponse.json({
      status: 'error',
      message: 'Setup failed',
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 })
  }
}
