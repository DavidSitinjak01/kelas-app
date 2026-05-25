-- Create admin table
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS on admin table (service_role key bypasses RLS anyway,
-- but disabling RLS ensures the table is accessible via the REST API
-- even with anon key if needed)
ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

-- Insert default admin user (username: admin, password: admin123)
INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', '$2b$10$wFgy5.xjUW9Gwqy2v4012.0a9/d.358qkQTB9wdPBXtxYq9BjQj2S')
ON CONFLICT (id) DO NOTHING;

-- Add nik column to siswa table
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS nik TEXT DEFAULT '-';
