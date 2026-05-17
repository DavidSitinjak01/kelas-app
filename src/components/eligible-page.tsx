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
  CheckCircle, Trophy, Loader2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface PeringkatItem {
  siswaId: string; nama: string; nis: string; nisn: string
  rombelId: string; rombelNama: string; kelas: number
  rataRata: number; subjectCount: number; peringkat: number
}

export function EligiblePage() {
  const [peringkat, setPeringkat] = useState<PeringkatItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [selectedSiswa, setSelectedSiswa] = useState<PeringkatItem | null>(null)
  const [keterangan, setKeterangan] = useState('')
  const [autoRunning, setAutoRunning] = useState(false)
  const [autoResult, setAutoResult] = useState<{
    updated: number; total: number; top20Count: number; top20Cutoff: number
  } | null>(null)

  const { toast } = useToast()

  const fetchData = async () => {
    try {
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

  // Only top 20%
  const totalSiswa = peringkat.length
  const top20Count = totalSiswa > 0 ? Math.max(Math.floor(totalSiswa * 0.2), 1) : 0
  const top20Siswa = peringkat.slice(0, top20Count)
  const top20Cutoff = top20Siswa.length > 0 ? top20Siswa[top20Siswa.length - 1].rataRata : 0

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

  const handleAtur = (siswa: PeringkatItem) => {
    setSelectedSiswa(siswa)
    setKeterangan('')
    setOpen(true)
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

  if (peringkat.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">Belum ada data nilai kelas XII</p>
            <p className="text-xs text-muted-foreground mt-1">Import leger nilai terlebih dahulu</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Top 20% Info Banner */}
      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Trophy className="h-6 w-6 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                  Top 20% Siswa Kelas XII
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalSiswa} siswa × 20% = <strong>{top20Count} siswa eligible</strong> (peringkat tertinggi dari semua rombel XII)
                </p>
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
      {top20Siswa.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {top20Siswa.slice(0, 3).map((s, idx) => (
            <Card key={s.siswaId} className={idx === 0 ? 'border-yellow-300 bg-yellow-50/50 dark:bg-yellow-950/10' : idx === 1 ? 'border-gray-300 bg-gray-50/50 dark:bg-gray-950/10' : 'border-amber-300 bg-amber-50/50 dark:bg-amber-950/10'}>
              <CardContent className="p-4 text-center">
                <div className="flex justify-center mb-2">
                  <Trophy className={`h-8 w-8 ${idx === 0 ? 'text-yellow-500' : idx === 1 ? 'text-gray-400' : 'text-amber-600'}`} />
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

      {/* Full Table - ONLY top 20% */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Siswa Eligible Kelas XII ({top20Count} dari {totalSiswa} siswa)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16 text-center">Peringkat</TableHead>
                <TableHead>NIS</TableHead>
                <TableHead>Nama Siswa</TableHead>
                <TableHead>Rombel</TableHead>
                <TableHead className="text-center">Mapel</TableHead>
                <TableHead className="text-right">Rata-rata</TableHead>
                <TableHead className="w-20 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {top20Siswa.map(s => (
                <TableRow key={s.siswaId} className="bg-emerald-50/50 dark:bg-emerald-950/10">
                  <TableCell className="text-center">
                    {s.peringkat === 1 ? (
                      <div className="flex items-center justify-center gap-1"><Trophy className="h-5 w-5 text-yellow-500" /><span className="font-bold text-yellow-600">1</span></div>
                    ) : s.peringkat === 2 ? (
                      <div className="flex items-center justify-center gap-1"><Trophy className="h-5 w-5 text-gray-400" /><span className="font-bold text-gray-500">2</span></div>
                    ) : s.peringkat === 3 ? (
                      <div className="flex items-center justify-center gap-1"><Trophy className="h-5 w-5 text-amber-600" /><span className="font-bold text-amber-700">3</span></div>
                    ) : (
                      <span className="font-bold text-emerald-600">{s.peringkat}</span>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{s.nis}</TableCell>
                  <TableCell className="font-medium">{s.nama}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{s.rombelNama}</Badge></TableCell>
                  <TableCell className="text-center">{s.subjectCount}</TableCell>
                  <TableCell className={`text-right font-semibold ${nilaiColor(s.rataRata)}`}>
                    {s.rataRata.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleAtur(s)}>
                      Atur
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Bottom cutoff info */}
      <div className="text-center text-xs text-muted-foreground">
        Batas bawah rata-rata: <strong>{top20Cutoff.toFixed(2)}</strong> | Menampilkan {top20Count} siswa terbaik dari total {totalSiswa} siswa kelas XII
      </div>

      {/* Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Status Siswa Eligible</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <p className="text-sm font-medium">{selectedSiswa?.nama}</p>
              <p className="text-xs text-muted-foreground">
                NIS: {selectedSiswa?.nis} | {selectedSiswa?.rombelNama} | Peringkat #{selectedSiswa?.peringkat} | Rata-rata: {selectedSiswa?.rataRata.toFixed(2)}
              </p>
            </div>
            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Eligible</p>
                <p className="text-xs text-muted-foreground">Termasuk top 20% siswa kelas XII</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Keterangan</Label>
              <Input placeholder="Opsional" value={keterangan} onChange={e => setKeterangan(e.target.value)} />
            </div>
            <Button onClick={() => setOpen(false)} className="w-full">Tutup</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
