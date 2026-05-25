import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// ============================================================
// STUDENT REPORT API - Generates analysis data for PDF download
// Combines: grade summary, analysis, and major recommendations
// ============================================================

// Helper: verify student is logged in
async function getStudentSession(): Promise<{ id: string; type: string } | null> {
  try {
    const cookieStore = await cookies()
    const session = cookieStore.get('student-session')
    if (!session?.value) return null
    const data = JSON.parse(session.value)
    if (data.type !== 'student') return null
    return data
  } catch {
    return null
  }
}

// ---------- SUBJECT CLASSIFICATION (shared with analisa-jurusan) ----------

const IPA_WEIGHTS: Record<string, number> = {
  'matematika (umum)': 3.0,
  'matematika tingkat lanjut': 2.5,
  'fisika': 3.0,
  'kimia': 3.0,
  'biologi': 3.0,
  'informatika': 2.0,
}

const IPS_WEIGHTS: Record<string, number> = {
  'ekonomi': 3.0,
  'geografi': 3.0,
  'sosiologi': 3.0,
  'sejarah': 3.0,
}

const NEUTRAL_WEIGHTS: Record<string, { ipa: number; ips: number }> = {
  'bahasa indonesia': { ipa: 1.0, ips: 1.0 },
  'bahasa inggris': { ipa: 1.0, ips: 1.0 },
}

const EXCLUDED_PATTERNS = [
  'pendidikan agama',
  'pendidikan pancasila',
  'pendidikan jasmani',
  'olahraga',
  'seni',
  'budaya',
  'prakarya',
  'project',
  'p5',
  'penguatan profil',
  'muatan lokal',
  'potensi daerah',
]

function normalizeMapel(name: string): string {
  return name.toLowerCase().trim()
}

function isExcluded(mapel: string): boolean {
  const lower = normalizeMapel(mapel)
  return EXCLUDED_PATTERNS.some(p => lower.includes(p))
}

function getSubjectCategory(mapel: string): {
  type: 'ipa' | 'ips' | 'neutral' | 'excluded'
  ipaWeight: number
  ipsWeight: number
} {
  if (isExcluded(mapel)) return { type: 'excluded', ipaWeight: 0, ipsWeight: 0 }
  const lower = normalizeMapel(mapel)
  for (const [key, weight] of Object.entries(IPA_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { type: 'ipa', ipaWeight: weight, ipsWeight: 0 }
    }
  }
  for (const [key, weight] of Object.entries(IPS_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { type: 'ips', ipaWeight: 0, ipsWeight: weight }
    }
  }
  for (const [key, weights] of Object.entries(NEUTRAL_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { type: 'neutral', ipaWeight: weights.ipa, ipsWeight: weights.ips }
    }
  }
  return { type: 'neutral', ipaWeight: 0.5, ipsWeight: 0.5 }
}

function calculateWeightedAverage(subjects: { rerata: number; weight: number }[]): number {
  const totalWeight = subjects.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight === 0) return 0
  return subjects.reduce((sum, s) => sum + s.rerata * s.weight, 0) / totalWeight
}

function calculateConsistency(values: number[]): number {
  if (values.length <= 1) return 1
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  if (mean === 0) return 0
  const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  const stddev = Math.sqrt(variance)
  const cv = stddev / mean
  return Math.max(0, Math.min(1, 1 - cv))
}

// ---------- MAJOR WEIGHTS (for Kelas XI/XII) ----------

const IPA_MAJOR_WEIGHTS: Record<string, Record<string, number>> = {
  'Teknik & Teknologi': { 'fisika': 3.5, 'matematika (umum)': 3.0, 'matematika tingkat lanjut': 3.0, 'informatika': 2.5, 'kimia': 2.0, 'bahasa inggris': 1.5, 'bahasa indonesia': 1.0 },
  'Kedokteran & Kesehatan': { 'biologi': 3.5, 'kimia': 3.0, 'matematika (umum)': 2.0, 'fisika': 2.0, 'bahasa inggris': 1.5, 'bahasa indonesia': 1.0 },
  'Farmasi & Kimia Terapan': { 'kimia': 3.5, 'biologi': 3.0, 'matematika (umum)': 2.0, 'fisika': 1.5, 'bahasa inggris': 1.5, 'bahasa indonesia': 1.0 },
  'Matematika & Ilmu Komputer': { 'matematika (umum)': 3.5, 'matematika tingkat lanjut': 3.5, 'informatika': 3.0, 'fisika': 2.0, 'bahasa inggris': 1.5, 'bahasa indonesia': 1.0 },
  'Ilmu Alam & Lingkungan': { 'biologi': 3.0, 'kimia': 2.5, 'fisika': 2.0, 'geografi': 2.0, 'matematika (umum)': 2.0, 'bahasa inggris': 1.5, 'bahasa indonesia': 1.0 },
  'Teknik Informatika & Sistem Informasi': { 'informatika': 3.5, 'matematika (umum)': 3.0, 'matematika tingkat lanjut': 3.0, 'fisika': 2.0, 'bahasa inggris': 2.0, 'bahasa indonesia': 1.0 },
  'Arsitektur & Desain': { 'fisika': 3.0, 'matematika (umum)': 3.0, 'matematika tingkat lanjut': 2.5, 'seni': 2.0, 'informatika': 1.5, 'bahasa inggris': 1.0 },
  'Keperawatan & Kebidanan': { 'biologi': 3.5, 'kimia': 2.5, 'bahasa indonesia': 2.0, 'bahasa inggris': 1.5, 'matematika (umum)': 1.5 },
  'Gizi & Kesehatan Masyarakat': { 'biologi': 3.0, 'kimia': 2.5, 'matematika (umum)': 2.0, 'bahasa indonesia': 2.0, 'ekonomi': 1.5, 'bahasa inggris': 1.5 },
  'Bioteknologi & Ilmu Genetik': { 'biologi': 3.5, 'kimia': 3.0, 'matematika (umum)': 2.5, 'fisika': 2.0, 'bahasa inggris': 2.0, 'informatika': 1.5 },
}

