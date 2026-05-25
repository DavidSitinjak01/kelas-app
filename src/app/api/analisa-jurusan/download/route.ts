import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

// Reuse classification logic from main route
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
  'pendidikan agama', 'pendidikan pancasila', 'pendidikan jasmani',
  'olahraga', 'seni', 'budaya', 'prakarya', 'project', 'p5',
  'penguatan profil', 'muatan lokal', 'potensi daerah',
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
  ipaWeight: number; ipsWeight: number
} {
  if (isExcluded(mapel)) return { type: 'excluded', ipaWeight: 0, ipsWeight: 0 }
  const lower = normalizeMapel(mapel)
  for (const [key, weight] of Object.entries(IPA_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower))
      return { type: 'ipa', ipaWeight: weight, ipsWeight: 0 }
  }
  for (const [key, weight] of Object.entries(IPS_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower))
      return { type: 'ips', ipaWeight: 0, ipsWeight: weight }
  }
  for (const [key, weights] of Object.entries(NEUTRAL_WEIGHTS)) {
    if (lower.includes(key) || key.includes(lower))
      return { type: 'neutral', ipaWeight: weights.ipa, ipsWeight: weights.ips }
  }
  return { type: 'neutral', ipaWeight: 0.5, ipsWeight: 0.5 }
}

function calcWeightedAvg(items: { rerata: number; weight: number }[]): number {
  const tw = items.reduce((s, i) => s + i.weight, 0)
  return tw === 0 ? 0 : items.reduce((s, i) => s + i.rerata * i.weight, 0) / tw
}

// V2 multi-factor classification
function calcCompositeScore(
  ipaScore: number, ipsScore: number, gap: number, overallAvg: number,
  ipaSubjects: { mapel: string; rerata: number; weight: number }[],
  ipsSubjects: { mapel: string; rerata: number; weight: number }[],
  ipaTrend: number, ipsTrend: number,
  hasMinIpa: boolean, hasMinIps: boolean,
): number {
  let gapScore = 0
  if (hasMinIpa && hasMinIps) {
    gapScore = Math.sign(gap) * Math.min(5, Math.abs(gap) * 0.75)
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
    const ratioDiff = (ipaAboveAvg / ipaSubjects.length) - (ipsAboveAvg / ipsSubjects.length)
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
      topNScore = ((topN.filter(s => s.type === 'ipa').length / topN.length) - (topN.filter(s => s.type === 'ips').length / topN.length)) * 3
    }
  }

  let strengthDiffScore = 0
  if (ipaSubjects.length > 0 && ipsSubjects.length > 0) {
    const diff = Math.max(...ipaSubjects.map(s => s.rerata)) - Math.max(...ipsSubjects.map(s => s.rerata))
    strengthDiffScore = Math.sign(diff) * Math.min(3, Math.abs(diff) * 0.5)
  }

  let trendScore = 0
  if (ipaTrend !== 0 || ipsTrend !== 0) {
    const trendDiff = ipaTrend - ipsTrend
    trendScore = Math.sign(trendDiff) * Math.min(2, Math.abs(trendDiff) * 0.5)
  }

  return gapScore * 0.20 + dominanceScore * 0.30 + topNScore * 0.25 + strengthDiffScore * 0.15 + trendScore * 0.10
}

