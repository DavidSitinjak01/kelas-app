'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2, Search } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface Siswa {
  id: string; nis: string; nama: string; jenisKelamin: string; rombelId: string
  rombel: Rombel
}

const emptyForm = { nis: '', nama: '', jenisKelamin: 'L', rombelId: '' }

export function SiswaPage() {
  const [data, setData] = useState<Siswa[]>([])
  const [rombelList, setRombelList] = useState<Rombel[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterRombel, setFilterRombel] = useState('all')
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const [siswaRes, rombelRes] = await Promise.all([
        fetch('/api/siswa'),
        fetch('/api/rombel'),
      ])
      const siswaJson = await siswaRes.json()
      const rombelJson = await rombelRes.json()
      setData(siswaJson)
      setRombelList(rombelJson)
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const handleSubmit = async () => {
    try {
      const method = editId ? 'PUT' : 'POST'
      const body = editId ? { id: editId, ...form } : form
      const res = await fetch('/api/siswa', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Gagal')
      }
      toast({ title: editId ? 'Siswa diperbarui' : 'Siswa ditambahkan' })
      setOpen(false)
      setEditId(null)
      setForm(emptyForm)
      fetchData()
    } catch (e: unknown) {
      toast({ title: e instanceof Error ? e.message : 'Gagal menyimpan', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch('/api/siswa', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Siswa dihapus' })
      fetchData()
    } catch {
      toast({ title: 'Gagal menghapus', variant: 'destructive' })
    }
  }

  const handleEdit = (item: Siswa) => {
    setEditId(item.id)
    setForm({
      nis: item.nis,
      nama: item.nama,
      jenisKelamin: item.jenisKelamin,
      rombelId: item.rombelId,
    })
    setOpen(true)
  }

  const handleAdd = () => {
    setEditId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const filtered = data.filter(s => {
    const matchSearch = s.nama.toLowerCase().includes(search.toLowerCase()) || s.nis.includes(search)
    const matchRombel = filterRombel === 'all' || s.rombelId === filterRombel
    return matchSearch && matchRombel
  })

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama atau NIS..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={filterRombel} onValueChange={setFilterRombel}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Filter Rombel" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Rombel</SelectItem>
              {rombelList.map(r => (
                <SelectItem key={r.id} value={r.id}>{r.nama}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Tambah Siswa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Edit Siswa' : 'Tambah Siswa'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>NIS</Label>
                  <Input placeholder="Nomor Induk Siswa" value={form.nis} onChange={e => setForm(f => ({ ...f, nis: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Kelamin</Label>
                  <Select value={form.jenisKelamin} onValueChange={v => setForm(f => ({ ...f, jenisKelamin: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="L">Laki-laki</SelectItem>
                      <SelectItem value="P">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nama Lengkap</Label>
                <Input placeholder="Nama siswa" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Rombel</Label>
                <Select value={form.rombelId} onValueChange={v => setForm(f => ({ ...f, rombelId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Pilih Rombel" /></SelectTrigger>
                  <SelectContent>
                    {rombelList.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.nama} - {r.jurusan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={!form.nis || !form.nama || !form.rombelId}>
                {editId ? 'Perbarui' : 'Simpan'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No</TableHead>
                <TableHead>NIS</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>L/P</TableHead>
                <TableHead>Rombel</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {data.length === 0 ? 'Belum ada data siswa' : 'Tidak ada siswa yang cocok'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{idx + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{item.nis}</TableCell>
                    <TableCell className="font-medium">{item.nama}</TableCell>
                    <TableCell><Badge variant={item.jenisKelamin === 'L' ? 'default' : 'secondary'}>{item.jenisKelamin}</Badge></TableCell>
                    <TableCell>{item.rombel?.nama ?? '-'}</TableCell>
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
                              <AlertDialogTitle>Hapus Siswa?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Data siswa &quot;{item.nama}&quot; dan semua nilai terkait akan dihapus.
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
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">Menampilkan {filtered.length} dari {data.length} siswa</p>
    </div>
  )
}
