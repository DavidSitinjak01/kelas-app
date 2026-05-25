-- ============================================================
-- 00_admin.sql - Create admin table and insert default user
-- Run this FIRST before other migration files
-- ============================================================

-- Create admin table
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS on admin table (service role key bypasses RLS anyway,
-- but disabling RLS ensures the table is accessible via the REST API
-- even with anon key if needed)
ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

-- Insert default admin user (username: admin, password: admin123)
INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', 'admin123')
ON CONFLICT (id) DO NOTHING;
