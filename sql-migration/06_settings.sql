-- Settings table for app configuration (school name, logo, etc.)
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  namasekolah TEXT NOT NULL DEFAULT 'Kelas App',
  logopath TEXT NOT NULL DEFAULT '',
  createdat TIMESTAMPTZ NOT NULL DEFAULT now(),
  updatedat TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert default row if not exists
INSERT INTO settings (id, namasekolah, logopath)
VALUES ('default', 'Kelas App', '')
ON CONFLICT (id) DO NOTHING;
