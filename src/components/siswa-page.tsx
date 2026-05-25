'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Plus, Pencil, Trash2, Search, Upload, FileSpreadsheet, Loader2, CheckCircle, AlertCircle, Users, ChevronLeft, ChevronRight } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface Siswa {
  id: string; nis: string; nisn: string; nama: string; jeniskelamin: string
  tempatlahir: string; tanggallahir: string; rombelid: string
  rombel: Rombel
}

const emptyForm = { nis: '', nisn: '', nama: '', jeniskelamin: 'L', tempatlahir: '', tanggallahir: '', rombelid: '' }
const PAGE_SIZE = 50

export function SiswaPage() {
  const [data, setData] = useState<Siswa[]>([])
  const [totalSiswa, setTotalSiswa] = useState(0)
  const [rombelList, setRombelList] = useState<Rombel[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [search, setSearch] = useState('')
  const [filterRombel, setFilterRombel] = useState('all')
  const [page, setPage] = useState(1)
  const { toast } = useToast()

  // Import state
  const [importOpen, setImportOpen] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    success: boolean
    rombelCreated: number
    rombelTotal: number
    siswaCreated: number
    siswaUpdated: number
    siswaSkipped: number
    siswaTotal: number
    errors: string[]
  } | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [serverFiles, setServerFiles] = useState<{ name: string; size: number; lastModified: string }[]>([])
  const [selectedServerFile, setSelectedServerFile] = useState<string>('')
  const [clearExisting, setClearExisting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchData = useCallback(async () => {
    try {
      const rombelRes = await fetch('/api/rombel')
      const rombelJson = await rombelRes.json()
      setRombelList(rombelJson)

      // Use server-side pagination and filtering
      const params = new URLSearchParams()
      params.set('limit', String(PAGE_SIZE))
      params.set('page', String(page))
      if (search) params.set('search', search)
      if (filterRombel !== 'all') params.set('rombelid', filterRombel)

      const siswaRes = await fetch(`/api/siswa?${params}`)
      const siswaJson = await siswaRes.json()

      if (siswaJson.data) {
        setData(siswaJson.data)
        setTotalSiswa(siswaJson.total)
      } else {
        setData(siswaJson)
        setTotalSiswa(Array.isArray(siswaJson) ? siswaJson.length : 0)
      }
    } catch {
      toast({ title: 'Gagal memuat data', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [page, search, filterRombel, toast])

  useEffect(() => { fetchData() }, [fetchData])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, filterRombel])

  const totalPages = Math.ceil(totalSiswa / PAGE_SIZE)

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
      nisn: item.nisn,
      nama: item.nama,
      jeniskelamin: item.jeniskelamin,
      tempatlahir: item.tempatlahir,
      tanggallahir: item.tanggallahir,
      rombelid: item.rombelid,
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
      const formData = new FormData()

      if (selectedFile && !selectedServerFile) {
        // User selected a local file - send directly
        formData.append('file', selectedFile)
      } else if (selectedServerFile) {
        // User selected a server file - send filePath
        formData.append('filePath', selectedServerFile)
      } else {
        throw new Error('Pilih file terlebih dahulu')
      }

      if (clearExisting) {
        formData.append('clearExisting', 'true')
      }

      const importRes = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      const result = await importRes.json()

      if (!importRes.ok) {
        throw new Error(result.error || 'Gagal mengimport')
      }

      setImportResult(result)
      fetchData()

      if (result.siswaCreated > 0 || result.siswaUpdated > 0) {
        toast({
          title: 'Import Berhasil',
          description: `${result.siswaCreated} siswa baru, ${result.siswaUpdated} siswa diperbarui, ${result.rombelCreated} rombel baru`,
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
    setClearExisting(false)
    setImportOpen(true)
    // Load server files
    fetch('/api/upload/list')
      .then(res => res.json())
      .then(data => setServerFiles(data.files || []))
      .catch(() => setServerFiles([]))
  }

  // Stats derived from rombelList (which has _count from the API)
  const totalSiswaFromRombel = rombelList.reduce((sum, r) => sum + ((r as Rombel & { _count?: { siswa: number } })._count?.siswa ?? 0), 0)

  const kelasColor = (kelas: number) => {
    if (kelas === 10) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
    if (kelas === 11) return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
    return 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400'
  }

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
                <Users className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalSiswaFromRombel}</p>
                <p className="text-xs text-muted-foreground">Total Siswa</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Users className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rombelList.length}</p>
                <p className="text-xs text-muted-foreground">Total Rombel</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/30">
                <Users className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rombelList.filter(r => r.kelas === 10).length}</p>
                <p className="text-xs text-muted-foreground">Rombel Kelas 10</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                <Users className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{rombelList.filter(r => r.kelas === 12).length}</p>
                <p className="text-xs text-muted-foreground">Rombel Kelas 12</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rombel Summary */}
      {rombelList.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rombongan Belajar</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {rombelList.sort((a, b) => a.kelas - b.kelas || a.nama.localeCompare(b.nama)).map(r => {
                const rc = r as Rombel & { _count?: { siswa: number } }
                return (
                  <Badge
                    key={r.id}
                    variant="outline"
                    className={`cursor-pointer transition-colors ${filterRombel === r.id ? 'ring-2 ring-primary' : ''} ${kelasColor(r.kelas)}`}
                    onClick={() => setFilterRombel(filterRombel === r.id ? 'all' : r.id)}
                  >
                    {r.nama} ({rc._count?.siswa ?? 0})
                  </Badge>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cari nama, NIS, atau NISN..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
                    <Label>NISN</Label>
                    <Input placeholder="NISN" value={form.nisn} onChange={e => setForm(f => ({ ...f, nisn: e.target.value }))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Jenis Kelamin</Label>
                    <Select value={form.jeniskelamin} onValueChange={v => setForm(f => ({ ...f, jeniskelamin: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="L">Laki-laki</SelectItem>
                        <SelectItem value="P">Perempuan</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Rombel</Label>
                    <Select value={form.rombelid} onValueChange={v => setForm(f => ({ ...f, rombelid: v }))}>
                      <SelectTrigger><SelectValue placeholder="Pilih Rombel" /></SelectTrigger>
                      <SelectContent>
                        {rombelList.map(r => (
                          <SelectItem key={r.id} value={r.id}>{r.nama}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Nama Lengkap</Label>
                  <Input placeholder="Nama siswa" value={form.nama} onChange={e => setForm(f => ({ ...f, nama: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tempat Lahir</Label>
                    <Input placeholder="Tempat lahir" value={form.tempatlahir} onChange={e => setForm(f => ({ ...f, tempatlahir: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Tanggal Lahir</Label>
                    <Input placeholder="YYYY-MM-DD" value={form.tanggallahir} onChange={e => setForm(f => ({ ...f, tanggallahir: e.target.value }))} />
                  </div>
                </div>
                <Button onClick={handleSubmit} className="w-full" disabled={!form.nis || !form.nama || !form.rombelid}>
                  {editId ? 'Perbarui' : 'Simpan'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button onClick={handleAdd} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Tambah Siswa
          </Button>
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
              Rombel akan dibuat otomatis sesuai data di Excel dan siswa akan dimasukkan ke rombel yang sesuai.
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

            {/* Clear existing option */}
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <Checkbox
                id="clear-existing"
                checked={clearExisting}
                onCheckedChange={(checked) => setClearExisting(checked === true)}
                className="data-[state=checked]:bg-amber-600 data-[state=checked]:border-amber-600"
              />
              <div className="flex-1">
                <Label htmlFor="clear-existing" className="text-sm font-medium cursor-pointer">
                  Hapus data sebelumnya sebelum import
                </Label>
                <p className="text-xs text-muted-foreground">
                  Semua data siswa, nilai, dan rombel yang ada akan dihapus terlebih dahulu
                </p>
              </div>
            </div>

            {importing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Mengimport data siswa...</span>
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

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{importResult.rombelCreated}</p>
                    <p className="text-xs text-muted-foreground">Rombel Baru</p>
                    <p className="text-xs text-muted-foreground">(dari {importResult.rombelTotal} total)</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{importResult.siswaCreated}</p>
                    <p className="text-xs text-muted-foreground">Siswa Baru</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-center">
                    <p className="text-2xl font-bold text-teal-600">{importResult.siswaUpdated}</p>
                    <p className="text-xs text-muted-foreground">Diperbarui</p>
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
                <TableHead>NISN</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead className="w-16">L/P</TableHead>
                <TableHead className="hidden md:table-cell">Tempat Lahir</TableHead>
                <TableHead>Rombel</TableHead>
                <TableHead className="w-24 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                    {totalSiswa === 0 ? (
                      <div className="space-y-2">
                        <p>Belum ada data siswa</p>
                        <Button variant="outline" size="sm" onClick={openImportDialog}>
                          <Upload className="h-4 w-4 mr-1" /> Import dari Excel Dapodik
                        </Button>
                      </div>
                    ) : (
                      'Tidak ada siswa yang cocok'
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item, idx) => (
                  <TableRow key={item.id}>
                    <TableCell>{(page - 1) * PAGE_SIZE + idx + 1}</TableCell>
                    <TableCell className="font-mono text-sm">{item.nis}</TableCell>
                    <TableCell className="font-mono text-sm">{item.nisn !== '-' ? item.nisn : '-'}</TableCell>
                    <TableCell className="font-medium">{item.nama}</TableCell>
                    <TableCell><Badge variant={item.jeniskelamin === 'L' ? 'default' : 'secondary'}>{item.jeniskelamin}</Badge></TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{item.tempatlahir !== '-' ? item.tempatlahir : '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={kelasColor(item.rombel?.kelas ?? 10)}>
                        {item.rombel?.nama ?? '-'}
                      </Badge>
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

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Menampilkan {data.length} dari {totalSiswa} siswa
          {totalPages > 1 && ` (Halaman ${page} dari ${totalPages})`}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">{page} / {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
