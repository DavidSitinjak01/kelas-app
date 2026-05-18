import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// ============================================================
// ANALISA JURUSAN IPA / IPS - Kelas X
// Algoritma multi-faktor dengan composite scoring
// V2: Menambahkan analisa dominasi mapel, top-3, dan strength diff
//     untuk mengurangi dominasi klasifikasi "Netral" pada siswa Kelas X
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
  // Multi-factor analysis details (V2)
  factorScores: {
    gapScore: number           // -5 to +5: based on weighted average gap
    dominanceScore: number     // -3 to +3: based on how many IPA/IPS subjects are above average
    topNScore: number          // -3 to +3: based on top-N subject composition
    strengthDiffScore: number  // -2 to +2: based on best subject comparison
    trendScore: number         // -2 to +2: based on semester trend
    compositeScore: number     // total composite: roughly -15 to +15
  }
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

// ============================================================
// V2: MULTI-FACTOR CLASSIFICATION
// ============================================================

interface FactorInput {
  ipaScore: number
  ipsScore: number
  ipaIpsGap: number
  overallAvg: number
  ipaSubjects: { mapel: string; rerata: number; weight: number }[]
  ipsSubjects: { mapel: string; rerata: number; weight: number }[]
  neutralSubjects: { mapel: string; rerata: number }[]
  semesterTrend: { ipaTrend: number; ipsTrend: number }
  hasMinIpa: boolean
  hasMinIps: boolean
}

