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
import { CheckCircle, XCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface Siswa { id: string; nis: string; nama: string; rombelId: string; rombel: Rombel }
interface Eligible {
  id: string; siswaId: string; status: string; keterangan: string | null
  siswa: Siswa
}

export function EligiblePage() {
  const [data, setData] = useState<Eligible[]>([])
  const [siswaKelas12, setSiswaKelas12] = useState<Siswa[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<Siswa | null>(null)
  const [eligibleStatus, setEligibleStatus] = useState('eligible')
  const [keterangan, setKeterangan] = useState('')
  const [filterRombel, setFilterRombel] = useState('all')
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const [eligibleRes, siswaRes] = await Promise.all([
        fetch('/api/eligible'),
        fetch('/api/siswa'),
      ])
      const eligibleJson = await eligibleRes.json()
      const siswaJson: Siswa[] = await siswaRes.json()
      setData(eligibleJson)
      setSiswaKelas12(siswaJson.filter(s => s.rombel?.kelas === 12))
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const rombelKelas12 = Array.from(new Map(siswaKelas12.map(s => [s.rombel?.id, s.rombel])).values())

  const filteredSiswaKelas12 = filterRombel === 'all'
    ? siswaKelas12
    : siswaKelas12.filter(s => s.rombelId === filterRombel)

  const siswaWithEligible = filteredSiswaKelas12.map(s => {
    const elig = data.find(e => e.siswaId === s.id)
    return { ...s, eligible: elig ?? null }
  })

  const handleSetEligible = (siswa: Siswa) => {
    setSelectedSiswa(siswa)
    const existing = data.find(e => e.siswaId === siswa.id)
    if (existing) {
      setEligibleStatus(existing.status)
      setKeterangan(existing.keterangan ?? '')
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
          siswaId: selectedSiswa.id,
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
    try {
      const res = await fetch('/api/eligible/auto', { method: 'POST' })
      if (!res.ok) throw new Error()
      const result = await res.json()
      toast({ title: `Auto-eligible selesai: ${result.updated} siswa diperbarui` })
      fetchData()
    } catch {
      toast({ title: 'Gagal auto-eligible', variant: 'destructive' })
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

  const eligibleCount = siswaWithEligible.filter(s => s.eligible?.status === 'eligible').length
  const tidakCount = siswaWithEligible.filter(s => s.eligible?.status === 'tidak').length
  const bersyaratCount = siswaWithEligible.filter(s => s.eligible?.status === 'bersyarat').length

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-emerald-600" />
            <div>
              <p className="text-2xl font-bold">{eligibleCount}</p>
              <p className="text-xs text-muted-foreground">Eligible</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{bersyaratCount}</p>
              <p className="text-xs text-muted-foreground">Bersyarat</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <p className="text-2xl font-bold">{tidakCount}</p>
              <p className="text-xs text-muted-foreground">Tidak Eligible</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Select value={filterRombel} onValueChange={setFilterRombel}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter Rombel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Rombel 12</SelectItem>
              {rombelKelas12.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleAutoEligible} size="sm" variant="outline">
          <RefreshCw className="h-4 w-4 mr-1" /> Auto-Eligible
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Siswa Kelas 12 - Status Eligible</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>NIS</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Rombel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Keterangan</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {siswaWithEligible.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Belum ada siswa kelas 12
                  </TableCell>
                </TableRow>
              ) : (
                siswaWithEligible.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{item.nis}</TableCell>
                    <TableCell className="font-medium">{item.nama}</TableCell>
                    <TableCell>{item.rombel?.nama ?? '-'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(item.eligible?.status ?? null)}
                        {statusBadge(item.eligible?.status ?? null)}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.eligible?.keterangan ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleSetEligible(item)}>
                        Atur Status
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur Status Eligible</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">{selectedSiswa?.nama}</p>
              <p className="text-xs text-muted-foreground">NIS: {selectedSiswa?.nis} | {selectedSiswa?.rombel?.nama}</p>
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