const IPS_MAJOR_WEIGHTS: Record<string, Record<string, number>> = {
  'Ekonomi & Bisnis': { 'ekonomi': 3.5, 'matematika (umum)': 2.5, 'bahasa inggris': 2.0, 'sosiologi': 1.5, 'geografi': 1.5, 'bahasa indonesia': 1.0 },
  'Hukum': { 'sejarah': 3.0, 'bahasa indonesia': 3.0, 'sosiologi': 2.5, 'ekonomi': 1.5, 'bahasa inggris': 1.5 },
  'Ilmu Komunikasi': { 'bahasa indonesia': 3.0, 'bahasa inggris': 3.0, 'sosiologi': 2.5, 'sejarah': 1.5, 'ekonomi': 1.0 },
  'Psikologi': { 'biologi': 2.5, 'sosiologi': 3.0, 'matematika (umum)': 2.0, 'bahasa indonesia': 2.0, 'bahasa inggris': 1.5 },
  'Hubungan Internasional & Sosial Politik': { 'bahasa inggris': 3.5, 'geografi': 3.0, 'sejarah': 2.5, 'sosiologi': 2.5, 'bahasa indonesia': 2.0, 'ekonomi': 1.5 },
  'Pendidikan': { 'bahasa indonesia': 3.0, 'matematika (umum)': 2.0, 'sosiologi': 2.0, 'sejarah': 2.0, 'bahasa inggris': 1.5, 'ekonomi': 1.5 },
  'Akuntansi & Keuangan': { 'ekonomi': 3.5, 'matematika (umum)': 3.0, 'bahasa inggris': 2.0, 'bahasa indonesia': 1.5, 'sosiologi': 1.0 },
  'Administrasi Publik & Pemerintahan': { 'sosiologi': 3.0, 'sejarah': 2.5, 'ekonomi': 2.5, 'bahasa indonesia': 2.0, 'geografi': 2.0, 'bahasa inggris': 1.5 },
  'Pariwisata & Perhotelan': { 'bahasa inggris': 3.5, 'geografi': 3.0, 'bahasa indonesia': 2.5, 'ekonomi': 2.0, 'sejarah': 1.5, 'sosiologi': 1.0 },
  'Kriminologi & Kepolisian': { 'sosiologi': 3.0, 'bahasa indonesia': 3.0, 'sejarah': 2.5, 'ekonomi': 1.5, 'bahasa inggris': 1.5, 'matematika (umum)': 1.5 },
}

const CORE_IPA_WEIGHTS: Record<string, number> = {
  'matematika (umum)': 2.0, 'matematika tingkat lanjut': 2.5, 'fisika': 3.0, 'kimia': 3.0, 'biologi': 3.0, 'informatika': 2.0,
}

const CORE_IPS_WEIGHTS: Record<string, number> = {
  'ekonomi': 3.0, 'geografi': 3.0, 'sosiologi': 3.0, 'sejarah': 2.5,
}

