/**
 * Script to create the `admin` table in Supabase and insert a default admin user.
 *
 * Usage:
 *   node create-admin-table.js
 *
 * Requires the DATABASE_URL environment variable or uses the default from .env
 * 
 * If direct PostgreSQL connection is unavailable, run the SQL in
 * sql-migration/00_admin.sql via the Supabase SQL Editor instead.
 */

const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://postgres.gybmzmxeknsbypthdvwr:K3las%40pp2025%21DbPass@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const SQL = `
-- Create admin table
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS on admin table
ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

-- Insert default admin user (username: admin, password: admin123)
INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', 'admin123')
ON CONFLICT (id) DO NOTHING;
`;

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 15000,
  });

  try {
    console.log('Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('Connected!');

    console.log('Executing SQL...');
    await client.query(SQL);
    console.log('Admin table created and default user inserted.');

    // Verify
    const result = await client.query('SELECT id, username, createdat, updatedat FROM admin');
    console.log('Admin table contents:', result.rows);

    // Check RLS status
    const rlsResult = await client.query(
      "SELECT relrowsecurity FROM pg_class WHERE relname = 'admin'"
    );
    console.log('RLS enabled:', rlsResult.rows[0]?.relrowsecurity);

  } catch (err) {
    console.error('Error:', err.message);
    console.error('\nIf the connection failed, please run the SQL in sql-migration/00_admin.sql');
    console.error('via the Supabase SQL Editor instead.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
