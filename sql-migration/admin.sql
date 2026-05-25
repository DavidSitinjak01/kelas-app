-- Create admin table
CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

-- Disable RLS on admin table (service_role key bypasses RLS anyway)
ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

-- Insert default admin user (username: admin, password: admin123)
INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', 'admin123')
ON CONFLICT (id) DO NOTHING;
