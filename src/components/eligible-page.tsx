'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Trophy, CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Eligible {
  id: string; siswaid: string; status: string; keterangan: string | null
  siswa: { id: string; nis: string; nama: string; rombelid: string; rombel: { id: string; nama: string; kelas: number } }
}

export function EligiblePage() {
  const [data, setData] = useState<Eligible[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/eligible')
      const json = await res.json()
      setData(json)
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleRemove = async (siswaid: string) => {
    try {
      await fetch('/api/eligible', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siswaid }),
      })
      toast({ title: 'Status eligible dihapus' })
      fetchData()
    } catch {
      toast({ title: 'Gagal menghapus', variant: 'destructive' })
    }
  }

  const eligibleSiswa = data.filter(e => e.status === 'eligible')
  const bersyaratSiswa = data.filter(e => e.status === 'bersyarat')
  const tidakSiswa = data.filter(e => e.status === 'tidak')

  const statusBadge = (status: string) => {
    if (status === 'eligible') return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">✅ Eligible</Badge>
    if (status === 'bersyarat') return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">⚠️ Bersyarat</Badge>
    if (status === 'tidak') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">❌ Tidak</Badge>
    return <Badge variant="outline">-</Badge>
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  if (data.length === 0) {
    return (
      <div className="space-y-4">
        <Card className="border-emerald-200 dark:border-emerald-800">
          <CardContent className="p-8 text-center">
            <Trophy className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-muted-foreground">Belum ada siswa yang ditetapkan status eligible</p>
            <p className="text-xs text-muted-foreground mt-1">Atur status eligible dari menu Nilai → Peringkat Tingkat → Kelas XII</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/10">
          <CardContent className="p-3 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xl font-bold text-emerald-700">{eligibleSiswa.length}</p>
              <p className="text-[11px] text-muted-foreground">Eligible</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
          <CardContent className="p-3 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-amber-700">{bersyaratSiswa.length}</p>
              <p className="text-[11px] text-muted-foreground">Bersyarat</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50 dark:bg-red-950/10">
          <CardContent className="p-3 flex items-center gap-2">
            <XCircle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-xl font-bold text-red-700">{tidakSiswa.length}</p>
              <p className="text-[11px] text-muted-foreground">Tidak Eligible</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-2">
            <Trophy className="h-5 w-5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xl font-bold">{data.length}</p>
              <p className="text-[11px] text-muted-foreground">Total Dinilai</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/10">
        <CardContent className="p-3">
          <p className="text-xs text-muted-foreground">
            💡 Atur status eligible dari menu <strong>Nilai → Peringkat Tingkat → Kelas XII</strong>
          </p>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Siswa Kelas XII - Status Eligible</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[60vh] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>No</TableHead>
                  <TableHead>NIS</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead>Rombel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="w-20 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, idx) => (
                  <TableRow key={item.id} className={item.status === 'eligible' ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{item.siswa?.nis ?? '-'}</TableCell>
                    <TableCell className="font-medium">{item.siswa?.nama ?? '-'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{item.siswa?.rombel?.nama ?? '-'}</Badge></TableCell>
                    <TableCell>{statusBadge(item.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{item.keterangan ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700" onClick={() => handleRemove(item.siswaid)}>
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