const MAJOR_SPECIFIC_JURUSAN: Record<string, { jurusan: string; deskripsi: string; prospek: string }[]> = {
  'Teknik & Teknologi': [
    { jurusan: 'Teknik Sipil', deskripsi: 'Merancang dan membangun infrastruktur', prospek: 'Konsultan, kontraktor, BUMN' },
    { jurusan: 'Teknik Mesin', deskripsi: 'Desain dan manufaktur alat/mesin', prospek: 'Manufaktur, otomotif, energi' },
    { jurusan: 'Teknik Elektro', deskripsi: 'Sistem kelistrikan dan elektronika', prospek: 'PLN, telekomunikasi, industri' },
    { jurusan: 'Teknik Industri', deskripsi: 'Optimalisasi sistem produksi', prospek: 'Manufaktur, logistik, konsultan' },
  ],
  'Kedokteran & Kesehatan': [
    { jurusan: 'Pendidikan Dokter (MD)', deskripsi: 'Menjadi dokter umum/spesialis', prospek: 'RS, klinik, praktek pribadi' },
    { jurusan: 'Kesehatan Masyarakat', deskripsi: 'Promosi dan pencegahan penyakit', prospek: 'Dinkes, WHO, NGO kesehatan' },
  ],
  'Farmasi & Kimia Terapan': [
    { jurusan: 'Farmasi', deskripsi: 'Riset dan produksi obat', prospek: 'Industri farmasi, RS, apotek' },
    { jurusan: 'Kimia', deskripsi: 'Riset dan analisis bahan kimia', prospek: 'Riset, industri, laboratorium' },
  ],
  'Matematika & Ilmu Komputer': [
    { jurusan: 'Ilmu Komputer', deskripsi: 'Teori komputasi dan algoritma', prospek: 'Software engineer, riset AI' },
    { jurusan: 'Statistika', deskripsi: 'Analisis data dan probabilitas', prospek: 'BPS, bank, riset pasar' },
    { jurusan: 'Data Science', deskripsi: 'Analisis big data dan machine learning', prospek: 'Tech company, fintech' },
  ],
  'Ilmu Alam & Lingkungan': [
    { jurusan: 'Biologi', deskripsi: 'Studi makhluk hidup dan ekosistem', prospek: 'Riset, konservasi, bioteknologi' },
    { jurusan: 'Ilmu Lingkungan', deskripsi: 'Pengelolaan dan konservasi lingkungan', prospek: 'KLHK, NGO, konsultan' },
  ],
  'Teknik Informatika & Sistem Informasi': [
    { jurusan: 'Teknik Informatika', deskripsi: 'Pengembangan software dan sistem', prospek: 'Software engineer, startup, tech' },
    { jurusan: 'Sistem Informasi', deskripsi: 'Manajemen sistem informasi bisnis', prospek: 'IT consultant, business analyst' },
    { jurusan: 'Teknologi Informasi', deskripsi: 'Infrastruktur dan layanan IT', prospek: 'Network engineer, cloud, cybersecurity' },
  ],
  'Arsitektur & Desain': [
    { jurusan: 'Arsitektur', deskripsi: 'Merancang bangunan dan ruang', prospek: 'Konsultan arsitektur, developer' },
    { jurusan: 'Desain Komunikasi Visual', deskripsi: 'Desain grafis dan media visual', prospek: 'Agency, media, freelance' },
  ],
  'Keperawatan & Kebidanan': [
    { jurusan: 'Keperawatan', deskripsi: 'Perawatan pasien dan asuhan keperawatan', prospek: 'RS, klinik, home care' },
    { jurusan: 'Kebidanan', deskripsi: 'Pelayanan kesehatan ibu dan bayi', prospek: 'RS, puskesmas, praktek mandiri' },
  ],
  'Gizi & Kesehatan Masyarakat': [
    { jurusan: 'Ilmu Gizi', deskripsi: 'Nutrisi dan diet untuk kesehatan', prospek: 'RS, klinik gizi, industri makanan' },
    { jurusan: 'Kesehatan Masyarakat', deskripsi: 'Promosi dan pencegahan penyakit', prospek: 'Dinkes, WHO, NGO' },
  ],
  'Bioteknologi & Ilmu Genetik': [
    { jurusan: 'Bioteknologi', deskripsi: 'Penerapan biologi dalam teknologi', prospek: 'Farmasi, pertanian, kesehatan' },
    { jurusan: 'Genetika', deskripsi: 'Studi gen dan pewarisan sifat', prospek: 'Riset medis, bioteknologi' },
  ],
  'Ekonomi & Bisnis': [
    { jurusan: 'Manajemen', deskripsi: 'Pengelolaan bisnis dan organisasi', prospek: 'Perusahaan, startup, konsultan' },
    { jurusan: 'Ekonomi Pembangunan', deskripsi: 'Analisis kebijakan ekonomi', prospek: 'Bank Indonesia, Bappenas' },
    { jurusan: 'Bisnis Digital', deskripsi: 'Bisnis berbasis teknologi digital', prospek: 'Startup, e-commerce, fintech' },
  ],
  'Hukum': [
    { jurusan: 'Ilmu Hukum', deskripsi: 'Studi hukum dan peraturan', prospek: 'Advokat, notaris, hakim, jaksa' },
    { jurusan: 'Hukum Bisnis', deskripsi: 'Hukum terkait dunia bisnis', prospek: 'Legal counsel, firma hukum' },
  ],
  'Ilmu Komunikasi': [
    { jurusan: 'Ilmu Komunikasi', deskripsi: 'Teori dan praktik komunikasi massa', prospek: 'Media, PR, advertising' },
    { jurusan: 'Jurnalistik', deskripsi: 'Peliputan dan pemberitaan', prospek: 'Media massa, online media' },
  ],
  'Psikologi': [
    { jurusan: 'Psikologi', deskripsi: 'Studi perilaku dan mental manusia', prospek: 'Klinis, HR, konsultan' },
    { jurusan: 'Psikologi Klinis', deskripsi: 'Diagnosa dan terapi gangguan mental', prospek: 'RS, klinik psikologi' },
  ],
  'Hubungan Internasional & Sosial Politik': [
    { jurusan: 'Hubungan Internasional', deskripsi: 'Diplomasi dan kerjasama internasional', prospek: 'Kemlu, NGO internasional, PBB' },
    { jurusan: 'Ilmu Politik', deskripsi: 'Sistem politik dan pemerintahan', prospek: 'Legislatif, partai, think tank' },
  ],
  'Pendidikan': [
    { jurusan: 'Pendidikan Ekonomi', deskripsi: 'Mengajarkan ilmu ekonomi', prospek: 'Guru, dosen, pendidik' },
    { jurusan: 'Manajemen Pendidikan', deskripsi: 'Pengelolaan institusi pendidikan', prospek: 'Kepala sekolah, yayasan' },
  ],
  'Akuntansi & Keuangan': [
    { jurusan: 'Akuntansi', deskripsi: 'Pencatatan dan pelaporan keuangan', prospek: 'KAP, perusahaan, bank' },
    { jurusan: 'Keuangan', deskripsi: 'Manajemen keuangan dan investasi', prospek: 'Bank, sekuritas, asuransi' },
  ],
  'Administrasi Publik & Pemerintahan': [
    { jurusan: 'Administrasi Publik', deskripsi: 'Manajemen pemerintahan dan publik', prospek: 'PNS, pemerintah daerah, BUMN' },
    { jurusan: 'Kebijakan Publik', deskripsi: 'Analisis dan formulasi kebijakan', prospek: 'Think tank, pemerintah, riset' },
  ],
  'Pariwisata & Perhotelan': [
    { jurusan: 'Manajemen Pariwisata', deskripsi: 'Pengelolaan industri wisata', prospek: 'Travel, hotel, Dinas Pariwisata' },
    { jurusan: 'Perhotelan', deskripsi: 'Manajemen hotel dan akomodasi', prospek: 'Hotel, resort, restoran' },
  ],
  'Kriminologi & Kepolisian': [
    { jurusan: 'Kriminologi', deskripsi: 'Studi kejahatan dan pencegahannya', prospek: 'Kepolisian, attorney, BNN' },
    { jurusan: 'Forensik Digital', deskripsi: 'Investigasi kejahatan siber', prospek: 'Cyber crime, BSSN, tech company' },
  ],
}

