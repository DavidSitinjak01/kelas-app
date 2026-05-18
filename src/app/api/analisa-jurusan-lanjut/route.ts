import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================================
// ANALISA JURUSAN LANJUT - Kelas XI & XII
// Analisa jurusan perguruan tinggi berdasarkan:
// - Kelas XI: Nilai Rapor (weighted scoring multi-faktor)
// - Kelas XII: Nilai Rapor + TKA (combined scoring)
// ============================================================

// ---------- SUBJECT-TO-MAJOR MAPPING ----------

// Major categories for IPA track students
const IPA_MAJOR_WEIGHTS: Record<string, Record<string, number>> = {
  'Teknik & Teknologi': {
    'fisika': 3.5,
    'matematika (umum)': 3.0,
    'matematika tingkat lanjut': 3.0,
    'informatika': 2.5,
    'kimia': 2.0,
    'bahasa inggris': 1.5,
    'bahasa indonesia': 1.0,
  },
  'Kedokteran & Kesehatan': {
    'biologi': 3.5,
    'kimia': 3.0,
    'matematika (umum)': 2.0,
    'fisika': 2.0,
    'bahasa inggris': 1.5,
    'bahasa indonesia': 1.0,
  },
  'Farmasi & Kimia Terapan': {
    'kimia': 3.5,
    'biologi': 3.0,
    'matematika (umum)': 2.0,
    'fisika': 1.5,
    'bahasa inggris': 1.5,
    'bahasa indonesia': 1.0,
  },
  'Matematika & Ilmu Komputer': {
    'matematika (umum)': 3.5,
    'matematika tingkat lanjut': 3.5,
    'informatika': 3.0,
    'fisika': 2.0,
    'bahasa inggris': 1.5,
    'bahasa indonesia': 1.0,
  },
  'Ilmu Alam & Lingkungan': {
    'biologi': 3.0,
    'kimia': 2.5,
    'fisika': 2.0,
    'geografi': 2.0,
    'matematika (umum)': 2.0,
    'bahasa inggris': 1.5,
    'bahasa indonesia': 1.0,
  },
}

// Major categories for IPS track students
const IPS_MAJOR_WEIGHTS: Record<string, Record<string, number>> = {
  'Ekonomi & Bisnis': {
    'ekonomi': 3.5,
    'matematika (umum)': 2.5,
    'bahasa inggris': 2.0,
    'sosiologi': 1.5,
    'geografi': 1.5,
    'bahasa indonesia': 1.0,
  },
  'Hukum': {
    'sejarah': 3.0,
    'bahasa indonesia': 3.0,
    'sosiologi': 2.5,
    'ekonomi': 1.5,
    'bahasa inggris': 1.5,
    'antropologi': 2.0,
  },
  'Ilmu Komunikasi': {
    'bahasa indonesia': 3.0,
    'bahasa inggris': 3.0,
    'sosiologi': 2.5,
    'sejarah': 1.5,
    'ekonomi': 1.0,
  },
  'Psikologi': {
    'biologi': 2.5,
    'sosiologi': 3.0,
    'matematika (umum)': 2.0,
    'bahasa indonesia': 2.0,
    'bahasa inggris': 1.5,
  },
  'Hubungan Internasional & Sosial Politik': {
    'bahasa inggris': 3.5,
    'geografi': 3.0,
    'sejarah': 2.5,
    'sosiologi': 2.5,
    'bahasa indonesia': 2.0,
    'ekonomi': 1.5,
  },
}

// Core IPA / IPS subject weights (for determining IPA vs IPS inclination)
const CORE_IPA_WEIGHTS: Record<string, number> = {
  'matematika (umum)': 2.0,
  'matematika tingkat lanjut': 2.5,
  'fisika': 3.0,
  'kimia': 3.0,
  'biologi': 3.0,
  'informatika': 2.0,
}

const CORE_IPS_WEIGHTS: Record<string, number> = {
  'ekonomi': 3.0,
  'geografi': 3.0,
  'sosiologi': 3.0,
  'sejarah': 2.5,
  'antropologi': 2.5,
}

// Excluded subjects
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

