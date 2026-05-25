const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const db = new Database('./db/custom.db');
const OUTPUT_DIR = './sql-migration';

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Helper: escape single quotes for SQL strings
function escStr(val) {
  if (val === null || val === undefined) return 'NULL';
  return "'" + String(val).replace(/'/g, "''") + "'";
}

// Helper: format timestamp from milliseconds to PostgreSQL to_timestamp
function escTimestamp(ms) {
  if (ms === null || ms === undefined) return 'NULL';
  const secs = ms / 1000;
  return `to_timestamp(${secs})`;
}

// Helper: escape numeric value
function escNum(val) {
  if (val === null || val === undefined) return 'NULL';
  return Number(val);
}

// Helper: write multi-row INSERT SQL to file
function writeMultiRowInsert(filepath, tableName, columns, rows, valueFormatter, batchSize = 500) {
  let content = '';
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const colList = columns.join(',');
    content += `INSERT INTO ${tableName} (${colList}) VALUES\n`;
    const values = batch.map((row, idx) => {
      const vals = valueFormatter(row);
      const sep = (idx === batch.length - 1) ? ';\n' : ',\n';
      return `(${vals})${sep}`;
    });
    content += values.join('');
    if (i + batchSize < rows.length) {
      content += '\n';
    }
  }
  fs.writeFileSync(filepath, content);
  return rows.length;
}

// Helper: write multi-row INSERT SQL to multiple files (for splitting)
function writeMultiRowInsertSplit(filepathPrefix, extension, tableName, columns, rows, valueFormatter, batchSize = 500, rowsPerFile = 1500) {
  const files = [];
  let fileIndex = 1;
  for (let i = 0; i < rows.length; i += rowsPerFile) {
    const chunk = rows.slice(i, i + rowsPerFile);
    const filepath = `${filepathPrefix}${fileIndex}${extension}`;
    const count = writeMultiRowInsert(filepath, tableName, columns, chunk, valueFormatter, batchSize);
    files.push({ file: path.basename(filepath), records: count });
    fileIndex++;
  }
  return files;
}

// ============================================================
// 1. ROMBEL
// ============================================================
console.log('Exporting Rombel...');
const rombels = db.prepare('SELECT * FROM Rombel ORDER BY id').all();
const rombelColumns = ['id', 'nama', 'kelas', 'jurusan', 'tahunajaran', 'walikelas', 'createdat', 'updatedat'];
const rombelFormatter = (row) => {
  return [
    escStr(row.id),
    escStr(row.nama),
    escNum(row.kelas),
    escStr(row.jurusan),
    escStr(row.tahunAjaran),
    escStr(row.waliKelas),
    escTimestamp(row.createdAt),
    escTimestamp(row.updatedAt),
  ].join(',');
};
const rombelCount = writeMultiRowInsert(
  path.join(OUTPUT_DIR, '01_rombel.sql'),
  'rombel', rombelColumns, rombels, rombelFormatter
);
console.log(`  Rombel: ${rombelCount} records`);

// ============================================================
// 2. SISWA
// ============================================================
console.log('Exporting Siswa...');
const siswas = db.prepare('SELECT * FROM Siswa ORDER BY id').all();
const siswaColumns = ['id', 'nis', 'nisn', 'nama', 'jeniskelamin', 'tempatlahir', 'tanggallahir', 'rombelid', 'createdat', 'updatedat'];
const siswaFormatter = (row) => {
  return [
    escStr(row.id),
    escStr(row.nis),
    escStr(row.nisn),
    escStr(row.nama),
    escStr(row.jenisKelamin),
    escStr(row.tempatLahir),
    escStr(row.tanggalLahir),
    escStr(row.rombelId),
    escTimestamp(row.createdAt),
    escTimestamp(row.updatedAt),
  ].join(',');
};
// 818 records in one file is fine for Supabase SQL Editor
const siswaCount = writeMultiRowInsert(
  path.join(OUTPUT_DIR, '02_siswa.sql'),
  'siswa', siswaColumns, siswas, siswaFormatter, 500
);
console.log(`  Siswa: ${siswaCount} records`);