function calculateMajorScores(
  nilaiMap: Map<string, number>,
  majorWeights: Record<string, Record<string, number>>
): { nama: string; skor: number; mapelDetail: { mapel: string; rerata: number; weight: number; contribution: number }[]; specificJurusan?: { jurusan: string; deskripsi: string; prospek: string }[] }[] {
  const scores: { nama: string; skor: number; mapelDetail: { mapel: string; rerata: number; weight: number; contribution: number }[]; specificJurusan?: { jurusan: string; deskripsi: string; prospek: string }[] }[] = []

  for (const [majorName, weights] of Object.entries(majorWeights)) {
    const mapelDetail: { mapel: string; rerata: number; weight: number; contribution: number }[] = []
    let totalWeight = 0
    let weightedSum = 0

    for (const [mapelKey, weight] of Object.entries(weights)) {
      let matchedValue = 0
      for (const [nilaiMapel, nilaiRerata] of nilaiMap) {
        const lower = normalizeMapel(nilaiMapel)
        if (lower.includes(mapelKey) || mapelKey.includes(lower)) {
          matchedValue = nilaiRerata
          break
        }
      }

      if (matchedValue > 0) {
        const contribution = matchedValue * weight
        weightedSum += contribution
        totalWeight += weight
        mapelDetail.push({
          mapel: mapelKey,
          rerata: matchedValue,
          weight,
          contribution: Math.round(contribution * 10) / 10,
        })
      }
    }

    const skor = totalWeight > 0 ? weightedSum / totalWeight : 0

    scores.push({
      nama: majorName,
      skor: Math.round(skor * 10) / 10,
      mapelDetail: mapelDetail.sort((a, b) => b.weight - a.weight),
      specificJurusan: MAJOR_SPECIFIC_JURUSAN[majorName],
    })
  }

  return scores.sort((a, b) => b.skor - a.skor)
}

function calculateTrackInclination(
  nilaiMap: Map<string, number>
): { ipa: number; ips: number; dominant: 'IPA' | 'IPS' | 'Seimbang' } {
  const ipaItems: { rerata: number; weight: number }[] = []
  const ipsItems: { rerata: number; weight: number }[] = []

  for (const [mapel, rerata] of nilaiMap) {
    const lower = normalizeMapel(mapel)
    for (const [key, weight] of Object.entries(CORE_IPA_WEIGHTS)) {
      if (lower.includes(key) || key.includes(lower)) {
        ipaItems.push({ rerata, weight })
        break
      }
    }
    for (const [key, weight] of Object.entries(CORE_IPS_WEIGHTS)) {
      if (lower.includes(key) || key.includes(lower)) {
        ipsItems.push({ rerata, weight })
        break
      }
    }
  }

  const ipaScore = calculateWeightedAverage(ipaItems)
  const ipsScore = calculateWeightedAverage(ipsItems)
  const gap = ipaScore - ipsScore
  const ipaPct = Math.round(Math.min(85, Math.max(15, 50 + gap * 2)))
  const ipsPct = 100 - ipaPct

  let dominant: 'IPA' | 'IPS' | 'Seimbang' = 'Seimbang'
  if (gap > 3) dominant = 'IPA'
  else if (gap < -3) dominant = 'IPS'

  return { ipa: ipaPct, ips: ipsPct, dominant }
}

// ---------- V2 Multi-factor for Kelas X ----------

interface FactorInput {
  ipaScore: number; ipsScore: number; ipaIpsGap: number; overallAvg: number
  ipaSubjects: { mapel: string; rerata: number; weight: number }[]
  ipsSubjects: { mapel: string; rerata: number; weight: number }[]
  neutralSubjects: { mapel: string; rerata: number }[]
  semesterTrend: { ipaTrend: number; ipsTrend: number }
  hasMinIpa: boolean; hasMinIps: boolean
}

