'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface Siswa { id: string; nis: string; nama: string; rombelId: string; rombel: Rombel }
interface Nilai {
  id: string; siswaId: string; mataPelajaran: string; nilaiAsli: number; nilaiUp: number
  semester: string; tahunAjaran: string; siswa: Siswa
}

const MATA_PELAJARAN = [
  'Matematika', 'Bahasa Indonesia', 'Bahasa Inggris', 'Fisika', 'Kimia',
  'Biologi', 'Ekonomi', 'Sosiologi', 'Geografi', 'Sejarah', 'PKN',
  'Seni Budaya', 'PJOK',
]

const emptyForm = {
  siswaId: '', mataPelajaran: 'Matematika', nilaiAsli: '', nilaiUp: '',
  semester: '1', tahunAjaran: '2024/2025',
}

export function NilaiPage() {
  const [data, setData] = useState<Nilai[]>([])
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [rombelList, setRombelList] = useState<Rombel[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterRombel, setFilterRombel] = useState('all')
  const [filterMapel, setFilterMapel] = useState('all')
  const [filterSemester, setFilterSemester] = useState('all')
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const [nilaiRes, rombelRes] = await Promise.all([
        fetch('/api/nilai'),
        fetch('/api/rombel'),
      ])
      setData(await nilaiRes.json())
      setRombelList(await rombelRes.json())
      
      // Fetch siswa with rombel filter when needed
      if (filterRombel !== 'all') {
        const siswaRes = await fetch(`/api/siswa?rombelId=${filterRombel}&limit=100`)
        const siswaJson = await siswaRes.json()
        setSiswaList(siswaJson.data || siswaJson)
      } else {
        // Fetch all siswa in batches by rombel
        const allSiswa: Siswa[] = []
        for (const r of rombelList) {
          const res = await fetch(`/api/siswa?rombelId=${r.id}&limit=100`)
          const json = await res.json()
          if (json.data) allSiswa.push(...json.data)
          else if (Array.isArray(json)) allSiswa.push(...json)
        }
        setSiswaList(allSiswa)
      }
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const filteredSiswa = filterRombel === 'all'
    ? siswaList
    : siswaList.filter(s => s.rombelId === filterRombel)

  const filtered = data.filter(n => {
    const matchRombel = filterRombel === 'all' || n.siswa.rombelId === filterRombel
    const matchMapel = filterMapel === 'all' || n.mataPelajaran === filterMapel
    const matchSemester = filterSemester === 'all' || n.semester === filterSemester
    return matchRombel && matchMapel && matchSemester
  })

  const handleSubmit = async () => {
    try {
      const method = editId ? 'PUT' : 'POST'
      const body = editId
        ? { id: editId, ...form, nilaiAsli: parseFloat(form.nilaiAsli), nilaiUp: parseFloat(form.nilaiUp) }
        : { ...form, nilaiAsli: parseFloat(form.nilaiAsli), nilaiUp: parseFloat(form.nilaiUp) }
      const res = await fetch('/api/nilai', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast({ title: editId ? 'Nilai diperbarui' : 'Nilai ditambahkan' })
      setOpen(false)
      setEditId(null)
      setForm(emptyForm)
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
      nilaiAsli: String(item.nilaiAsli),
      nilaiUp: String(item.nilaiUp),
      semester: item.semester,
      tahunAjaran: item.tahunAjaran,
    })
    setOpen(true)
  }

  const handleAdd = () => {
    setEditId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const nilaiColor = (val: number) => {
    if (val >= 85) return 'text-emerald-600 font-semibold'
    if (val >= 75) return 'text-green-600'
    if (val >= 60) return 'text-amber-600'
    return 'text-red-600 font-semibold'
  }

  const renderTable = (type: 'asli' | 'up') => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>No</TableHead>
          <TableHead>NIS</TableHead>
          <TableHead>Nama</TableHead>
          <TableHead>Rombel</TableHead>
          <TableHead>Mapel</TableHead>
          <TableHead>Semester</TableHead>
          <TableHead className="text-right">{type === 'asli' ? 'Nilai Asli' : 'Nilai Up'}</TableHead>
          <TableHead className="text-right">Aksi</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
              Belum ada data nilai
            </TableCell>
          </TableRow>
        ) : (
          filtered.map((item, idx) => (
            <TableRow key={item.id}>
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="font-mono text-sm">{item.siswa?.nis ?? '-'}</TableCell>
              <TableCell className="font-medium">{item.siswa?.nama ?? '-'}</TableCell>
              <TableCell>{item.siswa?.rombel?.nama ?? '-'}</TableCell>
              <TableCell>{item.mataPelajaran}</TableCell>
              <TableCell><Badge variant="outline">Sem {item.semester}</Badge></TableCell>
              <TableCell className={`text-right ${nilaiColor(type === 'asli' ? item.nilaiAsli : item.nilaiUp)}`}>
                {type === 'asli' ? item.nilaiAsli : item.nilaiUp}
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <Trash2 className="h-4 w-4 text-destructive" />
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
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <div className="space-y-4">
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
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter Mapel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Mapel</SelectItem>
              {MATA_PELAJARAN.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSemester} onValueChange={setFilterSemester}>
            <SelectTrigger className="w-32"><SelectValue placeholder="Semester" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua</SelectItem>
              <SelectItem value="1">Semester 1</SelectItem>
              <SelectItem value="2">Semester 2</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Tambah Nilai
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Edit Nilai' : 'Tambah Nilai'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Siswa</Label>
                <Select value={form.siswaId} onValueChange={v => setForm(f => ({ ...f, siswaId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Siswa" /></SelectTrigger>
                  <SelectContent>
                    {filteredSiswa.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.nis} - {s.nama}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Mata Pelajaran</Label>
                  <Select value={form.mataPelajaran} onValueChange={v => setForm(f => ({ ...f, mataPelajaran: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MATA_PELAJARAN.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Semester</Label>
                  <Select value={form.semester} onValueChange={v => setForm(f => ({ ...f, semester: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Semester 1</SelectItem>
                      <SelectItem value="2">Semester 2</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nilai Asli</Label>
                  <Input type="number" min="0" max="100" placeholder="0-100" value={form.nilaiAsli} onChange={e => setForm(f => ({ ...f, nilaiAsli: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Nilai Up</Label>
                  <Input type="number" min="0" max="100" placeholder="0-100" value={form.nilaiUp} onChange={e => setForm(f => ({ ...f, nilaiUp: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Tahun Ajaran</Label>
                <Input placeholder="2024/2025" value={form.tahunAjaran} onChange={e => setForm(f => ({ ...f, tahunAjaran: e.target.value }))} />
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={!form.siswaId || !form.nilaiAsli || !form.nilaiUp}>
                {editId ? 'Perbarui' : 'Simpan'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <Tabs defaultValue="asli">
          <CardHeader className="pb-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Daftar Nilai</CardTitle>
              <TabsList>
                <TabsTrigger value="asli">Nilai Asli</TabsTrigger>
                <TabsTrigger value="up">Nilai Up</TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <TabsContent value="asli" className="m-0">
              {renderTable('asli')}
            </TabsContent>
            <TabsContent value="up" className="m-0">
              {renderTable('up')}
            </TabsContent>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  )
}
