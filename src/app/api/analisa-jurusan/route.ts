import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================================
// ANALISA JURUSAN IPA / IPS - Kelas X
// Algoritma multi-faktor dengan weighted scoring
// ============================================================

// Klasifikasi mata pelajaran dengan bobot
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

// Mapel netral (berkontribusi ke keduanya dengan bobot rendah)
const NEUTRAL_WEIGHTS: Record<string, { ipa: number; ips: number }> = {
  'bahasa indonesia': { ipa: 1.0, ips: 1.0 },
  'bahasa inggris': { ipa: 1.0, ips: 1.0 },
}

// Mapel yang TIDAK dihitung
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

  // Check IPA - use partial matching for flexibility
  for (const [key, weight] of Object.entries(IPA_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { type: 'ipa', ipaWeight: weight, ipsWeight: 0 }
    }
  }

  // Check IPS
  for (const [key, weight] of Object.entries(IPS_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { type: 'ips', ipaWeight: 0, ipsWeight: weight }
    }
  }

  // Check neutral
  for (const [key, weights] of Object.entries(NEUTRAL_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower)) {
      return { type: 'neutral', ipaWeight: weights.ipa, ipsWeight: weights.ips }
    }
  }

  // Unknown subjects - treat as neutral with low weight
  return { type: 'neutral', ipaWeight: 0.5, ipsWeight: 0.5 }
}

interface StudentNilai {
  siswaId: string
  nama: string
  nis: string
  nisn: string
  rombelNama: string
  rombelId: string
  values: { mataPelajaran: string; rerata: number; category: 'ipa' | 'ips' | 'neutral' | 'excluded'; ipaWeight: number; ipsWeight: number }[]
}

interface AnalysisResult {
  siswaId: string
  nama: string
  nis: string
  nisn: string
  rombelNama: string
  ipaScore: number
  ipsScore: number
  ipaSubjects: { mapel: string; rerata: number; weight: number }[]
  ipsSubjects: { mapel: string; rerata: number; weight: number }[]
  neutralSubjects: { mapel: string; rerata: number }[]
  excludedSubjects: { mapel: string; rerata: number }[]
  overallAvg: number
  ipaIpsGap: number
  consistency: number
  semesterTrend: { ipaTrend: number; ipsTrend: number }
  rekomendasi: 'Sangat Cocok IPA' | 'Cocok IPA' | 'Cenderung IPA' | 'Netral' | 'Cenderung IPS' | 'Cocok IPS' | 'Sangat Cocok IPS'
  confidence: number // 0-100
  reasoning: string[]
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
  const cv = stddev / mean // coefficient of variation
  // Lower CV = more consistent. Convert to 0-1 score
  return Math.max(0, Math.min(1, 1 - cv))
}

function determineRecommendation(
  ipaScore: number,
  ipsScore: number,
  consistency: number,
  ipaIpsGap: number,
  ipaSubjectCount: number,
  ipsSubjectCount: number,
  semesterTrend: { ipaTrend: number; ipsTrend: number }
): AnalysisResult['rekomendasi'] {
  // Need minimum subjects for reliable analysis
  const hasMinIpa = ipaSubjectCount >= 2
  const hasMinIps = ipsSubjectCount >= 2

  // If one side has no data, can't compare fairly
  if (!hasMinIpa && !hasMinIps) return 'Netral'
  if (!hasMinIpa && hasMinIps) {
    return ipsScore >= 70 ? 'Cenderung IPS' : 'Netral'
  }
  if (hasMinIpa && !hasMinIps) {
    return ipaScore >= 70 ? 'Cenderung IPA' : 'Netral'
  }

  // Adjusted gap considering semester trend
  let effectiveGap = ipaIpsGap
  const trendBonus = (semesterTrend.ipaTrend - semesterTrend.ipsTrend) * 1.5
  effectiveGap += trendBonus

  // Determine recommendation based on gap
  // For class X students, smaller gaps are meaningful since subjects are still general
  if (effectiveGap > 10) return 'Sangat Cocok IPA'
  if (effectiveGap > 5) return 'Cocok IPA'
  if (effectiveGap > 2) return 'Cenderung IPA'
  if (effectiveGap >= -2) return 'Netral'
  if (effectiveGap >= -5) return 'Cenderung IPS'
  if (effectiveGap >= -10) return 'Cocok IPS'
  return 'Sangat Cocok IPS'
}