function calculateMultiFactorScores(input: FactorInput) {
  const { ipaScore, ipsScore, ipaIpsGap, overallAvg, ipaSubjects, ipsSubjects, semesterTrend, hasMinIpa, hasMinIps } = input

  let gapScore = 0
  if (hasMinIpa && hasMinIps) {
    gapScore = Math.sign(ipaIpsGap) * Math.min(5, Math.abs(ipaIpsGap) * 0.75)
  } else if (hasMinIpa && !hasMinIps) {
    gapScore = ipaScore >= 70 ? 1.5 : 0
  } else if (!hasMinIpa && hasMinIps) {
    gapScore = ipsScore >= 70 ? -1.5 : 0
  }

  let dominanceScore = 0
  if (overallAvg > 0 && ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    const ipaAboveAvg = ipaSubjects.filter(s => s.rerata > overallAvg).length
    const ipsAboveAvg = ipsSubjects.filter(s => s.rerata > overallAvg).length
    const countDiff = ipaAboveAvg - ipsAboveAvg
    const ipaRatio = ipaAboveAvg / ipaSubjects.length
    const ipsRatio = ipsAboveAvg / ipsSubjects.length
    const ratioDiff = ipaRatio - ipsRatio
    dominanceScore = Math.sign(countDiff || ratioDiff) * Math.min(3, Math.abs(countDiff) * 0.6 + Math.abs(ratioDiff) * 1.5)
  }

  let topNScore = 0
  if (ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    const allRanked = [
      ...ipaSubjects.map(s => ({ type: 'ipa' as const, rerata: s.rerata })),
      ...ipsSubjects.map(s => ({ type: 'ips' as const, rerata: s.rerata })),
    ].sort((a, b) => b.rerata - a.rerata)
    const topN = allRanked.slice(0, Math.min(3, allRanked.length))
    if (topN.length > 0) {
      const ipaInTop = topN.filter(s => s.type === 'ipa').length
      const ipsInTop = topN.filter(s => s.type === 'ips').length
      topNScore = (ipaInTop - ipsInTop) / topN.length * 3
    }
  }

  let strengthDiffScore = 0
  if (ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    const bestIpa = Math.max(...ipaSubjects.map(s => s.rerata))
    const bestIps = Math.max(...ipsSubjects.map(s => s.rerata))
    const strengthDiff = bestIpa - bestIps
    strengthDiffScore = Math.sign(strengthDiff) * Math.min(3, Math.abs(strengthDiff) * 0.5)
  }

  let trendScore = 0
  if (semesterTrend.ipaTrend !== 0 || semesterTrend.ipsTrend !== 0) {
    const trendDiff = semesterTrend.ipaTrend - semesterTrend.ipsTrend
    trendScore = Math.sign(trendDiff) * Math.min(2, Math.abs(trendDiff) * 0.5)
  }

  const compositeScore = gapScore * 0.20 + dominanceScore * 0.30 + topNScore * 0.25 + strengthDiffScore * 0.15 + trendScore * 0.10

  return {
    gapScore: Math.round(gapScore * 100) / 100,
    dominanceScore: Math.round(dominanceScore * 100) / 100,
    topNScore: Math.round(topNScore * 100) / 100,
    strengthDiffScore: Math.round(strengthDiffScore * 100) / 100,
    trendScore: Math.round(trendScore * 100) / 100,
    compositeScore: Math.round(compositeScore * 100) / 100,
  }
}

function determineRecommendationV2(
  factorScores: { compositeScore: number },
  ipaSubjectCount: number,
  ipsSubjectCount: number,
  ipaScore: number,
  ipsScore: number,
): string {
  const { compositeScore } = factorScores
  const hasMinIpa = ipaSubjectCount >= 2
  const hasMinIps = ipsSubjectCount >= 2
  if (!hasMinIpa && !hasMinIps) return 'Netral'
  if (!hasMinIpa && hasMinIps) return ipsScore >= 70 ? 'Cenderung IPS' : 'Netral'
  if (hasMinIpa && !hasMinIps) return ipaScore >= 70 ? 'Cenderung IPA' : 'Netral'
  if (compositeScore > 3.0) return 'Sangat Cocok IPA'
  if (compositeScore > 1.5) return 'Cocok IPA'
  if (compositeScore > 0.5) return 'Cenderung IPA'
  if (compositeScore >= -0.5) return 'Netral'
  if (compositeScore >= -1.5) return 'Cenderung IPS'
  if (compositeScore >= -3.0) return 'Cocok IPS'
  return 'Sangat Cocok IPS'
}

// ---------- MAIN API HANDLER ----------