function getRekomendasi(composite: number, hasMinIpa: boolean, hasMinIps: boolean, ipaScore: number, ipsScore: number): string {
  if (!hasMinIpa && !hasMinIps) return 'Netral'
  if (!hasMinIpa && hasMinIps) return ipsScore >= 70 ? 'Cenderung IPS' : 'Netral'
  if (hasMinIpa && !hasMinIps) return ipaScore >= 70 ? 'Cenderung IPA' : 'Netral'
  if (composite > 3.0) return 'Sangat Cocok IPA'
  if (composite > 1.5) return 'Cocok IPA'
  if (composite > 0.5) return 'Cenderung IPA'
  if (composite >= -0.5) return 'Netral'
  if (composite >= -1.5) return 'Cenderung IPS'
  if (composite >= -3.0) return 'Cocok IPS'
  return 'Sangat Cocok IPS'
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const rombelid = searchParams.get('rombelid')

    // Get all kelas 10 rombels
    const rombels = await db.rombel.findMany({
      where: { kelas: 10 },
      include: { siswa: { include: { nilai: true, rombel: true } } },
    })

    if (rombels.length === 0) {
      return NextResponse.json({ error: 'Tidak ada rombel kelas 10' }, { status: 404 })
    }

    const targetRombels = rombelid
      ? rombels.filter(r => r.id === rombelid)
      : rombels

    const allSiswa = targetRombels.flatMap(r => r.siswa)

    // Fetch all nilai for semester trend
    const nilaiData = await db.nilai.findMany({
      where: { siswaid: { in: allSiswa.map(s => s.id) } },
    })

    // Build rows
    const rows: Record<string, string | number>[] = []

    for (let idx = 0; idx < allSiswa.length; idx++) {
      const siswa = allSiswa[idx]
      const studentNilai = nilaiData.filter(n => n.siswaid === siswa.id)

      const ipaSubjects = studentNilai
        .filter(n => getSubjectCategory(n.matapelajaran).type === 'ipa')
        .map(n => ({ mapel: n.matapelajaran, rerata: n.rerata, weight: getSubjectCategory(n.matapelajaran).ipaWeight }))

      const ipsSubjects = studentNilai
        .filter(n => getSubjectCategory(n.matapelajaran).type === 'ips')
        .map(n => ({ mapel: n.matapelajaran, rerata: n.rerata, weight: getSubjectCategory(n.matapelajaran).ipsWeight }))

      const neutralVals = studentNilai
        .filter(n => getSubjectCategory(n.matapelajaran).type === 'neutral')

      const ipaWeighted = [
        ...ipaSubjects.map(s => ({ rerata: s.rerata, weight: s.weight })),
        ...neutralVals.filter(v => getSubjectCategory(v.matapelajaran).ipaWeight > 0)
          .map(v => ({ rerata: v.rerata, weight: getSubjectCategory(v.matapelajaran).ipaWeight })),
      ]
      const ipsWeighted = [
        ...ipsSubjects.map(s => ({ rerata: s.rerata, weight: s.weight })),
        ...neutralVals.filter(v => getSubjectCategory(v.matapelajaran).ipsWeight > 0)
          .map(v => ({ rerata: v.rerata, weight: getSubjectCategory(v.matapelajaran).ipsWeight })),
      ]

      const ipaScore = calcWeightedAvg(ipaWeighted)
      const ipsScore = calcWeightedAvg(ipsWeighted)
      const gap = ipaScore - ipsScore
      const allScores = studentNilai.map(n => n.rerata).filter(v => v > 0)
      const overallAvg = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0

      // Trend
      let ipaTrend = 0, ipsTrend = 0
      const calcTrend = (records: typeof studentNilai) => {
        const first: number[] = [], second: number[] = []
        for (const r of records) {
          if (r.smt1 > 0) first.push(r.smt1); if (r.smt2 > 0) first.push(r.smt2); if (r.smt3 > 0) first.push(r.smt3)
          if (r.smt4 > 0) second.push(r.smt4); if (r.smt5 > 0) second.push(r.smt5); if (r.smt6 > 0) second.push(r.smt6)
        }
        if (first.length === 0 || second.length === 0) return 0
        return second.reduce((a, b) => a + b, 0) / second.length - first.reduce((a, b) => a + b, 0) / first.length
      }
      ipaTrend = calcTrend(studentNilai.filter(n => getSubjectCategory(n.matapelajaran).type === 'ipa'))
      ipsTrend = calcTrend(studentNilai.filter(n => getSubjectCategory(n.matapelajaran).type === 'ips'))

      const hasMinIpa = ipaSubjects.length >= 2
      const hasMinIps = ipsSubjects.length >= 2
      const composite = calcCompositeScore(ipaScore, ipsScore, gap, overallAvg, ipaSubjects, ipsSubjects, ipaTrend, ipsTrend, hasMinIpa, hasMinIps)
      const rekomendasi = getRekomendasi(composite, hasMinIpa, hasMinIps, ipaScore, ipsScore)

      // Top 3 subjects
      const top3 = [...ipaSubjects, ...ipsSubjects].sort((a, b) => b.rerata - a.rerata).slice(0, 3)
        .map(s => `${s.mapel} (${s.rerata.toFixed(1)})`).join('; ')

      rows.push({
        'No': idx + 1,
        'Nama': siswa.nama,
        'NIS': siswa.nis,
        'NISN': siswa.nisn,
        'Rombel': siswa.rombel?.nama || '-',
        'Rata-Rata Keseluruhan': overallAvg > 0 ? Math.round(overallAvg * 100) / 100 : '-',
        'Skor IPA': Math.round(ipaScore * 10) / 10,
        'Skor IPS': Math.round(ipsScore * 10) / 10,
        'Gap IPA-IPS': Math.round(gap * 10) / 10,
        'Composite Score': Math.round(composite * 100) / 100,
        'Rekomendasi': rekomendasi,
        'Top 3 Mapel': top3 || '-',
        'Mapel IPA di Atas Rata-Rata': ipaSubjects.filter(s => s.rerata > overallAvg).length,
        'Mapel IPS di Atas Rata-Rata': ipsSubjects.filter(s => s.rerata > overallAvg).length,
        'Tren IPA': ipaTrend !== 0 ? Math.round(ipaTrend * 10) / 10 : '-',
        'Tren IPS': ipsTrend !== 0 ? Math.round(ipsTrend * 10) / 10 : '-',
      })
    }

    // Create workbook
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    ws['!cols'] = [
      { wch: 5 }, { wch: 30 }, { wch: 10 }, { wch: 15 }, { wch: 20 },
      { wch: 20 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 16 },
      { wch: 22 }, { wch: 40 }, { wch: 22 }, { wch: 22 }, { wch: 12 }, { wch: 12 },
    ]
    XLSX.utils.book_append_sheet(wb, ws, 'Rekomendasi Jurusan Kelas X')

    // Summary sheet
    const withNilai = rows.filter(r => r['Rata-Rata Keseluruhan'] !== '-')
    const summaryRows = [
      { 'Kategori': 'Total Siswa', 'Jumlah': rows.length },
      { 'Kategori': 'Siswa dengan Nilai', 'Jumlah': withNilai.length },
      { 'Kategori': 'Sangat Cocok IPA', 'Jumlah': rows.filter(r => String(r['Rekomendasi']) === 'Sangat Cocok IPA').length },
      { 'Kategori': 'Cocok IPA', 'Jumlah': rows.filter(r => String(r['Rekomendasi']) === 'Cocok IPA').length },
      { 'Kategori': 'Cenderung IPA', 'Jumlah': rows.filter(r => String(r['Rekomendasi']) === 'Cenderung IPA').length },
      { 'Kategori': 'Netral', 'Jumlah': rows.filter(r => String(r['Rekomendasi']) === 'Netral').length },
      { 'Kategori': 'Cenderung IPS', 'Jumlah': rows.filter(r => String(r['Rekomendasi']) === 'Cenderung IPS').length },
      { 'Kategori': 'Cocok IPS', 'Jumlah': rows.filter(r => String(r['Rekomendasi']) === 'Cocok IPS').length },
      { 'Kategori': 'Sangat Cocok IPS', 'Jumlah': rows.filter(r => String(r['Rekomendasi']) === 'Sangat Cocok IPS').length },
    ]
    const ws2 = XLSX.utils.json_to_sheet(summaryRows)
    ws2['!cols'] = [{ wch: 25 }, { wch: 12 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Ringkasan')

    // Subject mapping sheet
    const mappingRows = [
      ...Object.entries(IPA_WEIGHTS).map(([name, w]) => ({ 'Mata Pelajaran': name, 'Kategori': 'IPA', 'Bobot': w })),
      ...Object.entries(IPS_WEIGHTS).map(([name, w]) => ({ 'Mata Pelajaran': name, 'Kategori': 'IPS', 'Bobot': w })),
      ...Object.entries(NEUTRAL_WEIGHTS).map(([name, w]) => ({ 'Mata Pelajaran': name, 'Kategori': 'Netral', 'Bobot': `IPA:${w.ipa} / IPS:${w.ips}` })),
    ]
    const ws3 = XLSX.utils.json_to_sheet(mappingRows)
    ws3['!cols'] = [{ wch: 25 }, { wch: 10 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws3, 'Pemetaan Mapel')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = 'Rekomendasi_Jurusan_Kelas_X.xlsx'

    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Gagal membuat file download' }, { status: 500 })
  }
}
