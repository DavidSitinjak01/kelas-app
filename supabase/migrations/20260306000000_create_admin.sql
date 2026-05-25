CREATE TABLE IF NOT EXISTS admin (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  createdat TIMESTAMPTZ DEFAULT now(),
  updatedat TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin DISABLE ROW LEVEL SECURITY;

INSERT INTO admin (id, username, password)
VALUES ('admin1', 'admin', '$2b$10$wFgy5.xjUW9Gwqy2v4012.0a9/d.358qkQTB9wdPBXtxYq9BjQj2S')
ON CONFLICT (id) DO NOTHING;