// TKA elective subject to major mapping
const TKA_PILIHAN_MAJOR_MAP: Record<string, { track: 'ipa' | 'ips'; majors: string[]; weight: number }> = {
  'matematika tingkat lanjut': { track: 'ipa', majors: ['Teknik & Teknologi', 'Matematika & Ilmu Komputer'], weight: 3.0 },
  'fisika': { track: 'ipa', majors: ['Teknik & Teknologi', 'Ilmu Alam & Lingkungan'], weight: 3.0 },
  'kimia': { track: 'ipa', majors: ['Farmasi & Kimia Terapan', 'Ilmu Alam & Lingkungan'], weight: 3.0 },
  'biologi': { track: 'ipa', majors: ['Kedokteran & Kesehatan', 'Ilmu Alam & Lingkungan'], weight: 3.0 },
  'informatika': { track: 'ipa', majors: ['Matematika & Ilmu Komputer', 'Teknik & Teknologi'], weight: 2.5 },
  'ekonomi': { track: 'ips', majors: ['Ekonomi & Bisnis'], weight: 3.0 },
  'geografi': { track: 'ips', majors: ['Hubungan Internasional & Sosial Politik', 'Ilmu Alam & Lingkungan'], weight: 2.5 },
  'sejarah': { track: 'ips', majors: ['Hukum', 'Hubungan Internasional & Sosial Politik'], weight: 2.5 },
  'sosiologi': { track: 'ips', majors: ['Psikologi', 'Ilmu Komunikasi', 'Hukum'], weight: 2.5 },
  'antropologi': { track: 'ips', majors: ['Hukum', 'Hubungan Internasional & Sosial Politik'], weight: 2.0 },
}

// ---------- HELPER FUNCTIONS ----------

function normalizeMapel(name: string): string {
  return name.toLowerCase().trim()
}

function isExcluded(mapel: string): boolean {
  const lower = normalizeMapel(mapel)
  return EXCLUDED_PATTERNS.some(p => lower.includes(p))
}

