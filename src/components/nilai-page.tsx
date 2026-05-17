'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Plus, Pencil, Trash2, Upload, FileSpreadsheet, Loader2,
  CheckCircle, AlertCircle, Trophy, Medal, BarChart3, ChevronLeft, ChevronRight,
  XCircle, FileText, Trash,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface Siswa { id: string; nis: string; nisn: string; nama: string; rombelId: string; rombel: Rombel }
interface Nilai {
  id: string; siswaId: string; mataPelajaran: string
  smt1: number; smt2: number; smt3: number; smt4: number; smt5: number; smt6: number
  rerata: number; siswa: Siswa
}

interface PeringkatItem {
  siswaId: string; nama: string; nis: string; nisn: string
  rombelId: string; rombelNama: string; kelas: number
  rataRata: number; subjectCount: number; peringkat: number
  subjects: { mataPelajaran: string; rerata: number }[]
}

interface RombelSummary {
  rombelId: string; rombelNama: string; count: number; avgRataRata: number
}

interface TKARecord {
  id: string
  siswaId: string
  nomorPeserta: string
  tanggalPelaksanaan: string
  bindoNilai: number; bindoKategori: string
  matNilai: number; matKategori: string
  bingNilai: number; bingKategori: string
  pilihan1Nama: string; pilihan1Nilai: number; pilihan1Kategori: string
  pilihan2Nama: string; pilihan2Nilai: number; pilihan2Kategori: string
  tkaId: string
  siswa: { id: string; nis: string; nisn: string; nama: string; rombelId: string; rombel: Rombel }
}

const PAGE_SIZE = 30