function calculateMultiFactorScores(input: FactorInput): AnalysisResult['factorScores'] {
  const {
    ipaScore, ipsScore, ipaIpsGap, overallAvg,
    ipaSubjects, ipsSubjects, neutralSubjects,
    semesterTrend, hasMinIpa, hasMinIps,
  } = input

  // ---- FACTOR 1: Weighted Average Gap (-5 to +5) ----
  // The raw gap between IPA and IPS weighted averages
  // Scaled more aggressively for Kelas X: gap of ±2 = score 1.5
  let gapScore = 0
  if (hasMinIpa && hasMinIps) {
    // Scale: gap of 2 = score 1.5, gap of 10 = score 5
    gapScore = Math.sign(ipaIpsGap) * Math.min(5, Math.abs(ipaIpsGap) * 0.75)
  } else if (hasMinIpa && !hasMinIps) {
    // Only IPA data - slight IPA lean if score is decent
    gapScore = ipaScore >= 70 ? 1.5 : 0
  } else if (!hasMinIpa && hasMinIps) {
    gapScore = ipsScore >= 70 ? -1.5 : 0
  }

  // ---- FACTOR 2: Subject Dominance (-3 to +3) ----
  // How many IPA vs IPS subjects score above the student's own overall average
  // More aggressive scaling for Kelas X: count difference directly
  let dominanceScore = 0
  if (overallAvg > 0 && ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    const ipaAboveAvg = ipaSubjects.filter(s => s.rerata > overallAvg).length
    const ipsAboveAvg = ipsSubjects.filter(s => s.rerata > overallAvg).length
    // Direct count difference: if 4 IPA above avg vs 1 IPS above avg -> diff=3 -> score=+1.8
    // Also factor in the ratio for small differences
    const countDiff = ipaAboveAvg - ipsAboveAvg
    const ipaRatio = ipaAboveAvg / ipaSubjects.length
    const ipsRatio = ipsAboveAvg / ipsSubjects.length
    const ratioDiff = ipaRatio - ipsRatio
    // Blend count difference and ratio difference
    dominanceScore = Math.sign(countDiff || ratioDiff) * Math.min(3, Math.abs(countDiff) * 0.6 + Math.abs(ratioDiff) * 1.5)
  }

  // ---- FACTOR 3: Top-N Subject Composition (-3 to +3) ----
  // How many of the student's top 3 (or top 4 if tied) subjects are IPA vs IPS
  let topNScore = 0
  if (ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    // Combine all IPA and IPS subjects, sort by score
    const allRanked = [
      ...ipaSubjects.map(s => ({ type: 'ipa' as const, rerata: s.rerata })),
      ...ipsSubjects.map(s => ({ type: 'ips' as const, rerata: s.rerata })),
    ].sort((a, b) => b.rerata - a.rerata)

    // Use top 3 (or fewer if not enough subjects)
    const topN = allRanked.slice(0, Math.min(3, allRanked.length))
    const ipaInTop = topN.filter(s => s.type === 'ipa').length
    const ipsInTop = topN.filter(s => s.type === 'ips').length

    // 3 IPA in top 3 = +3, 2 IPA = +1.5, 1 IPA = 0, 0 IPA = -3 (if all IPS)
    if (topN.length > 0) {
      const ipaProportion = ipaInTop / topN.length
      const ipsProportion = ipsInTop / topN.length
      topNScore = (ipaProportion - ipsProportion) * 3
    }
  }

  // ---- FACTOR 4: Strength Differential (-3 to +3) ----
  // Difference between the student's BEST IPA subject and BEST IPS subject
  let strengthDiffScore = 0
  if (ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    const bestIpa = Math.max(...ipaSubjects.map(s => s.rerata))
    const bestIps = Math.max(...ipsSubjects.map(s => s.rerata))
    const strengthDiff = bestIpa - bestIps
    // More aggressive scaling: diff of ±3 maps to ±2, diff of ±6 maps to ±3
    strengthDiffScore = Math.sign(strengthDiff) * Math.min(3, Math.abs(strengthDiff) * 0.5)
  }

  // ---- FACTOR 5: Semester Trend (-2 to +2) ----
  let trendScore = 0
  if (semesterTrend.ipaTrend !== 0 || semesterTrend.ipsTrend !== 0) {
    const trendDiff = semesterTrend.ipaTrend - semesterTrend.ipsTrend
    // Scale: trend diff of ±4 maps to ±2
    trendScore = Math.sign(trendDiff) * Math.min(2, Math.abs(trendDiff) * 0.5)
  }

  // ---- COMPOSITE SCORE ----
  // Weighted combination of all factors
  // Higher weights for dominance and top-N since they show clearer patterns for Kelas X
  const compositeScore =
    gapScore * 0.20 +          // 20% weight: gap between averages
    dominanceScore * 0.30 +    // 30% weight: subject dominance above average (strongest signal)
    topNScore * 0.25 +         // 25% weight: top-N composition
    strengthDiffScore * 0.15 + // 15% weight: best subject comparison
    trendScore * 0.10          // 10% weight: semester trend (often 0 for Kelas X)

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
  factorScores: AnalysisResult['factorScores'],
  ipaSubjectCount: number,
  ipsSubjectCount: number,
  ipaScore: number,
  ipsScore: number,
): AnalysisResult['rekomendasi'] {
  const { compositeScore } = factorScores

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

  // V2 Thresholds based on composite score
  // Composite range: roughly -15 to +15
  // Narrower Netral zone: ±0.5 (most students should get a recommendation)
  if (compositeScore > 3.0) return 'Sangat Cocok IPA'
  if (compositeScore > 1.5) return 'Cocok IPA'
  if (compositeScore > 0.5) return 'Cenderung IPA'
  if (compositeScore >= -0.5) return 'Netral'
  if (compositeScore >= -1.5) return 'Cenderung IPS'
  if (compositeScore >= -3.0) return 'Cocok IPS'
  return 'Sangat Cocok IPS'
}

function calculateConfidenceV2(
  ipaSubjectCount: number,
  ipsSubjectCount: number,
  consistency: number,
  factorScores: AnalysisResult['factorScores'],
  hasTrendData: boolean,
): number {
  // Base confidence from data completeness
  const ipaCompleteness = Math.min(1, ipaSubjectCount / 4)
  const ipsCompleteness = Math.min(1, ipsSubjectCount / 4)
  const dataCompleteness = (ipaCompleteness + ipsCompleteness / 2) / 2

  // If one side is completely missing, very low confidence
  if (ipaSubjectCount === 0 || ipsSubjectCount === 0) return Math.round(Math.min(30, dataCompleteness * 30))

  // Factor agreement - how much do the factors agree with each other?
  // If all factors point in the same direction, higher confidence
  const factors = [
    factorScores.gapScore,
    factorScores.dominanceScore,
    factorScores.topNScore,
    factorScores.strengthDiffScore,
    factorScores.trendScore,
  ]
  const positiveFactors = factors.filter(f => f > 0.1).length
  const negativeFactors = factors.filter(f => f < -0.1).length
  const totalDecisive = positiveFactors + negativeFactors
  const factorAgreement = totalDecisive > 0
    ? Math.max(positiveFactors, negativeFactors) / totalDecisive
    : 0.5 // neutral = low confidence

  // Composite clarity - how far from 0 is the composite?
  const compositeClarity = Math.min(1, Math.abs(factorScores.compositeScore) / 3)

  // Consistency factor
  const consistencyFactor = consistency

  // Trend data bonus
  const trendBonus = hasTrendData ? 0.1 : 0

  // Combined confidence (weighted)
  const raw = (dataCompleteness * 0.25 + factorAgreement * 0.30 + compositeClarity * 0.25 + consistencyFactor * 0.15 + trendBonus) * 100

  return Math.round(Math.min(97, Math.max(20, raw)))
}