function calculateWeightedAverage(items: { rerata: number; weight: number }[]): number {
  const totalWeight = items.reduce((sum, s) => sum + s.weight, 0)
  if (totalWeight === 0) return 0
  return items.reduce((sum, s) => sum + s.rerata * s.weight, 0) / totalWeight
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

function getSubjectCoreType(mapel: string): 'ipa' | 'ips' | 'neutral' | 'excluded' {
  if (isExcluded(mapel)) return 'excluded'
  const lower = normalizeMapel(mapel)
  for (const key of Object.keys(CORE_IPA_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) return 'ipa'
  }
  for (const key of Object.keys(CORE_IPS_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) return 'ips'
  }
  return 'neutral'
}

// ---------- TYPES ----------

interface MajorScore {
  nama: string
  skor: number
  mapelDetail: { mapel: string; rerata: number; weight: number; contribution: number }[]
}

interface TKAData {
  bindoNilai: number
  bindoKategori: string
  matNilai: number
  matKategori: string
  bingNilai: number
  bingKategori: string
  pilihan1Nama: string
  pilihan1Nilai: number
  pilihan1Kategori: string
  pilihan2Nama: string
  pilihan2Nilai: number
  pilihan2Kategori: string
}

interface AnalysisResult {
  siswaId: string
  nama: string
  nis: string
  nisn: string
  rombelNama: string
  rombelId: string
  rombelJurusan: string
  kelas: number
  // IPA vs IPS inclination
  ipaInclination: number // 0-100
  ipsInclination: number // 0-100
  dominantTrack: 'IPA' | 'IPS' | 'Seimbang'
  // Major recommendations
  topMajors: MajorScore[]
  allMajorScores: MajorScore[]
  // TKA data (class 12 only)
  tkaData: TKAData | null
  tkaAdjustedMajors: MajorScore[] | null
  // Summary
  overallAvg: number
  consistency: number
  semesterTrend: { ipaTrend: number; ipsTrend: number }
  reasoning: string[]
  confidence: number
  hasNilai: boolean
  hasTKA: boolean
}

interface Summary {
  total: number
  withNilaiCount: number
  withoutNilaiCount: number
  ipaTrackCount: number
  ipsTrackCount: number
  balancedCount: number
  tkaCount: number
  majorDistribution: { major: string; count: number; track: string }[]
  avgConfidence: number
}

// ---------- MAIN ANALYSIS LOGIC ----------

function calculateMajorScores(
  nilaiMap: Map<string, number>,
  majorWeights: Record<string, Record<string, number>>
): MajorScore[] {
  const scores: MajorScore[] = []

  for (const [majorName, weights] of Object.entries(majorWeights)) {
    const mapelDetail: MajorScore['mapelDetail'] = []
    let totalWeight = 0
    let weightedSum = 0

    for (const [mapelKey, weight] of Object.entries(weights)) {
      // Find matching nilai
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

  // Use gap-based approach instead of percentage-of-total
  // Gap = ipaScore - ipsScore, range typically -20 to +20
  const gap = ipaScore - ipsScore

  // Map gap to percentage inclination (50 = balanced, >50 = IPA, <50 = IPS)
  // A gap of 5 points = ~60% inclination, gap of 10 = ~70%
  const ipaPct = Math.round(Math.min(85, Math.max(15, 50 + gap * 2)))
  const ipsPct = 100 - ipaPct

  let dominant: 'IPA' | 'IPS' | 'Seimbang' = 'Seimbang'
  if (gap > 3) dominant = 'IPA'
  else if (gap < -3) dominant = 'IPS'

  return { ipa: ipaPct, ips: ipsPct, dominant }
}

function adjustMajorScoresWithTKA(
  baseScores: MajorScore[],
  tkaData: TKAData,
  trackInclination: { ipa: number; ips: number }
): MajorScore[] {
  const adjusted = baseScores.map(s => ({ ...s, mapelDetail: [...s.mapelDetail] }))

  // 1. TKA mandatory scores validate core competency
  const tkaBindo = tkaData.bindoNilai || 0
  const tkaMat = tkaData.matNilai || 0
  const tkaBing = tkaData.bingNilai || 0
  const tkaMandatoryAvg = (tkaBindo + tkaMat + tkaBing) / 3

  // TKA mandatory boosts all majors slightly (academic foundation)
  for (const major of adjusted) {
    if (tkaMandatoryAvg >= 70) {
      major.skor = Math.min(100, major.skor + 1.5)
    } else if (tkaMandatoryAvg >= 55) {
      major.skor = Math.min(100, major.skor + 0.5)
    } else if (tkaMandatoryAvg < 40) {
      major.skor = Math.max(0, major.skor - 1.0)
    }
  }

  // 2. TKA elective subjects directly boost related majors
  const processPilihan = (pilihanNama: string, pilihanNilai: number) => {
    if (!pilihanNama) return
    const lower = normalizeMapel(pilihanNama)

    for (const [tkaKey, mapping] of Object.entries(TKA_PILIHAN_MAJOR_MAP)) {
      if (lower.includes(tkaKey) || tkaKey.includes(lower)) {
        // Boost the related majors
        for (const major of adjusted) {
          if (mapping.majors.includes(major.nama)) {
            const boostFactor = pilihanNilai >= 70 ? 4.0 : pilihanNilai >= 55 ? 2.5 : pilihanNilai >= 40 ? 1.0 : -0.5
            major.skor = Math.min(100, Math.max(0, major.skor + boostFactor))
            major.mapelDetail.push({
              mapel: `TKA: ${pilihanNama}`,
              rerata: pilihanNilai,
              weight: mapping.weight,
              contribution: Math.round(pilihanNilai * mapping.weight / 10) / 10,
            })
          }
        }
        break
      }
    }
  }

  processPilihan(tkaData.pilihan1Nama, tkaData.pilihan1Nilai)
  processPilihan(tkaData.pilihan2Nama, tkaData.pilihan2Nilai)

  // 3. TKA Math score specifically boosts IPA-heavy majors
  if (tkaMat >= 60 && trackInclination.ipa > 50) {
    for (const major of adjusted) {
      if (['Teknik & Teknologi', 'Matematika & Ilmu Komputer', 'Ilmu Alam & Lingkungan'].includes(major.nama)) {
        major.skor = Math.min(100, major.skor + 1.0)
      }
    }
  }

  // Re-sort after adjustments
  return adjusted.sort((a, b) => b.skor - a.skor)
}

function generateReasoning(
  trackInclination: { ipa: number; ips: number; dominant: string },
  topMajors: MajorScore[],
  overallAvg: number,
  consistency: number,
  tkaData: TKAData | null,
  semesterTrend: { ipaTrend: number; ipsTrend: number }
): string[] {
  const reasons: string[] = []

  // Track inclination
  if (trackInclination.dominant === 'IPA') {
    reasons.push(`Kecenderungan kuat ke jalur IPA (${trackInclination.ipa}% vs ${trackInclination.ips}%) — nilai mapel IPA lebih dominan`)
  } else if (trackInclination.dominant === 'IPS') {
    reasons.push(`Kecenderungan kuat ke jalur IPS (${trackInclination.ips}% vs ${trackInclination.ipa}%) — nilai mapel IPS lebih dominan`)
  } else {
    reasons.push(`Nilai mapel IPA dan IPS relatif seimbang (${trackInclination.ipa}% vs ${trackInclination.ips}%) — berpotensi di kedua jalur`)
  }

  // Top major recommendation
  if (topMajors.length > 0 && topMajors[0].skor > 0) {
    reasons.push(`Jurusan paling cocok: ${topMajors[0].nama} (skor ${topMajors[0].skor.toFixed(1)})`)
    if (topMajors.length > 1 && topMajors[1].skor > 0) {
      reasons.push(`Alternatif: ${topMajors[1].nama} (skor ${topMajors[1].skor.toFixed(1)})`)
    }
  }

  // Top major subject strengths
  if (topMajors.length > 0 && topMajors[0].mapelDetail.length > 0) {
    const strong = topMajors[0].mapelDetail.filter(s => s.rerata >= 75).sort((a, b) => b.rerata - a.rerata)
    if (strong.length > 0) {
      reasons.push(`Mapel unggulan untuk ${topMajors[0].nama}: ${strong.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')}`)
    }
    const weak = topMajors[0].mapelDetail.filter(s => s.rerata < 60)
    if (weak.length > 0) {
      reasons.push(`Mapel perlu peningkatan: ${weak.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')}`)
    }
  }

  // Semester trend
  if (Math.abs(semesterTrend.ipaTrend) > 2 || Math.abs(semesterTrend.ipsTrend) > 2) {
    if (semesterTrend.ipaTrend > 2) reasons.push('Tren nilai IPA meningkat dari semester ke semester')
    if (semesterTrend.ipaTrend < -2) reasons.push('Tren nilai IPA menurun — perlu perhatian khusus')
    if (semesterTrend.ipsTrend > 2) reasons.push('Tren nilai IPS meningkat dari semester ke semester')
    if (semesterTrend.ipsTrend < -2) reasons.push('Tren nilai IPS menurun — perlu perhatian khusus')
  }

  // Consistency
  if (consistency >= 0.85) {
    reasons.push('Konsistensi nilai tinggi — performa stabil di semua mapel')
  } else if (consistency < 0.6) {
    reasons.push('Konsistensi nilai rendah — terdapat variasi besar antar mapel')
  }

  // Overall
  if (overallAvg >= 85) {
    reasons.push('Rata-rata keseluruhan sangat baik — berpotensi masuk PTN favorit')
  } else if (overallAvg >= 70) {
    reasons.push('Rata-rata keseluruhan baik — memiliki peluang yang cukup')
  } else if (overallAvg < 60) {
    reasons.push('Rata-rata keseluruhan perlu ditingkatkan — perlu bimbingan tambahan')
  }

  // TKA specific
  if (tkaData) {
    const tkaMandatoryAvg = ((tkaData.bindoNilai || 0) + (tkaData.matNilai || 0) + (tkaData.bingNilai || 0)) / 3
    if (tkaMandatoryAvg >= 65) {
      reasons.push(`Rata-rata TKA wajib (${tkaMandatoryAvg.toFixed(1)}) baik — mendukung seleksi SNBT`)
    } else if (tkaMandatoryAvg >= 45) {
      reasons.push(`Rata-rata TKA wajib (${tkaMandatoryAvg.toFixed(1)}) cukup — perlu peningkatan untuk SNBT`)
    } else {
      reasons.push(`Rata-rata TKA wajib (${tkaMandatoryAvg.toFixed(1)}) rendah — perlu persiapan lebih untuk SNBT`)
    }

    if (tkaData.pilihan1Nama) {
      reasons.push(`TKA pilihan: ${tkaData.pilihan1Nama} (${tkaData.pilihan1Nilai}) & ${tkaData.pilihan2Nama} (${tkaData.pilihan2Nilai})`)
    }
  }

  return reasons
}

function calculateConfidence(
  hasNilai: boolean,
  hasTKA: boolean,
  consistency: number,
  gap: number,
  subjectCount: number,
  tkaSubjectCount: number
): number {
  if (!hasNilai) return 0

  // Data completeness factor
  const nilaiCompleteness = Math.min(1, subjectCount / 8) // ideal: 8+ relevant subjects
  const tkaCompleteness = hasTKA ? Math.min(1, (3 + tkaSubjectCount) / 5) : 0 // ideal: 3 wajib + 2 pilihan

  const dataCompleteness = hasTKA
    ? nilaiCompleteness * 0.5 + tkaCompleteness * 0.3 + 0.2
    : nilaiCompleteness * 0.7 + 0.1

  // Gap clarity
  const gapClarity = Math.min(1, Math.abs(gap) / 8)

  // Consistency
  const consistencyFactor = consistency

  // TKA bonus (more data = more confidence)
  const tkaBonus = hasTKA ? 0.1 : 0

  const raw = (dataCompleteness * 0.4 + gapClarity * 0.3 + consistencyFactor * 0.2 + tkaBonus) * 100

  return Math.round(Math.min(97, Math.max(20, raw)))
}

// ---------- API HANDLER ----------

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const kelasParam = searchParams.get('kelas')
    const rombelId = searchParams.get('rombelId')

    const kelas = kelasParam ? parseInt(kelasParam) : 12
    if (![11, 12].includes(kelas)) {
      return NextResponse.json({ error: 'Kelas harus 11 atau 12' }, { status: 400 })
    }

    // Get rombels for the specified kelas
    const rombels = await db.rombel.findMany({
      where: { kelas },
      include: { siswa: true },
    })

    if (rombels.length === 0) {
      return NextResponse.json({
        students: [],
        summary: { total: 0, withNilaiCount: 0, withoutNilaiCount: 0, ipaTrackCount: 0, ipsTrackCount: 0, balancedCount: 0, tkaCount: 0, majorDistribution: [], avgConfidence: 0 },
        availableRombels: [],
        kelas,
        message: `Tidak ada rombel kelas ${kelas}`
      })
    }

    const targetRombels = rombelId
      ? rombels.filter(r => r.id === rombelId)
      : rombels

    const allSiswaIds = targetRombels.flatMap(r => r.siswa.map(s => s.id))

    if (allSiswaIds.length === 0) {
      return NextResponse.json({
        students: [],
        summary: { total: 0, withNilaiCount: 0, withoutNilaiCount: 0, ipaTrackCount: 0, ipsTrackCount: 0, balancedCount: 0, tkaCount: 0, majorDistribution: [], avgConfidence: 0 },
        availableRombels: [],
        kelas,
        message: `Tidak ada siswa kelas ${kelas}`
      })
    }

    // Fetch all nilai for these students
    const nilaiData = await db.nilai.findMany({
      where: { siswaId: { in: allSiswaIds } },
      include: { siswa: { include: { rombel: true } } },
    })

    // Fetch TKA data for class 12
    let tkaRecords: Map<string, TKAData> = new Map()
    if (kelas === 12) {
      const tkaData = await db.tKA.findMany({
        where: { siswaId: { in: allSiswaIds } },
      })
      for (const tka of tkaData) {
        tkaRecords.set(tka.siswaId, {
          bindoNilai: tka.bindoNilai,
          bindoKategori: tka.bindoKategori,
          matNilai: tka.matNilai,
          matKategori: tka.matKategori,
          bingNilai: tka.bingNilai,
          bingKategori: tka.bingKategori,
          pilihan1Nama: tka.pilihan1Nama,
          pilihan1Nilai: tka.pilihan1Nilai,
          pilihan1Kategori: tka.pilihan1Kategori,
          pilihan2Nama: tka.pilihan2Nama,
          pilihan2Nilai: tka.pilihan2Nilai,
          pilihan2Kategori: tka.pilihan2Kategori,
        })
      }
    }

    // Group nilai by siswa
    const siswaNilaiMap = new Map<string, {
      siswaId: string; nama: string; nis: string; nisn: string
      rombelNama: string; rombelId: string; rombelJurusan: string
      nilaiMap: Map<string, number>
      allNilai: { mataPelajaran: string; rerata: number; smt1: number; smt2: number; smt3: number; smt4: number; smt5: number; smt6: number }[]
    }>()

    for (const nilai of nilaiData) {
      const sid = nilai.siswaId
      if (!siswaNilaiMap.has(sid)) {
        siswaNilaiMap.set(sid, {
          siswaId: sid,
          nama: nilai.siswa.nama,
          nis: nilai.siswa.nis,
          nisn: nilai.siswa.nisn,
          rombelNama: nilai.siswa.rombel.nama,
          rombelId: nilai.siswa.rombel.id,
          rombelJurusan: nilai.siswa.rombel.jurusan,
          nilaiMap: new Map(),
          allNilai: [],
        })
      }

      const entry = siswaNilaiMap.get(sid)!
      if (!isExcluded(nilai.mataPelajaran)) {
        entry.nilaiMap.set(nilai.mataPelajaran, nilai.rerata)
      }
      entry.allNilai.push({
        mataPelajaran: nilai.mataPelajaran,
        rerata: nilai.rerata,
        smt1: nilai.smt1,
        smt2: nilai.smt2,
        smt3: nilai.smt3,
        smt4: nilai.smt4,
        smt5: nilai.smt5,
        smt6: nilai.smt6,
      })
    }

    // Add students with no nilai
    for (const rombel of targetRombels) {
      for (const siswa of rombel.siswa) {
        if (!siswaNilaiMap.has(siswa.id)) {
          siswaNilaiMap.set(siswa.id, {
            siswaId: siswa.id,
            nama: siswa.nama,
            nis: siswa.nis,
            nisn: siswa.nisn,
            rombelNama: rombel.nama,
            rombelId: rombel.id,
            rombelJurusan: rombel.jurusan,
            nilaiMap: new Map(),
            allNilai: [],
          })
        }
      }
    }

    // Analyze each student
    const results: AnalysisResult[] = []

    for (const [sid, sn] of siswaNilaiMap) {
      const hasNilai = sn.nilaiMap.size > 0
      const tkaData = kelas === 12 ? tkaRecords.get(sid) || null : null
      const hasTKA = tkaData !== null

      // Calculate track inclination
      const trackInclination = calculateTrackInclination(sn.nilaiMap)

      // Calculate major scores for both tracks
      const ipaMajorScores = calculateMajorScores(sn.nilaiMap, IPA_MAJOR_WEIGHTS)
      const ipsMajorScores = calculateMajorScores(sn.nilaiMap, IPS_MAJOR_WEIGHTS)

      // Combine and rank all majors
      const allMajorScores: MajorScore[] = [
        ...ipaMajorScores.map(s => ({ ...s })),
        ...ipsMajorScores.map(s => ({ ...s })),
      ].sort((a, b) => b.skor - a.skor)

      // Top 3 majors
      const topMajors = allMajorScores.slice(0, 3)

      // Adjust with TKA if available (class 12)
      let tkaAdjustedMajors: MajorScore[] | null = null
      if (hasTKA && tkaData) {
        // Recalculate with TKA adjustments
        const adjustedIpa = adjustMajorScoresWithTKA(
          ipaMajorScores.map(s => ({ ...s })), tkaData, trackInclination
        )
        const adjustedIps = adjustMajorScoresWithTKA(
          ipsMajorScores.map(s => ({ ...s })), tkaData, trackInclination
        )
        tkaAdjustedMajors = [...adjustedIpa, ...adjustedIps].sort((a, b) => b.skor - a.skor)
      }

      // Use TKA-adjusted majors if available, otherwise use base majors
      const effectiveMajors = tkaAdjustedMajors || allMajorScores

      // Overall average
      const allScores = Array.from(sn.nilaiMap.values()).filter(v => v > 0)
      const overallAvg = allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0

      // Consistency
      const consistency = calculateConsistency(allScores)

      // Semester trend
      const ipaNilaiRecords = sn.allNilai.filter(n => getSubjectCoreType(n.mataPelajaran) === 'ipa')
      const ipsNilaiRecords = sn.allNilai.filter(n => getSubjectCoreType(n.mataPelajaran) === 'ips')

      const calcTrend = (records: typeof sn.allNilai) => {
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
        return avgSecond - avgFirst
      }

      const ipaTrend = calcTrend(ipaNilaiRecords)
      const ipsTrend = calcTrend(ipsNilaiRecords)

      // Top major gap (for confidence)
      const topMajorGap = effectiveMajors.length >= 2 && effectiveMajors[0].skor > 0 && effectiveMajors[1].skor > 0
        ? effectiveMajors[0].skor - effectiveMajors[1].skor
        : 0

      // Confidence
      const tkaSubjectCount = hasTKA && tkaData
        ? (tkaData.pilihan1Nama ? 1 : 0) + (tkaData.pilihan2Nama ? 1 : 0)
        : 0
      const confidence = calculateConfidence(hasNilai, hasTKA, consistency, topMajorGap, sn.nilaiMap.size, tkaSubjectCount)

      // Reasoning
      const reasoning = generateReasoning(
        trackInclination,
        effectiveMajors.slice(0, 3),
        overallAvg,
        consistency,
        tkaData,
        { ipaTrend, ipsTrend }
      )

      results.push({
        siswaId: sid,
        nama: sn.nama,
        nis: sn.nis,
        nisn: sn.nisn,
        rombelNama: sn.rombelNama,
        rombelId: sn.rombelId,
        rombelJurusan: sn.rombelJurusan,
        kelas,
        ipaInclination: trackInclination.ipa,
        ipsInclination: trackInclination.ips,
        dominantTrack: trackInclination.dominant,
        topMajors: effectiveMajors.slice(0, 3),
        allMajorScores: effectiveMajors,
        tkaData,
        tkaAdjustedMajors,
        overallAvg: Math.round(overallAvg * 10) / 10,
        consistency: Math.round(consistency * 100) / 100,
        semesterTrend: {
          ipaTrend: Math.round(ipaTrend * 10) / 10,
          ipsTrend: Math.round(ipsTrend * 10) / 10,
        },
        reasoning,
        confidence,
        hasNilai,
        hasTKA,
      })
    }

    // Sort
    results.sort((a, b) => {
      if (!a.hasNilai && b.hasNilai) return 1
      if (a.hasNilai && !b.hasNilai) return -1
      return b.overallAvg - a.overallAvg
    })

    // Summary
    const withNilai = results.filter(r => r.hasNilai)
    // Determine major's own track category (not student's inclination)
    const ipaMajorNames = new Set(Object.keys(IPA_MAJOR_WEIGHTS))
    const ipsMajorNames = new Set(Object.keys(IPS_MAJOR_WEIGHTS))

    const majorDistMap = new Map<string, { count: number; track: string }>()
    for (const r of withNilai) {
      if (r.topMajors.length > 0 && r.topMajors[0].skor > 0) {
        const major = r.topMajors[0].nama
        // Use major's own category, not student's inclination
        const track = ipaMajorNames.has(major) ? 'IPA' : ipsMajorNames.has(major) ? 'IPS' : 'Lainnya'
        const existing = majorDistMap.get(major)
        if (existing) {
          existing.count++
        } else {
          majorDistMap.set(major, { count: 1, track })
        }
      }
    }

    const summary: Summary = {
      total: results.length,
      withNilaiCount: withNilai.length,
      withoutNilaiCount: results.filter(r => !r.hasNilai).length,
      ipaTrackCount: withNilai.filter(r => r.dominantTrack === 'IPA').length,
      ipsTrackCount: withNilai.filter(r => r.dominantTrack === 'IPS').length,
      balancedCount: withNilai.filter(r => r.dominantTrack === 'Seimbang').length,
      tkaCount: withNilai.filter(r => r.hasTKA).length,
      majorDistribution: Array.from(majorDistMap.entries())
        .map(([major, data]) => ({ major, count: data.count, track: data.track }))
        .sort((a, b) => b.count - a.count),
      avgConfidence: withNilai.length > 0
        ? Math.round(withNilai.reduce((s, r) => s + r.confidence, 0) / withNilai.length)
        : 0,
    }

    const availableRombels = rombels.map(r => ({
      id: r.id,
      nama: r.nama,
      siswaCount: r.siswa.length,
    }))

    return NextResponse.json({
      students: results,
      summary,
      availableRombels,
      kelas,
      subjectMapping: {
        ipaMajors: Object.entries(IPA_MAJOR_WEIGHTS).map(([name, weights]) => ({
          name,
          subjects: Object.entries(weights).map(([sub, w]) => ({ name: sub, weight: w })),
        })),
        ipsMajors: Object.entries(IPS_MAJOR_WEIGHTS).map(([name, weights]) => ({
          name,
          subjects: Object.entries(weights).map(([sub, w]) => ({ name: sub, weight: w })),
        })),
      },
    })
  } catch (error) {
    console.error('Analisa jurusan lanjut error:', error)
    return NextResponse.json({ error: 'Gagal menganalisis data jurusan' }, { status: 500 })
  }
}
