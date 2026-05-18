'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Compass, FlaskConical, Globe, Loader2, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, Minus, AlertCircle, CheckCircle2, BarChart3,
  Brain, Sparkles, Users, Printer,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// Types matching the API response
interface SubjectScore { mapel: string; rerata: number; weight: number }
interface SimpleSubject { mapel: string; rerata: number }

interface FactorScores {
  gapScore: number
  dominanceScore: number
  topNScore: number
  strengthDiffScore: number
  trendScore: number
  compositeScore: number
}

interface AnalysisStudent {
  siswaId: string; nama: string; nis: string; nisn: string; rombelNama: string
  ipaScore: number; ipsScore: number
  ipaSubjects: SubjectScore[]; ipsSubjects: SubjectScore[]
  neutralSubjects: SimpleSubject[]; excludedSubjects: SimpleSubject[]
  overallAvg: number; ipaIpsGap: number; consistency: number
  semesterTrend: { ipaTrend: number; ipsTrend: number }
  rekomendasi: string; confidence: number; reasoning: string[]
  factorScores?: FactorScores
}

interface Summary {
  total: number; withNilaiCount: number; withoutNilaiCount: number
  ipaCount: number; ipsCount: number; netralCount: number
  avgIpaScore: number; avgIpsScore: number; avgConfidence: number
}

interface SubjectMapping {
  name: string; weight: number; label: string
}

interface SubjectMappingNeutral {
  name: string; label: string; ipaWeight: number; ipsWeight: number
}

const PAGE_SIZE = 20