function generateReasoningV2(
  ipaScore: number,
  ipsScore: number,
  ipaSubjects: { mapel: string; rerata: number; weight: number }[],
  ipsSubjects: { mapel: string; rerata: number; weight: number }[],
  gap: number,
  overallAvg: number,
  consistency: number,
  factorScores: AnalysisResult['factorScores'],
  rekomendasi: string,
): string[] {
  const reasons: string[] = []

  // Factor 1: Score comparison
  if (gap > 0) {
    reasons.push(`Rata-rata tertimbang IPA (${ipaScore.toFixed(1)}) lebih tinggi ${gap.toFixed(1)} poin dari IPS (${ipsScore.toFixed(1)})`)
  } else if (gap < 0) {
    reasons.push(`Rata-rata tertimbang IPS (${ipsScore.toFixed(1)}) lebih tinggi ${Math.abs(gap).toFixed(1)} poin dari IPA (${ipaScore.toFixed(1)})`)
  } else {
    reasons.push(`Rata-rata tertimbang IPA dan IPS seimbang (${ipaScore.toFixed(1)})`)
  }

  // Factor 2: Subject dominance
  if (overallAvg > 0) {
    const ipaAboveAvg = ipaSubjects.filter(s => s.rerata > overallAvg).length
    const ipsAboveAvg = ipsSubjects.filter(s => s.rerata > overallAvg).length
    if (ipaAboveAvg > ipsAboveAvg) {
      reasons.push(`Lebih banyak mapel IPA di atas rata-rata pribadi (${ipaAboveAvg}/${ipaSubjects.length}) dibanding IPS (${ipsAboveAvg}/${ipsSubjects.length}) — menunjukkan kecenderungan IPA`)
    } else if (ipsAboveAvg > ipaAboveAvg) {
      reasons.push(`Lebih banyak mapel IPS di atas rata-rata pribadi (${ipsAboveAvg}/${ipsSubjects.length}) dibanding IPA (${ipaAboveAvg}/${ipaSubjects.length}) — menunjukkan kecenderungan IPS`)
    } else {
      reasons.push(`Jumlah mapel IPA dan IPS di atas rata-rata pribadi seimbang`)
    }
  }

  // Factor 3: Top subjects
  const allRanked = [
    ...ipaSubjects.map(s => ({ type: 'ipa' as const, mapel: s.mapel, rerata: s.rerata })),
    ...ipsSubjects.map(s => ({ type: 'ips' as const, mapel: s.mapel, rerata: s.rerata })),
  ].sort((a, b) => b.rerata - a.rerata)

  const top3 = allRanked.slice(0, Math.min(3, allRanked.length))
  const ipaInTop3 = top3.filter(s => s.type === 'ipa').length
  const ipsInTop3 = top3.filter(s => s.type === 'ips').length

  if (top3.length > 0) {
    const top3Names = top3.map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join(', ')
    if (ipaInTop3 > ipsInTop3) {
      reasons.push(`Mapel terbaik didominasi IPA: ${top3Names} — ${ipaInTop3} dari ${top3.length} terbaik adalah IPA`)
    } else if (ipsInTop3 > ipaInTop3) {
      reasons.push(`Mapel terbaik didominasi IPS: ${top3Names} — ${ipsInTop3} dari ${top3.length} terbaik adalah IPS`)
    } else {
      reasons.push(`Mapel terbaik campuran IPA & IPS: ${top3Names}`)
    }
  }

  // Factor 4: Best subject comparison
  if (ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    const bestIpa = ipaSubjects.reduce((best, s) => s.rerata > best.rerata ? s : best, ipaSubjects[0])
    const bestIps = ipsSubjects.reduce((best, s) => s.rerata > best.rerata ? s : best, ipsSubjects[0])
    if (bestIpa.rerata > bestIps.rerata + 2) {
      reasons.push(`Mapel terkuat adalah IPA (${bestIpa.mapel}: ${bestIpa.rerata.toFixed(1)}), ${bestIpa.rerata - bestIps.rerata > 5 ? 'jauh ' : ''}mengungguli mapel IPS terkuat (${bestIps.mapel}: ${bestIps.rerata.toFixed(1)})`)
    } else if (bestIps.rerata > bestIpa.rerata + 2) {
      reasons.push(`Mapel terkuat adalah IPS (${bestIps.mapel}: ${bestIps.rerata.toFixed(1)}), ${bestIps.rerata - bestIpa.rerata > 5 ? 'jauh ' : ''}mengungguli mapel IPA terkuat (${bestIpa.mapel}: ${bestIpa.rerata.toFixed(1)})`)
    }
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

  // Strong subjects (above 80)
  const strongIpa = ipaSubjects.filter(s => s.rerata >= 80).sort((a, b) => b.rerata - a.rerata)
  const strongIps = ipsSubjects.filter(s => s.rerata >= 80).sort((a, b) => b.rerata - a.rerata)
  if (strongIpa.length >= 3) {
    reasons.push(`Memiliki ${strongIpa.length} mapel IPA dengan nilai sangat baik (≥80) — fondasi IPA kuat`)
  }
  if (strongIps.length >= 3) {
    reasons.push(`Memiliki ${strongIps.length} mapel IPS dengan nilai sangat baik (≥80) — fondasi IPS kuat`)
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
  } else if (overallAvg < 60) {
    reasons.push('Rata-rata keseluruhan perlu ditingkatkan — perlu bimbingan tambahan')
  }

  // Netral explanation
  if (rekomendasi === 'Netral') {
    const hasTrend = factorScores.trendScore !== 0
    if (!hasTrend) {
      reasons.push('⚠️ Klasifikasi Netral: Data tren perkembangan belum tersedia. Disarankan input nilai lebih dari 1 semester agar analisis lebih akurat.')
    } else {
      reasons.push('Klasifikasi Netral: Belum terdapat kecenderungan yang jelas ke IPA atau IPS berdasarkan analisis multi-faktor')
    }
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
      const hasTrendData = ipaTrend !== 0 || ipsTrend !== 0

      // V2: Calculate multi-factor scores
      const hasMinIpa = ipaSubjects.length >= 2
      const hasMinIps = ipsSubjects.length >= 2

      const factorScores = calculateMultiFactorScores({
        ipaScore, ipsScore, ipaIpsGap, overallAvg,
        ipaSubjects, ipsSubjects, neutralSubjects,
        semesterTrend: { ipaTrend, ipsTrend },
        hasMinIpa, hasMinIps,
      })

      // V2: Determine recommendation using composite score
      const rekomendasi = determineRecommendationV2(
        factorScores,
        ipaSubjects.length, ipsSubjects.length,
        ipaScore, ipsScore,
      )

      // V2: Calculate confidence using multi-factor approach
      const confidence = calculateConfidenceV2(
        ipaSubjects.length, ipsSubjects.length,
        overallConsistency, factorScores, hasTrendData,
      )

      // V2: Generate improved reasoning
      const reasoning = generateReasoningV2(
        ipaScore, ipsScore, ipaSubjects, ipsSubjects,
        ipaIpsGap, overallAvg, overallConsistency,
        factorScores, rekomendasi,
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
        factorScores,
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
      algorithmVersion: 'V2-MultiFactor',
    })
  } catch (error) {
    console.error('Analisa jurusan error:', error)
    return NextResponse.json({ error: 'Gagal menganalisis data' }, { status: 500 })
  }
}
