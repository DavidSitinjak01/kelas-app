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
  const [nisn, setNisn] = useState('')
  const [nik, setNik] = useState('')
  const [showNik, setShowNik] = useState(false)
  const [siswa, setSiswa] = useState<StudentInfo | null>(null)
  const [nilaiList, setNilaiList] = useState<NilaiEntry[]>([])
  const [newSubject, setNewSubject] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const { toast } = useToast()

  // Check existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch('/api/public/student-me')
        if (res.ok) {
          const data = await res.json()
          if (data.student) {
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
          }
        }
      } catch {
        // Not logged in, show login
      } finally {
        setIsCheckingSession(false)
      }
    }
    checkSession()
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nisn.trim() || !nik.trim()) return

    setIsLoggingIn(true)
    setLoginError('')

    try {
      const res = await fetch('/api/public/student-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nisn: nisn.trim(), nik: nik.trim() }),
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
    setNisn('')
    setNik('')
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

  const semesterLabels = ['Smt 1', 'Smt 2', 'Smt 3', 'Smt 4', 'Smt 5', 'Smt 6']
  const semesterFields: (keyof NilaiEntry)[] = ['smt1', 'smt2', 'smt3', 'smt4', 'smt5', 'smt6']

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
                  Masukkan NISN dan NIK untuk mengisi nilai
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleLogin} className="space-y-4">
                  {loginError && (
                    <div className="rounded-lg bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                      {loginError}
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="nisn">NISN (Nomor Induk Siswa Nasional)</Label>
                    <Input
                      id="nisn"
                      type="text"
                      placeholder="Contoh: 0102432531"
                      value={nisn}
                      onChange={(e) => setNisn(e.target.value)}
                      required
                      className="text-center text-lg font-mono"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nik">NIK (Nomor Induk Kependudukan)</Label>
                    <div className="relative">
                      <Input
                        id="nik"
                        type={showNik ? 'text' : 'password'}
                        placeholder="Masukkan NIK"
                        value={nik}
                        onChange={(e) => setNik(e.target.value)}
                        required
                        className="pr-10 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNik(!showNik)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showNik ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    disabled={isLoggingIn || !nisn.trim() || !nik.trim()}
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
                  Hubungi wali kelas jika Anda lupa NISN atau NIK
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

            {/* Save success banner */}
            {saveSuccess && (
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/50 p-4 flex items-center gap-3 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-medium text-emerald-700 dark:text-emerald-400">Nilai berhasil disimpan!</p>
                  <p className="text-sm text-emerald-600 dark:text-emerald-500">Data nilai telah diperbarui</p>
                </div>
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
                <div className="sticky bottom-4 z-40">
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