export function RekomendasiJurusanPage() {
  const [students, setStudents] = useState<AnalysisStudent[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [subjectMapping, setSubjectMapping] = useState<{
    ipa: SubjectMapping[]; ips: SubjectMapping[]; neutral: SubjectMappingNeutral[]
  } | null>(null)
  const [availableRombels, setAvailableRombels] = useState<{ id: string; nama: string; siswaCount: number }[]>([])
  const [filterRombel, setFilterRombel] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedStudent, setSelectedStudent] = useState<AnalysisStudent | null>(null)
  const { toast } = useToast()

  const fetchData = useCallback(async (rombelId?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (rombelId) params.set('rombelId', rombelId)
      const res = await fetch(`/api/analisa-jurusan?${params}`)
      const json = await res.json()
      setStudents(json.students || [])
      setSummary(json.summary || null)
      setSubjectMapping(json.subjectMapping || null)
      setAvailableRombels(json.availableRombels || [])
    } catch {
      toast({ title: 'Gagal memuat data analisa', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  useEffect(() => {
    if (filterRombel === 'all') {
      fetchData()
    } else {
      fetchData(filterRombel)
    }
    setPage(1)
    setSelectedStudent(null)
  }, [filterRombel, fetchData])

  // Pagination
  const totalPages = Math.ceil(students.length / PAGE_SIZE)
  const paginatedStudents = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Rekomendasi badge
  const rekomendasiBadge = (rek: string) => {
    if (rek.includes('Sangat Cocok IPA')) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-semibold">Sangat Cocok IPA</Badge>
    if (rek === 'Cocok IPA') return <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 border-emerald-200">Cocok IPA</Badge>
    if (rek === 'Cenderung IPA') return <Badge className="bg-teal-50 text-teal-700 hover:bg-teal-50 border-teal-200">Cenderung IPA</Badge>
    if (rek === 'Netral') return <Badge variant="outline" className="text-muted-foreground">Netral</Badge>
    if (rek === 'Cenderung IPS') return <Badge className="bg-amber-50 text-amber-700 hover:bg-amber-50 border-amber-200">Cenderung IPS</Badge>
    if (rek === 'Cocok IPS') return <Badge className="bg-orange-50 text-orange-700 hover:bg-orange-50 border-orange-200">Cocok IPS</Badge>
    if (rek.includes('Sangat Cocok IPS')) return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100 border-orange-300 font-semibold">Sangat Cocok IPS</Badge>
    return <Badge variant="outline">{rek}</Badge>
  }

  // Score color
  const scoreColor = (val: number) => {
    if (val >= 85) return 'text-emerald-600 font-semibold'
    if (val >= 75) return 'text-green-600'
    if (val >= 60) return 'text-amber-600'
    return 'text-red-600 font-semibold'
  }

  // Trend icon
  const trendIcon = (val: number) => {
    if (val > 2) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
    if (val < -2) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
  }

  // ============================================================
  // REPORT GENERATION (Kelas X)
  // ============================================================

  const handlePreviewReportX = (student: AnalysisStudent) => {
    const now = new Date()
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    const ipaSubjectRows = student.ipaSubjects.map(s => `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${s.mapel}</td><td style="text-align:center;padding:6px 8px;border:1px solid #ddd;font-weight:bold;">${s.rerata.toFixed(1)}</td><td style="text-align:center;padding:6px 8px;border:1px solid #ddd;">${s.weight}x</td></tr>`).join('')
    const ipsSubjectRows = student.ipsSubjects.map(s => `<tr><td style="padding:6px 8px;border:1px solid #ddd;">${s.mapel}</td><td style="text-align:center;padding:6px 8px;border:1px solid #ddd;font-weight:bold;">${s.rerata.toFixed(1)}</td><td style="text-align:center;padding:6px 8px;border:1px solid #ddd;">${s.weight}x</td></tr>`).join('')
    const reasoningHTML = student.reasoning.map(r => `<li style="margin-bottom:4px;">${r}</li>`).join('')

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Laporan Rekomendasi Jurusan - ${student.nama}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print { body { margin: 0; padding: 0; } .no-print { display: none !important; } }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.5; margin: 0; padding: 20px; }
    h1 { font-size: 22px; color: #059669; margin-bottom: 4px; }
    h2 { font-size: 16px; color: #374151; margin-top: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #f9fafb; font-weight: 600; text-align: left; }
    .header-bar { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; }
    .header-bar h1 { color: white; margin: 0; font-size: 20px; }
    .header-bar p { color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 13px; }
    .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; }
    .stat-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; text-align: center; }
    .stat-value { font-size: 20px; font-weight: 700; }
    .stat-label { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .bar-container { background: #f3f4f6; border-radius: 8px; height: 24px; overflow: hidden; display: flex; }
    .bar-ipa { background: #10b981; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 600; }
    .bar-ips { background: #f59e0b; display: flex; align-items: center; justify-content: center; color: white; font-size: 11px; font-weight: 600; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #9ca3af; text-align: center; }
  </style>
</head>
<body>
  <div class="no-print" style="position:fixed;top:0;left:0;right:0;background:white;border-bottom:1px solid #e5e7eb;padding:12px 20px;display:flex;justify-content:space-between;align-items:center;z-index:999;">
    <span style="font-weight:600;color:#374151;">Preview Laporan Rekomendasi Jurusan</span>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#059669;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;">📥 Download PDF</button>
      <button onclick="window.close()" style="background:#6b7280;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">Tutup</button>
    </div>
  </div>
  <div style="margin-top:56px;">
    <div class="header-bar">
      <h1>Laporan Rekomendasi Jurusan Kelas X</h1>
      <p>${dateStr}</p>
    </div>
    <h2 style="border:none;margin:0;padding:0;">${student.nama}</h2>
    <p style="font-size:13px;color:#6b7280;">NIS: ${student.nis} &bull; Rombel: ${student.rombelNama}</p>

    <div class="stats-row">
      <div class="stat-card"><div class="stat-value" style="color:#059669;">${student.ipaScore.toFixed(1)}</div><div class="stat-label">Skor IPA</div></div>
      <div class="stat-card"><div class="stat-value" style="color:#d97706;">${student.ipsScore.toFixed(1)}</div><div class="stat-label">Skor IPS</div></div>
      <div class="stat-card"><div class="stat-value">${student.overallAvg.toFixed(1)}</div><div class="stat-label">Rata-rata Nilai</div></div>
      <div class="stat-card"><div class="stat-value">${student.confidence}%</div><div class="stat-label">Akurasi</div></div>
    </div>

    <h2>Perbandingan IPA vs IPS</h2>
    <div class="bar-container" style="margin:8px 0 16px;">
      <div class="bar-ipa" style="width:${Math.max(student.ipaScore, 5)}%;">IPA ${student.ipaScore.toFixed(1)}</div>
      <div class="bar-ips" style="width:${Math.max(student.ipsScore, 5)}%;">IPS ${student.ipsScore.toFixed(1)}</div>
    </div>

    <h2>Detail Nilai Mapel IPA</h2>
    <table style="font-size:13px;">
      <thead><tr style="background:#f9fafb;"><th style="padding:8px;border:1px solid #ddd;">Mata Pelajaran</th><th style="padding:8px;border:1px solid #ddd;text-align:center;">Rerata</th><th style="padding:8px;border:1px solid #ddd;text-align:center;">Bobot</th></tr></thead>
      <tbody>${ipaSubjectRows}</tbody>
    </table>

    <h2>Detail Nilai Mapel IPS</h2>
    <table style="font-size:13px;">
      <thead><tr style="background:#f9fafb;"><th style="padding:8px;border:1px solid #ddd;">Mata Pelajaran</th><th style="padding:8px;border:1px solid #ddd;text-align:center;">Rerata</th><th style="padding:8px;border:1px solid #ddd;text-align:center;">Bobot</th></tr></thead>
      <tbody>${ipsSubjectRows}</tbody>
    </table>

    <h2>Alasan Rekomendasi</h2>
    <ul style="font-size:13px;padding-left:20px;">${reasoningHTML}</ul>

    <div class="footer">
      <p>Laporan ini dihasilkan secara otomatis oleh Sistem Rekomendasi Jurusan — ${dateStr}</p>
      <p>Hasil analisis bersifat rekomendasi dan perlu dikonsultasikan dengan pihak bimbingan konseling</p>
    </div>
  </div>
</body>
</html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) {
      win.onload = () => URL.revokeObjectURL(url)
    } else {
      toast({ title: 'Gagal membuka preview', description: 'Izinkan popup untuk melihat laporan', variant: 'destructive' })
    }
  }

  if (loading && students.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Menganalisis data nilai siswa...</p>
        </div>
      </div>
    )
  }

  if (students.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-8 text-center">
            <Compass className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">Belum ada data siswa kelas 10 untuk dianalisis</p>
            <p className="text-xs text-muted-foreground mt-1">Import leger nilai kelas 10 terlebih dahulu</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Analisa Jurusan IPA / IPS</h2>
          <Badge variant="outline" className="text-xs">Kelas X</Badge>
        </div>
        {availableRombels.length > 1 && (
          <Select value={filterRombel} onValueChange={setFilterRombel}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Semua Rombel" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Rombel Kelas X</SelectItem>
              {availableRombels.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.nama} ({r.siswaCount} siswa)</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10">
            <CardContent className="p-3 flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xl font-bold text-emerald-700">{summary.ipaCount}</p>
                <p className="text-[11px] text-muted-foreground">Rekomendasi IPA</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
            <CardContent className="p-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-orange-600 shrink-0" />
              <div>
                <p className="text-xl font-bold text-orange-700">{summary.ipsCount}</p>
                <p className="text-[11px] text-muted-foreground">Rekomendasi IPS</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xl font-bold">{summary.withNilaiCount}<span className="text-sm font-normal text-muted-foreground">/{summary.total}</span></p>
                <p className="text-[11px] text-muted-foreground">Siswa Ada Nilai</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xl font-bold text-purple-700">{summary.avgConfidence}%</p>
                <p className="text-[11px] text-muted-foreground">Rata-rata Akurasi</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Distribution Bar */}
      {summary && summary.withNilaiCount > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Distribusi Rekomendasi</span>
                <span className="text-muted-foreground">{summary.withNilaiCount} siswa dengan nilai</span>
              </div>
              <div className="flex h-6 rounded-full overflow-hidden bg-muted">
                {summary.ipaCount > 0 && (
                  <div
                    className="bg-emerald-500 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(summary.ipaCount / summary.withNilaiCount) * 100}%` }}
                  >
                    {summary.ipaCount > 2 && `IPA ${summary.ipaCount}`}
                  </div>
                )}
                {summary.netralCount > 0 && (
                  <div
                    className="bg-gray-400 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(summary.netralCount / summary.withNilaiCount) * 100}%` }}
                  >
                    {summary.netralCount > 2 && `Netral ${summary.netralCount}`}
                  </div>
                )}
                {summary.ipsCount > 0 && (
                  <div
                    className="bg-orange-500 flex items-center justify-center text-[10px] text-white font-medium"
                    style={{ width: `${(summary.ipsCount / summary.withNilaiCount) * 100}%` }}
                  >
                    {summary.ipsCount > 2 && `IPS ${summary.ipsCount}`}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> IPA: {summary.ipaCount} siswa</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gray-400" /> Netral: {summary.netralCount} siswa</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> IPS: {summary.ipsCount} siswa</span>
                {summary.withoutNilaiCount > 0 && (
                  <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" /> Belum ada nilai: {summary.withoutNilaiCount}</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Subject Mapping Info */}
      {subjectMapping && (
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1.5 flex items-center gap-1"><FlaskConical className="h-3.5 w-3.5" /> Mapel IPA (Bobot)</p>
                <div className="flex flex-wrap gap-1.5">
                  {subjectMapping.ipa.map(s => (
                    <Badge key={s.name} variant="outline" className="text-[10px] border-emerald-200">
                      {s.label} <span className="text-emerald-600 font-semibold ml-0.5">×{s.weight}</span>
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-orange-700 mb-1.5 flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Mapel IPS (Bobot)</p>
                <div className="flex flex-wrap gap-1.5">
                  {subjectMapping.ips.map(s => (
                    <Badge key={s.name} variant="outline" className="text-[10px] border-orange-200">
                      {s.label} <span className="text-orange-600 font-semibold ml-0.5">×{s.weight}</span>
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1"><Minus className="h-3.5 w-3.5" /> Netral (Bobot Rendah)</p>
                <div className="flex flex-wrap gap-1.5">
                  {subjectMapping.neutral.map(s => (
                    <Badge key={s.name} variant="outline" className="text-[10px]">
                      {s.label} <span className="text-muted-foreground ml-0.5">×{s.ipaWeight}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Card>
        <Tabs defaultValue="tabel">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Hasil Analisa Siswa Kelas X</CardTitle>
              <TabsList>
                <TabsTrigger value="tabel">Tabel Rekomendasi</TabsTrigger>
                <TabsTrigger value="perbandingan">Perbandingan IPA vs IPS</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Table View */}
            <TabsContent value="tabel" className="m-0 space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">No</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead>Rombel</TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1"><FlaskConical className="h-3.5 w-3.5 text-emerald-600" /> IPA</span>
                      </TableHead>
                      <TableHead className="text-center">
                        <span className="flex items-center justify-center gap-1"><Globe className="h-3.5 w-3.5 text-orange-600" /> IPS</span>
                      </TableHead>
                      <TableHead className="text-center">Gap</TableHead>
                      <TableHead className="text-center">Konsistensi</TableHead>
                      <TableHead className="text-center">Rekomendasi</TableHead>
                      <TableHead className="text-center">Akurasi</TableHead>
                      <TableHead className="w-20 text-center">Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map((s, idx) => (
                      <TableRow
                        key={s.siswaId}
                        className={`cursor-pointer hover:bg-muted/50 ${selectedStudent?.siswaId === s.siswaId ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}`}
                        onClick={() => setSelectedStudent(s)}
                      >
                        <TableCell className="text-center text-muted-foreground">{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{s.nama}</p>
                            <p className="text-[11px] text-muted-foreground">{s.nis}</p>
                          </div>
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.rombelNama}</Badge></TableCell>
                        <TableCell className={`text-center font-semibold ${scoreColor(s.ipaScore)}`}>{s.ipaScore.toFixed(1)}</TableCell>
                        <TableCell className={`text-center font-semibold ${scoreColor(s.ipsScore)}`}>{s.ipsScore.toFixed(1)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-medium ${s.ipaIpsGap > 0 ? 'text-emerald-600' : s.ipaIpsGap < 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                            {s.ipaIpsGap > 0 ? '+' : ''}{s.ipaIpsGap.toFixed(1)}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Progress value={s.consistency * 100} className="h-1.5 w-12" />
                            <span className="text-[11px] text-muted-foreground">{Math.round(s.consistency * 100)}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{rekomendasiBadge(s.rekomendasi)}</TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold ${s.confidence >= 80 ? 'text-emerald-600' : s.confidence >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {s.confidence}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={(e) => { e.stopPropagation(); setSelectedStudent(s) }}>
                            Lihat
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Halaman {page} dari {totalPages} ({students.length} siswa)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Comparison View */}
            <TabsContent value="perbandingan" className="m-0 space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>Nama Siswa</TableHead>
                      <TableHead className="text-center">Skor IPA</TableHead>
                      <TableHead className="text-center">Skor IPS</TableHead>
                      <TableHead>Perbandingan Visual</TableHead>
                      <TableHead className="text-center">Selisih</TableHead>
                      <TableHead className="text-center">Trend IPA</TableHead>
                      <TableHead className="text-center">Trend IPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedStudents.map((s, idx) => {
                      const maxScore = Math.max(s.ipaScore, s.ipsScore, 1)
                      const ipaWidth = (s.ipaScore / maxScore) * 100
                      const ipsWidth = (s.ipsScore / maxScore) * 100
                      return (
                        <TableRow key={s.siswaId}>
                          <TableCell className="text-muted-foreground">{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{s.nama}</p>
                            <p className="text-[11px] text-muted-foreground">{s.rombelNama}</p>
                          </TableCell>
                          <TableCell className={`text-center font-semibold ${scoreColor(s.ipaScore)}`}>{s.ipaScore.toFixed(1)}</TableCell>
                          <TableCell className={`text-center font-semibold ${scoreColor(s.ipsScore)}`}>{s.ipsScore.toFixed(1)}</TableCell>
                          <TableCell>
                            <div className="space-y-1 min-w-[120px]">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-emerald-600 w-6 font-medium">IPA</span>
                                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${ipaWidth}%` }} />
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] text-orange-600 w-6 font-medium">IPS</span>
                                <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-orange-500 rounded-full" style={{ width: `${ipsWidth}%` }} />
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`text-sm font-semibold ${s.ipaIpsGap > 0 ? 'text-emerald-600' : s.ipaIpsGap < 0 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                              {s.ipaIpsGap > 0 ? '+' : ''}{s.ipaIpsGap.toFixed(1)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {trendIcon(s.semesterTrend.ipaTrend)}
                              <span className={`text-[11px] ${s.semesterTrend.ipaTrend > 0 ? 'text-emerald-600' : s.semesterTrend.ipaTrend < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {s.semesterTrend.ipaTrend > 0 ? '+' : ''}{s.semesterTrend.ipaTrend.toFixed(1)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              {trendIcon(s.semesterTrend.ipsTrend)}
                              <span className={`text-[11px] ${s.semesterTrend.ipsTrend > 0 ? 'text-emerald-600' : s.semesterTrend.ipsTrend < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                                {s.semesterTrend.ipsTrend > 0 ? '+' : ''}{s.semesterTrend.ipsTrend.toFixed(1)}
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Halaman {page} dari {totalPages} ({students.length} siswa)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Student Detail Panel */}
      {selectedStudent && (
        <Card className={`border-2 ${selectedStudent.rekomendasi.includes('IPA') ? 'border-emerald-300' : selectedStudent.rekomendasi.includes('IPS') ? 'border-orange-300' : 'border-muted'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${selectedStudent.rekomendasi.includes('IPA') ? 'bg-emerald-100 dark:bg-emerald-900/30' : selectedStudent.rekomendasi.includes('IPS') ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-muted'}`}>
                  {selectedStudent.rekomendasi.includes('IPA') ? <FlaskConical className="h-5 w-5 text-emerald-600" /> : <Globe className="h-5 w-5 text-orange-600" />}
                </div>
                <div>
                  <CardTitle className="text-base">{selectedStudent.nama}</CardTitle>
                  <CardDescription>{selectedStudent.nis} • {selectedStudent.rombelNama}</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {rekomendasiBadge(selectedStudent.rekomendasi)}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => handlePreviewReportX(selectedStudent)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Cetak Laporan
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedStudent(null)}>✕</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Score Comparison */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/5">
                <CardContent className="p-3 text-center">
                  <FlaskConical className="h-4 w-4 text-emerald-600 mx-auto mb-1" />
                  <p className={`text-2xl font-bold ${scoreColor(selectedStudent.ipaScore)}`}>{selectedStudent.ipaScore.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">Skor IPA</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {trendIcon(selectedStudent.semesterTrend.ipaTrend)}
                    <span className="text-[10px] text-muted-foreground">
                      {selectedStudent.semesterTrend.ipaTrend > 0 ? 'Meningkat' : selectedStudent.semesterTrend.ipaTrend < 0 ? 'Menurun' : 'Stabil'}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/5">
                <CardContent className="p-3 text-center">
                  <Globe className="h-4 w-4 text-orange-600 mx-auto mb-1" />
                  <p className={`text-2xl font-bold ${scoreColor(selectedStudent.ipsScore)}`}>{selectedStudent.ipsScore.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">Skor IPS</p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {trendIcon(selectedStudent.semesterTrend.ipsTrend)}
                    <span className="text-[10px] text-muted-foreground">
                      {selectedStudent.semesterTrend.ipsTrend > 0 ? 'Meningkat' : selectedStudent.semesterTrend.ipsTrend < 0 ? 'Menurun' : 'Stabil'}
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <BarChart3 className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-2xl font-bold">{selectedStudent.overallAvg.toFixed(1)}</p>
                  <p className="text-[11px] text-muted-foreground">Rata-rata Total</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Brain className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                  <p className={`text-2xl font-bold ${selectedStudent.confidence >= 80 ? 'text-emerald-600' : selectedStudent.confidence >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {selectedStudent.confidence}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">Tingkat Akurasi</p>
                </CardContent>
              </Card>
            </div>

            {/* Visual Score Comparison Bar */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Perbandingan Skor IPA vs IPS</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8 text-emerald-600 font-medium">IPA</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(selectedStudent.ipaScore, 5)}%` }}
                    >
                      <span className="text-[10px] text-white font-semibold">{selectedStudent.ipaScore.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs w-8 text-orange-600 font-medium">IPS</span>
                  <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full flex items-center justify-end pr-2"
                      style={{ width: `${Math.max(selectedStudent.ipsScore, 5)}%` }}
                    >
                      <span className="text-[10px] text-white font-semibold">{selectedStudent.ipsScore.toFixed(1)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Subject Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* IPA Subjects */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <FlaskConical className="h-4 w-4 text-emerald-600" />
                  Mapel IPA
                  <Badge variant="outline" className="text-[10px] ml-1">{selectedStudent.ipaSubjects.length} mapel</Badge>
                </p>
                {selectedStudent.ipaSubjects.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedStudent.ipaSubjects.map(s => (
                      <div key={s.mapel} className="flex items-center justify-between">
                        <span className="text-xs">{s.mapel}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-emerald-600">×{s.weight}</span>
                          <span className={`text-xs font-semibold ${scoreColor(s.rerata)}`}>{s.rerata.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Tidak ada data mapel IPA</p>
                )}
              </div>

              {/* IPS Subjects */}
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                  <Globe className="h-4 w-4 text-orange-600" />
                  Mapel IPS
                  <Badge variant="outline" className="text-[10px] ml-1">{selectedStudent.ipsSubjects.length} mapel</Badge>
                </p>
                {selectedStudent.ipsSubjects.length > 0 ? (
                  <div className="space-y-1.5">
                    {selectedStudent.ipsSubjects.map(s => (
                      <div key={s.mapel} className="flex items-center justify-between">
                        <span className="text-xs">{s.mapel}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-orange-600">×{s.weight}</span>
                          <span className={`text-xs font-semibold ${scoreColor(s.rerata)}`}>{s.rerata.toFixed(1)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Tidak ada data mapel IPS</p>
                )}
              </div>
            </div>

            {/* Consistency */}
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Konsistensi Nilai</p>
              <div className="flex items-center gap-3">
                <Progress value={selectedStudent.consistency * 100} className="h-2 flex-1" />
                <span className={`text-sm font-semibold ${selectedStudent.consistency >= 0.85 ? 'text-emerald-600' : selectedStudent.consistency >= 0.6 ? 'text-amber-600' : 'text-red-600'}`}>
                  {Math.round(selectedStudent.consistency * 100)}%
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {selectedStudent.consistency >= 0.85
                  ? 'Nilai sangat konsisten — performa stabil di semua mapel'
                  : selectedStudent.consistency >= 0.6
                    ? 'Nilai cukup konsisten — ada sedikit variasi antar mapel'
                    : 'Nilai kurang konsisten — terdapat variasi signifikan antar mapel'}
              </p>
            </div>

            <Separator />

            {/* Reasoning */}
            <div>
              {/* Multi-Factor Score Visualization */}
              {selectedStudent.factorScores && (
                <div className="space-y-3">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-purple-500" />
                    Analisa Multi-Faktor
                    <Badge variant="outline" className="text-[10px] ml-1">V2</Badge>
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {/* Composite Score */}
                    <div className="col-span-1 sm:col-span-2 bg-muted/30 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold">Skor Komposit</span>
                        <span className={`text-lg font-bold ${selectedStudent.factorScores.compositeScore > 0.8 ? 'text-emerald-600' : selectedStudent.factorScores.compositeScore < -0.8 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                          {selectedStudent.factorScores.compositeScore > 0 ? '+' : ''}{selectedStudent.factorScores.compositeScore.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                        <div
                          className={`h-full rounded-l-full ${selectedStudent.factorScores.compositeScore > 0 ? 'bg-emerald-500' : 'bg-orange-500'}`}
                          style={{ width: `${Math.min(50, Math.abs(selectedStudent.factorScores.compositeScore) / 5 * 50)}%`, marginLeft: selectedStudent.factorScores.compositeScore < 0 ? `${50 - Math.min(50, Math.abs(selectedStudent.factorScores.compositeScore) / 5 * 50)}%` : '50%' }}
                        />
                      </div>
                      <div className="flex justify-between text-[9px] text-muted-foreground mt-0.5">
                        <span>IPS</span>
                        <span className="text-muted-foreground/50">|</span>
                        <span>IPA</span>
                      </div>
                    </div>
                    {/* Individual Factors */}
                    {[
                      { label: 'Selisih Rata-rata', score: selectedStudent.factorScores.gapScore, icon: '📊' },
                      { label: 'Dominasi Mapel', score: selectedStudent.factorScores.dominanceScore, icon: '📈' },
                      { label: 'Top-3 Mapel', score: selectedStudent.factorScores.topNScore, icon: '🏆' },
                      { label: 'Mapel Terkuat', score: selectedStudent.factorScores.strengthDiffScore, icon: '💪' },
                      { label: 'Tren Perkembangan', score: selectedStudent.factorScores.trendScore, icon: '📉' },
                    ].map(f => (
                      <div key={f.label} className="flex items-center justify-between bg-muted/20 rounded-md px-2.5 py-1.5">
                        <span className="text-[11px] text-muted-foreground">{f.icon} {f.label}</span>
                        <span className={`text-xs font-semibold ${f.score > 0.1 ? 'text-emerald-600' : f.score < -0.1 ? 'text-orange-600' : 'text-muted-foreground'}`}>
                          {f.score > 0 ? '+' : ''}{f.score.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                Analisis Detail
              </p>
              <div className="space-y-1.5">
                {selectedStudent.reasoning.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">{r}</p>
                  </div>
                ))}
              </div>
            </div>

            <Separator />

            {/* Neutral/Excluded Subjects */}
            {selectedStudent.neutralSubjects.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Mapel Netral (tidak mempengaruhi rekomendasi):</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedStudent.neutralSubjects.map(s => (
                    <Badge key={s.mapel} variant="outline" className="text-[10px]">
                      {s.mapel}: <span className={`ml-0.5 ${scoreColor(s.rerata)}`}>{s.rerata.toFixed(1)}</span>
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Methodology Note */}
            <div className="bg-muted/50 rounded-lg p-3 mt-2">
              <p className="text-[11px] text-muted-foreground">
                <strong>Metodologi:</strong> Analisa menggunakan weighted scoring multi-faktor yang mempertimbangkan:
                nilai rata-rata mapel IPA & IPS (dengan bobot), konsistensi nilai, tren semester,
                dan kelengkapan data. Skor dihitung berdasarkan rata-rata tertimbang dari mata pelajaran
                yang relevan dengan jurusan IPA dan IPS. Mapel inti (Matematika, Fisika, Kimia, Biologi untuk IPA;
                Ekonomi, Geografi, Sosiologi, Sejarah untuk IPS) memiliki bobot tertinggi.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