// ============================================================
// 3. NILAI (split into ~1500 records per file)
// ============================================================
console.log('Exporting Nilai...');
const nilais = db.prepare('SELECT * FROM Nilai ORDER BY id').all();
const nilaiColumns = ['id', 'siswaid', 'matapelajaran', 'smt1', 'smt2', 'smt3', 'smt4', 'smt5', 'smt6', 'rerata', 'createdat', 'updatedat'];
const nilaiFormatter = (row) => {
  return [
    escStr(row.id),
    escStr(row.siswaId),
    escStr(row.mataPelajaran),
    escNum(row.smt1),
    escNum(row.smt2),
    escNum(row.smt3),
    escNum(row.smt4),
    escNum(row.smt5),
    escNum(row.smt6),
    escNum(row.rerata),
    escTimestamp(row.createdAt),
    escTimestamp(row.updatedAt),
  ].join(',');
};
const nilaiFiles = writeMultiRowInsertSplit(
  path.join(OUTPUT_DIR, '03_nilai_part'), '.sql',
  'nilai', nilaiColumns, nilais, nilaiFormatter, 500, 1500
);
console.log(`  Nilai: ${nilais.length} records in ${nilaiFiles.length} file(s)`);

// ============================================================
// 4. ELIGIBLE
// ============================================================
console.log('Exporting Eligible...');
const eligibles = db.prepare('SELECT * FROM Eligible ORDER BY id').all();
const eligibleColumns = ['id', 'siswaid', 'status', 'keterangan', 'createdat', 'updatedat'];
const eligibleFormatter = (row) => {
  return [
    escStr(row.id),
    escStr(row.siswaId),
    escStr(row.status),
    escStr(row.keterangan),
    escTimestamp(row.createdAt),
    escTimestamp(row.updatedAt),
  ].join(',');
};
const eligibleCount = writeMultiRowInsert(
  path.join(OUTPUT_DIR, '04_eligible.sql'),
  'eligible', eligibleColumns, eligibles, eligibleFormatter
);
console.log(`  Eligible: ${eligibleCount} records`);

// ============================================================
// 5. TKA
// ============================================================
console.log('Exporting TKA...');
const tkas = db.prepare('SELECT * FROM TKA ORDER BY id').all();
const tkaColumns = ['id', 'siswaid', 'nomorpeserta', 'tanggalpelaksanaan', 'bindonilai', 'bindokategori', 'matnilai', 'matkategori', 'bingnilai', 'bingkategori', 'pilihan1nama', 'pilihan1nilai', 'pilihan1kategori', 'pilihan2nama', 'pilihan2nilai', 'pilihan2kategori', 'tkaid', 'createdat', 'updatedat'];
const tkaFormatter = (row) => {
  return [
    escStr(row.id),
    escStr(row.siswaId),
    escStr(row.nomorPeserta),
    escStr(row.tanggalPelaksanaan),
    escNum(row.bindoNilai),
    escStr(row.bindoKategori),
    escNum(row.matNilai),
    escStr(row.matKategori),
    escNum(row.bingNilai),
    escStr(row.bingKategori),
    escStr(row.pilihan1Nama),
    escNum(row.pilihan1Nilai),
    escStr(row.pilihan1Kategori),
    escStr(row.pilihan2Nama),
    escNum(row.pilihan2Nilai),
    escStr(row.pilihan2Kategori),
    escStr(row.tkaId),
    escTimestamp(row.createdAt),
    escTimestamp(row.updatedAt),
  ].join(',');
};
const tkaCount = writeMultiRowInsert(
  path.join(OUTPUT_DIR, '05_tka.sql'),
  'tka', tkaColumns, tkas, tkaFormatter
);
console.log(`  TKA: ${tkaCount} records`);

// ============================================================
// Summary
// ============================================================
console.log('\n=== MIGRATION SUMMARY ===');
console.log(`Rombel:   ${rombelCount} records -> 01_rombel.sql`);
console.log(`Siswa:    ${siswaCount} records -> 02_siswa.sql`);
nilaiFiles.forEach(f => console.log(`Nilai:    ${f.records} records -> ${f.file}`));
console.log(`Eligible: ${eligibleCount} records -> 04_eligible.sql`);
console.log(`TKA:      ${tkaCount} records -> 05_tka.sql`);

// List file sizes
console.log('\n=== FILE SIZES ===');
const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.sql')).sort();
files.forEach(f => {
  const stat = fs.statSync(path.join(OUTPUT_DIR, f));
  console.log(`${f}: ${(stat.size / 1024).toFixed(1)} KB`);
});

db.close();
console.log('\nDone!');
