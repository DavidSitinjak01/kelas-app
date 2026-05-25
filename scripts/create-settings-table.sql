-- Create settings table for app configuration (school name, logo, etc.)
-- Run this SQL in the Supabase SQL Editor (Dashboard → SQL Editor)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  namasekolah TEXT DEFAULT 'Kelas App',
  logopath TEXT DEFAULT '',
  createdat TIMESTAMPTZ DEFAULT NOW(),
  updatedat TIMESTAMPTZ DEFAULT NOW()
);

-- Disable RLS so the service role key can access the table
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;

-- Insert default row if not exists
INSERT INTO settings (id, namasekolah, logopath)
VALUES ('default', 'Kelas App', '')
ON CONFLICT (id) DO NOTHING;
