'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  GraduationCap,
  Eye,
  EyeOff,
  Loader2,
  Save,
  CheckCircle2,
  LogOut,
  Plus,
  Trash2,
  BookOpen,
  User,
  Download,
  FileText,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface StudentInfo {
  id: string
  nis: string
  nisn: string
  nama: string
  jeniskelamin: string
  rombel: {
    id: string
    nama: string
    kelas: number
    jurusan: string
  } | null
}

interface NilaiEntry {
  id?: string
  matapelajaran: string
  smt1: number | string
  smt2: number | string
  smt3: number | string
  smt4: number | string
  smt5: number | string
  smt6: number | string
  rerata?: number
  isNew?: boolean
}

type Step = 'login' | 'form'

export default function FormNilaiPage() {
  const [step, setStep] = useState<Step>('login')
  const [nama, setNama] = useState('')
  const [nisn, setNisn] = useState('')
  const [showNisn, setShowNisn] = useState(false)
  const [siswa, setSiswa] = useState<StudentInfo | null>(null)
  const [nilaiList, setNilaiList] = useState<NilaiEntry[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { toast } = useToast()

  // On page load/refresh: clear any existing session and show login
  useEffect(() => {
    const clearSession = async () => {
      try {
        await fetch('/api/public/student-logout', { method: 'POST' })
      } catch {
        // Ignore
      }
      setIsCheckingSession(false)
    }
    clearSession()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nama.trim() || !nisn.trim()) return

    setIsLoggingIn(true)
    setLoginError('')

    try {
      const res = await fetch('/api/public/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama: nama.trim(), nisn: nisn.trim() }),
      })
      const data = await res.json()

      if (!res.ok) {
        setLoginError(data.error || 'Login gagal')
        return
      }

      setSiswa(data.student)

      // Load nilai
      const nilaiRes = await fetch(`/api/public/nilai?siswaid=${data.student.id}`)
      const nilaiData = await nilaiRes.json()
      if (nilaiRes.ok && nilaiData.nilai) {
        setNilaiList(
          nilaiData.nilai.map((n: NilaiEntry) => ({
            ...n,
            smt1: n.smt1 || '',
            smt2: n.smt2 || '',
            smt3: n.smt3 || '',
            smt4: n.smt4 || '',
            smt5: n.smt5 || '',
            smt6: n.smt6 || '',
          }))
        )
      }

      setStep('form')
    } catch {
      setLoginError('Terjadi kesalahan saat login')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/public/student-logout', { method: 'POST' })
    } catch {
      // Ignore
    }
    setStep('login')
    setSiswa(null)
    setNilaiList([])
    setNama('')
    setNisn('')
    setSaveSuccess(false)
  }

  const handleNilaiChange = (index: number, field: keyof NilaiEntry, value: string) => {
    setNilaiList((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
    setSaveSuccess(false)
  }

  const handleAddSubject = () => {
    if (!newSubject.trim()) return
    if (nilaiList.some((n) => n.matapelajaran.toLowerCase() === newSubject.trim().toLowerCase())) {
      toast({ title: 'Mata pelajaran sudah ada', variant: 'destructive' })
      return
    }
    setNilaiList((prev) => [
      ...prev,
      {
        matapelajaran: newSubject.trim(),
        smt1: '',
        smt2: '',
        smt3: '',
        smt4: '',
        smt5: '',
        smt6: '',
        isNew: true,
      },
    ])
    setNewSubject('')
    setSaveSuccess(false)
  }

  const handleRemoveSubject = (index: number) => {
    setNilaiList((prev) => prev.filter((_, i) => i !== index))
    setSaveSuccess(false)
  }

  const calculateRerata = (entry: NilaiEntry): string => {
    const vals = [entry.smt1, entry.smt2, entry.smt3, entry.smt4, entry.smt5, entry.smt6]
      .map((v) => parseFloat(String(v)))
      .filter((v) => !isNaN(v) && v > 0)
    if (vals.length === 0) return '-'
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)
  }

  const handleSave = async () => {
    if (!siswa) return
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      const cleanedNilai = nilaiList.map((entry) => {
        const parseNum = (v: number | string) => {
          const n = parseFloat(String(v))
          return isNaN(n) ? 0 : n
        }
        return {
          id: entry.isNew ? undefined : entry.id,
          matapelajaran: entry.matapelajaran,
          smt1: parseNum(entry.smt1),
          smt2: parseNum(entry.smt2),
          smt3: parseNum(entry.smt3),
          smt4: parseNum(entry.smt4),
          smt5: parseNum(entry.smt5),
          smt6: parseNum(entry.smt6),
        }
      })

      const res = await fetch('/api/public/nilai', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siswaid: siswa.id, nilai: cleanedNilai }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast({ title: 'Gagal menyimpan', description: data.error, variant: 'destructive' })
        return
      }

      setSaveSuccess(true)
      toast({
        title: 'Berhasil disimpan!',
        description: `${data.count} mata pelajaran berhasil disimpan`,
      })

      // Refresh data
      const nilaiRes = await fetch(`/api/public/nilai?siswaid=${siswa.id}`)
      const nilaiData = await nilaiRes.json()
      if (nilaiRes.ok && nilaiData.nilai) {
        setNilaiList(
          nilaiData.nilai.map((n: NilaiEntry) => ({
            ...n,
            smt1: n.smt1 || '',
            smt2: n.smt2 || '',
            smt3: n.smt3 || '',
            smt4: n.smt4 || '',
            smt5: n.smt5 || '',
            smt6: n.smt6 || '',
          }))
        )
      }
    } catch {
      toast({ title: 'Terjadi kesalahan', description: 'Gagal menyimpan data', variant: 'destructive' })
    } finally {
      setIsSaving(false)
    }
  }

  // ---- PDF DOWNLOAD ----
  const handleDownloadPDF = async () => {
    if (!siswa) return
    setIsDownloading(true)

    try {
      const res = await fetch('/api/public/student-report')
      if (!res.ok) {
        const data = await res.json()
        toast({ title: 'Gagal', description: data.error || 'Tidak dapat membuat laporan', variant: 'destructive' })
        return
      }

      const report = await res.json()
      const html = generateReportHTML(report)

      // Open in new window and trigger print
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const printWindow = window.open(url, '_blank')

      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print()
          }, 500)
        }
      }

      toast({ title: 'Laporan siap diunduh!', description: 'Gunakan "Save as PDF" pada dialog print' })
    } catch {
      toast({ title: 'Gagal', description: 'Terjadi kesalahan saat membuat laporan', variant: 'destructive' })
    } finally {
      setIsDownloading(false)
    }
  }

  const semesterLabels = ['Smt 1', 'Smt 2', 'Smt 3', 'Smt 4', 'Smt 5', 'Smt 6']
  const semesterFields = ['smt1', 'smt2', 'smt3', 'smt4', 'smt5', 'smt6'] as const

  // Loading state while checking session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-950 dark:to-gray-900">
        <Loader2 className="size-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-950 dark:to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <GraduationCap className="size-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">Kelas App</h1>
              <p className="text-xs text-muted-foreground">Form Isi Nilai Siswa</p>
            </div>
          </div>
          {step === 'form' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <LogOut className="size-4 mr-1" />
              Keluar
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 pb-24">
        {/* LOGIN STEP */}
        {step === 'login' && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Card className="w-full max-w-md shadow-xl border-0">
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 shadow-inner">
                  <User className="size-8" />
                </div>
                <h2 className="text-xl font-bold">Login Siswa</h2>
                <p className="text-sm text-muted-foreground">
                  Masukkan <strong>Nama Lengkap</strong> dan <strong>NISN</strong> untuk login
                </p>
                <div className="mt-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                  <strong>Info:</strong> Nama harus sesuai data siswa, NISN adalah 10 digit nomor unik siswa
                </div>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/50 p-3 border border-red-200 dark:border-red-800">
                      <p className="text-sm font-medium text-red-600 dark:text-red-400">{loginError}</p>
                      {loginError.includes('NISN') && (
                        <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                          Pastikan NISN yang dimasukkan benar (10 digit angka)
                        </p>
                      )}
                      {loginError.includes('Nama') && (
                        <p className="text-xs text-red-500 dark:text-red-500 mt-1">
                          Nama harus sesuai dengan data yang terdaftar
                        </p>
                      )}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="nama">Nama Lengkap</Label>
                    <Input
                      id="nama"
                      type="text"
                      placeholder="Masukkan nama lengkap"
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      required
                      className="text-center text-base"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nisn">NISN (Password)</Label>
                    <div className="relative">
                      <Input
                        id="nisn"
                        type={showNisn ? 'text' : 'password'}
                        placeholder="Masukkan NISN"
                        value={nisn}
                        onChange={(e) => setNisn(e.target.value)}
                        required
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNisn(!showNisn)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNisn ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={isLoggingIn || !nama.trim() || !nisn.trim()}
                  >
                    {isLoggingIn ? (
                      <>
                        <Loader2 className="size-4 mr-2 animate-spin" />
                        Masuk...
                      </>
                    ) : (
                      'Masuk'
                    )}
                  </Button>
                </form>
                <div className="mt-6 text-center text-xs text-muted-foreground">
                  <p>Hubungi wali kelas jika Anda lupa NISN</p>
                  <p className="mt-1 text-[11px] opacity-70">Halaman ini hanya untuk siswa — bukan login admin</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* FORM STEP */}
        {step === 'form' && siswa && (
          <div className="space-y-6">
            {/* Student info card */}
            <Card className="shadow-lg border-0 overflow-hidden">
              <div className="bg-emerald-600 text-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg">{siswa.nama}</h3>
                    <p className="text-emerald-100 text-sm">
                      NISN: {siswa.nisn}
                      {siswa.rombel && ` • ${siswa.rombel.nama}`}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-4 py-3 flex gap-2 flex-wrap">
                {siswa.rombel && (
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                    Kelas {siswa.rombel.kelas}
                  </Badge>
                )}
                {siswa.rombel?.jurusan && (
                  <Badge variant="secondary" className="bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                    {siswa.rombel.jurusan}
                  </Badge>
                )}
                {siswa.jeniskelamin && (
                  <Badge variant="secondary">
                    {siswa.jeniskelamin}
                  </Badge>
                )}
              </div>
            </Card>

            {/* Save success banner with download option */}
            {saveSuccess && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-4 border border-emerald-200 dark:border-emerald-800">
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-medium text-emerald-700 dark:text-emerald-400">Nilai berhasil disimpan!</p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-500">Data nilai telah diperbarui</p>
                  </div>
                </div>
                <Button
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="w-full bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700 dark:hover:bg-emerald-900/50"
                  variant="outline"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="size-4 mr-2 animate-spin" />
                      Membuat laporan...
                    </>
                  ) : (
                    <>
                      <FileText className="size-4 mr-2" />
                      Download Laporan Analisa Nilai (PDF)
                    </>
                  )}
                </Button>
              </div>
            )}

            {/* Add new subject */}
            <Card className="shadow-md border-0">
              <CardContent className="p-4">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Nama mata pelajaran baru..."
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleAddSubject()
                      }
                    }}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleAddSubject}
                    variant="outline"
                    size="icon"
                    disabled={!newSubject.trim()}
                    className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Grades form */}
            {nilaiList.length > 0 ? (
              <div className="space-y-4">
                {/* Desktop table view */}
                <Card className="shadow-md border-0 hidden md:block">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                            <th className="text-left p-3 text-sm font-medium text-muted-foreground w-[200px]">Mata Pelajaran</th>
                            {semesterLabels.map((label) => (
                              <th key={label} className="text-center p-3 text-sm font-medium text-muted-foreground w-[80px]">
                                {label}
                              </th>
                            ))}
                            <th className="text-center p-3 text-sm font-medium text-muted-foreground w-[80px]">Rerata</th>
                            <th className="w-[40px]"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {nilaiList.map((entry, index) => (
                            <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                              <td className="p-3">
                                <span className="font-medium text-sm">{entry.matapelajaran}</span>
                              </td>
                              {semesterFields.map((field) => (
                                <td key={field} className="p-2">
                                  <Input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="0.01"
                                    value={entry[field]}
                                    onChange={(e) => handleNilaiChange(index, field, e.target.value)}
                                    className="text-center h-9 text-sm"
                                    placeholder="-"
                                  />
                                </td>
                              ))}
                              <td className="p-3 text-center">
                                <span className="font-semibold text-sm text-emerald-600">
                                  {calculateRerata(entry)}
                                </span>
                              </td>
                              <td className="p-2">
                                {entry.isNew && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleRemoveSubject(index)}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Mobile card view */}
                <div className="md:hidden space-y-3">
                  {nilaiList.map((entry, index) => (
                    <Card key={index} className="shadow-md border-0">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-semibold text-sm">{entry.matapelajaran}</h4>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">
                              Rerata: {calculateRerata(entry)}
                            </Badge>
                            {entry.isNew && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleRemoveSubject(index)}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {semesterFields.map((field, fIndex) => (
                            <div key={field}>
                              <Label className="text-xs text-muted-foreground mb-1 block">
                                {semesterLabels[fIndex]}
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={entry[field]}
                                onChange={(e) => handleNilaiChange(index, field, e.target.value)}
                                className="text-center h-9 text-sm"
                                placeholder="-"
                              />
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Save button */}
                <div className="sticky bottom-4 z-40 space-y-3">
                  {/* Download PDF button - always visible after first save */}
                  {saveSuccess && (
                    <Button
                      onClick={handleDownloadPDF}
                      disabled={isDownloading}
                      className="w-full bg-white text-emerald-700 border-2 border-emerald-500 hover:bg-emerald-50 h-12 text-base shadow-xl dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-600 dark:hover:bg-emerald-900/50"
                      variant="outline"
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 className="size-5 mr-2 animate-spin" />
                          Membuat Laporan...
                        </>
                      ) : (
                        <>
                          <Download className="size-5 mr-2" />
                          Download Laporan Analisa & Rekomendasi (PDF)
                        </>
                      )}
                    </Button>
                  )}

                  <Button
                    onClick={handleSave}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-base shadow-xl"
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="size-5 mr-2 animate-spin" />
                        Menyimpan...
                      </>
                    ) : (
                      <>
                        <Save className="size-5 mr-2" />
                        Simpan Nilai
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <Card className="shadow-md border-0">
                <CardContent className="p-8 text-center">
                  <BookOpen className="size-12 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium">Belum ada mata pelajaran</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Tambahkan mata pelajaran di atas untuk mulai mengisi nilai
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-t">
        <div className="max-w-4xl mx-auto px-4 py-2 text-center text-xs text-muted-foreground">
          © 2025 Kelas App — Form Isi Nilai Siswa
        </div>
      </footer>
    </div>
  )
}

// ============================================================
// PDF REPORT HTML GENERATOR
// ============================================================

function generateReportHTML(report: Record<string, any>): string {
  const { student, gradeSummary, analysis, jurusanAnalysis, tkaData, eligibleData, generatedAt } = report
  const kelas = student.rombel?.kelas || 10
  const generatedDate = new Date(generatedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  // Grade color helper
  function gradeColor(val: number): string {
    if (val >= 80) return '#059669'
    if (val >= 70) return '#2563eb'
    if (val >= 60) return '#d97706'
    return '#dc2626'
  }

  function gradeLabel(val: number): string {
    if (val >= 90) return 'A'
    if (val >= 80) return 'B'
    if (val >= 70) return 'C'
    if (val >= 60) return 'D'
    return 'E'
  }

  // Build grade table rows
  const gradeRows = gradeSummary.map((g: Record<string, any>) => {
    const semesters = [g.smt1, g.smt2, g.smt3, g.smt4, g.smt5, g.smt6]
      .map((v: number) => v > 0 ? `<span style="color:${gradeColor(v)}; font-weight:600">${v}</span>` : '<span style="color:#9ca3af">-</span>')
      .join('</td><td style="text-align:center; padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:12px">')

    const catBadge = g.category === 'ipa'
      ? '<span style="background:#dbeafe; color:#1d4ed8; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600">IPA</span>'
      : g.category === 'ips'
      ? '<span style="background:#fef3c7; color:#b45309; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600">IPS</span>'
      : g.category === 'neutral'
      ? '<span style="background:#f3f4f6; color:#6b7280; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600">Netral</span>'
      : '<span style="background:#f3f4f6; color:#9ca3af; padding:2px 6px; border-radius:4px; font-size:10px">Lain</span>'

    return `<tr>
      <td style="padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:12px; font-weight:500">${g.matapelajaran} ${catBadge}</td>
      <td style="text-align:center; padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:12px">${semesters}</td>
      <td style="text-align:center; padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:12px; font-weight:700; color:${gradeColor(g.rerata)}">${g.rerata > 0 ? g.rerata : '-'}</td>
      <td style="text-align:center; padding:6px 8px; border-bottom:1px solid #e5e7eb; font-size:11px; color:${gradeColor(g.rerata)}; font-weight:600">${g.rerata > 0 ? gradeLabel(g.rerata) : '-'}</td>
    </tr>`
  }).join('')

  // Distribution bars
  const distBars = analysis.distribution.map((d: Record<string, any>) => {
    const maxCount = Math.max(...analysis.distribution.map((x: Record<string, any>) => x.count), 1)
    const widthPct = (d.count / maxCount) * 100
    return `<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px">
      <span style="width:140px; font-size:11px; text-align:right; color:#374151">${d.range}</span>
      <div style="flex:1; background:#f3f4f6; border-radius:4px; height:20px; overflow:hidden">
        <div style="width:${widthPct}%; height:100%; background:linear-gradient(90deg, #059669, #10b981); border-radius:4px; min-width:${d.count > 0 ? '4px' : '0'}"></div>
      </div>
      <span style="width:30px; font-size:11px; font-weight:600; color:#374151">${d.count}</span>
    </div>`
  }).join('')

  // Strong subjects
  const strongHTML = analysis.strongSubjects.length > 0
    ? analysis.strongSubjects.map((s: Record<string, any>) =>
        `<span style="display:inline-block; background:#ecfdf5; color:#065f46; padding:4px 10px; border-radius:6px; font-size:11px; margin:2px; font-weight:500">${s.matapelajaran} (${s.rerata})</span>`
      ).join('')
    : '<p style="font-size:12px; color:#9ca3af">Belum ada mapel dengan nilai ≥80</p>'

  // Weak subjects
  const weakHTML = analysis.weakSubjects.length > 0
    ? analysis.weakSubjects.map((s: Record<string, any>) =>
        `<span style="display:inline-block; background:#fef2f2; color:#991b1b; padding:4px 10px; border-radius:6px; font-size:11px; margin:2px; font-weight:500">${s.matapelajaran} (${s.rerata})</span>`
      ).join('')
    : '<p style="font-size:12px; color:#059669; font-weight:500">Tidak ada mapel dengan nilai di bawah 60. Bagus!</p>'

  // Jurusan analysis section
  let jurusanHTML = ''

  if (jurusanAnalysis.type === 'kelas10') {
    const rec = jurusanAnalysis.rekomendasi
    const recColor = rec.includes('IPA') ? '#1d4ed8' : rec.includes('IPS') ? '#b45309' : '#6b7280'
    const recBg = rec.includes('IPA') ? '#dbeafe' : rec.includes('IPS') ? '#fef3c7' : '#f3f4f6'

    jurusanHTML = `
      <div style="background:linear-gradient(135deg, ${recBg}, white); border:2px solid ${recColor}20; border-radius:12px; padding:20px; margin-bottom:16px; text-align:center">
        <p style="font-size:12px; color:#6b7280; margin:0 0 4px 0; text-transform:uppercase; letter-spacing:1px">Rekomendasi Penjurusan</p>
        <p style="font-size:28px; font-weight:800; color:${recColor}; margin:0">${rec}</p>
        <p style="font-size:13px; color:#6b7280; margin:4px 0 0 0">Tingkat Kepercayaan: <strong style="color:${recColor}">${jurusanAnalysis.confidence}%</strong></p>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:16px">
        <div style="background:#eff6ff; border-radius:10px; padding:14px; text-align:center">
          <p style="font-size:11px; color:#6b7280; margin:0">Skor IPA</p>
          <p style="font-size:24px; font-weight:800; color:#1d4ed8; margin:2px 0">${jurusanAnalysis.ipaScore}</p>
          <p style="font-size:11px; color:#6b7280; margin:0">${jurusanAnalysis.ipaSubjects.length} mapel IPA</p>
        </div>
        <div style="background:#fffbeb; border-radius:10px; padding:14px; text-align:center">
          <p style="font-size:11px; color:#6b7280; margin:0">Skor IPS</p>
          <p style="font-size:24px; font-weight:800; color:#b45309; margin:2px 0">${jurusanAnalysis.ipsScore}</p>
          <p style="font-size:11px; color:#6b7280; margin:0">${jurusanAnalysis.ipsSubjects.length} mapel IPS</p>
        </div>
      </div>

      ${jurusanAnalysis.reasoning.length > 0 ? `
      <div style="background:#f9fafb; border-radius:10px; padding:14px; margin-bottom:12px">
        <p style="font-size:13px; font-weight:700; color:#374151; margin:0 0 8px 0">Analisis:</p>
        <ul style="margin:0; padding-left:16px; font-size:12px; color:#4b5563; line-height:1.8">
          ${jurusanAnalysis.reasoning.map((r: string) => `<li>${r}</li>`).join('')}
        </ul>
      </div>` : ''}
    `
  } else {
    // Kelas XI/XII major recommendations
    const { trackInclination, topMajors, confidence, reasoning } = jurusanAnalysis

    const trackColor = trackInclination.dominant === 'IPA' ? '#1d4ed8' : trackInclination.dominant === 'IPS' ? '#b45309' : '#6b7280'
    const trackBg = trackInclination.dominant === 'IPA' ? '#dbeafe' : trackInclination.dominant === 'IPS' ? '#fef3c7' : '#f3f4f6'

    jurusanHTML = `
      <div style="background:linear-gradient(135deg, ${trackBg}, white); border:2px solid ${trackColor}20; border-radius:12px; padding:20px; margin-bottom:16px; text-align:center">
        <p style="font-size:12px; color:#6b7280; margin:0 0 4px 0; text-transform:uppercase; letter-spacing:1px">Kecenderungan Jalur</p>
        <p style="font-size:28px; font-weight:800; color:${trackColor}; margin:0">${trackInclination.dominant}</p>
        <div style="display:flex; justify-content:center; gap:16px; margin-top:8px">
          <span style="font-size:13px; color:#1d4ed8; font-weight:600">IPA ${trackInclination.ipa}%</span>
          <span style="font-size:13px; color:#9ca3af">vs</span>
          <span style="font-size:13px; color:#b45309; font-weight:600">IPS ${trackInclination.ips}%</span>
        </div>
        <p style="font-size:13px; color:#6b7280; margin:8px 0 0 0">Tingkat Kepercayaan: <strong style="color:${trackColor}">${confidence}%</strong></p>
      </div>

      ${topMajors.length > 0 ? `
      <div style="margin-bottom:16px">
        <p style="font-size:13px; font-weight:700; color:#374151; margin:0 0 8px 0">Top 5 Rekomendasi Jurusan:</p>
        ${topMajors.map((m: Record<string, any>, i: number) => {
          const mColor = m.track === 'IPA' ? '#1d4ed8' : '#b45309'
          const mBg = m.track === 'IPA' ? '#eff6ff' : '#fffbeb'
          const barWidth = m.skor > 0 ? Math.min(100, (m.skor / 100) * 100) : 0

          return `<div style="background:${mBg}; border-radius:8px; padding:10px 12px; margin-bottom:6px; border-left:4px solid ${mColor}">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px">
              <div style="display:flex; align-items:center; gap:6px">
                <span style="font-size:14px; font-weight:700; color:${mColor}">#${i + 1}</span>
                <span style="font-size:12px; font-weight:600; color:#1f2937">${m.nama}</span>
                <span style="background:${mColor}15; color:${mColor}; padding:1px 6px; border-radius:4px; font-size:10px; font-weight:600">${m.track}</span>
              </div>
              <span style="font-size:14px; font-weight:700; color:${mColor}">${m.skor}</span>
            </div>
            <div style="background:#e5e7eb; border-radius:4px; height:6px; overflow:hidden; margin-bottom:6px">
              <div style="width:${barWidth}%; height:100%; background:${mColor}; border-radius:4px"></div>
            </div>
            ${m.specificJurusan && m.specificJurusan.length > 0 ? `
            <div style="margin-top:4px">
              <p style="font-size:10px; color:#6b7280; margin:0 0 2px 0; font-weight:600">Program Studi:</p>
              ${m.specificJurusan.slice(0, 2).map((j: Record<string, any>) =>
                `<p style="font-size:11px; color:#4b5563; margin:1px 0">• <strong>${j.jurusan}</strong> — ${j.deskripsi} <span style="color:#9ca3af">(${j.prospek})</span></p>`
              ).join('')}
            </div>` : ''}
          </div>`
        }).join('')}
      </div>` : ''}

      ${reasoning.length > 0 ? `
      <div style="background:#f9fafb; border-radius:10px; padding:14px; margin-bottom:12px">
        <p style="font-size:13px; font-weight:700; color:#374151; margin:0 0 8px 0">Analisis:</p>
        <ul style="margin:0; padding-left:16px; font-size:12px; color:#4b5563; line-height:1.8">
          ${reasoning.map((r: string) => `<li>${r}</li>`).join('')}
        </ul>
      </div>` : ''}
    `
  }

  // TKA section
  let tkaHTML = ''
  if (tkaData) {
    tkaHTML = `
    <div style="page-break-inside:avoid; margin-bottom:20px">
      <div style="background:linear-gradient(135deg, #faf5ff, white); border:1px solid #e9d5ff; border-radius:12px; padding:16px">
        <h3 style="font-size:15px; font-weight:700; color:#7c3aed; margin:0 0 12px 0">Tes Kompetensi Akademik (TKA)</h3>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:10px">
          <div style="text-align:center; background:white; border-radius:8px; padding:8px; border:1px solid #e9d5ff">
            <p style="font-size:10px; color:#6b7280; margin:0">Bahasa Indonesia</p>
            <p style="font-size:18px; font-weight:700; color:${gradeColor(tkaData.bindoNilai || 0)}; margin:2px 0">${tkaData.bindoNilai || '-'}</p>
            <p style="font-size:10px; color:#9ca3af; margin:0">${tkaData.bindoKategori || '-'}</p>
          </div>
          <div style="text-align:center; background:white; border-radius:8px; padding:8px; border:1px solid #e9d5ff">
            <p style="font-size:10px; color:#6b7280; margin:0">Matematika</p>
            <p style="font-size:18px; font-weight:700; color:${gradeColor(tkaData.matNilai || 0)}; margin:2px 0">${tkaData.matNilai || '-'}</p>
            <p style="font-size:10px; color:#9ca3af; margin:0">${tkaData.matKategori || '-'}</p>
          </div>
          <div style="text-align:center; background:white; border-radius:8px; padding:8px; border:1px solid #e9d5ff">
            <p style="font-size:10px; color:#6b7280; margin:0">Bahasa Inggris</p>
            <p style="font-size:18px; font-weight:700; color:${gradeColor(tkaData.bingNilai || 0)}; margin:2px 0">${tkaData.bingNilai || '-'}</p>
            <p style="font-size:10px; color:#9ca3af; margin:0">${tkaData.bingKategori || '-'}</p>
          </div>
        </div>
        ${tkaData.pilihan1Nama ? `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">
          <div style="text-align:center; background:white; border-radius:8px; padding:8px; border:1px solid #e9d5ff">
            <p style="font-size:10px; color:#6b7280; margin:0">Pilihan 1: ${tkaData.pilihan1Nama}</p>
            <p style="font-size:16px; font-weight:700; color:${gradeColor(tkaData.pilihan1Nilai || 0)}; margin:2px 0">${tkaData.pilihan1Nilai || '-'}</p>
          </div>
          <div style="text-align:center; background:white; border-radius:8px; padding:8px; border:1px solid #e9d5ff">
            <p style="font-size:10px; color:#6b7280; margin:0">Pilihan 2: ${tkaData.pilihan2Nama || '-'}</p>
            <p style="font-size:16px; font-weight:700; color:${gradeColor(tkaData.pilihan2Nilai || 0)}; margin:2px 0">${tkaData.pilihan2Nilai || '-'}</p>
          </div>
        </div>` : ''}
      </div>
    </div>`
  }

  // Eligible section
  let eligibleHTML = ''
  if (eligibleData) {
    const elColor = eligibleData.status === 'Lulus' ? '#059669' : eligibleData.status === 'Tidak Lulus' ? '#dc2626' : '#d97706'
    const elBg = eligibleData.status === 'Lulus' ? '#ecfdf5' : eligibleData.status === 'Tidak Lulus' ? '#fef2f2' : '#fffbeb'
    eligibleHTML = `
    <div style="margin-bottom:20px">
      <div style="background:${elBg}; border:2px solid ${elColor}30; border-radius:12px; padding:16px; text-align:center">
        <p style="font-size:12px; color:#6b7280; margin:0 0 4px 0">Status Kelulusan</p>
        <p style="font-size:24px; font-weight:800; color:${elColor}; margin:0">${eligibleData.status}</p>
        ${eligibleData.keterangan ? `<p style="font-size:12px; color:#6b7280; margin:4px 0 0 0">${eligibleData.keterangan}</p>` : ''}
      </div>
    </div>`
  }

  // Trend indicator
  const trendIndicator = analysis.overallTrend > 2
    ? `<span style="color:#059669; font-weight:600">↑ Meningkat (+${analysis.overallTrend})</span>`
    : analysis.overallTrend < -2
    ? `<span style="color:#dc2626; font-weight:600">↓ Menurun (${analysis.overallTrend})</span>`
    : `<span style="color:#6b7280; font-weight:500">→ Stabil</span>`

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Laporan Analisa Nilai - ${student.nama}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      color: #1f2937;
      line-height: 1.5;
      margin: 0;
      padding: 0;
      background: white;
    }
    .print-bar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 999;
      background: #1f2937; color: white; padding: 10px 20px;
      display: flex; justify-content: space-between; align-items: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    }
    .print-bar button {
      background: #059669; color: white; border: none; padding: 8px 20px;
      border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 600;
    }
    .print-bar button:hover { background: #047857; }
  </style>
</head>
<body>
  <!-- Print bar -->
  <div class="no-print print-bar">
    <span style="font-size:14px">Laporan Analisa Nilai - ${student.nama}</span>
    <button onclick="window.print()">📥 Download PDF</button>
  </div>

  <div style="max-width:800px; margin:0 auto; padding:60px 20px 20px 20px">
    <!-- Header -->
    <div style="text-align:center; margin-bottom:24px; padding-bottom:16px; border-bottom:3px solid #059669">
      <h1 style="font-size:22px; font-weight:800; color:#059669; margin:0; letter-spacing:-0.5px">LAPORAN ANALISA NILAI</h1>
      <p style="font-size:13px; color:#6b7280; margin:4px 0 0 0">dan Rekomendasi Jurusan</p>
    </div>

    <!-- Student Profile -->
    <div style="background:linear-gradient(135deg, #ecfdf5, #f0fdfa); border:1px solid #d1fae5; border-radius:12px; padding:16px; margin-bottom:20px">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:12px">
        <div>
          <h2 style="font-size:20px; font-weight:800; color:#065f46; margin:0">${student.nama}</h2>
          <p style="font-size:13px; color:#6b7280; margin:4px 0 0 0">
            NISN: ${student.nisn} • NIS: ${student.nis}
            ${student.jeniskelamin ? ` • ${student.jeniskelamin}` : ''}
          </p>
          <p style="font-size:13px; color:#6b7280; margin:2px 0 0 0">
            ${student.rombel ? `${student.rombel.nama} • Kelas ${student.rombel.kelas} • ${student.rombel.jurusan}` : ''}
            ${student.rombel?.walikelas ? ` • Wali Kelas: ${student.rombel.walikelas}` : ''}
          </p>
        </div>
        <div style="text-align:right">
          <p style="font-size:10px; color:#9ca3af; margin:0">Tanggal Laporan</p>
          <p style="font-size:12px; font-weight:600; color:#374151; margin:2px 0 0 0">${generatedDate}</p>
        </div>
      </div>
    </div>

    <!-- Summary Stats -->
    <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:8px; margin-bottom:20px">
      <div style="background:#f9fafb; border-radius:8px; padding:10px; text-align:center; border:1px solid #e5e7eb">
        <p style="font-size:10px; color:#6b7280; margin:0">Rata-rata</p>
        <p style="font-size:22px; font-weight:800; color:${gradeColor(analysis.overallAvg)}; margin:2px 0">${analysis.overallAvg}</p>
        <p style="font-size:10px; color:#6b7280; margin:0">${gradeLabel(analysis.overallAvg)}</p>
      </div>
      <div style="background:#f9fafb; border-radius:8px; padding:10px; text-align:center; border:1px solid #e5e7eb">
        <p style="font-size:10px; color:#6b7280; margin:0">Konsistensi</p>
        <p style="font-size:22px; font-weight:800; color:#059669; margin:2px 0">${Math.round(analysis.consistency * 100)}%</p>
        <p style="font-size:10px; color:#6b7280; margin:0">Stabilitas Nilai</p>
      </div>
      <div style="background:#f9fafb; border-radius:8px; padding:10px; text-align:center; border:1px solid #e5e7eb">
        <p style="font-size:10px; color:#6b7280; margin:0">Tren</p>
        <p style="font-size:16px; font-weight:700; margin:6px 0">${trendIndicator}</p>
      </div>
      <div style="background:#f9fafb; border-radius:8px; padding:10px; text-align:center; border:1px solid #e5e7eb">
        <p style="font-size:10px; color:#6b7280; margin:0">Total Mapel</p>
        <p style="font-size:22px; font-weight:800; color:#374151; margin:2px 0">${analysis.totalSubjects}</p>
        <p style="font-size:10px; color:#6b7280; margin:0">IPA:${analysis.ipaCount} IPS:${analysis.ipsCount}</p>
      </div>
    </div>

    ${eligibleHTML}

    <!-- Grade Table -->
    <div style="page-break-inside:avoid; margin-bottom:20px">
      <h3 style="font-size:15px; font-weight:700; color:#374151; margin:0 0 8px 0; border-left:4px solid #059669; padding-left:8px">Daftar Nilai per Mata Pelajaran</h3>
      <div style="border:1px solid #e5e7eb; border-radius:10px; overflow:hidden">
        <table style="width:100%; border-collapse:collapse">
          <thead>
            <tr style="background:#f9fafb">
              <th style="text-align:left; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Mata Pelajaran</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Smt 1</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Smt 2</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Smt 3</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Smt 4</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Smt 5</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Smt 6</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Rerata</th>
              <th style="text-align:center; padding:8px; font-size:11px; font-weight:600; color:#6b7280; border-bottom:2px solid #e5e7eb">Grade</th>
            </tr>
          </thead>
          <tbody>
            ${gradeRows}
          </tbody>
        </table>
      </div>
    </div>

    <!-- IPA vs IPS Average -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; page-break-inside:avoid">
      <div style="background:#eff6ff; border-radius:10px; padding:14px; text-align:center; border:1px solid #bfdbfe">
        <p style="font-size:12px; color:#6b7280; margin:0">Rata-rata Mapel IPA</p>
        <p style="font-size:28px; font-weight:800; color:#1d4ed8; margin:4px 0">${analysis.ipaAvg}</p>
      </div>
      <div style="background:#fffbeb; border-radius:10px; padding:14px; text-align:center; border:1px solid #fde68a">
        <p style="font-size:12px; color:#6b7280; margin:0">Rata-rata Mapel IPS</p>
        <p style="font-size:28px; font-weight:800; color:#b45309; margin:4px 0">${analysis.ipsAvg}</p>
      </div>
    </div>

    <!-- Distribution -->
    <div style="page-break-inside:avoid; margin-bottom:20px">
      <h3 style="font-size:15px; font-weight:700; color:#374151; margin:0 0 8px 0; border-left:4px solid #059669; padding-left:8px">Distribusi Nilai</h3>
      <div style="background:#f9fafb; border-radius:10px; padding:14px; border:1px solid #e5e7eb">
        ${distBars}
      </div>
    </div>

    <!-- Strong and Weak -->
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:20px; page-break-inside:avoid">
      <div style="background:#f0fdf4; border-radius:10px; padding:14px; border:1px solid #bbf7d0">
        <p style="font-size:13px; font-weight:700; color:#065f46; margin:0 0 8px 0">Mapel Unggulan (≥80)</p>
        ${strongHTML}
      </div>
      <div style="background:#fef2f2; border-radius:10px; padding:14px; border:1px solid #fecaca">
        <p style="font-size:13px; font-weight:700; color:#991b1b; margin:0 0 8px 0">Mapel Perlu Peningkatan (&lt;60)</p>
        ${weakHTML}
      </div>
    </div>

    ${tkaHTML}

    <!-- Jurusan Analysis -->
    <div style="page-break-inside:avoid; margin-bottom:20px">
      <h3 style="font-size:15px; font-weight:700; color:#374151; margin:0 0 12px 0; border-left:4px solid #7c3aed; padding-left:8px">
        ${kelas === 10 ? 'Rekomendasi Penjurusan (IPA / IPS)' : 'Rekomendasi Jurusan Perguruan Tinggi'}
      </h3>
      ${jurusanHTML}
    </div>

    <!-- Footer -->
    <div style="margin-top:24px; padding-top:12px; border-top:1px solid #e5e7eb; text-align:center">
      <p style="font-size:10px; color:#9ca3af; margin:0">Laporan ini dihasilkan secara otomatis oleh Kelas App berdasarkan data nilai yang tersedia.</p>
      <p style="font-size:10px; color:#9ca3af; margin:2px 0 0 0">Rekomendasi bersifat saran — keputusan akurat mempertimbangkan faktor lain seperti minat, bakat, dan konsultasi dengan BK.</p>
      <p style="font-size:10px; color:#d1d5db; margin:4px 0 0 0">© 2025 Kelas App</p>
    </div>
  </div>
</body>
</html>`
}
