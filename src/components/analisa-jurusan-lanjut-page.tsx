'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  GraduationCap, FlaskConical, Globe, Loader2, ChevronLeft, ChevronRight,
  ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, AlertCircle,
  CheckCircle2, BarChart3, Brain, Sparkles, Users, BookOpen, Target,
  FileText, X, Zap, Shield, ArrowRight, Printer, Download, Eye,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

// ============================================================
// TYPES
// ============================================================

interface MajorScore {
  nama: string
  skor: number
  mapelDetail: { mapel: string; rerata: number; weight: number; contribution: number }[]
  specificJurusan?: { jurusan: string; deskripsi: string; prospek: string }[]
  trendAdjustment?: number
}

interface SubjectTrend {
  mapel: string
  trend: number
  earlyAvg: number
  lateAvg: number
}

interface TKAData {
  bindonilai: number; bindokategori: string
  matnilai: number; matkategori: string
  bingnilai: number; bingkategori: string
  pilihan1nama: string; pilihan1nilai: number; pilihan1kategori: string
  pilihan2nama: string; pilihan2nilai: number; pilihan2kategori: string
}

interface AnalysisResult {
  siswaid: string; nama: string; nis: string; nisn: string
  rombelNama: string; rombelid: string; rombelJurusan: string; kelas: number
  ipaInclination: number
  ipsInclination: number
  dominantTrack: 'IPA' | 'IPS' | 'Seimbang'
  topMajors: MajorScore[]
  allMajorScores: MajorScore[]
  subjectTrends: SubjectTrend[]
  tkaData: TKAData | null
  tkaAdjustedMajors: MajorScore[] | null
  overallAvg: number; consistency: number
  semesterTrend: { ipaTrend: number; ipsTrend: number }
  reasoning: string[]; confidence: number
  hasNilai: boolean; hasTKA: boolean
}

interface Summary {
  total: number; withNilaiCount: number; withoutNilaiCount: number
  ipaTrackCount: number; ipsTrackCount: number; balancedCount: number
  tkaCount: number
  majorDistribution: { major: string; count: number; track: string }[]
  avgConfidence: number
}

interface SubjectMappingItem { name: string; weight: number }
interface SubjectMappingGroup { name: string; subjects: SubjectMappingItem[] }
interface SubjectMapping { ipaMajors: SubjectMappingGroup[]; ipsMajors: SubjectMappingGroup[] }

const PAGE_SIZE = 20

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function trackBadge(track: 'IPA' | 'IPS' | 'Seimbang') {
  if (track === 'IPA') return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-300 font-semibold text-xs">IPA</Badge>
  if (track === 'IPS') return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-300 font-semibold text-xs">IPS</Badge>
  return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-300 text-xs">Seimbang</Badge>
}

function scoreColor(val: number) {
  if (val >= 85) return 'text-emerald-600 font-semibold'
  if (val >= 75) return 'text-green-600'
  if (val >= 60) return 'text-amber-600'
  return 'text-red-600 font-semibold'
}

function scoreBgColor(val: number) {
  if (val >= 85) return 'bg-emerald-500'
  if (val >= 75) return 'bg-green-500'
  if (val >= 60) return 'bg-amber-500'
  return 'bg-red-500'
}

function confidenceColor(val: number) {
  if (val >= 80) return 'text-emerald-600'
  if (val >= 60) return 'text-amber-600'
  return 'text-red-600'
}

function trendIcon(val: number) {
  if (val > 2) return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
  if (val < -2) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
}