export async function GET(request: Request) {
  try {
    const student = await getStudentSession()
    if (!student) {
      return NextResponse.json({ error: 'Siswa belum login' }, { status: 401 })
    }

    const siswaid = student.id

    // Get student data with rombel
    const siswa = await db.siswa.findFirst({
      where: { id: siswaid },
      include: { rombel: true },
    })

    if (!siswa) {
      return NextResponse.json({ error: 'Siswa tidak ditemukan' }, { status: 404 })
    }

    // Get all nilai for this student
    const nilaiList = await db.nilai.findMany({
      where: { siswaid },
      orderBy: [{ matapelajaran: 'asc' }],
    })

    if (nilaiList.length === 0) {
      return NextResponse.json({ error: 'Belum ada data nilai. Silakan isi nilai terlebih dahulu.' }, { status: 400 })
    }

    // Get TKA data if available (Kelas XII)
    let tkaData: Record<string, any> | null = null
    const kelas = siswa.rombel?.kelas || 10
    if (kelas === 12) {
      try {
        const tka = await db.tKA.findFirst({ where: { siswaid } })
        if (tka) {
          tkaData = {
            bindoNilai: tka.bindonilai,
            bindoKategori: tka.bindokategori,
            matNilai: tka.matnilai,
            matKategori: tka.matkategori,
            bingNilai: tka.bingnilai,
            bingKategori: tka.bingkategori,
            pilihan1Nama: tka.pilihan1nama,
            pilihan1Nilai: tka.pilihan1nilai,
            pilihan1Kategori: tka.pilihan1kategori,
            pilihan2Nama: tka.pilihan2nama,
            pilihan2Nilai: tka.pilihan2nilai,
            pilihan2Kategori: tka.pilihan2kategori,
          }
        }
      } catch {
        // TKA table might not have data
      }
    }

    // Get eligible data
    let eligibleData: { status: string; keterangan: string } | null = null
    try {
      const eligible = await db.eligible.findFirst({ where: { siswaid } })
      if (eligible) {
        eligibleData = { status: eligible.status, keterangan: eligible.keterangan }
      }
    } catch {
      // Eligible table might not have data
    }

    // ---------- BUILD GRADE SUMMARY ----------
    const gradeSummary = nilaiList.map(n => ({
      matapelajaran: n.matapelajaran,
      smt1: n.smt1,
      smt2: n.smt2,
      smt3: n.smt3,
      smt4: n.smt4,
      smt5: n.smt5,
      smt6: n.smt6,
      rerata: n.rerata,
      category: getSubjectCategory(n.matapelajaran).type,
    }))

    // Calculate overall average
    const allScores = nilaiList.map(n => n.rerata).filter(v => v > 0)
    const overallAvg = allScores.length > 0
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length * 10) / 10
      : 0

    // Subject distribution by category
    const ipaSubjects = gradeSummary.filter(g => g.category === 'ipa')
    const ipsSubjects = gradeSummary.filter(g => g.category === 'ips')
    const neutralSubjects = gradeSummary.filter(g => g.category === 'neutral')
    const excludedSubjects = gradeSummary.filter(g => g.category === 'excluded')

    const ipaAvg = ipaSubjects.length > 0
      ? Math.round(ipaSubjects.reduce((s, g) => s + g.rerata, 0) / ipaSubjects.length * 10) / 10
      : 0
    const ipsAvg = ipsSubjects.length > 0
      ? Math.round(ipsSubjects.reduce((s, g) => s + g.rerata, 0) / ipsSubjects.length * 10) / 10
      : 0

    // Strong and weak subjects
    const strongSubjects = gradeSummary.filter(g => g.rerata >= 80).sort((a, b) => b.rerata - a.rerata)
    const weakSubjects = gradeSummary.filter(g => g.rerata > 0 && g.rerata < 60).sort((a, b) => a.rerata - b.rerata)

    // Semester trend
    const calcTrend = (records: typeof nilaiList) => {
      const firstHalf: number[] = []
      const secondHalf: number[] = []
      for (const r of records) {
        if (r.smt1 > 0) firstHalf.push(r.smt1)
        if (r.smt2 > 0) firstHalf.push(r.smt2)
        if (r.smt3 > 0) firstHalf.push(r.smt3)
        if (r.smt4 > 0) secondHalf.push(r.smt4)
        if (r.smt5 > 0) secondHalf.push(r.smt5)
        if (r.smt6 > 0) secondHalf.push(r.smt6)
      }
      if (firstHalf.length === 0 || secondHalf.length === 0) return 0
      const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
      const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
      return Math.round((avgSecond - avgFirst) * 10) / 10
    }

    const overallTrend = calcTrend(nilaiList)

    // Consistency
    const consistency = calculateConsistency(allScores)

    // ---------- GRADE DISTRIBUTION ----------
    const ranges = [
      { range: '90-100 (Sangat Baik)', min: 90, max: 100, count: 0 },
      { range: '80-89 (Baik)', min: 80, max: 89, count: 0 },
      { range: '70-79 (Cukup Baik)', min: 70, max: 79, count: 0 },
      { range: '60-69 (Cukup)', min: 60, max: 69, count: 0 },
      { range: '0-59 (Kurang)', min: 0, max: 59, count: 0 },
    ]
    for (const r of ranges) {
      r.count = gradeSummary.filter(g => g.rerata >= r.min && g.rerata <= r.max).length
    }

    // ---------- IPA/IPS ANALYSIS (Kelas X) ----------
    let jurusanAnalysis: Record<string, any> = {}

    if (kelas === 10) {
      // V2 Multi-factor analysis for Kelas X
      const ipaWeightedItems = [
        ...ipaSubjects.map(s => ({ rerata: s.rerata, weight: getSubjectCategory(s.matapelajaran).ipaWeight })),
        ...neutralSubjects.filter(v => getSubjectCategory(v.matapelajaran).ipaWeight > 0)
          .map(v => ({ rerata: v.rerata, weight: getSubjectCategory(v.matapelajaran).ipaWeight })),
      ]
      const ipsWeightedItems = [
        ...ipsSubjects.map(s => ({ rerata: s.rerata, weight: getSubjectCategory(s.matapelajaran).ipsWeight })),
        ...neutralSubjects.filter(v => getSubjectCategory(v.matapelajaran).ipsWeight > 0)
          .map(v => ({ rerata: v.rerata, weight: getSubjectCategory(v.matapelajaran).ipsWeight })),
      ]

      const ipaScore = calculateWeightedAverage(ipaWeightedItems)
      const ipsScore = calculateWeightedAverage(ipsWeightedItems)
      const ipaIpsGap = Math.round((ipaScore - ipsScore) * 10) / 10

      const ipaSubjs = ipaSubjects.map(s => ({ mapel: s.matapelajaran, rerata: s.rerata, weight: getSubjectCategory(s.matapelajaran).ipaWeight }))
      const ipsSubjs = ipsSubjects.map(s => ({ mapel: s.matapelajaran, rerata: s.rerata, weight: getSubjectCategory(s.matapelajaran).ipsWeight }))

      const ipaNilaiRecords = nilaiList.filter(n => getSubjectCategory(n.matapelajaran).type === 'ipa')
      const ipsNilaiRecords = nilaiList.filter(n => getSubjectCategory(n.matapelajaran).type === 'ips')

      const factorScores = calculateMultiFactorScores({
        ipaScore, ipsScore, ipaIpsGap, overallAvg,
        ipaSubjects: ipaSubjs, ipsSubjects: ipsSubjs, neutralSubjects: neutralSubjects.map(s => ({ mapel: s.matapelajaran, rerata: s.rerata })),
        semesterTrend: { ipaTrend: calcTrend(ipaNilaiRecords), ipsTrend: calcTrend(ipsNilaiRecords) },
        hasMinIpa: ipaSubjs.length >= 2, hasMinIps: ipsSubjs.length >= 2,
      })

      const rekomendasi = determineRecommendationV2(factorScores, ipaSubjs.length, ipsSubjs.length, ipaScore, ipsScore)

      // Calculate confidence
      const ipaCompleteness = Math.min(1, ipaSubjs.length / 4)
      const ipsCompleteness = Math.min(1, ipsSubjs.length / 4)
      const dataCompleteness = (ipaCompleteness + ipsCompleteness / 2) / 2
      const factors = [factorScores.gapScore, factorScores.dominanceScore, factorScores.topNScore, factorScores.strengthDiffScore, factorScores.trendScore]
      const positiveFactors = factors.filter(f => f > 0.1).length
      const negativeFactors = factors.filter(f => f < -0.1).length
      const totalDecisive = positiveFactors + negativeFactors
      const factorAgreement = totalDecisive > 0 ? Math.max(positiveFactors, negativeFactors) / totalDecisive : 0.5
      const compositeClarity = Math.min(1, Math.abs(factorScores.compositeScore) / 3)
      const hasTrendData = factorScores.trendScore !== 0
      const confidence = Math.round(Math.min(97, Math.max(20,
        (dataCompleteness * 0.25 + factorAgreement * 0.30 + compositeClarity * 0.25 + consistency * 0.15 + (hasTrendData ? 0.1 : 0)) * 100
      )))

      // Generate reasoning
      const reasoning: string[] = []
      if (ipaIpsGap > 0) {
        reasoning.push(`Rata-rata tertimbang IPA (${ipaScore.toFixed(1)}) lebih tinggi ${Math.abs(ipaIpsGap).toFixed(1)} poin dari IPS (${ipsScore.toFixed(1)})`)
      } else if (ipaIpsGap < 0) {
        reasoning.push(`Rata-rata tertimbang IPS (${ipsScore.toFixed(1)}) lebih tinggi ${Math.abs(ipaIpsGap).toFixed(1)} poin dari IPA (${ipaScore.toFixed(1)})`)
      } else {
        reasoning.push(`Rata-rata tertimbang IPA dan IPS seimbang`)
      }

      if (overallAvg > 0) {
        const ipaAboveAvg = ipaSubjs.filter(s => s.rerata > overallAvg).length
        const ipsAboveAvg = ipsSubjs.filter(s => s.rerata > overallAvg).length
        if (ipaAboveAvg > ipsAboveAvg) {
          reasoning.push(`Lebih banyak mapel IPA di atas rata-rata pribadi (${ipaAboveAvg}/${ipaSubjs.length}) dibanding IPS (${ipsAboveAvg}/${ipsSubjs.length})`)
        } else if (ipsAboveAvg > ipaAboveAvg) {
          reasoning.push(`Lebih banyak mapel IPS di atas rata-rata pribadi (${ipsAboveAvg}/${ipsSubjs.length}) dibanding IPA (${ipaAboveAvg}/${ipaSubjs.length})`)
        }
      }

      const allRanked = [
        ...ipaSubjs.map(s => ({ type: 'ipa' as const, mapel: s.mapel, rerata: s.rerata })),
        ...ipsSubjs.map(s => ({ type: 'ips' as const, mapel: s.mapel, rerata: s.rerata })),
      ].sort((a, b) => b.rerata - a.rerata)
      const top3 = allRanked.slice(0, 3)
      if (top3.length > 0) {
        reasoning.push(`Mapel terbaik: ${top3.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')} — ${top3.filter(s => s.type === 'ipa').length} IPA, ${top3.filter(s => s.type === 'ips').length} IPS`)
      }

      if (strongSubjects.length >= 3) {
        reasoning.push(`Memiliki ${strongSubjects.length} mapel dengan nilai sangat baik (≥80)`)
      }
      if (weakSubjects.length > 0) {
        reasoning.push(`Mapel perlu peningkatan: ${weakSubjects.map(s => `${s.matapelajaran} (${s.rerata})`).join(', ')}`)
      }
      if (rekomendasi === 'Netral') {
        reasoning.push('⚠️ Klasifikasi Netral: Data tren perkembangan belum tersedia. Disarankan input nilai lebih dari 1 semester agar analisis lebih akurat.')
      }

      jurusanAnalysis = {
        type: 'kelas10',
        ipaScore: Math.round(ipaScore * 10) / 10,
        ipsScore: Math.round(ipsScore * 10) / 10,
        ipaIpsGap,
        rekomendasi,
        confidence,
        factorScores,
        reasoning,
        ipaSubjects: ipaSubjs.sort((a, b) => b.rerata - a.rerata),
        ipsSubjects: ipsSubjs.sort((a, b) => b.rerata - a.rerata),
      }
    } else {
      // Kelas XI/XII: Major recommendation analysis
      const nilaiMap = new Map<string, number>()
      for (const n of nilaiList) {
        if (!isExcluded(n.matapelajaran)) {
          nilaiMap.set(n.matapelajaran, n.rerata)
        }
      }

      const trackInclination = calculateTrackInclination(nilaiMap)

      // Calculate both IPA and IPS major scores
      const ipaMajorScores = calculateMajorScores(nilaiMap, IPA_MAJOR_WEIGHTS)
      const ipsMajorScores = calculateMajorScores(nilaiMap, IPS_MAJOR_WEIGHTS)

      // Combine and pick top 5
      const allMajorScores = [
        ...ipaMajorScores.map(s => ({ ...s, track: 'IPA' as const })),
        ...ipsMajorScores.map(s => ({ ...s, track: 'IPS' as const })),
      ].sort((a, b) => b.skor - a.skor)

      const topMajors = allMajorScores.slice(0, 5)

      // Confidence calculation
      const gap = trackInclination.ipa - trackInclination.ips
      const subjectCount = nilaiMap.size
      const tkaSubjectCount = tkaData ? 3 + (tkaData.pilihan1Nama ? 1 : 0) + (tkaData.pilihan2Nama ? 1 : 0) : 0
      const nilaiCompleteness = Math.min(1, subjectCount / 8)
      const tkaCompleteness = tkaData ? Math.min(1, tkaSubjectCount / 5) : 0
      const dataCompleteness = tkaData
        ? nilaiCompleteness * 0.5 + tkaCompleteness * 0.3 + 0.2
        : nilaiCompleteness * 0.7 + 0.1
      const gapClarity = Math.min(1, Math.abs(gap) / 30)
      const confidence = Math.round(Math.min(97, Math.max(20,
        (dataCompleteness * 0.4 + gapClarity * 0.3 + consistency * 0.2 + (tkaData ? 0.1 : 0)) * 100
      )))

      // Generate reasoning
      const reasoning: string[] = []
      if (trackInclination.dominant === 'IPA') {
        reasoning.push(`Kecenderungan kuat ke jalur IPA (${trackInclination.ipa}% vs ${trackInclination.ips}%)`)
      } else if (trackInclination.dominant === 'IPS') {
        reasoning.push(`Kecenderungan kuat ke jalur IPS (${trackInclination.ips}% vs ${trackInclination.ipa}%)`)
      } else {
        reasoning.push(`Nilai mapel IPA dan IPS relatif seimbang (${trackInclination.ipa}% vs ${trackInclination.ips}%)`)
      }

      if (topMajors.length > 0 && topMajors[0].skor > 0) {
        reasoning.push(`Jurusan paling cocok: ${topMajors[0].nama} (skor ${topMajors[0].skor})`)
        if (topMajors[0].specificJurusan && topMajors[0].specificJurusan.length > 0) {
          reasoning.push(`Program studi: ${topMajors[0].specificJurusan.slice(0, 3).map(j => j.jurusan).join(', ')}`)
        }
        if (topMajors.length > 1 && topMajors[1].skor > 0) {
          reasoning.push(`Alternatif: ${topMajors[1].nama} (skor ${topMajors[1].skor})`)
        }
      }

      if (strongSubjects.length > 0) {
        reasoning.push(`Mapel unggulan: ${strongSubjects.slice(0, 5).map(s => `${s.matapelajaran} (${s.rerata})`).join(', ')}`)
      }
      if (weakSubjects.length > 0) {
        reasoning.push(`Mapel perlu peningkatan: ${weakSubjects.slice(0, 3).map(s => `${s.matapelajaran} (${s.rerata})`).join(', ')}`)
      }

      if (overallTrend > 2) {
        reasoning.push(`Tren nilai keseluruhan meningkat (+${overallTrend})`)
      } else if (overallTrend < -2) {
        reasoning.push(`Tren nilai keseluruhan menurun (${overallTrend}) — perlu perhatian`)
      }

      if (tkaData) {
        const tkaMandatoryAvg = Math.round(((tkaData.bindoNilai || 0) + (tkaData.matNilai || 0) + (tkaData.bingNilai || 0)) / 3 * 10) / 10
        if (tkaMandatoryAvg >= 65) {
          reasoning.push(`Rata-rata TKA wajib (${tkaMandatoryAvg}) baik — mendukung seleksi SNBT`)
        } else {
          reasoning.push(`Rata-rata TKA wajib (${tkaMandatoryAvg}) perlu ditingkatkan untuk SNBT`)
        }
      }

      if (consistency >= 0.85) {
        reasoning.push('Konsistensi nilai tinggi — performa stabil')
      } else if (consistency < 0.6) {
        reasoning.push('Konsistensi nilai rendah — terdapat variasi besar antar mapel')
      }

      jurusanAnalysis = {
        type: 'kelas11_12',
        trackInclination,
        topMajors: topMajors.map(m => ({
          nama: m.nama,
          skor: m.skor,
          track: m.track,
          mapelDetail: m.mapelDetail.slice(0, 5),
          specificJurusan: m.specificJurusan?.slice(0, 3),
        })),
        confidence,
        reasoning,
      }
    }

    // ---------- BUILD COMPLETE REPORT ----------
    const report = {
      student: {
        nama: siswa.nama,
        nis: siswa.nis,
        nisn: siswa.nisn,
        jeniskelamin: siswa.jeniskelamin,
        rombel: siswa.rombel ? {
          nama: siswa.rombel.nama,
          kelas: siswa.rombel.kelas,
          jurusan: siswa.rombel.jurusan,
          walikelas: siswa.rombel.walikelas,
        } : null,
      },
      gradeSummary,
      analysis: {
        overallAvg,
        ipaAvg,
        ipsAvg,
        consistency: Math.round(consistency * 100) / 100,
        overallTrend,
        strongSubjects: strongSubjects.slice(0, 5),
        weakSubjects: weakSubjects.slice(0, 5),
        distribution: ranges,
        totalSubjects: nilaiList.length,
        ipaCount: ipaSubjects.length,
        ipsCount: ipsSubjects.length,
      },
      jurusanAnalysis,
      tkaData,
      eligibleData,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(report)
  } catch (error) {
    console.error('Student report error:', error)
    return NextResponse.json({ error: 'Gagal membuat laporan' }, { status: 500 })
  }
}
