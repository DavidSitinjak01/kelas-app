'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, Pencil, Trash2, Search, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
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

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    rombelCreated: number
    rombelTotal: number
    siswaCreated: number
    siswaSkipped: number
    siswaTotal: number
    errors: string[]
  } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [serverFiles, setServerFiles] = useState<{ name: string; size: number; lastModified: string }[]>([])
  const [selectedServerFile, setSelectedServerFile] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImport = async () => {
    setImporting(true)
    setImportResult(null)

    try {
      let filePath = selectedServerFile

      // If user selected a local file, upload it first
      if (selectedFile && !selectedServerFile) {
        const formData = new FormData()
        formData.append('file', selectedFile)

        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          throw new Error('Gagal mengupload file')
        }

        const uploadData = await uploadRes.json()
        filePath = uploadData.filePath
      }

      if (!filePath) {
        throw new Error('Pilih file terlebih dahulu')
      }

      // Then import
      const importRes = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath }),
      })

      const result = await importRes.json()

      if (!importRes.ok) {
        throw new Error(result.error || 'Gagal mengimport')
      }

      setImportResult(result)
      fetchData()

      if (result.siswaCreated > 0) {
        toast({
          title: 'Import Berhasil',
          description: `${result.siswaCreated} siswa dan ${result.rombelCreated} rombel berhasil diimport`,
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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setSelectedServerFile('')
      setImportResult(null)
    }
  }

  const openImportDialog = () => {
    setSelectedFile(null)
    setSelectedServerFile('')
    setImportResult(null)
    setImportOpen(true)
    // Load server files
    fetch('/api/upload/list')
      .then(res => res.json())
      .then(data => setServerFiles(data.files || []))
      .catch(() => setServerFiles([]))
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
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={openImportDialog}>
            <Upload className="h-4 w-4 mr-1" /> Import Excel
          </Button>
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
      </div>

      {/* Import Dialog */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              Import Data Siswa dari Excel
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <CardDescription>
              Import data peserta didik dari file Excel Dapodik. File harus berformat .xlsx dengan kolom: No, Nama, NIPD, JK, NISN, dan Rombel Saat Ini.
              Rombel akan dibuat otomatis sesuai data di Excel.
            </CardDescription>

            {/* Server files selection */}
            {serverFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">File di Server</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                  {serverFiles.map(f => (
                    <div
                      key={f.name}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-sm transition-colors ${
                        selectedServerFile === f.name
                          ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                      onClick={() => {
                        setSelectedServerFile(f.name)
                        setSelectedFile(null)
                        setImportResult(null)
                      }}
                    >
                      <FileSpreadsheet className={`h-4 w-4 shrink-0 ${selectedServerFile === f.name ? 'text-emerald-600' : 'text-muted-foreground'}`} />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      {selectedServerFile === f.name && <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">atau upload file baru</span>
              </div>
            </div>

            <div className="space-y-3">
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {selectedFile ? selectedFile.name : 'Klik untuk memilih file Excel'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Format: .xlsx (Dapodik)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {selectedFile && !importResult && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(1)} KB</p>
                </div>
              </div>
            )}

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Mengimport data...</span>
                </div>
                <Progress value={45} className="h-2" />
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
                    <p className="text-2xl font-bold text-emerald-600">{importResult.rombelCreated}</p>
                    <p className="text-xs text-muted-foreground">Rombel Baru</p>
                    <p className="text-xs text-muted-foreground">(dari {importResult.rombelTotal} total)</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{importResult.siswaCreated}</p>
                    <p className="text-xs text-muted-foreground">Siswa Diimport</p>
                    <p className="text-xs text-muted-foreground">(dari {importResult.siswaTotal} total)</p>
                  </div>
                </div>

                {importResult.siswaSkipped > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>{importResult.siswaSkipped} siswa dilewati (sudah ada / data tidak valid)</span>
                  </div>
                )}

                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto text-xs text-muted-foreground space-y-1 custom-scrollbar">
                    {importResult.errors.map((err, i) => (
                      <p key={i} className="text-red-500">• {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2">
              {importResult ? (
                <Button onClick={() => setImportOpen(false)} className="w-full">
                  Selesai
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>
                    Batal
                  </Button>
                  <Button onClick={handleImport} disabled={(!selectedFile && !selectedServerFile) || importing}>
                    {importing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Mengimport...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" /> Import
                      </>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">No</TableHead>
                <TableHead>NIS</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="w-16">L/P</TableHead>
                <TableHead>Rombel</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    {data.length === 0 ? (
                      <div className="space-y-2">
                        <p>Belum ada data siswa</p>
                        <Button variant="outline" size="sm" onClick={openImportDialog}>
                          <Upload className="h-4 w-4 mr-1" /> Import dari Excel
                        </Button>
                      </div>
                    ) : (
                      'Tidak ada siswa yang cocok'
                    )}
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