function tkaKategoriBadge(kategori: string) {
  if (!kategori) return null
  const lower = kategori.toLowerCase()
  if (lower.includes('tinggi') || lower.includes('sangat')) return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 text-[10px]">{kategori}</Badge>
  if (lower.includes('sedang') || lower.includes('cukup')) return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 text-[10px]">{kategori}</Badge>
  if (lower.includes('rendah') || lower.includes('kurang')) return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 text-[10px]">{kategori}</Badge>
  return <Badge variant="outline" className="text-[10px]">{kategori}</Badge>
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function AnalisaJurusanLanjutPage() {
  const { toast } = useToast()

  // Core state
  const [kelas, setKelas] = useState<11 | 12>(12)
  const [filterRombel, setFilterRombel] = useState<string>('all')
  const [students, setStudents] = useState<AnalysisResult[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [subjectMapping, setSubjectMapping] = useState<SubjectMapping | null>(null)
  const [availableRombels, setAvailableRombels] = useState<{ id: string; nama: string; siswaCount: number }[]>([])
  const [loading, setLoading] = useState(true)

  // Table state
  const [page, setPage] = useState(1)

  // Detail panel state
  const [selectedStudent, setSelectedStudent] = useState<AnalysisResult | null>(null)

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiElapsed, setAiElapsed] = useState(0)

  // Collapsible mapping state
  const [mappingOpen, setMappingOpen] = useState(false)

  // Report preview state
  const [reportOpen, setReportOpen] = useState(false)

  // ============================================================
  // DATA FETCHING
  // ============================================================

  const fetchData = useCallback(async (k: number, rombelid?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('kelas', String(k))
      if (rombelid && rombelid !== 'all') params.set('rombelid', rombelid)
      const res = await fetch(`/api/analisa-jurusan-lanjut?${params}`)
      if (!res.ok) throw new Error('Gagal memuat data')
      const json = await res.json()
      setStudents(json.students || [])
      setSummary(json.summary || null)
      setSubjectMapping(json.subjectMapping || null)
      setAvailableRombels(json.availableRombels || [])
    } catch {
      toast({ title: 'Gagal memuat data analisa jurusan lanjut', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData(kelas)
  }, [kelas, fetchData])

  useEffect(() => {
    if (filterRombel === 'all') {
      fetchData(kelas)
    } else {
      fetchData(kelas, filterRombel)
    }
    setPage(1)
    setSelectedStudent(null)
    setAiAnalysis(null)
  }, [filterRombel, fetchData, kelas])

  const handleKelasChange = (val: string) => {
    const k = parseInt(val) as 11 | 12
    setKelas(k)
    setFilterRombel('all')
    setPage(1)
    setSelectedStudent(null)
    setAiAnalysis(null)
  }

  // ============================================================
  // AI ANALYSIS
  // ============================================================

  const abortControllerRef = useRef<AbortController | null>(null)
  const aiTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchAiAnalysis = async (siswaid: string) => {
    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
    if (aiTimerRef.current) {
      clearInterval(aiTimerRef.current)
    }
    const controller = new AbortController()
    abortControllerRef.current = controller

    setAiLoading(true)
    setAiAnalysis(null)
    setAiElapsed(0)

    // Start elapsed timer
    const startTime = Date.now()
    aiTimerRef.current = setInterval(() => {
      setAiElapsed(Math.floor((Date.now() - startTime) / 1000))
    }, 1000)

    try {
      // Set a 5-minute timeout (LLM can take up to 2-3 minutes)
      const timeoutId = setTimeout(() => controller.abort(), 300000)

      const res = await fetch('/api/analisa-jurusan-lanjut/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siswaid }),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        const errorMsg = json.error || json.detail || 'Gagal menghasilkan analisis'
        throw new Error(errorMsg)
      }
      const json = await res.json()

      if (!json.analysis || json.analysis.trim().length < 10) {
        throw new Error('AI menghasilkan respons kosong. Silakan coba lagi.')
      }

      setAiAnalysis(json.analysis)
      toast({ title: 'Analisis AI berhasil!', description: 'Hasil analisis siap dilihat', variant: 'default' })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        toast({
          title: 'Analisis AI dibatalkan',
          description: 'Permintaan membutuhkan waktu terlalu lama. Coba lagi nanti.',
          variant: 'destructive'
        })
      } else {
        const msg = err instanceof Error ? err.message : 'Silakan coba lagi'
        toast({
          title: 'Gagal menghasilkan analisis AI',
          description: msg,
          variant: 'destructive'
        })
      }
    } finally {
      setAiLoading(false)
      if (aiTimerRef.current) {
        clearInterval(aiTimerRef.current)
        aiTimerRef.current = null
      }
      abortControllerRef.current = null
    }
  }

  // ============================================================
  // REPORT GENERATION
  // ============================================================

  const generateReportHTML = (student: AnalysisResult, aiText: string | null): string => {
    const kelasLabel = student.kelas === 11 ? 'XI' : 'XII'
    const now = new Date()
    const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

    const topMajorsHTML = student.topMajors.slice(0, 5).map((m, i) => `
      <tr>
        <td style="text-align:center;font-weight:bold;padding:8px;border:1px solid #ddd;">${i + 1}</td>
        <td style="padding:8px;border:1px solid #ddd;font-weight:${i === 0 ? 'bold' : 'normal'};">${m.nama}</td>
        <td style="text-align:center;padding:8px;border:1px solid #ddd;font-weight:bold;color:${m.skor >= 85 ? '#059669' : m.skor >= 75 ? '#16a34a' : m.skor >= 60 ? '#d97706' : '#dc2626'};">${m.skor.toFixed(1)}${m.trendAdjustment && Math.abs(m.trendAdjustment) > 0.1 ? (m.trendAdjustment > 0 ? ` (+${m.trendAdjustment.toFixed(1)} tren)` : ` (${m.trendAdjustment.toFixed(1)} tren)`) : ''}</td>
        <td style="padding:8px;border:1px solid #ddd;font-size:11px;">${m.mapelDetail.slice(0, 4).map(d => `${d.mapel} (${d.rerata.toFixed(1)})`).join(', ')}</td>
        <td style="padding:8px;border:1px solid #ddd;font-size:11px;">${m.specificJurusan ? m.specificJurusan.slice(0, 3).map(j => j.jurusan).join(', ') : '-'}</td>
      </tr>
    `).join('')

    const tkaHTML = student.tkaData ? `
      <div style="margin-top:20px;">
        <h3 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:6px;margin-bottom:12px;">📊 Data TKA (Tes Kompetensi Akademik)</h3>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:8px;border:1px solid #ddd;text-align:left;">Mata Pelajaran</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:center;">Nilai</th>
              <th style="padding:8px;border:1px solid #ddd;text-align:center;">Kategori</th>
            </tr>
          </thead>
          <tbody>
            <tr><td style="padding:8px;border:1px solid #ddd;">Bahasa Indonesia</td><td style="text-align:center;padding:8px;border:1px solid #ddd;font-weight:bold;">${student.tkaData.bindonilai}</td><td style="text-align:center;padding:8px;border:1px solid #ddd;">${student.tkaData.bindokategori}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;">Matematika</td><td style="text-align:center;padding:8px;border:1px solid #ddd;font-weight:bold;">${student.tkaData.matnilai}</td><td style="text-align:center;padding:8px;border:1px solid #ddd;">${student.tkaData.matkategori}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;">Bahasa Inggris</td><td style="text-align:center;padding:8px;border:1px solid #ddd;font-weight:bold;">${student.tkaData.bingnilai}</td><td style="text-align:center;padding:8px;border:1px solid #ddd;">${student.tkaData.bingkategori}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;">${student.tkaData.pilihan1nama || 'Pilihan 1'}</td><td style="text-align:center;padding:8px;border:1px solid #ddd;font-weight:bold;">${student.tkaData.pilihan1nilai}</td><td style="text-align:center;padding:8px;border:1px solid #ddd;">${student.tkaData.pilihan1kategori}</td></tr>
            <tr><td style="padding:8px;border:1px solid #ddd;">${student.tkaData.pilihan2nama || 'Pilihan 2'}</td><td style="text-align:center;padding:8px;border:1px solid #ddd;font-weight:bold;">${student.tkaData.pilihan2nilai}</td><td style="text-align:center;padding:8px;border:1px solid #ddd;">${student.tkaData.pilihan2kategori}</td></tr>
          </tbody>
        </table>
        <p style="font-size:11px;color:#6b7280;margin-top:6px;">Rata-rata Wajib: ${((student.tkaData.bindonilai + student.tkaData.matnilai + student.tkaData.bingnilai) / 3).toFixed(1)}</p>
      </div>
    ` : ''

    const aiSectionHTML = aiText ? `
      <div style="margin-top:20px;">
        <h3 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:6px;margin-bottom:12px;">🤖 Analisis AI Mendalam</h3>
        <div style="font-size:13px;line-height:1.7;color:#374151;">${aiText.replace(/\n/g, '<br/>').replace(/^## (.+)$/gm, '<h4 style="font-size:14px;font-weight:bold;color:#1f2937;margin:12px 0 6px;">$1</h4>').replace(/^### (.+)$/gm, '<h5 style="font-size:13px;font-weight:bold;color:#374151;margin:10px 0 4px;">$1</h5>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/^- (.+)$/gm, '• $1')}</div>
      </div>
    ` : '<p style="font-size:12px;color:#9ca3af;margin-top:20px;font-style:italic;">Analisis AI belum dilakukan. Klik "Mulai Analisis AI" terlebih dahulu untuk mendapatkan analisis mendalam.</p>'

    const reasoningHTML = student.reasoning.map(r => `<li style="margin-bottom:4px;">${r}</li>`).join('')

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Laporan Analisa Jurusan - ${student.nama}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print {
      body { margin: 0; padding: 0; }
      .no-print { display: none !important; }
    }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1f2937; line-height: 1.5; margin: 0; padding: 20px; }
    h1 { font-size: 22px; color: #059669; margin-bottom: 4px; }
    h2 { font-size: 16px; color: #374151; margin-top: 24px; border-bottom: 2px solid #e5e7eb; padding-bottom: 6px; }
    h3 { font-size: 14px; margin-top: 16px; }
    table { border-collapse: collapse; width: 100%; }
    th { background: #f9fafb; font-weight: 600; text-align: left; }
    .header-bar { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; }
    .header-bar h1 { color: white; margin: 0; font-size: 20px; }
    .header-bar p { color: rgba(255,255,255,0.9); margin: 4px 0 0; font-size: 13px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; margin-bottom: 16px; }
    .info-label { color: #6b7280; }
    .info-value { font-weight: 600; }
    .track-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 13px; }
    .track-ipa { background: #d1fae5; color: #065f46; }
    .track-ips { background: #fef3c7; color: #92400e; }
    .track-balance { background: #f1f5f9; color: #475569; }
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
    <span style="font-weight:600;color:#374151;">Preview Laporan Analisa Jurusan</span>
    <div style="display:flex;gap:8px;">
      <button onclick="window.print()" style="background:#059669;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:6px;">
        📥 Download PDF
      </button>
      <button onclick="window.close()" style="background:#6b7280;color:white;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;">
        Tutup
      </button>
    </div>
  </div>
  <div style="margin-top:56px;">
    <div class="header-bar">
      <h1>Laporan Analisa Jurusan Perguruan Tinggi</h1>
      <p>${dateStr}</p>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:12px;">
      <div>
        <h2 style="border:none;margin:0;padding:0;">${student.nama}</h2>
        <div class="info-grid" style="margin-top:8px;">
          <div><span class="info-label">NIS:</span> <span class="info-value">${student.nis}</span></div>
          <div><span class="info-label">NISN:</span> <span class="info-value">${student.nisn}</span></div>
          <div><span class="info-label">Rombel:</span> <span class="info-value">${student.rombelNama}</span></div>
          <div><span class="info-label">Kelas:</span> <span class="info-value">${kelasLabel}</span></div>
        </div>
      </div>
      <div>
        <span class="track-badge ${student.dominantTrack === 'IPA' ? 'track-ipa' : student.dominantTrack === 'IPS' ? 'track-ips' : 'track-balance'}">
          ${student.dominantTrack === 'IPA' ? '🔬 Jalur IPA' : student.dominantTrack === 'IPS' ? '🌍 Jalur IPS' : '⚖️ Seimbang'}
        </span>
      </div>
    </div>

    <h2>Kecondongan Jalur</h2>
    <div class="bar-container" style="margin:8px 0;">
      <div class="bar-ipa" style="width:${student.ipaInclination}%;">${student.ipaInclination >= 15 ? `IPA ${student.ipaInclination}%` : ''}</div>
      <div class="bar-ips" style="width:${student.ipsInclination}%;">${student.ipsInclination >= 15 ? `IPS ${student.ipsInclination}%` : ''}</div>
    </div>
    <div style="display:flex;gap:16px;font-size:12px;color:#6b7280;margin-bottom:4px;">
      <span>🟢 IPA: ${student.ipaInclination}%</span>
      <span>🟡 IPS: ${student.ipsInclination}%</span>
      <span>Tren IPA: ${student.semesterTrend.ipaTrend > 0 ? '+' : ''}${student.semesterTrend.ipaTrend.toFixed(1)}</span>
      <span>Tren IPS: ${student.semesterTrend.ipsTrend > 0 ? '+' : ''}${student.semesterTrend.ipsTrend.toFixed(1)}</span>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-value" style="color:${student.overallAvg >= 85 ? '#059669' : student.overallAvg >= 75 ? '#16a34a' : student.overallAvg >= 60 ? '#d97706' : '#dc2626'};">${student.overallAvg.toFixed(1)}</div>
        <div class="stat-label">Rata-rata Nilai</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${Math.round(student.consistency * 100)}%</div>
        <div class="stat-label">Konsistensi</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color:${student.confidence >= 80 ? '#059669' : student.confidence >= 60 ? '#d97706' : '#dc2626'};">${student.confidence}%</div>
        <div class="stat-label">Akurasi Analisis</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${student.topMajors.length}</div>
        <div class="stat-label">Jurusan Rekomendasi</div>
      </div>
    </div>

    <h2>Top 5 Jurusan Rekomendasi${student.tkaAdjustedMajors ? ' <span style="font-size:11px;background:#f3e8ff;color:#7c3aed;padding:2px 8px;border-radius:10px;">Disesuaikan TKA</span>' : ''}</h2>
    <table style="font-size:13px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:8px;border:1px solid #ddd;width:40px;text-align:center;">#</th>
          <th style="padding:8px;border:1px solid #ddd;">Kategori Jurusan</th>
          <th style="padding:8px;border:1px solid #ddd;width:80px;text-align:center;">Skor</th>
          <th style="padding:8px;border:1px solid #ddd;">Mapel Pendukung</th>
          <th style="padding:8px;border:1px solid #ddd;">Program Studi</th>
        </tr>
      </thead>
      <tbody>
        ${topMajorsHTML}
      </tbody>
    </table>

    ${student.subjectTrends && student.subjectTrends.length > 0 ? `
    <h2>Tren Perkembangan Nilai</h2>
    <table style="font-size:12px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:6px;border:1px solid #ddd;text-align:left;">Mata Pelajaran</th>
          <th style="padding:6px;border:1px solid #ddd;text-align:center;">Rata-rata Awal</th>
          <th style="padding:6px;border:1px solid #ddd;text-align:center;">Rata-rata Akhir</th>
          <th style="padding:6px;border:1px solid #ddd;text-align:center;">Perubahan</th>
          <th style="padding:6px;border:1px solid #ddd;text-align:center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${student.subjectTrends.sort((a, b) => b.trend - a.trend).map(st => `
          <tr>
            <td style="padding:6px;border:1px solid #ddd;">${st.mapel}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:center;">${st.earlyAvg.toFixed(1)}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:center;">${st.lateAvg.toFixed(1)}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:center;color:${st.trend > 0 ? '#059669' : st.trend < 0 ? '#dc2626' : '#6b7280'};font-weight:bold;">${st.trend > 0 ? '+' : ''}${st.trend.toFixed(1)}</td>
            <td style="padding:6px;border:1px solid #ddd;text-align:center;">${st.trend > 2 ? '↑ Meningkat' : st.trend < -2 ? '↓ Menurun' : '→ Stabil'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    ${tkaHTML}

    <h2>Alasan Rekomendasi</h2>
    <ul style="font-size:13px;padding-left:20px;">${reasoningHTML}</ul>

    ${aiSectionHTML}

    <div class="footer">
      <p>Laporan ini dihasilkan secara otomatis oleh Sistem Analisa Jurusan — ${dateStr}</p>
      <p>Hasil analisis bersifat rekomendasi dan perlu dikonsultasikan dengan pihak bimbingan konseling</p>
    </div>
  </div>
</body>
</html>`
  }

  const handlePreviewReport = () => {
    if (!selectedStudent) return
    const html = generateReportHTML(selectedStudent, aiAnalysis)
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const win = window.open(url, '_blank')
    if (win) {
      win.onload = () => URL.revokeObjectURL(url)
    } else {
      toast({ title: 'Gagal membuka preview', description: 'Izinkan popup untuk melihat laporan', variant: 'destructive' })
    }
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  const totalPages = Math.ceil(students.length / PAGE_SIZE)
  const paginatedStudents = students.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading && students.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Menganalisis data jurusan lanjut...</p>
        </div>
      </div>
    )
  }

  // ============================================================
  // EMPTY STATE
  // ============================================================

  if (students.length === 0 && !loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold">Analisa Jurusan Lanjut</h2>
          </div>
          <Tabs value={String(kelas)} onValueChange={handleKelasChange}>
            <TabsList>
              <TabsTrigger value="11">Kelas XI</TabsTrigger>
              <TabsTrigger value="12">Kelas XII</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Card>
          <CardContent className="p-8 text-center">
            <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">Belum ada data siswa kelas {kelas} untuk dianalisis</p>
            <p className="text-xs text-muted-foreground mt-1">Import leger nilai terlebih dahulu</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  return (
    <div className="space-y-4">
      {/* Header & Filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Analisa Jurusan Lanjut</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={String(kelas)} onValueChange={handleKelasChange}>
            <TabsList>
              <TabsTrigger value="11">Kelas XI</TabsTrigger>
              <TabsTrigger value="12">Kelas XII</TabsTrigger>
            </TabsList>
          </Tabs>
          {availableRombels.length > 1 && (
            <Select value={filterRombel} onValueChange={setFilterRombel}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Semua Rombel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Rombel Kelas {kelas}</SelectItem>
                {availableRombels.map(r => (
                  <SelectItem key={r.id} value={r.id}>{r.nama} ({r.siswaCount} siswa)</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10">
            <CardContent className="p-3 flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xl font-bold text-emerald-700">{summary.ipaTrackCount}</p>
                <p className="text-[11px] text-muted-foreground">Jalur IPA</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
            <CardContent className="p-3 flex items-center gap-2">
              <Globe className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-xl font-bold text-amber-700">{summary.ipsTrackCount}</p>
                <p className="text-[11px] text-muted-foreground">Jalur IPS</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200 bg-slate-50/50 dark:bg-slate-950/10">
            <CardContent className="p-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-slate-500 shrink-0" />
              <div>
                <p className="text-xl font-bold text-slate-700">{summary.balancedCount}</p>
                <p className="text-[11px] text-muted-foreground">Seimbang</p>
              </div>
            </CardContent>
          </Card>
          {kelas === 12 && (
            <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/10">
              <CardContent className="p-3 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-purple-600 shrink-0" />
                <div>
                  <p className="text-xl font-bold text-purple-700">
                    {summary.tkaCount}
                    <span className="text-sm font-normal text-muted-foreground">/{summary.withNilaiCount}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">Data TKA</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-3 flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-500 shrink-0" />
              <div>
                <p className="text-xl font-bold text-purple-700">{summary.avgConfidence}%</p>
                <p className="text-[11px] text-muted-foreground">Rata-rata Akurasi</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Major Distribution Bar Chart */}
      {summary && summary.majorDistribution.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Distribusi Jurusan Teratas
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {summary.withNilaiCount} siswa
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {summary.majorDistribution.map((item, idx) => {
                  const maxCount = summary.majorDistribution[0]?.count || 1
                  const barWidth = (item.count / maxCount) * 100
                  const isIpa = item.track === 'IPA'
                  const isIps = item.track === 'IPS'
                  const barColor = isIpa ? 'bg-emerald-500' : isIps ? 'bg-amber-500' : 'bg-slate-400'
                  return (
                    <div key={item.major} className="flex items-center gap-3">
                      <div className="w-48 sm:w-56 shrink-0">
                        <div className="flex items-center gap-1.5">
                          {isIpa ? <FlaskConical className="h-3 w-3 text-emerald-500" /> : isIps ? <Globe className="h-3 w-3 text-amber-500" /> : <Shield className="h-3 w-3 text-slate-400" />}
                          <span className="text-xs font-medium truncate">{item.major}</span>
                        </div>
                      </div>
                      <div className="flex-1 h-6 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className={`h-full ${barColor} rounded-full flex items-center justify-end pr-2`}
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.max(barWidth, 8)}%` }}
                          transition={{ duration: 0.5, delay: idx * 0.05 }}
                        >
                          <span className="text-[10px] text-white font-semibold">{item.count}</span>
                        </motion.div>
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">{item.track}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Student Table */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">
                Hasil Analisa Siswa Kelas {kelas === 11 ? 'XI' : 'XII'}
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {summary?.withNilaiCount} siswa dengan nilai
                {kelas === 12 && summary && summary.tkaCount > 0 && ` • ${summary.tkaCount} dengan TKA`}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">No</TableHead>
                    <TableHead>Nama Siswa</TableHead>
                    <TableHead className="hidden sm:table-cell">Rombel</TableHead>
                    <TableHead className="text-center">Kecondongan</TableHead>
                    <TableHead className="text-center">Jurusan #1</TableHead>
                    <TableHead className="text-center hidden md:table-cell">Jurusan #2</TableHead>
                    <TableHead className="text-center hidden lg:table-cell">Jurusan #3</TableHead>
                    <TableHead className="text-center hidden xl:table-cell">Jurusan #4</TableHead>
                    <TableHead className="text-center hidden xl:table-cell">Jurusan #5</TableHead>
                    <TableHead className="text-center">Akurasi</TableHead>
                    <TableHead className="w-20 text-center">Detail</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedStudents.map((s, idx) => {
                    const top1 = s.topMajors[0]
                    const top2 = s.topMajors[1]
                    const top3 = s.topMajors[2]
                    const top4 = s.topMajors[3]
                    const top5 = s.topMajors[4]
                    const isSelected = selectedStudent?.siswaid === s.siswaid
                    return (
                      <TableRow
                        key={s.siswaid}
                        className={`cursor-pointer hover:bg-muted/50 transition-colors ${isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''} ${!s.hasNilai ? 'opacity-50' : ''}`}
                        onClick={() => {
                          setSelectedStudent(s)
                          setAiAnalysis(null)
                        }}
                      >
                        <TableCell className="text-center text-muted-foreground text-xs">
                          {(page - 1) * PAGE_SIZE + idx + 1}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{s.nama}</p>
                            <p className="text-[11px] text-muted-foreground">{s.nis}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="outline" className="text-[10px]">{s.rombelNama}</Badge>
                        </TableCell>
                        <TableCell className="text-center">{trackBadge(s.dominantTrack)}</TableCell>
                        <TableCell className="text-center">
                          {top1 && top1.skor > 0 ? (
                            <div>
                              <p className="text-xs font-medium truncate max-w-[120px]">{top1.nama}</p>
                              <p className={`text-[11px] font-semibold ${scoreColor(top1.skor)}`}>{top1.skor.toFixed(1)}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden md:table-cell">
                          {top2 && top2.skor > 0 ? (
                            <div>
                              <p className="text-xs truncate max-w-[120px]">{top2.nama}</p>
                              <p className={`text-[11px] ${scoreColor(top2.skor)}`}>{top2.skor.toFixed(1)}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden lg:table-cell">
                          {top3 && top3.skor > 0 ? (
                            <div>
                              <p className="text-xs truncate max-w-[120px]">{top3.nama}</p>
                              <p className={`text-[11px] ${scoreColor(top3.skor)}`}>{top3.skor.toFixed(1)}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden xl:table-cell">
                          {top4 && top4.skor > 0 ? (
                            <div>
                              <p className="text-xs truncate max-w-[120px]">{top4.nama}</p>
                              <p className={`text-[11px] ${scoreColor(top4.skor)}`}>{top4.skor.toFixed(1)}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center hidden xl:table-cell">
                          {top5 && top5.skor > 0 ? (
                            <div>
                              <p className="text-xs truncate max-w-[120px]">{top5.nama}</p>
                              <p className={`text-[11px] ${scoreColor(top5.skor)}`}>{top5.skor.toFixed(1)}</p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className={`text-sm font-semibold ${confidenceColor(s.confidence)}`}>
                            {s.confidence}%
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedStudent(s)
                              setAiAnalysis(null)
                            }}
                          >
                            Lihat
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
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
          </CardContent>
        </Card>
      </motion.div>

      {/* Student Detail Panel */}
      <AnimatePresence>
        {selectedStudent && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.3 }}
          >
            <Card className={`border-2 ${
              selectedStudent.dominantTrack === 'IPA' ? 'border-emerald-300' :
              selectedStudent.dominantTrack === 'IPS' ? 'border-amber-300' : 'border-slate-300'
            }`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      selectedStudent.dominantTrack === 'IPA' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                      selectedStudent.dominantTrack === 'IPS' ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-slate-100 dark:bg-slate-900/30'
                    }`}>
                      {selectedStudent.dominantTrack === 'IPA' ? (
                        <FlaskConical className="h-5 w-5 text-emerald-600" />
                      ) : selectedStudent.dominantTrack === 'IPS' ? (
                        <Globe className="h-5 w-5 text-amber-600" />
                      ) : (
                        <Shield className="h-5 w-5 text-slate-600" />
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-base">{selectedStudent.nama}</CardTitle>
                      <CardDescription>
                        {selectedStudent.nis} • {selectedStudent.rombelNama} • Kelas {selectedStudent.kelas === 11 ? 'XI' : 'XII'}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {trackBadge(selectedStudent.dominantTrack)}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={handlePreviewReport}
                      disabled={!selectedStudent.hasNilai}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Cetak Laporan
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedStudent(null); setAiAnalysis(null) }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Track Inclination Visual Bar */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    Kecondongan Jalur
                  </p>
                  <div className="relative">
                    <div className="flex h-8 rounded-full overflow-hidden bg-muted">
                      <motion.div
                        className="bg-emerald-500 flex items-center justify-center"
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedStudent.ipaInclination}%` }}
                        transition={{ duration: 0.5 }}
                      >
                        {selectedStudent.ipaInclination >= 20 && (
                          <span className="text-[11px] text-white font-semibold">IPA {selectedStudent.ipaInclination}%</span>
                        )}
                      </motion.div>
                      <motion.div
                        className="bg-amber-500 flex items-center justify-center"
                        initial={{ width: 0 }}
                        animate={{ width: `${selectedStudent.ipsInclination}%` }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                      >
                        {selectedStudent.ipsInclination >= 20 && (
                          <span className="text-[11px] text-white font-semibold">IPS {selectedStudent.ipsInclination}%</span>
                        )}
                      </motion.div>
                    </div>
                    {selectedStudent.ipaInclination < 20 && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-emerald-700 font-medium">IPA {selectedStudent.ipaInclination}%</span>
                    )}
                    {selectedStudent.ipsInclination < 20 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-amber-700 font-medium">IPS {selectedStudent.ipsInclination}%</span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> IPA: {selectedStudent.ipaInclination}%</span>
                    <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> IPS: {selectedStudent.ipsInclination}%</span>
                    <span className="flex items-center gap-1">
                      {trendIcon(selectedStudent.semesterTrend.ipaTrend)}
                      Tren IPA: {selectedStudent.semesterTrend.ipaTrend > 0 ? '+' : ''}{selectedStudent.semesterTrend.ipaTrend.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      {trendIcon(selectedStudent.semesterTrend.ipsTrend)}
                      Tren IPS: {selectedStudent.semesterTrend.ipsTrend > 0 ? '+' : ''}{selectedStudent.semesterTrend.ipsTrend.toFixed(1)}
                    </span>
                  </div>
                </div>

                <Separator />

                {/* Quick Stats Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/5">
                    <CardContent className="p-3 text-center">
                      <p className={`text-xl font-bold ${scoreColor(selectedStudent.overallAvg)}`}>
                        {selectedStudent.overallAvg.toFixed(1)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">Rata-rata Nilai</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Progress value={selectedStudent.consistency * 100} className="h-1.5 w-12" />
                        <span className="text-xl font-bold">{Math.round(selectedStudent.consistency * 100)}%</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Konsistensi</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className={`text-xl font-bold ${confidenceColor(selectedStudent.confidence)}`}>
                        {selectedStudent.confidence}%
                      </p>
                      <p className="text-[11px] text-muted-foreground">Akurasi</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xl font-bold">{selectedStudent.topMajors.length}</p>
                      <p className="text-[11px] text-muted-foreground">Jurusan Rekomendasi</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                {/* Top 5 Major Cards */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <GraduationCap className="h-4 w-4 text-emerald-600" />
                    Top 5 Jurusan Rekomendasi
                    {selectedStudent.tkaAdjustedMajors && (
                      <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-[10px] ml-1">
                        <Zap className="h-2.5 w-2.5 mr-0.5" /> Disesuaikan TKA
                      </Badge>
                    )}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedStudent.topMajors.slice(0, 5).map((major, idx) => (
                      <motion.div
                        key={major.nama}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.2, delay: idx * 0.08 }}
                      >
                        <Card className={`relative overflow-hidden ${
                          idx === 0 ? 'border-emerald-300 bg-emerald-50/30 dark:bg-emerald-950/5' :
                          idx === 1 ? 'border-green-200 bg-green-50/20' :
                          idx === 2 ? 'border-amber-200' : 'border-slate-200'
                        }`}>
                          {idx < 3 && (
                            <div className={`absolute top-0 right-0 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg ${
                              idx === 0 ? 'bg-emerald-500' : idx === 1 ? 'bg-green-500' : 'bg-amber-500'
                            }`}>
                              #{idx + 1}
                            </div>
                          )}
                          <CardContent className="p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-semibold truncate pr-6">{major.nama}</p>
                              <span className={`text-sm font-bold ${scoreColor(major.skor)}`}>
                                {major.skor.toFixed(1)}
                              </span>
                            </div>
                            {/* Trend adjustment badge */}
                            {major.trendAdjustment && Math.abs(major.trendAdjustment) > 0.1 && (
                              <div className="flex items-center gap-1 mb-1.5">
                                {major.trendAdjustment > 0 ? (
                                  <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-50 text-[9px] py-0 px-1.5">
                                    <TrendingUp className="h-2.5 w-2.5 mr-0.5" />
                                    +{major.trendAdjustment.toFixed(1)} tren
                                  </Badge>
                                ) : (
                                  <Badge className="bg-red-50 text-red-700 hover:bg-red-50 text-[9px] py-0 px-1.5">
                                    <TrendingDown className="h-2.5 w-2.5 mr-0.5" />
                                    {major.trendAdjustment.toFixed(1)} tren
                                  </Badge>
                                )}
                              </div>
                            )}
                            {/* Score bar */}
                            <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                              <motion.div
                                className={`h-full ${scoreBgColor(major.skor)} rounded-full`}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(major.skor, 2)}%` }}
                                transition={{ duration: 0.5, delay: idx * 0.08 }}
                              />
                            </div>
                            {/* Subject breakdown */}
                            {major.mapelDetail.length > 0 && (
                              <div className="space-y-0.5">
                                {major.mapelDetail.slice(0, 4).map(detail => (
                                  <div key={detail.mapel} className="flex items-center justify-between text-[11px]">
                                    <span className="text-muted-foreground truncate">{detail.mapel}</span>
                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <span className="text-[9px] text-muted-foreground">×{detail.weight}</span>
                                      <span className={`font-medium ${scoreColor(detail.rerata)}`}>
                                        {detail.rerata.toFixed(1)}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                                {major.mapelDetail.length > 4 && (
                                  <p className="text-[10px] text-muted-foreground">+{major.mapelDetail.length - 4} mapel lainnya</p>
                                )}
                              </div>
                            )}
                            {/* Specific Jurusan */}
                            {major.specificJurusan && major.specificJurusan.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-dashed border-slate-200">
                                <p className="text-[10px] text-muted-foreground mb-1">Program Studi:</p>
                                <div className="flex flex-wrap gap-1">
                                  {major.specificJurusan.slice(0, 3).map(j => (
                                    <Badge key={j.jurusan} variant="outline" className="text-[9px] py-0 px-1.5 border-emerald-200 text-emerald-700">
                                      {j.jurusan}
                                    </Badge>
                                  ))}
                                  {major.specificJurusan.length > 3 && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1.5">
                                      +{major.specificJurusan.length - 3}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Subject Trends Section */}
                {selectedStudent.subjectTrends && selectedStudent.subjectTrends.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        Tren Perkembangan Nilai
                      </p>
                      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                        {selectedStudent.subjectTrends
                          .sort((a, b) => b.trend - a.trend)
                          .map(st => (
                          <div key={st.mapel} className="flex items-center justify-between text-xs bg-muted/30 rounded-md px-2.5 py-1.5">
                            <span className="font-medium truncate mr-2">{st.mapel}</span>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-muted-foreground text-[10px]">
                                {st.earlyAvg.toFixed(1)} → {st.lateAvg.toFixed(1)}
                              </span>
                              <span className={`font-semibold flex items-center gap-0.5 ${
                                st.trend > 2 ? 'text-emerald-600' : st.trend < -2 ? 'text-red-600' : 'text-muted-foreground'
                              }`}>
                                {trendIcon(st.trend)}
                                {st.trend > 0 ? '+' : ''}{st.trend.toFixed(1)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* TKA Data Section (Class 12 only) */}
                {kelas === 12 && selectedStudent.tkaData && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <BookOpen className="h-4 w-4 text-purple-600" />
                        Data TKA (Tes Kompetensi Akademik)
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        {/* B. Indonesia */}
                        <Card className="border-purple-100">
                          <CardContent className="p-2.5 text-center">
                            <p className="text-[10px] text-muted-foreground mb-0.5">B. Indonesia</p>
                            <p className={`text-lg font-bold ${scoreColor(selectedStudent.tkaData.bindonilai)}`}>
                              {selectedStudent.tkaData.bindonilai}
                            </p>
                            {tkaKategoriBadge(selectedStudent.tkaData.bindokategori)}
                          </CardContent>
                        </Card>
                        {/* Matematika */}
                        <Card className="border-purple-100">
                          <CardContent className="p-2.5 text-center">
                            <p className="text-[10px] text-muted-foreground mb-0.5">Matematika</p>
                            <p className={`text-lg font-bold ${scoreColor(selectedStudent.tkaData.matnilai)}`}>
                              {selectedStudent.tkaData.matnilai}
                            </p>
                            {tkaKategoriBadge(selectedStudent.tkaData.matkategori)}
                          </CardContent>
                        </Card>
                        {/* B. Inggris */}
                        <Card className="border-purple-100">
                          <CardContent className="p-2.5 text-center">
                            <p className="text-[10px] text-muted-foreground mb-0.5">B. Inggris</p>
                            <p className={`text-lg font-bold ${scoreColor(selectedStudent.tkaData.bingnilai)}`}>
                              {selectedStudent.tkaData.bingnilai}
                            </p>
                            {tkaKategoriBadge(selectedStudent.tkaData.bingkategori)}
                          </CardContent>
                        </Card>
                        {/* Pilihan 1 */}
                        <Card className="border-purple-100">
                          <CardContent className="p-2.5 text-center">
                            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{selectedStudent.tkaData.pilihan1nama || 'Pilihan 1'}</p>
                            <p className={`text-lg font-bold ${scoreColor(selectedStudent.tkaData.pilihan1nilai)}`}>
                              {selectedStudent.tkaData.pilihan1nilai}
                            </p>
                            {tkaKategoriBadge(selectedStudent.tkaData.pilihan1kategori)}
                          </CardContent>
                        </Card>
                        {/* Pilihan 2 */}
                        <Card className="border-purple-100">
                          <CardContent className="p-2.5 text-center">
                            <p className="text-[10px] text-muted-foreground mb-0.5 truncate">{selectedStudent.tkaData.pilihan2nama || 'Pilihan 2'}</p>
                            <p className={`text-lg font-bold ${scoreColor(selectedStudent.tkaData.pilihan2nilai)}`}>
                              {selectedStudent.tkaData.pilihan2nilai}
                            </p>
                            {tkaKategoriBadge(selectedStudent.tkaData.pilihan2kategori)}
                          </CardContent>
                        </Card>
                      </div>
                      {/* TKA Summary Bar */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] text-muted-foreground">Rata-rata Wajib:</span>
                        <span className={`text-xs font-semibold ${scoreColor(
                          (selectedStudent.tkaData.bindonilai + selectedStudent.tkaData.matnilai + selectedStudent.tkaData.bingnilai) / 3
                        )}`}>
                          {((selectedStudent.tkaData.bindonilai + selectedStudent.tkaData.matnilai + selectedStudent.tkaData.bingnilai) / 3).toFixed(1)}
                        </span>
                        <span className="text-[11px] text-muted-foreground ml-2">Pilihan:</span>
                        <span className="text-xs font-medium">
                          {selectedStudent.tkaData.pilihan1nama} ({selectedStudent.tkaData.pilihan1nilai})
                          {selectedStudent.tkaData.pilihan2nama && ` & ${selectedStudent.tkaData.pilihan2nama} (${selectedStudent.tkaData.pilihan2nilai})`}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {/* No TKA data notice for class 12 */}
                {kelas === 12 && !selectedStudent.tkaData && selectedStudent.hasNilai && (
                  <div className="bg-amber-50 dark:bg-amber-950/10 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-700 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5" />
                      Data TKA belum tersedia untuk siswa ini — rekomendasi hanya berdasarkan nilai rapor
                    </p>
                  </div>
                )}

                {/* Class 11 no TKA notice */}
                {kelas === 11 && (
                  <div className="bg-slate-50 dark:bg-slate-950/10 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <BookOpen className="h-3.5 w-3.5" />
                      Data TKA tersedia untuk analisis kelas XII — rekomendasi saat ini hanya berdasarkan nilai rapor
                    </p>
                  </div>
                )}

                <Separator />

                {/* Reasoning */}
                <div className="space-y-2">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    Alasan Rekomendasi
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

                {/* AI Analysis Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      Analisis AI Mendalam
                    </p>
                    <Button
                      size="sm"
                      onClick={() => fetchAiAnalysis(selectedStudent.siswaid)}
                      disabled={aiLoading}
                      className="gap-1.5"
                    >
                      {aiLoading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Menganalisis...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          {aiAnalysis ? 'Analisis Ulang' : 'Mulai Analisis AI'}
                        </>
                      )}
                    </Button>
                  </div>

                  <AnimatePresence mode="wait">
                    {aiLoading && (
                      <motion.div
                        key="ai-loading"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center py-8"
                      >
                        <div className="text-center space-y-3">
                          <Loader2 className="h-6 w-6 animate-spin text-purple-500 mx-auto" />
                          <p className="text-sm text-muted-foreground">AI sedang menganalisis profil akademik siswa...</p>
                          <p className="text-[11px] text-muted-foreground">
                            Proses ini biasanya membutuhkan 30-120 detik
                            {aiElapsed > 0 && <span className="ml-1 font-medium text-purple-600">({aiElapsed}s)</span>}
                          </p>
                          {aiElapsed > 15 && (
                            <div className="w-48 mx-auto">
                              <Progress value={Math.min(95, (aiElapsed / 120) * 100)} className="h-1.5" />
                            </div>
                          )}
                          {aiElapsed > 60 && (
                            <p className="text-[10px] text-muted-foreground mt-1">Proses masih berjalan, mohon tunggu...</p>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {aiAnalysis && !aiLoading && (
                      <motion.div
                        key="ai-result"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Card className="border-purple-200 bg-purple-50/20 dark:bg-purple-950/5">
                          <CardContent className="p-4">
                            <ScrollArea className="max-h-96">
                              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-sm prose-headings:font-semibold prose-p:text-xs prose-p:text-muted-foreground prose-li:text-xs prose-li:text-muted-foreground prose-strong:text-foreground">
                                <ReactMarkdown>{aiAnalysis}</ReactMarkdown>
                              </div>
                            </ScrollArea>
                          </CardContent>
                        </Card>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {!aiAnalysis && !aiLoading && (
                    <Card className="border-dashed">
                      <CardContent className="p-4 text-center">
                        <Brain className="h-8 w-8 text-purple-300 mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Klik tombol &ldquo;Mulai Analisis AI&rdquo; untuk mendapatkan analisis mendalam
                          tentang jurusan perguruan tinggi yang paling cocok
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          AI akan mempertimbangkan nilai rapor, tren semester, {kelas === 12 ? 'data TKA, ' : ''}dan peluang masuk PTN
                        </p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Methodology Note */}
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">
                    <strong>Metodologi:</strong> Analisa menggunakan weighted scoring multi-faktor yang mempertimbangkan:
                    nilai rata-rata mapel IPA & IPS (dengan bobot per jurusan), konsistensi nilai, tren semester,
                    {kelas === 12 ? ' data TKA (wajib & pilihan) sebagai validasi kompetensi,' : ''} dan kelengkapan data.
                    Skor dihitung berdasarkan rata-rata tertimbang dari mata pelajaran yang relevan dengan setiap jurusan.
                    {kelas === 12 && ' Data TKA memberikan penyesuaian skor berdasarkan kompetensi akademik yang terukur.'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subject Mapping Info (Collapsible) */}
      {subjectMapping && (
        <Collapsible open={mappingOpen} onOpenChange={setMappingOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    Pemetaan Mapel ke Jurusan (Bobot)
                  </CardTitle>
                  <Button variant="ghost" size="sm">
                    {mappingOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* IPA Majors */}
                <div>
                  <p className="text-xs font-semibold text-emerald-700 mb-2 flex items-center gap-1.5">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Jurusan Jalur IPA
                  </p>
                  <div className="space-y-3">
                    {subjectMapping.ipaMajors.map(group => (
                      <div key={group.name} className="border rounded-lg p-3">
                        <p className="text-xs font-medium mb-1.5">{group.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.subjects.map(sub => (
                            <Badge key={sub.name} variant="outline" className="text-[10px] border-emerald-200">
                              {sub.name} <span className="text-emerald-600 font-semibold ml-0.5">×{sub.weight}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* IPS Majors */}
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-2 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" />
                    Jurusan Jalur IPS
                  </p>
                  <div className="space-y-3">
                    {subjectMapping.ipsMajors.map(group => (
                      <div key={group.name} className="border rounded-lg p-3">
                        <p className="text-xs font-medium mb-1.5">{group.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {group.subjects.map(sub => (
                            <Badge key={sub.name} variant="outline" className="text-[10px] border-amber-200">
                              {sub.name} <span className="text-amber-600 font-semibold ml-0.5">×{sub.weight}</span>
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground">
                    <strong>Keterangan:</strong> Bobot yang lebih tinggi (×3.5) menunjukkan mata pelajaran yang lebih
                    menentukan kesesuaian dengan jurusan tersebut. Skor akhir dihitung sebagai rata-rata tertimbang
                    dari nilai mapel dikali bobotnya.
                    {kelas === 12 && ' Untuk kelas XII, data TKA memberikan penyesuaian tambahan pada skor jurusan terkait.'}
                  </p>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  )
}