function calculateConfidence(
  ipaSubjectCount: number,
  ipsSubjectCount: number,
  consistency: number,
  gap: number
): number {
  // Base confidence from data completeness (need both IPA and IPS subjects)
  const ipaCompleteness = Math.min(1, ipaSubjectCount / 4) // ideal: 4+ IPA subjects
  const ipsCompleteness = Math.min(1, ipsSubjectCount / 4) // ideal: 4+ IPS subjects
  const dataCompleteness = (ipaCompleteness + ipsCompleteness) / 2

  // If one side is completely missing, very low confidence
  if (ipaSubjectCount === 0 || ipsSubjectCount === 0) return Math.round(Math.min(30, dataCompleteness * 30))

  // Gap clarity - bigger gap = more confident recommendation
  const gapClarity = Math.min(1, Math.abs(gap) / 10)

  // Consistency - more consistent = more confident
  const consistencyFactor = consistency

  // Combined confidence (weighted)
  const raw = (dataCompleteness * 0.4 + gapClarity * 0.35 + consistencyFactor * 0.25) * 100

  return Math.round(Math.min(97, Math.max(25, raw)))
}

function generateReasoning(
  ipaScore: number,
  ipsScore: number,
  ipaSubjects: { mapel: string; rerata: number; weight: number }[],
  ipsSubjects: { mapel: string; rerata: number; weight: number }[],
  gap: number,
  rekomendasi: string,
  consistency: number,
  overallAvg: number
): string[] {
  const reasons: string[] = []

  // Score comparison
  if (gap > 0) {
    reasons.push(`Nilai rata-rata mapel IPA (${ipaScore.toFixed(1)}) lebih tinggi ${gap.toFixed(1)} poin dari IPS (${ipsScore.toFixed(1)})`)
  } else if (gap < 0) {
    reasons.push(`Nilai rata-rata mapel IPS (${ipsScore.toFixed(1)}) lebih tinggi ${Math.abs(gap).toFixed(1)} poin dari IPA (${ipaScore.toFixed(1)})`)
  } else {
    reasons.push(`Nilai rata-rata mapel IPA dan IPS seimbang (${ipaScore.toFixed(1)})`)
  }

  // Strongest IPA subjects
  const strongIpa = ipaSubjects
    .filter(s => s.rerata >= 75)
    .sort((a, b) => b.rerata - a.rerata)
  if (strongIpa.length > 0) {
    reasons.push(`Mapel IPA unggulan: ${strongIpa.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')}`)
  }

  // Strongest IPS subjects
  const strongIps = ipsSubjects
    .filter(s => s.rerata >= 75)
    .sort((a, b) => b.rerata - a.rerata)
  if (strongIps.length > 0) {
    reasons.push(`Mapel IPS unggulan: ${strongIps.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')}`)
  }

  // Weak subjects
  const weakIpa = ipaSubjects.filter(s => s.rerata < 60)
  if (weakIpa.length > 0) {
    reasons.push(`Mapel IPA perlu peningkatan: ${weakIpa.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')}`)
  }
  const weakIps = ipsSubjects.filter(s => s.rerata < 60)
  if (weakIps.length > 0) {
    reasons.push(`Mapel IPS perlu peningkatan: ${weakIps.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')}`)
  }

  // Consistency
  if (consistency >= 0.85) {
    reasons.push('Konsistensi nilai tinggi — performa stabil di semua mapel')
  } else if (consistency < 0.6) {
    reasons.push('Konsistensi nilai rendah — terdapat variasi besar antar mapel')
  }

  // Overall
  if (overallAvg >= 85) {
    reasons.push('Rata-rata keseluruhan sangat baik — berpotensi sukses di kedua jurusan')
  } else if (overallAvg >= 70) {
    reasons.push('Rata-rata keseluruhan baik — memiliki dasar yang cukup')
  } else if (overallAvg < 60) {
    reasons.push('Rata-rata keseluruhan perlu ditingkatkan — perlu bimbingan tambahan')
  }

  return reasons
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelId = searchParams.get('rombelId')

    // Get all kelas 10 rombels
    const rombels = await db.rombel.findMany({
      where: { kelas: 10 },
      include: { siswa: true },
    })

    if (rombels.length === 0) {
      return NextResponse.json({
        students: [],
        summary: { total: 0, ipaCount: 0, ipsCount: 0, netralCount: 0 },
        message: 'Tidak ada rombel kelas 10'
      })
    }

    // Filter by rombel if specified
    const targetRombels = rombelId
      ? rombels.filter(r => r.id === rombelId)
      : rombels

    const allSiswaIds = targetRombels.flatMap(r => r.siswa.map(s => s.id))

    if (allSiswaIds.length === 0) {
      return NextResponse.json({
        students: [],
        summary: { total: 0, ipaCount: 0, ipsCount: 0, netralCount: 0 },
        message: 'Tidak ada siswa kelas 10'
      })
    }

    // Fetch all nilai for these students
    const nilaiData = await db.nilai.findMany({
      where: {
        siswaId: { in: allSiswaIds },
      },
      include: {
        siswa: { include: { rombel: true } },
      },
    })

    // Group nilai by siswa
    const siswaNilaiMap = new Map<string, StudentNilai>()

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
          values: [],
        })
      }

      const category = getSubjectCategory(nilai.mataPelajaran)
      siswaNilaiMap.get(sid)!.values.push({
        mataPelajaran: nilai.mataPelajaran,
        rerata: nilai.rerata,
        category: category.type,
        ipaWeight: category.ipaWeight,
        ipsWeight: category.ipsWeight,
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
            values: [],
          })
        }
      }
    }

    // Analyze each student
    const results: AnalysisResult[] = []

    for (const [sid, sn] of siswaNilaiMap) {
      const ipaSubjects = sn.values
        .filter(v => v.category === 'ipa')
        .map(v => ({ mapel: v.mataPelajaran, rerata: v.rerata, weight: v.ipaWeight }))

      const ipsSubjects = sn.values
        .filter(v => v.category === 'ips')
        .map(v => ({ mapel: v.mataPelajaran, rerata: v.rerata, weight: v.ipsWeight }))

      const neutralSubjects = sn.values
        .filter(v => v.category === 'neutral')
        .map(v => ({ mapel: v.mataPelajaran, rerata: v.rerata }))

      const excludedSubjects = sn.values
        .filter(v => v.category === 'excluded')
        .map(v => ({ mapel: v.mataPelajaran, rerata: v.rerata }))

      // Calculate weighted averages
      // IPA: core IPA + neutral contribution
      const ipaWeightedItems = [
        ...ipaSubjects.map(s => ({ rerata: s.rerata, weight: s.weight })),
        ...sn.values
          .filter(v => v.category === 'neutral' && v.ipaWeight > 0)
          .map(v => ({ rerata: v.rerata, weight: v.ipaWeight })),
      ]

      const ipsWeightedItems = [
        ...ipsSubjects.map(s => ({ rerata: s.rerata, weight: s.weight })),
        ...sn.values
          .filter(v => v.category === 'neutral' && v.ipsWeight > 0)
          .map(v => ({ rerata: v.rerata, weight: v.ipsWeight })),
      ]

      const ipaScore = calculateWeightedAverage(ipaWeightedItems)
      const ipsScore = calculateWeightedAverage(ipsWeightedItems)

      // Overall average (all subjects including excluded for reference)
      const allScores = sn.values.map(v => v.rerata).filter(v => v > 0)
      const overallAvg = allScores.length > 0
        ? allScores.reduce((a, b) => a + b, 0) / allScores.length
        : 0

      // Gap between IPA and IPS
      const ipaIpsGap = ipaScore - ipsScore

      // Consistency of IPA and IPS scores separately
      const ipaConsistency = calculateConsistency(ipaSubjects.map(s => s.rerata))
      const ipsConsistency = calculateConsistency(ipsSubjects.map(s => s.rerata))
      const overallConsistency = (ipaConsistency + ipsConsistency) / 2

      // Semester trend analysis
      let ipaTrend = 0
      let ipsTrend = 0

      const ipaNilaiRecords = nilaiData.filter(
        n => n.siswaId === sid && getSubjectCategory(n.mataPelajaran).type === 'ipa'
      )
      const ipsNilaiRecords = nilaiData.filter(
        n => n.siswaId === sid && getSubjectCategory(n.mataPelajaran).type === 'ips'
      )

      // Simple trend: compare first half (smt1-3) vs second half (smt4-6) averages
      const calcTrend = (records: typeof nilaiData) => {
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
        // Only calculate trend if both halves have data
        if (firstHalf.length === 0 || secondHalf.length === 0) return 0
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        return avgSecond - avgFirst // positive = improving
      }

      ipaTrend = calcTrend(ipaNilaiRecords)
      ipsTrend = calcTrend(ipsNilaiRecords)

      // Determine recommendation
      const rekomendasi = determineRecommendation(
        ipaScore, ipsScore, overallConsistency, ipaIpsGap,
        ipaSubjects.length, ipsSubjects.length,
        { ipaTrend, ipsTrend }
      )

      // Calculate confidence
      const confidence = calculateConfidence(
        ipaSubjects.length, ipsSubjects.length,
        overallConsistency, ipaIpsGap
      )

      // Generate reasoning
      const reasoning = generateReasoning(
        ipaScore, ipsScore, ipaSubjects, ipsSubjects,
        ipaIpsGap, rekomendasi, overallConsistency, overallAvg
      )

      results.push({
        siswaId: sid,
        nama: sn.nama,
        nis: sn.nis,
        nisn: sn.nisn,
        rombelNama: sn.rombelNama,
        ipaScore: Math.round(ipaScore * 10) / 10,
        ipsScore: Math.round(ipsScore * 10) / 10,
        ipaSubjects: ipaSubjects.sort((a, b) => b.rerata - a.rerata),
        ipsSubjects: ipsSubjects.sort((a, b) => b.rerata - a.rerata),
        neutralSubjects,
        excludedSubjects,
        overallAvg: Math.round(overallAvg * 10) / 10,
        ipaIpsGap: Math.round(ipaIpsGap * 10) / 10,
        consistency: Math.round(overallConsistency * 100) / 100,
        semesterTrend: {
          ipaTrend: Math.round(ipaTrend * 10) / 10,
          ipsTrend: Math.round(ipsTrend * 10) / 10,
        },
        rekomendasi,
        confidence,
        reasoning,
      })
    }

    // Sort by overall average descending, students with no nilai at the bottom
    results.sort((a, b) => {
      if (a.overallAvg === 0 && b.overallAvg > 0) return 1
      if (a.overallAvg > 0 && b.overallAvg === 0) return -1
      return b.overallAvg - a.overallAvg
    })

    // Separate students with and without nilai
    const withNilai = results.filter(r => r.overallAvg > 0)
    const withoutNilai = results.filter(r => r.overallAvg === 0)

    // Summary - only count students with nilai data
    const summary = {
      total: results.length,
      withNilaiCount: withNilai.length,
      withoutNilaiCount: withoutNilai.length,
      ipaCount: withNilai.filter(r => r.rekomendasi.includes('IPA')).length,
      ipsCount: withNilai.filter(r => r.rekomendasi.includes('IPS')).length,
      netralCount: withNilai.filter(r => r.rekomendasi === 'Netral').length,
      avgIpaScore: withNilai.length > 0 ? Math.round(withNilai.reduce((s, r) => s + r.ipaScore, 0) / withNilai.length * 10) / 10 : 0,
      avgIpsScore: withNilai.length > 0 ? Math.round(withNilai.reduce((s, r) => s + r.ipsScore, 0) / withNilai.length * 10) / 10 : 0,
      avgConfidence: withNilai.length > 0 ? Math.round(withNilai.reduce((s, r) => s + r.confidence, 0) / withNilai.length) : 0,
    }

    // Available rombels for filter
    const availableRombels = rombels.map(r => ({
      id: r.id,
      nama: r.nama,
      siswaCount: r.siswa.length,
    }))

    return NextResponse.json({
      students: results,
      summary,
      availableRombels,
      subjectMapping: {
        ipa: Object.entries(IPA_WEIGHTS).map(([name, weight]) => ({
          name, weight, label: name.charAt(0).toUpperCase() + name.slice(1)
        })),
        ips: Object.entries(IPS_WEIGHTS).map(([name, weight]) => ({
          name, weight, label: name.charAt(0).toUpperCase() + name.slice(1)
        })),
        neutral: Object.entries(NEUTRAL_WEIGHTS).map(([name, w]) => ({
          name, label: name.charAt(0).toUpperCase() + name.slice(1), ipaWeight: w.ipa, ipsWeight: w.ips
        })),
      },
    })
  } catch (error) {
    console.error('Analisa jurusan error:', error)
    return NextResponse.json({ error: 'Gagal menganalisis data' }, { status: 500 })
  }
}
