-- Add nik column to siswa table
ALTER TABLE siswa ADD COLUMN IF NOT EXISTS nik TEXT DEFAULT '-';
