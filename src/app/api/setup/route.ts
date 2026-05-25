import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

/**
 * Setup endpoint — creates the admin table and seeds a default admin.
 *
 * Call this endpoint once after deployment: GET /api/setup
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

    // Hash the default password
    const hashedPassword = await bcrypt.hash('admin123', 10)

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
          message: 'Admin table does not exist in the database. Please run the following SQL in the Supabase SQL Editor:',
          sql: `-- NOTE: The password must be a bcrypt hash of 'admin123'.
-- Run this in Node.js to generate the hash:
--   const bcrypt = require('bcryptjs'); bcrypt.hash('admin123', 10).then(console.log)
-- Then replace the password value below with the generated hash.

CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

-- Replace the password below with a bcrypt hash of 'admin123'
INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', '${hashedPassword}')
ON CONFLICT (id) DO NOTHING;`,
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