export function NilaiPage() {
  const [data, setData] = useState<Nilai[]>([])
  const [rombelList, setRombelList] = useState<Rombel[]>([])
  const [mataPelajaranList, setMataPelajaranList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({
    siswaId: '', mataPelajaran: '',
    smt1: '', smt2: '', smt3: '', smt4: '', smt5: '', smt6: '', rerata: '',
  })
  const [filterRombel, setFilterRombel] = useState('all')
  const [filterMapel, setFilterMapel] = useState('all')
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [activeTab, setActiveTab] = useState('peringkat-kelas')

  // Pagination for detail nilai
  const [page, setPage] = useState(1)
  const [totalNilai, setTotalNilai] = useState(0)
  const [totalDetailPages, setTotalDetailPages] = useState(0)

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean; totalSiswaProcessed: number; totalNilaiCreated: number
    totalNilaiSkipped: number; subjects: string[]; errors: string[]
  } | null>(null)
  const [clearExisting, setClearExisting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  // Peringkat state
  const [peringkatKelas, setPeringkatKelas] = useState<PeringkatItem[]>([])
  const [peringkatTingkat, setPeringkatTingkat] = useState<PeringkatItem[]>([])
  const [peringkatKelasRombel, setPeringkatKelasRombel] = useState('')
  const [peringkatTingkatKelas, setPeringkatTingkatKelas] = useState('')
  const [rombelSummary, setRombelSummary] = useState<RombelSummary[]>([])
  const [loadingPeringkat, setLoadingPeringkat] = useState(false)
  const [peringkatPage, setPeringkatPage] = useState(1)
  const [tingkatSummary, setTingkatSummary] = useState<{ kelas: number; rombelCount: number; siswaCount: number; nilaiCount: number; rombels: { id: string; nama: string; siswaCount: number; nilaiCount: number }[] }[]>([])
  const [rombelNilaiInfo, setRombelNilaiInfo] = useState<Map<string, number>>(new Map())

  // Eligible status map (siswaId -> status)
  const [eligibleMap, setEligibleMap] = useState<Map<string, string>>(new Map())

  // TKA state
  const [tkaData, setTkaData] = useState<TKARecord[]>([])
  const [tkaLoading, setTkaLoading] = useState(false)
  const [tkaImportOpen, setTkaImportOpen] = useState(false)
  const [tkaImporting, setTkaImporting] = useState(false)
  const [tkaImportResult, setTkaImportResult] = useState<{
    success: boolean; totalProcessed: number; totalCreated: number; totalUpdated: number; totalSkipped: number; errors: string[]; details?: { fileName: string; siswaNama: string; rombel: string; status: string }[]
  } | null>(null)
  const [tkaSelectedFiles, setTkaSelectedFiles] = useState<File[]>([])
  const [tkaFilterRombel, setTkaFilterRombel] = useState('all')
  const [tkaCoverage, setTkaCoverage] = useState<{ rombelId: string; rombelNama: string; totalSiswa: number; tkaCount: number; missingCount: number }[]>([])

  const { toast } = useToast()

  // Fetch mata pelajaran list separately
  const fetchMataPelajaran = useCallback(async (rombelId?: string) => {
    try {
      const params = new URLSearchParams()
      params.set('distinct', 'mataPelajaran')
      if (rombelId) params.set('rombelId', rombelId)
      const res = await fetch(`/api/nilai?${params}`)
      const json = await res.json()
      if (Array.isArray(json)) {
        setMataPelajaranList(json)
      }
    } catch {
      // silent fail
    }
  }, [])

  const fetchData = useCallback(async () => {
    try {
      const rombelRes = await fetch('/api/rombel')
      const rombelJson = await rombelRes.json()
      setRombelList(rombelJson)

      // Fetch total nilai count
      const countRes = await fetch('/api/nilai?limit=1')
      const countJson = await countRes.json()
      if (countJson.total) setTotalNilai(countJson.total)

      // Fetch all mata pelajaran
      fetchMataPelajaran()

      // Fetch tingkat summary to auto-select first tingkat with data
      const summaryRes = await fetch('/api/peringkat?type=summary')
      const summaryJson = await summaryRes.json()
      if (summaryJson.tingkatSummary) {
        setTingkatSummary(summaryJson.tingkatSummary)
        // Build rombel nilai info map
        const rombelMap = new Map<string, number>()
        for (const t of summaryJson.tingkatSummary) {
          for (const r of t.rombels) {
            rombelMap.set(r.id, r.nilaiCount)
          }
        }
        setRombelNilaiInfo(rombelMap)
        // Auto-select first tingkat with nilai data
        if (summaryJson.firstTingkatWithNilai) {
          setPeringkatTingkatKelas(String(summaryJson.firstTingkatWithNilai))
        } else {
          // No data at all, default to 10
          setPeringkatTingkatKelas('10')
        }
        // Auto-select first rombel with nilai data for Peringkat Kelas
        const firstRombelWithNilai = summaryJson.tingkatSummary
          .flatMap((t: { rombels: { id: string; nilaiCount: number }[] }) => t.rombels)
          .find((r: { nilaiCount: number }) => r.nilaiCount > 0)
        if (firstRombelWithNilai) {
          setPeringkatKelasRombel(firstRombelWithNilai.id)
        }
      }
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast, fetchMataPelajaran])

  // Fetch eligible status for kelas 12 students - MUST be defined before useEffect that references it
  const fetchEligibleStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/eligible')
      const json = await res.json()
      const map = new Map<string, string>()
      for (const e of json) {
        map.set(e.siswaId, e.status)
      }
      setEligibleMap(map)
    } catch {
      // silent
    }
  }, [])

  useEffect(() => { fetchData(); fetchEligibleStatus() }, [fetchData, fetchEligibleStatus])

  // Fetch TKA data - defined after tkaFilterRombel state
  const fetchTkaData = useCallback(async () => {
    setTkaLoading(true)
    try {
      const params = new URLSearchParams()
      if (tkaFilterRombel !== 'all') params.set('rombelId', tkaFilterRombel)
      params.set('coverage', 'true')
      const res = await fetch(`/api/tka?${params}`)
      const json = await res.json()
      if (json.data && Array.isArray(json.data)) {
        setTkaData(json.data)
      } else if (Array.isArray(json)) {
        setTkaData(json)
      }
      if (json.coverage && Array.isArray(json.coverage)) {
        setTkaCoverage(json.coverage)
      }
    } catch {
      // silent
    } finally {
      setTkaLoading(false)
    }
  }, [tkaFilterRombel])

  useEffect(() => { if (activeTab === 'tka') fetchTkaData() }, [activeTab, fetchTkaData])

  // Fetch detail nilai when switching to detail tab
  useEffect(() => {
    if (activeTab === 'detail') {
      const fetchDetail = async () => {
        setDetailLoading(true)
        try {
          const params = new URLSearchParams()
          if (filterRombel !== 'all') params.set('rombelId', filterRombel)
          if (filterMapel !== 'all') params.set('mataPelajaran', filterMapel)
          params.set('page', String(page))
          params.set('limit', String(PAGE_SIZE))

          const nilaiRes = await fetch(`/api/nilai?${params}`)
          const nilaiJson = await nilaiRes.json()
          if (nilaiJson.data && Array.isArray(nilaiJson.data)) {
            setData(nilaiJson.data)
            setTotalNilai(nilaiJson.total || 0)
            setTotalDetailPages(Math.ceil((nilaiJson.total || 0) / PAGE_SIZE))
          }

          // Fetch siswa for the add form
          if (filterRombel !== 'all') {
            const siswaRes = await fetch(`/api/siswa?rombelId=${filterRombel}&limit=100`)
            const siswaJson = await siswaRes.json()
            setSiswaList(siswaJson.data || siswaJson)
          } else {
            setSiswaList([])
          }

          // Refresh mata pelajaran list for selected rombel
          fetchMataPelajaran(filterRombel !== 'all' ? filterRombel : undefined)
        } catch {
          toast({ title: 'Gagal memuat data nilai', variant: 'destructive' })
        } finally {
          setDetailLoading(false)
        }
      }
      fetchDetail()
    }
  }, [activeTab, filterRombel, filterMapel, page, toast, fetchMataPelajaran])

  // Handle eligible status change from peringkat tingkat
  const handleEligibleChange = async (siswaId: string, status: string) => {
    try {
      // Find the siswa to get keterangan
      const siswa = peringkatTingkat.find(s => s.siswaId === siswaId)
      let keterangan = ''
      if (status === 'eligible' && siswa) {
        keterangan = `Top 20% - Peringkat ${siswa.peringkat} dari ${peringkatTingkat.length} (Rata-rata: ${siswa.rataRata.toFixed(1)})`
      } else if (status === 'bersyarat' && siswa) {
        keterangan = `Peringkat ${siswa.peringkat} dari ${peringkatTingkat.length} - Rata-rata: ${siswa.rataRata.toFixed(1)}`
      } else if (status === 'tidak' && siswa) {
        keterangan = `Peringkat ${siswa.peringkat} dari ${peringkatTingkat.length} - Rata-rata: ${siswa.rataRata.toFixed(1)}`
      }

      if (status === '-') {
        // Delete eligible record
        const res = await fetch('/api/eligible', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siswaId }),
        })
        if (!res.ok) throw new Error()
      } else {
        const res = await fetch('/api/eligible', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siswaId, status, keterangan }),
        })
        if (!res.ok) throw new Error()
      }

      // Update local state
      setEligibleMap(prev => {
        const next = new Map(prev)
        if (status === '-') {
          next.delete(siswaId)
        } else {
          next.set(siswaId, status)
        }
        return next
      })

      toast({ title: status === '-' ? 'Status eligible dihapus' : `Status diubah ke ${status}` })
    } catch {
      toast({ title: 'Gagal mengubah status', variant: 'destructive' })
    }
  }

  // Fetch peringkat kelas
  const fetchPeringkatKelas = useCallback(async () => {
    if (!peringkatKelasRombel) return
    setLoadingPeringkat(true)
    try {
      const res = await fetch(`/api/peringkat?type=kelas&rombelId=${peringkatKelasRombel}`)
      const json = await res.json()
      setPeringkatKelas(json.data || [])
      // Update totalNilai from rombel data
      if (json.data?.length > 0) {
        setTotalNilai(prev => prev || json.data.reduce((sum: number, s: { subjectCount: number }) => sum + s.subjectCount, 0))
      }
    } catch {
      toast({ title: 'Gagal memuat peringkat', variant: 'destructive' })
    } finally {
      setLoadingPeringkat(false)
    }
  }, [peringkatKelasRombel, toast])

  useEffect(() => { if (peringkatKelasRombel) fetchPeringkatKelas() }, [fetchPeringkatKelas])

  // Fetch peringkat tingkat - only when tingkat is set
  const fetchPeringkatTingkat = useCallback(async () => {
    if (!peringkatTingkatKelas) return
    setLoadingPeringkat(true)
    try {
      const res = await fetch(`/api/peringkat?type=tingkat&tingkat=${peringkatTingkatKelas}`)
      const json = await res.json()
      setPeringkatTingkat(json.data || [])
      setRombelSummary(json.rombelSummary || [])
      // Update totalNilai
      if (json.data?.length > 0) {
        setTotalNilai(prev => prev || json.data.reduce((sum: number, s: { subjectCount: number }) => sum + s.subjectCount, 0))
      }
    } catch {
      toast({ title: 'Gagal memuat peringkat', variant: 'destructive' })
    } finally {
      setLoadingPeringkat(false)
    }
  }, [peringkatTingkatKelas, toast])

  useEffect(() => { if (peringkatTingkatKelas) fetchPeringkatTingkat() }, [fetchPeringkatTingkat])

  // Reset page on filter change
  useEffect(() => { setPage(1); setPeringkatPage(1) }, [filterRombel, filterMapel])

  const filtered = data

  const handleSubmit = async () => {
    try {
      const body = {
        ...(editId ? { id: editId } : {}),
        siswaId: form.siswaId,
        mataPelajaran: form.mataPelajaran,
        smt1: form.smt1 || '0',
        smt2: form.smt2 || '0',
        smt3: form.smt3 || '0',
        smt4: form.smt4 || '0',
        smt5: form.smt5 || '0',
        smt6: form.smt6 || '0',
        rerata: form.rerata || '0',
      }
      const method = editId ? 'PUT' : 'POST'
      const res = await fetch('/api/nilai', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast({ title: editId ? 'Nilai diperbarui' : 'Nilai ditambahkan' })
      setOpen(false)
      setEditId(null)
      fetchData()
    } catch {
      toast({ title: 'Gagal menyimpan', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/nilai', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Nilai dihapus' })
      fetchData()
    } catch {
      toast({ title: 'Gagal menghapus', variant: 'destructive' })
    }
  }

  const handleEdit = (item: Nilai) => {
    setEditId(item.id)
    setForm({
      siswaId: item.siswaId,
      mataPelajaran: item.mataPelajaran,
      smt1: String(item.smt1 || ''),
      smt2: String(item.smt2 || ''),
      smt3: String(item.smt3 || ''),
      smt4: String(item.smt4 || ''),
      smt5: String(item.smt5 || ''),
      smt6: String(item.smt6 || ''),
      rerata: String(item.rerata || ''),
    })
    setOpen(true)
  }

  const handleAdd = () => {
    setEditId(null)
    setForm({
      siswaId: '', mataPelajaran: '',
      smt1: '', smt2: '', smt3: '', smt4: '', smt5: '', smt6: '', rerata: '',
    })
    setOpen(true)
  }

  const handleImport = async () => {
    setImporting(true)
    setImportResult(null)

    try {
      // Upload files first, then import
      const uploadedPaths: string[] = []

      for (const file of selectedFiles) {
        const formData = new FormData()
        formData.append('file', file)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) throw new Error('Gagal mengupload file')
        const uploadData = await uploadRes.json()
        uploadedPaths.push(uploadData.filePath)
      }

      if (uploadedPaths.length === 0) {
        throw new Error('Pilih file terlebih dahulu')
      }

      const importRes = await fetch('/api/import-leger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths: uploadedPaths, clearExisting }),
      })

      const result = await importRes.json()
      if (!importRes.ok) throw new Error(result.error || 'Gagal mengimport')

      setImportResult(result)
      fetchData()

      if (result.totalNilaiCreated > 0) {
        toast({
          title: 'Import Berhasil',
          description: `${result.totalNilaiCreated} nilai dari ${result.totalSiswaProcessed} siswa`,
        })
      }
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Gagal mengimport',
        variant: 'destructive',
      })
    } finally {
      setImporting(false)
    }
  }

  // TKA Import handler
  const handleTkaImport = async () => {
    setTkaImporting(true)
    setTkaImportResult(null)

    try {
      const uploadedPaths: string[] = []

      for (const file of tkaSelectedFiles) {
        const formData = new FormData()
        formData.append('file', file)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) throw new Error('Gagal mengupload file')
        const uploadData = await uploadRes.json()
        uploadedPaths.push(uploadData.filePath)
      }

      if (uploadedPaths.length === 0) {
        throw new Error('Pilih file PDF terlebih dahulu')
      }

      const importRes = await fetch('/api/import-tka', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePaths: uploadedPaths }),
      })

      const result = await importRes.json()
      if (!importRes.ok) throw new Error(result.error || 'Gagal mengimport')

      setTkaImportResult(result)
      fetchTkaData()

      if (result.totalCreated > 0) {
        toast({
          title: 'Import TKA Berhasil',
          description: `${result.totalCreated} data TKA dari ${result.totalProcessed} siswa`,
        })
      }
    } catch (e: unknown) {
      toast({
        title: e instanceof Error ? e.message : 'Gagal mengimport TKA',
        variant: 'destructive',
      })
    } finally {
      setTkaImporting(false)
    }
  }

  // TKA Delete handler
  const handleTkaDelete = async (id: string) => {
    try {
      const res = await fetch('/api/tka', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Data TKA dihapus' })
      fetchTkaData()
    } catch {
      toast({ title: 'Gagal menghapus data TKA', variant: 'destructive' })
    }
  }

  const nilaiColor = (val: number) => {
    if (val >= 85) return 'text-emerald-600 font-semibold'
    if (val >= 75) return 'text-green-600'
    if (val >= 60) return 'text-amber-600'
    return 'text-red-600 font-semibold'
  }

  const peringkatBadge = (rank: number) => {
    if (rank === 1) return <div className="flex items-center gap-1"><Trophy className="h-5 w-5 text-yellow-500" /><span className="font-bold text-yellow-600">1</span></div>
    if (rank === 2) return <div className="flex items-center gap-1"><Medal className="h-5 w-5 text-gray-400" /><span className="font-bold text-gray-500">2</span></div>
    if (rank === 3) return <div className="flex items-center gap-1"><Medal className="h-5 w-5 text-amber-600" /><span className="font-bold text-amber-700">3</span></div>
    return <span className="font-medium">{rank}</span>
  }

  // Paginated peringkat
  const paginatedPeringkatKelas = peringkatKelas.slice((peringkatPage - 1) * PAGE_SIZE, peringkatPage * PAGE_SIZE)
  const paginatedPeringkatTingkat = peringkatTingkat.slice((peringkatPage - 1) * PAGE_SIZE, peringkatPage * PAGE_SIZE)
  const totalPeringkatPages = Math.ceil(
    (activeTab === 'peringkat-kelas' ? peringkatKelas.length : peringkatTingkat.length) / PAGE_SIZE
  )

  // Stats
  const rombel10 = rombelList.filter(r => r.kelas === 10)
  const rombel11 = rombelList.filter(r => r.kelas === 11)
  const rombel12 = rombelList.filter(r => r.kelas === 12)

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalNilai}</p>
                <p className="text-xs text-muted-foreground">Total Data Nilai</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Trophy className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rombel10.length}</p>
                <p className="text-xs text-muted-foreground">Rombel Kelas X</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <Trophy className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rombel11.length}</p>
                <p className="text-xs text-muted-foreground">Rombel Kelas XI</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                <Trophy className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rombel12.length}</p>
                <p className="text-xs text-muted-foreground">Rombel Kelas XII</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Card>
        <Tabs value={activeTab} onValueChange={(v) => { setActiveTab(v); setPeringkatPage(1) }}>
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base">Nilai & Peringkat</CardTitle>
              <div className="flex items-center gap-2">
                <TabsList>
                  <TabsTrigger value="peringkat-kelas">Peringkat Kelas</TabsTrigger>
                  <TabsTrigger value="peringkat-tingkat">Peringkat Tingkat</TabsTrigger>
                  <TabsTrigger value="tka" className="gap-1">
                    <FileText className="h-3.5 w-3.5" />
                    Nilai TKA
                  </TabsTrigger>
                  <TabsTrigger value="detail">Detail Nilai</TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setSelectedFiles([]); setImportResult(null); setImportOpen(true) }}>
                    <Upload className="h-4 w-4 mr-1" /> Import Leger
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setTkaSelectedFiles([]); setTkaImportResult(null); setTkaImportOpen(true) }}>
                    <FileText className="h-4 w-4 mr-1" /> Import TKA
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Peringkat Per Kelas */}
            <TabsContent value="peringkat-kelas" className="m-0 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={peringkatKelasRombel} onValueChange={setPeringkatKelasRombel}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Pilih Rombel..." />
                  </SelectTrigger>
                  <SelectContent>
                    {rombelList.sort((a, b) => a.kelas - b.kelas || a.nama.localeCompare(b.nama)).map(r => {
                      const nilaiCount = rombelNilaiInfo.get(r.id) || 0
                      return (
                        <SelectItem key={r.id} value={r.id}>
                          <div className="flex items-center gap-2">
                            <span>{r.nama}</span>
                            {nilaiCount > 0 ? (
                              <Badge variant="default" className="h-5 px-1.5 text-[10px] bg-emerald-600">{nilaiCount}</Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">-</Badge>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {peringkatKelasRombel && (
                  <Badge variant="outline" className="text-sm">
                    {peringkatKelas.length} siswa
                  </Badge>
                )}
              </div>

              {!peringkatKelasRombel ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Pilih rombel untuk melihat peringkat</p>
                </div>
              ) : loadingPeringkat ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : peringkatKelas.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Belum ada data nilai untuk rombel ini</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-1" /> Import Leger
                  </Button>
                </div>
              ) : (
                <>
                  {/* Top 3 */}
                  <div className="grid grid-cols-3 gap-3">
                    {peringkatKelas.slice(0, 3).map((s, idx) => (
                      <Card key={s.siswaId} className={idx === 0 ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10' : idx === 1 ? 'border-gray-300 bg-gray-50/50 dark:bg-gray-950/10' : 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'}>
                        <CardContent className="p-4 text-center">
                          <div className="flex justify-center mb-2">
                            {idx === 0 ? <Trophy className="h-8 w-8 text-yellow-500" /> : <Medal className={`h-8 w-8 ${idx === 1 ? 'text-gray-400' : 'text-amber-600'}`} />}
                          </div>
                          <p className="font-bold text-lg">#{s.peringkat}</p>
                          <p className="font-medium text-sm mt-1 truncate">{s.nama}</p>
                          <p className="text-xs text-muted-foreground">{s.rombelNama}</p>
                          <p className={`text-2xl font-bold mt-2 ${nilaiColor(s.rataRata)}`}>
                            {s.rataRata.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.subjectCount} mata pelajaran</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Full ranking table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16 text-center">Peringkat</TableHead>
                          <TableHead>NIS</TableHead>
                          <TableHead>Nama Siswa</TableHead>
                          <TableHead className="text-center">Jumlah Mapel</TableHead>
                          <TableHead className="text-right">Rata-rata</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPeringkatKelas.map(s => (
                          <TableRow key={s.siswaId} className={s.peringkat <= 3 ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                            <TableCell className="text-center">{peringkatBadge(s.peringkat)}</TableCell>
                            <TableCell className="font-mono text-sm">{s.nis}</TableCell>
                            <TableCell className="font-medium">{s.nama}</TableCell>
                            <TableCell className="text-center">{s.subjectCount}</TableCell>
                            <TableCell className={`text-right font-semibold ${nilaiColor(s.rataRata)}`}>
                              {s.rataRata.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPeringkatPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Halaman {peringkatPage} dari {totalPeringkatPages} ({peringkatKelas.length} siswa)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={peringkatPage <= 1} onClick={() => setPeringkatPage(p => Math.max(1, p - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={peringkatPage >= totalPeringkatPages} onClick={() => setPeringkatPage(p => Math.min(totalPeringkatPages, p + 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Peringkat Per Tingkat */}
            <TabsContent value="peringkat-tingkat" className="m-0 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={peringkatTingkatKelas} onValueChange={(v) => { setPeringkatTingkatKelas(v); setPeringkatPage(1) }}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Pilih Tingkat..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tingkatSummary.map(t => {
                      const label = t.kelas === 10 ? 'X' : t.kelas === 11 ? 'XI' : 'XII'
                      return (
                        <SelectItem key={t.kelas} value={String(t.kelas)}>
                          <div className="flex items-center gap-2">
                            <span>Kelas {label} ({t.kelas})</span>
                            {t.nilaiCount > 0 ? (
                              <Badge variant="default" className="h-5 px-1.5 text-[10px] bg-emerald-600">{t.nilaiCount} nilai</Badge>
                            ) : (
                              <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">kosong</Badge>
                            )}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
                {peringkatTingkat.length > 0 && (
                  <Badge variant="outline" className="text-sm">
                    {peringkatTingkat.length} siswa dari {rombelSummary.length} rombel
                  </Badge>
                )}
              </div>

              {/* Eligible summary for kelas XII */}
              {peringkatTingkatKelas === '12' && peringkatTingkat.length > 0 && (() => {
                const total = peringkatTingkat.length
                const top20 = Math.max(Math.floor(total * 0.2), 1)
                const eligibleSiswaCount = peringkatTingkat.filter(s => eligibleMap.get(s.siswaId) === 'eligible').length
                const bersyaratCount = peringkatTingkat.filter(s => eligibleMap.get(s.siswaId) === 'bersyarat').length
                const tidakCount = peringkatTingkat.filter(s => eligibleMap.get(s.siswaId) === 'tidak').length
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10">
                      <CardContent className="p-3 flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-emerald-600 shrink-0" />
                        <div>
                          <p className="text-xl font-bold text-emerald-700">{eligibleSiswaCount}<span className="text-sm font-normal text-muted-foreground">/{top20}</span></p>
                          <p className="text-[11px] text-muted-foreground">Eligible (20% dari {total})</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
                      <CardContent className="p-3 flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                        <div>
                          <p className="text-xl font-bold text-amber-700">{bersyaratCount}</p>
                          <p className="text-[11px] text-muted-foreground">Bersyarat</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/10">
                      <CardContent className="p-3 flex items-center gap-2">
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                        <div>
                          <p className="text-xl font-bold text-red-700">{tidakCount}</p>
                          <p className="text-[11px] text-muted-foreground">Tidak Eligible</p>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-3 flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xl font-bold">{total}</p>
                          <p className="text-[11px] text-muted-foreground">Total Siswa XII</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}

              {/* Rombel Summary */}
              {rombelSummary.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {rombelSummary.sort((a, b) => b.avgRataRata - a.avgRataRata).map(r => (
                    <Badge key={r.rombelId} variant="outline" className="py-1.5 px-3">
                      <span className="font-medium">{r.rombelNama}</span>
                      <span className="mx-1.5 text-muted-foreground">•</span>
                      <span className="text-emerald-600 font-semibold">{r.avgRataRata.toFixed(2)}</span>
                      <span className="mx-1.5 text-muted-foreground">•</span>
                      <span className="text-muted-foreground">{r.count} siswa</span>
                    </Badge>
                  ))}
                </div>
              )}

              {loadingPeringkat ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : peringkatTingkat.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Belum ada data nilai untuk tingkat ini</p>
                  <p className="text-xs mt-1">Import leger nilai untuk menampilkan peringkat</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => setImportOpen(true)}>
                    <Upload className="h-4 w-4 mr-1" /> Import Leger
                  </Button>
                </div>
              ) : (
                <>
                  {/* Top 3 */}
                  <div className="grid grid-cols-3 gap-3">
                    {peringkatTingkat.slice(0, 3).map((s, idx) => (
                      <Card key={s.siswaId} className={idx === 0 ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10' : idx === 1 ? 'border-gray-300 bg-gray-50/50 dark:bg-gray-950/10' : 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'}>
                        <CardContent className="p-4 text-center">
                          <div className="flex justify-center mb-2">
                            {idx === 0 ? <Trophy className="h-8 w-8 text-yellow-500" /> : <Medal className={`h-8 w-8 ${idx === 1 ? 'text-gray-400' : 'text-amber-600'}`} />}
                          </div>
                          <p className="font-bold text-lg">#{s.peringkat}</p>
                          <p className="font-medium text-sm mt-1 truncate">{s.nama}</p>
                          <p className="text-xs text-muted-foreground">{s.rombelNama}</p>
                          <p className={`text-2xl font-bold mt-2 ${nilaiColor(s.rataRata)}`}>
                            {s.rataRata.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">{s.subjectCount} mata pelajaran</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Full ranking table */}
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16 text-center">Peringkat</TableHead>
                          <TableHead>NIS</TableHead>
                          <TableHead>Nama Siswa</TableHead>
                          <TableHead>Rombel</TableHead>
                          <TableHead className="text-center">Mapel</TableHead>
                          <TableHead className="text-right">Rata-rata</TableHead>
                          {peringkatTingkatKelas === '12' && (
                            <TableHead className="w-40 text-center">Status Eligible</TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedPeringkatTingkat.map(s => {
                          const currentStatus = eligibleMap.get(s.siswaId) || '-'
                          const top20 = Math.max(Math.floor(peringkatTingkat.length * 0.2), 1)
                          return (
                            <TableRow key={s.siswaId} className={currentStatus === 'eligible' ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : s.peringkat <= 3 ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                              <TableCell className="text-center">{peringkatBadge(s.peringkat)}</TableCell>
                              <TableCell className="font-mono text-sm">{s.nis}</TableCell>
                              <TableCell className="font-medium">{s.nama}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">{s.rombelNama}</Badge>
                              </TableCell>
                              <TableCell className="text-center">{s.subjectCount}</TableCell>
                              <TableCell className={`text-right font-semibold ${nilaiColor(s.rataRata)}`}>
                                {s.rataRata.toFixed(2)}
                              </TableCell>
                              {peringkatTingkatKelas === '12' && (
                                <TableCell className="text-center">
                                  <Select value={currentStatus} onValueChange={(v) => handleEligibleChange(s.siswaId, v)}>
                                    <SelectTrigger className={`h-8 w-32 text-xs ${currentStatus === 'eligible' ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30' : currentStatus === 'bersyarat' ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/30' : currentStatus === 'tidak' ? 'border-red-400 bg-red-50 dark:bg-red-950/30' : ''}`}>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="-">—</SelectItem>
                                      <SelectItem value="eligible">✅ Eligible</SelectItem>
                                      <SelectItem value="bersyarat">⚠️ Bersyarat</SelectItem>
                                      <SelectItem value="tidak">❌ Tidak</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                              )}
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPeringkatPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">
                        Halaman {peringkatPage} dari {totalPeringkatPages} ({peringkatTingkat.length} siswa)
                      </p>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" disabled={peringkatPage <= 1} onClick={() => setPeringkatPage(p => Math.max(1, p - 1))}>
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" disabled={peringkatPage >= totalPeringkatPages} onClick={() => setPeringkatPage(p => Math.min(totalPeringkatPages, p + 1))}>
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </TabsContent>

            {/* Nilai TKA - Kelas 12 */}
            <TabsContent value="tka" className="m-0 space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Select value={tkaFilterRombel} onValueChange={setTkaFilterRombel}>
                  <SelectTrigger className="w-56">
                    <SelectValue placeholder="Pilih Rombel XII..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Rombel XII</SelectItem>
                    {rombel12.sort((a, b) => a.nama.localeCompare(b.nama)).map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {tkaData.length > 0 && (
                  <Badge variant="outline" className="text-sm">{tkaData.length} siswa memiliki data TKA</Badge>
                )}
              </div>

              {/* TKA Coverage per Rombel - show which classes have/missing data */}
              {tkaCoverage.length > 0 && (() => {
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {tkaCoverage.sort((a, b) => a.rombelNama.localeCompare(b.rombelNama)).map(r => {
                      const isComplete = r.tkaCount > 0 && r.missingCount === 0
                      const isPartial = r.tkaCount > 0 && r.missingCount > 0
                      const isEmpty = r.tkaCount === 0
                      const isSelected = tkaFilterRombel === r.rombelId
                      return (
                        <Card
                          key={r.rombelId}
                          className={`cursor-pointer transition-all ${isComplete ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10' : isPartial ? 'border-amber-200 bg-amber-50/50 dark:bg-amber-950/10' : 'border-red-200 bg-red-50/50 dark:bg-red-950/10'} ${isSelected ? 'ring-2 ring-primary' : ''}`}
                          onClick={() => setTkaFilterRombel(r.rombelId)}
                        >
                          <CardContent className="p-3 text-center">
                            <p className="text-xs font-medium">{r.rombelNama}</p>
                            <p className={`text-lg font-bold ${isComplete ? 'text-emerald-600' : isPartial ? 'text-amber-600' : 'text-red-600'}`}>
                              {r.tkaCount}<span className="text-sm font-normal text-muted-foreground">/{r.totalSiswa}</span>
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {isComplete ? 'Lengkap' : isPartial ? `${r.missingCount} belum ada` : 'Belum ada TKA'}
                            </p>
                          </CardContent>
                        </Card>
                      )
                    })}
                  </div>
                )
              })()}

              {/* TKA Summary Stats */}
              {tkaData.length > 0 && (() => {
                const avgBindo = tkaData.reduce((s, t) => s + t.bindoNilai, 0) / tkaData.length
                const avgMat = tkaData.reduce((s, t) => s + t.matNilai, 0) / tkaData.length
                const avgBing = tkaData.reduce((s, t) => s + t.bingNilai, 0) / tkaData.length
                return (
                  <div className="grid grid-cols-3 gap-3">
                    <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/10">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Rata-rata B. Indonesia</p>
                        <p className={`text-2xl font-bold ${nilaiColor(avgBindo)}`}>{avgBindo.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-teal-200 bg-teal-50/50 dark:bg-teal-950/10">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Rata-rata Matematika</p>
                        <p className={`text-2xl font-bold ${nilaiColor(avgMat)}`}>{avgMat.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                    <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/10">
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Rata-rata B. Inggris</p>
                        <p className={`text-2xl font-bold ${nilaiColor(avgBing)}`}>{avgBing.toFixed(2)}</p>
                      </CardContent>
                    </Card>
                  </div>
                )
              })()}

              {tkaLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : tkaData.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Belum ada data TKA untuk rombel ini</p>
                  <p className="text-xs mt-1">Import Sertifikat TKA (PDF) untuk menampilkan data</p>
                  <Button variant="outline" size="sm" className="mt-2" onClick={() => { setTkaSelectedFiles([]); setTkaImportResult(null); setTkaImportOpen(true) }}>
                    <FileText className="h-4 w-4 mr-1" /> Import TKA
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead>NISN</TableHead>
                        <TableHead>Nama Siswa</TableHead>
                        <TableHead>Rombel</TableHead>
                        <TableHead className="text-center">B. Indonesia</TableHead>
                        <TableHead className="text-center">Matematika</TableHead>
                        <TableHead className="text-center">B. Inggris</TableHead>
                        <TableHead className="text-center">Pilihan 1</TableHead>
                        <TableHead className="text-center">Nilai</TableHead>
                        <TableHead className="text-center">Pilihan 2</TableHead>
                        <TableHead className="text-center">Nilai</TableHead>
                        <TableHead className="w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tkaData.map((t, idx) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-center text-muted-foreground">{idx + 1}</TableCell>
                          <TableCell className="font-mono text-sm">{t.siswa.nisn}</TableCell>
                          <TableCell className="font-medium">{t.siswa.nama}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">{t.siswa.rombel.nama}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>
                              <span className={`font-semibold ${nilaiColor(t.bindoNilai)}`}>{t.bindoNilai.toFixed(2)}</span>
                              <p className="text-[10px] text-muted-foreground">{t.bindoKategori}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>
                              <span className={`font-semibold ${nilaiColor(t.matNilai)}`}>{t.matNilai.toFixed(2)}</span>
                              <p className="text-[10px] text-muted-foreground">{t.matKategori}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>
                              <span className={`font-semibold ${nilaiColor(t.bingNilai)}`}>{t.bingNilai.toFixed(2)}</span>
                              <p className="text-[10px] text-muted-foreground">{t.bingKategori}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-medium">{t.pilihan1Nama}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>
                              <span className={`font-semibold ${nilaiColor(t.pilihan1Nilai)}`}>{t.pilihan1Nilai.toFixed(2)}</span>
                              <p className="text-[10px] text-muted-foreground">{t.pilihan1Kategori}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-medium">{t.pilihan2Nama}</span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div>
                              <span className={`font-semibold ${nilaiColor(t.pilihan2Nilai)}`}>{t.pilihan2Nilai.toFixed(2)}</span>
                              <p className="text-[10px] text-muted-foreground">{t.pilihan2Kategori}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Hapus Data TKA?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Data TKA milik {t.siswa.nama} akan dihapus permanen.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Batal</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleTkaDelete(t.id)}>Hapus</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* Detail Nilai */}
            <TabsContent value="detail" className="m-0 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={filterRombel} onValueChange={setFilterRombel}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="Filter Rombel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Rombel</SelectItem>
                      {rombelList.map(r => (
                        <SelectItem key={r.id} value={r.id}>{r.nama}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={filterMapel} onValueChange={setFilterMapel}>
                    <SelectTrigger className="w-52"><SelectValue placeholder="Filter Mapel" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Mapel</SelectItem>
                      {mataPelajaranList.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {totalNilai > 0 && (
                    <Badge variant="outline" className="text-sm">
                      {totalNilai} data
                    </Badge>
                  )}
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                  <Button onClick={handleAdd} size="sm">
                    <Plus className="h-4 w-4 mr-1" /> Tambah Nilai
                  </Button>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{editId ? 'Edit Nilai' : 'Tambah Nilai'}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2 max-h-[70vh] overflow-y-auto">
                      <div className="space-y-2">
                        <Label>Siswa</Label>
                        <Select value={form.siswaId} onValueChange={v => setForm(f => ({ ...f, siswaId: v }))}>
                          <SelectTrigger><SelectValue placeholder="Pilih Siswa" /></SelectTrigger>
                          <SelectContent>
                            {siswaList.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.nis} - {s.nama}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Mata Pelajaran</Label>
                        <Input placeholder="Nama mata pelajaran" value={form.mataPelajaran} onChange={e => setForm(f => ({ ...f, mataPelajaran: e.target.value }))} />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {['smt1', 'smt2', 'smt3', 'smt4', 'smt5', 'smt6'].map((smt) => (
                          <div key={smt} className="space-y-1">
                            <Label className="text-xs">{smt.replace('smt', 'Semester ').toUpperCase()}</Label>
                            <Input type="number" min="0" max="100" placeholder="0" value={(form as Record<string, string>)[smt]} onChange={e => setForm(f => ({ ...f, [smt]: e.target.value }))} />
                          </div>
                        ))}
                      </div>
                      <div className="space-y-1">
                        <Label>Rerata</Label>
                        <Input type="number" min="0" max="100" step="0.01" placeholder="Otomatis jika kosong" value={form.rerata} onChange={e => setForm(f => ({ ...f, rerata: e.target.value }))} />
                      </div>
                      <Button onClick={handleSubmit} className="w-full" disabled={!form.siswaId || !form.mataPelajaran}>
                        {editId ? 'Perbarui' : 'Simpan'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              {detailLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
              <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">No</TableHead>
                      <TableHead>Nama</TableHead>
                      <TableHead>Rombel</TableHead>
                      <TableHead>Mata Pelajaran</TableHead>
                      <TableHead className="text-center">Smt1</TableHead>
                      <TableHead className="text-center">Smt2</TableHead>
                      <TableHead className="text-center">Smt3</TableHead>
                      <TableHead className="text-center">Smt4</TableHead>
                      <TableHead className="text-center">Smt5</TableHead>
                      <TableHead className="text-center">Smt6</TableHead>
                      <TableHead className="text-right">Rerata</TableHead>
                      <TableHead className="w-20 text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          {totalNilai === 0 ? (
                            <div className="space-y-2">
                              <p>Belum ada data nilai</p>
                              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                                <Upload className="h-4 w-4 mr-1" /> Import Leger Excel
                              </Button>
                            </div>
                          ) : 'Tidak ada data yang cocok'}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((item, idx) => (
                        <TableRow key={item.id}>
                          <TableCell>{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                          <TableCell className="font-medium text-sm">{item.siswa?.nama ?? '-'}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{item.siswa?.rombel?.nama ?? '-'}</Badge></TableCell>
                          <TableCell className="text-sm">{item.mataPelajaran}</TableCell>
                          {[item.smt1, item.smt2, item.smt3, item.smt4, item.smt5, item.smt6].map((v, i) => (
                            <TableCell key={i} className={`text-center text-sm ${v > 0 ? nilaiColor(v) : 'text-muted-foreground'}`}>
                              {v > 0 ? v : '-'}
                            </TableCell>
                          ))}
                          <TableCell className={`text-right font-semibold ${nilaiColor(item.rerata)}`}>
                            {item.rerata.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus Nilai?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Nilai {item.siswa?.nama} - {item.mataPelajaran} akan dihapus.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item.id)}>Hapus</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {/* Detail Pagination */}
              {totalDetailPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Halaman {page} dari {totalDetailPages} ({totalNilai} data)
                  </p>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" disabled={page >= totalDetailPages} onClick={() => setPage(p => Math.min(totalDetailPages, p + 1))}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
              </>
              )}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>

      {/* Import Leger Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Import Leger Nilai dari Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <CardDescription>
              Import data leger nilai dari file Excel Dapodik. File harus berformat leger (.xlsx) dengan kolom semester per mata pelajaran.
              Upload semua file leger (X, XI, XII) sekaligus untuk hasil lengkap.
            </CardDescription>

            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm font-medium">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} file dipilih`
                  : 'Klik untuk memilih file Leger Excel'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Format: .xlsx (Leger Dapodik) — Bisa pilih beberapa file sekaligus
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                setSelectedFiles(files)
                setImportResult(null)
              }}
              className="hidden"
            />

            {selectedFiles.length > 0 && !importResult && (
              <div className="space-y-1">
                {selectedFiles.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded-lg text-sm">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="flex-1 truncate">{f.name}</span>
                    <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                ))}
              </div>
            )}

            {/* Clear existing option - scoped to imported siswa only */}
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Checkbox
                id="clear-existing-nilai"
                checked={clearExisting}
                onCheckedChange={(checked) => setClearExisting(checked === true)}
                className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <div className="flex-1">
                <Label htmlFor="clear-existing-nilai" className="text-sm font-medium cursor-pointer">
                  Ganti nilai lama siswa yang diimport
                </Label>
                <p className="text-xs text-muted-foreground">
                  Hapus nilai lama siswa yang ada di file import, lalu ganti dengan data baru (nilai kelas lain tetap aman)
                </p>
              </div>
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Mengimport data leger nilai...</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-emerald-500 h-full rounded-full animate-pulse" style={{ width: '60%' }} />
                </div>
              </div>
            )}

            {importResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Import Berhasil!</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{importResult.totalSiswaProcessed}</p>
                    <p className="text-xs text-muted-foreground">Siswa Diproses</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{importResult.totalNilaiCreated}</p>
                    <p className="text-xs text-muted-foreground">Data Nilai</p>
                  </div>
                </div>

                {importResult.subjects.length > 0 && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs font-medium mb-2">Mata Pelajaran Terdeteksi ({importResult.subjects.length}):</p>
                    <div className="flex flex-wrap gap-1">
                      {importResult.subjects.map(s => (
                        <Badge key={s} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.totalNilaiSkipped > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{importResult.totalNilaiSkipped} nilai dilewati</span>
                  </div>
                )}

                {importResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs space-y-1 custom-scrollbar">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-red-500">• {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {importResult ? (
                <Button onClick={() => { setImportOpen(false); fetchPeringkatKelas(); fetchPeringkatTingkat(); }} className="w-full">
                  Selesai
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                    Batal
                  </Button>
                  <Button onClick={handleImport} disabled={selectedFiles.length === 0 || importing}>
                    {importing ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Mengimport...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-1" /> Import</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import TKA PDF Dialog */}
      <Dialog open={tkaImportOpen} onOpenChange={setTkaImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Import Sertifikat TKA (PDF)
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              <p>Upload file PDF Sertifikat Hasil TKA (SHTKA) siswa kelas 12.</p>
              <p className="mt-1">Setiap file PDF berisi data 1 siswa. Bisa upload banyak file sekaligus.</p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-2 block">Pilih File PDF</Label>
              <Input
                type="file"
                accept=".pdf"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || [])
                  setTkaSelectedFiles(files)
                  setTkaImportResult(null)
                }}
              />
            </div>

            {tkaSelectedFiles.length > 0 && !tkaImportResult && (
              <div className="space-y-2">
                <p className="text-xs font-medium">{tkaSelectedFiles.length} file dipilih:</p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {tkaSelectedFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <FileText className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span className="truncate">{f.name}</span>
                      <span className="text-muted-foreground shrink-0">({(f.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tkaImportResult && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Import Selesai</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Card className="border-emerald-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-emerald-600">{tkaImportResult.totalCreated}</p>
                      <p className="text-xs text-muted-foreground">Data Baru</p>
                    </CardContent>
                  </Card>
                  <Card className="border-teal-200">
                    <CardContent className="p-3 text-center">
                      <p className="text-2xl font-bold text-teal-600">{tkaImportResult.totalUpdated || 0}</p>
                      <p className="text-xs text-muted-foreground">Diperbarui</p>
                    </CardContent>
                  </Card>
                  <Card className={tkaImportResult.totalSkipped > 0 ? 'border-amber-200' : 'border-emerald-200'}>
                    <CardContent className="p-3 text-center">
                      <p className={`text-2xl font-bold ${tkaImportResult.totalSkipped > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{tkaImportResult.totalSkipped}</p>
                      <p className="text-xs text-muted-foreground">Dilewati</p>
                    </CardContent>
                  </Card>
                </div>
                {tkaImportResult.totalSkipped > 0 && (
                  <div className="flex items-center gap-2 text-amber-600 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <span>{tkaImportResult.totalSkipped} file dilewati - lihat detail error di bawah</span>
                  </div>
                )}
                {tkaImportResult.errors.length > 0 && (
                  <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                    <p className="text-xs font-medium text-red-600">Error:</p>
                    {tkaImportResult.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-500">{err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {tkaImportResult ? (
                <>
                  <Button variant="outline" onClick={() => setTkaImportOpen(false)}>Tutup</Button>
                  <Button onClick={() => { setTkaSelectedFiles([]); setTkaImportResult(null) }}>
                    Import Lagi
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setTkaImportOpen(false)} disabled={tkaImporting}>
                    Batal
                  </Button>
                  <Button onClick={handleTkaImport} disabled={tkaSelectedFiles.length === 0 || tkaImporting}>
                    {tkaImporting ? (
                      <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Mengimport...</>
                    ) : (
                      <><FileText className="h-4 w-4 mr-1" /> Import TKA</>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
