import { db } from '../src/lib/db'

async function seed() {
  console.log('Seeding database...')

  // Create Rombel
  const rombelData = [
    { nama: 'X IPA 1', kelas: 10, jurusan: 'IPA', tahunAjaran: '2024/2025', waliKelas: 'Budi Santoso' },
    { nama: 'X IPS 1', kelas: 10, jurusan: 'IPS', tahunAjaran: '2024/2025', waliKelas: 'Ahmad Hidayat' },
    { nama: 'XI IPA 1', kelas: 11, jurusan: 'IPA', tahunAjaran: '2024/2025', waliKelas: 'Dewi Lestari' },
    { nama: 'XI IPS 1', kelas: 11, jurusan: 'IPS', tahunAjaran: '2024/2025', waliKelas: 'Rina Wulandari' },
    { nama: 'XII IPA 1', kelas: 12, jurusan: 'IPA', tahunAjaran: '2024/2025', waliKelas: 'Dr. Surya Putra' },
    { nama: 'XII IPA 2', kelas: 12, jurusan: 'IPA', tahunAjaran: '2024/2025', waliKelas: 'Maya Sari' },
    { nama: 'XII IPS 1', kelas: 12, jurusan: 'IPS', tahunAjaran: '2024/2025', waliKelas: 'Joko Widodo' },
  ]

  const rombels = []
  for (const r of rombelData) {
    const rombel = await db.rombel.create({ data: r })
    rombels.push(rombel)
  }
  console.log(`Created ${rombels.length} rombel`)

  // Create Siswa - distribute across all rombels including kelas 12
  const lNames = ['Andi', 'Cahyo', 'Eko', 'Galih', 'Irfan', 'Kevin', 'Muhammad', 'Omar', 'Rizky', 'Taufik', 'Umar', 'Wahyu', 'Yusuf', 'Arif', 'Dimas', 'Fajar', 'Hendro', 'Lukman', 'Naufal', 'Joko', 'Bintang', 'Fikri', 'Maulana', 'Hakim', 'Farhan', 'Abdullah', 'Setiawan', 'Ibrahim', 'Rahman', 'Prayoga', 'Pratama', 'Prasetyo', 'Ramadhan', 'Aditya', 'Sidiq', 'Wicaksono', 'Susanto']

  // Students per rombel - heavier for kelas 12 to demo eligible
  const rombelSiswaCounts = [5, 4, 5, 4, 8, 7, 7]

  const allSiswaData: { nama: string; rombelIdx: number }[] = []
  const namaList = [
    'Andi Pratama', 'Bella Safitri', 'Cahyo Nugroho', 'Dina Mariana', 'Eko Prasetyo',
    'Fitri Handayani', 'Galih Ramadhan', 'Hana Pertiwi', 'Irfan Hakim', 'Jasmine Aulia',
    'Kevin Aditya', 'Laras Kinanti', 'Muhammad Farhan', 'Nadia Azizah', 'Omar Fikri',
    'Putri Maharani', 'Qori Annisa', 'Rizky Maulana', 'Sinta Dewi', 'Taufik Hidayat',
    'Umar Abdullah', 'Vina Oktavia', 'Wahyu Setiawan', 'Xena Valentina', 'Yusuf Ibrahim',
    'Zahra Amelia', 'Arif Rahman', 'Bintang Perkasa', 'Citra Dewanti', 'Dimas Prayoga',
    'Elsa Maharani', 'Fajar Sidiq', 'Gita Nirmala', 'Hendro Wicaksono', 'Indah Permata',
    'Joko Susanto', 'Kartika Sari', 'Lukman Hakim', 'Mega Puspita', 'Naufal Rizki',
  ]

  let idx = 0
  for (let r = 0; r < rombelSiswaCounts.length; r++) {
    for (let s = 0; s < rombelSiswaCounts[r] && idx < namaList.length; s++) {
      allSiswaData.push({ nama: namaList[idx++], rombelIdx: r })
    }
  }

  let nisCounter = 10001
  const siswaList: { id: string; rombel: { kelas: number; jurusan: string } }[] = []

  for (const item of allSiswaData) {
    const rombel = rombels[item.rombelIdx]
    const jenisKelamin = lNames.some(n => item.nama.startsWith(n)) ? 'L' : 'P'

    const siswa = await db.siswa.create({
      data: {
        nis: String(nisCounter++),
        nama: item.nama,
        jenisKelamin,
        rombelId: rombel.id,
      },
    })
    siswaList.push({ ...siswa, rombel: { kelas: rombel.kelas, jurusan: rombel.jurusan } })
  }
  console.log(`Created ${siswaList.length} siswa`)

  // Create Nilai
  const mapelIPA = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Fisika', 'Kimia', 'Biologi', 'Sejarah', 'PKN', 'Seni Budaya', 'PJOK']
  const mapelIPS = ['Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Ekonomi', 'Sosiologi', 'Geografi', 'Sejarah', 'PKN', 'Seni Budaya', 'PJOK']

  let nilaiCount = 0
  for (const siswa of siswaList) {
    const mapels = siswa.rombel.jurusan === 'IPA' ? mapelIPA : mapelIPS

    for (const mapel of mapels) {
      const base = Math.random() * 40 + 55
      const nilaiAsli = Math.round(base * 10) / 10
      const upBoost = Math.random() * 8 + 2
      const nilaiUp = Math.min(100, Math.round((nilaiAsli + upBoost) * 10) / 10)

      await db.nilai.create({
        data: {
          siswaId: siswa.id,
          mataPelajaran: mapel,
          nilaiAsli,
          nilaiUp,
          semester: '1',
          tahunAjaran: '2024/2025',
        },
      })
      nilaiCount++
    }
  }
  console.log(`Created ${nilaiCount} nilai`)

  // Create Eligible for kelas 12 students
  const kelas12Siswa = siswaList.filter(s => s.rombel.kelas === 12)

  for (const siswa of kelas12Siswa) {
    const nilai = await db.nilai.findMany({ where: { siswaId: siswa.id } })
    if (nilai.length === 0) continue
    const rataRata = nilai.reduce((sum, n) => sum + n.nilaiAsli, 0) / nilai.length
    const diBawahKKM = nilai.filter(n => n.nilaiAsli < 60).length

    let status: string
    let keterangan: string

    if (rataRata >= 75 && diBawahKKM === 0) {
      status = 'eligible'
      keterangan = `Rata-rata ${rataRata.toFixed(1)}, tidak ada nilai di bawah KKM`
    } else if (rataRata >= 70 && diBawahKKM <= 2) {
      status = 'bersyarat'
      keterangan = `Rata-rata ${rataRata.toFixed(1)}, ${diBawahKKM} mapel di bawah KKM`
    } else {
      status = 'tidak'
      keterangan = `Rata-rata ${rataRata.toFixed(1)}, ${diBawahKKM} mapel di bawah KKM`
    }

    await db.eligible.create({
      data: {
        siswaId: siswa.id,
        status,
        keterangan,
      },
    })
  }
  console.log(`Created ${kelas12Siswa.length} eligible records`)

  console.log('Seeding complete!')
}

seed()
  .catch(console.error)
  .finally(() => db.$disconnect())
