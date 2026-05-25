CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', 'admin123')
ON CONFLICT (id) DO NOTHING;
