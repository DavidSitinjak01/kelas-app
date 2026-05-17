'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle, XCircle, AlertTriangle, Trophy, Loader2,
  ChevronLeft, ChevronRight,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface Siswa { id: string; nis: string; nisn: string; nama: string; rombelId: string; rombel: Rombel }
interface Eligible {
  id: string; siswaId: string; status: string; keterangan: string | null
  siswa: Siswa
}
interface PeringkatItem {
  siswaId: string; nama: string; nis: string; nisn: string
  rombelId: string; rombelNama: string; kelas: number
  rataRata: number; subjectCount: number; peringkat: number
}

const PAGE_SIZE = 30

export function EligiblePage() {
  const [data, setData] = useState<Eligible[]>([])
  const [peringkat, setPeringkat] = useState<PeringkatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<PeringkatItem | null>(null)
  const [eligibleStatus, setEligibleStatus] = useState('eligible')
  const [keterangan, setKeterangan] = useState('')
  const [page, setPage] = useState(1)
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoResult, setAutoResult] = useState<{
    updated: number; total: number; top20Count: number; top20Cutoff: number
  } | null>(null)

  const { toast } = useToast()

  const fetchData = async () => {
    try {
      // Fetch eligible data
      const eligibleRes = await fetch('/api/eligible')
      const eligibleJson = await eligibleRes.json()
      setData(eligibleJson)

      // Fetch peringkat tingkat XII (all kelas 12 students ranked)
      const peringkatRes = await fetch('/api/peringkat?type=tingkat&tingkat=12')
      const peringkatJson = await peringkatRes.json()
      setPeringkat(peringkatJson.data || [])
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Combine peringkat with eligible status
  const siswaRanked = peringkat.map(p => {
    const elig = data.find(e => e.siswaId === p.siswaId)
    return { ...p, eligible: elig ?? null }
  })

  // Also include kelas 12 students that have no nilai (not in peringkat)
  // These would already be in eligible data but not in peringkat
  const peringkatSiswaIds = new Set(peringkat.map(p => p.siswaId))
  const siswaWithoutNilai = data
    .filter(e => !peringkatSiswaIds.has(e.siswaId))
    .map(e => ({
      siswaId: e.siswaId,
      nama: e.siswa?.nama ?? '-',
      nis: e.siswa?.nis ?? '-',
      nisn: e.siswa?.nisn ?? '-',
      rombelId: e.siswa?.rombelId ?? '',
      rombelNama: e.siswa?.rombel?.nama ?? '-',
      kelas: 12,
      rataRata: 0,
      subjectCount: 0,
      peringkat: 0,
      eligible: e,
    }))

  const allSiswa = [...siswaRanked, ...siswaWithoutNilai]
  const totalSiswa = allSiswa.length
  const top20Expected = totalSiswa > 0 ? Math.max(Math.floor(totalSiswa * 0.2), 1) : 0

  // Pagination
  const totalPages = Math.ceil(allSiswa.length / PAGE_SIZE)
  const paginatedSiswa = allSiswa.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Counts
  const eligibleCount = allSiswa.filter(s => s.eligible?.status === 'eligible').length
  const bersyaratCount = allSiswa.filter(s => s.eligible?.status === 'bersyarat').length
  const tidakCount = allSiswa.filter(s => s.eligible?.status === 'tidak').length

  const handleSetEligible = (siswa: PeringkatItem & { eligible: Eligible | null }) => {
    setSelectedSiswa(siswa)
    if (siswa.eligible) {
      setEligibleStatus(siswa.eligible.status)
      setKeterangan(siswa.eligible.keterangan ?? '')
    } else {
      setEligibleStatus('eligible')
      setKeterangan('')
    }
    setOpen(true)
  }

  const handleSubmit = async () => {
    if (!selectedSiswa) return
    try {
      const res = await fetch('/api/eligible', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siswaId: selectedSiswa.siswaId,
          status: eligibleStatus,
          keterangan,
        }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Status eligible diperbarui' })
      setOpen(false)
      fetchData()
    } catch {
      toast({ title: 'Gagal menyimpan', variant: 'destructive' })
    }
  }

  const handleAutoEligible = async () => {
    setAutoRunning(true)
    setAutoResult(null)
    try {
      const res = await fetch('/api/eligible/auto', { method: 'POST' })
      if (!res.ok) throw new Error()
      const result = await res.json()
      setAutoResult(result)
      toast({
        title: 'Distribusi Top 20% Berhasil!',
        description: `${result.top20Count} siswa eligible dari ${result.total} siswa kelas XII`,
      })
      fetchData()
    } catch {
      toast({ title: 'Gagal distribusi eligible', variant: 'destructive' })
    } finally {
      setAutoRunning(false)
    }
  }

  const statusIcon = (status: string | null) => {
    if (status === 'eligible') return <CheckCircle className="h-4 w-4 text-emerald-600" />
    if (status === 'tidak') return <XCircle className="h-4 w-4 text-red-500" />
    if (status === 'bersyarat') return <AlertTriangle className="h-4 w-4 text-amber-500" />
    return <span className="text-muted-foreground text-xs">-</span>
  }

  const statusBadge = (status: string | null) => {
    if (status === 'eligible') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Eligible</Badge>
    if (status === 'tidak') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">Tidak Eligible</Badge>
    if (status === 'bersyarat') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Bersyarat</Badge>
    return <Badge variant="outline" className="text-muted-foreground">Belum dinilai</Badge>
  }

  const peringkatBadge = (rank: number, status: string | null) => {
    if (rank === 1) return <div className="flex items-center gap-1"><Trophy className="h-5 w-5 text-yellow-500" /><span className="font-bold text-yellow-600">1</span></div>
    if (rank === 2) return <div className="flex items-center gap-1"><Trophy className="h-5 w-5 text-gray-400" /><span className="font-bold text-gray-500">2</span></div>
    if (rank === 3) return <div className="flex items-center gap-1"><Trophy className="h-5 w-5 text-amber-600" /><span className="font-bold text-amber-700">3</span></div>
    if (rank <= top20Expected) return <span className="font-bold text-emerald-600">{rank}</span>
    return <span className="font-medium">{rank}</span>
  }

  const nilaiColor = (val: number) => {
    if (val >= 85) return 'text-emerald-600 font-semibold'
    if (val >= 75) return 'text-green-600'
    if (val >= 60) return 'text-amber-600'
    return 'text-red-600 font-semibold'
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Trophy className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{eligibleCount}</p>
              <p className="text-xs text-muted-foreground">Eligible (Top 20%)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{bersyaratCount}</p>
              <p className="text-xs text-muted-foreground">Bersyarat</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tidakCount}</p>
              <p className="text-xs text-muted-foreground">Tidak Eligible</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted">
              <CheckCircle className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSiswa}</p>
              <p className="text-xs text-muted-foreground">Total Siswa XII</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top 20% Info Banner */}
      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Distribusi Top 20% Kelas XII
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalSiswa} siswa × 20% = <strong>{top20Expected} siswa eligible</strong> (nilai rata-rata tertinggi dari semua rombel XII)
                </p>
                {autoResult && (
                  <p className="text-xs text-emerald-600 mt-1">
                    ✓ Terakhir: {autoResult.top20Count} eligible, batas bawah rata-rata: {autoResult.top20Cutoff.toFixed(1)}
                  </p>
                )}
              </div>
            </div>
            <Button
              onClick={handleAutoEligible}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              disabled={autoRunning}
            >
              {autoRunning ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Memproses...</>
              ) : (
                <><Trophy className="h-4 w-4 mr-1" /> Distribusi Top 20%</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Top 3 Preview */}
      {allSiswa.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {allSiswa.slice(0, 3).map((s, idx) => (
            <Card key={s.siswaId} className={idx === 0 ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10' : idx === 1 ? 'border-gray-300 bg-gray-50/50 dark:bg-gray-950/10' : 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  {idx === 0 ? <Trophy className="h-8 w-8 text-yellow-500" /> : <Trophy className={`h-8 w-8 ${idx === 1 ? 'text-gray-400' : 'text-amber-600'}`} />}
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
      )}

      {/* Full Ranking Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Peringkat Siswa Kelas XII - Status Eligible</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16 text-center">Peringkat</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead>Nama Siswa</TableHead>
                  <TableHead>Rombel</TableHead>
                  <TableHead className="text-center">Mapel</TableHead>
                  <TableHead className="text-right">Rata-rata</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedSiswa.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p>Belum ada data siswa kelas XII</p>
                      <p className="text-xs mt-1">Import leger nilai terlebih dahulu</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSiswa.map(s => (
                    <TableRow key={s.siswaId} className={s.eligible?.status === 'eligible' ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                      <TableCell className="text-center">{peringkatBadge(s.peringkat, s.eligible?.status ?? null)}</TableCell>
                      <TableCell className="font-mono text-sm">{s.nis}</TableCell>
                      <TableCell className="font-medium">{s.nama}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{s.rombelNama}</Badge></TableCell>
                      <TableCell className="text-center">{s.subjectCount}</TableCell>
                      <TableCell className={`text-right font-semibold ${nilaiColor(s.rataRata)}`}>
                        {s.rataRata.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {statusIcon(s.eligible?.status ?? null)}
                          {statusBadge(s.eligible?.status ?? null)}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleSetEligible(s)}>
                          Atur
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Halaman {page} dari {totalPages} ({allSiswa.length} siswa)
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

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Status Eligible</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">{selectedSiswa?.nama}</p>
              <p className="text-xs text-muted-foreground">
                NIS: {selectedSiswa?.nis} | {selectedSiswa?.rombelNama} | Peringkat #{selectedSiswa?.peringkat} | Rata-rata: {selectedSiswa?.rataRata.toFixed(2)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={eligibleStatus} onValueChange={setEligibleStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="eligible">Eligible</SelectItem>
                  <SelectItem value="bersyarat">Bersyarat</SelectItem>
                  <SelectItem value="tidak">Tidak Eligible</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input placeholder="Opsional" value={keterangan} onChange={e => setKeterangan(e.target.value)} />
            </div>
            <Button onClick={handleSubmit} className="w-full">Simpan</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
