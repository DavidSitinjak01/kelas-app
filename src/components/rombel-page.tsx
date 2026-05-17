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
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel {
  id: string
  nama: string
  kelas: number
  jurusan: string
  tahunAjaran: string
  waliKelas: string
  _count?: { siswa: number }
}

const emptyForm = { nama: '', kelas: '10', jurusan: 'IPA', tahunAjaran: '2024/2025', waliKelas: '' }

export function RombelPage() {
  const [data, setData] = useState<Rombel[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const { toast } = useToast()

  const fetchData = async () => {
    try {
      const res = await fetch('/api/rombel')
      const json = await res.json()
      setData(json)
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
      const res = await fetch('/api/rombel', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error()
      toast({ title: editId ? 'Rombel diperbarui' : 'Rombel ditambahkan' })
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
      const res = await fetch('/api/rombel', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) throw new Error()
      toast({ title: 'Rombel dihapus' })
      fetchData()
    } catch {
      toast({ title: 'Gagal menghapus', variant: 'destructive' })
    }
  }

  const handleEdit = (item: Rombel) => {
    setEditId(item.id)
    setForm({
      nama: item.nama,
      kelas: String(item.kelas),
      jurusan: item.jurusan,
      tahunAjaran: item.tahunAjaran,
      waliKelas: item.waliKelas,
    })
    setOpen(true)
  }

  const handleAdd = () => {
    setEditId(null)
    setForm(emptyForm)
    setOpen(true)
  }

  const kelasColor = (k: number) => {
    if (k === 10) return 'bg-emerald-100 text-emerald-700'
    if (k === 11) return 'bg-teal-100 text-teal-700'
    return 'bg-cyan-100 text-cyan-700'
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Kelola rombongan belajar</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleAdd} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Tambah Rombel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editId ? 'Edit Rombel' : 'Tambah Rombel'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Nama Rombel</Label>
                <Input placeholder="X IPA 1" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kelas</Label>
                  <Select value={form.kelas} onValueChange={v => setForm(f => ({ ...f, kelas: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">Kelas 10</SelectItem>
                      <SelectItem value="11">Kelas 11</SelectItem>
                      <SelectItem value="12">Kelas 12</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jurusan</Label>
                  <Select value={form.jurusan} onValueChange={v => setForm(f => ({ ...f, jurusan: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IPA">IPA</SelectItem>
                      <SelectItem value="IPS">IPS</SelectItem>
                      <SelectItem value="Bahasa">Bahasa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tahun Ajaran</Label>
                  <Input placeholder="2024/2025" value={form.tahunAjaran} onChange={e => setForm(f => ({ ...f, tahunAjaran: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Wali Kelas</Label>
                  <Input placeholder="Nama wali kelas" value={form.waliKelas} onChange={e => setForm(f => ({ ...f, waliKelas: e.target.value }))} />
                </div>
              </div>
              <Button onClick={handleSubmit} className="w-full" disabled={!form.nama || !form.waliKelas}>
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
                <TableHead>Nama</TableHead>
                <TableHead>Kelas</TableHead>
                <TableHead>Jurusan</TableHead>
                <TableHead>Tahun Ajaran</TableHead>
                <TableHead>Wali Kelas</TableHead>
                <TableHead>Jml Siswa</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Belum ada data rombel
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.nama}</TableCell>
                    <TableCell><Badge className={kelasColor(item.kelas)}>Kelas {item.kelas}</Badge></TableCell>
                    <TableCell>{item.jurusan}</TableCell>
                    <TableCell>{item.tahunAjaran}</TableCell>
                    <TableCell>{item.waliKelas}</TableCell>
                    <TableCell>{item._count?.siswa ?? 0}</TableCell>
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
                              <AlertDialogTitle>Hapus Rombel?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Data rombel &quot;{item.nama}&quot; dan semua siswa di dalamnya akan dihapus. Tindakan ini tidak dapat dibatalkan.
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
    </div>
  )
}
