'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Compass, Sparkles, Loader2 } from 'lucide-react'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface Siswa { id: string; nis: string; nama: string; rombelId: string; rombel: Rombel }
interface Nilai { id: string; siswaId: string; mataPelajaran: string; nilaiAsli: number; nilaiUp: number }

export function RekomendasiJurusanPage() {
  const [siswaList, setSiswaList] = useState<Siswa[]>([])
  const [selectedSiswa, setSelectedSiswa] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<string>('')
  const [nilaiSiswa, setNilaiSiswa] = useState<Nilai[]>([])

  useEffect(() => {
    // Load rombels first, then load siswa per rombel
    const loadSiswa = async () => {
      try {
        const rombelRes = await fetch('/api/rombel')
        const rombelJson = await rombelRes.json()
        const allSiswa: Siswa[] = []
        for (const r of rombelJson) {
          const siswaRes = await fetch(`/api/siswa?rombelId=${r.id}&limit=100`)
          const siswaJson = await siswaRes.json()
          if (siswaJson.data) allSiswa.push(...siswaJson.data)
          else if (Array.isArray(siswaJson)) allSiswa.push(...siswaJson)
        }
        setSiswaList(allSiswa)
      } catch {
        // ignore
      }
      setLoading(false)
    }
    loadSiswa()
  }, [])

  useEffect(() => {
    if (selectedSiswa) {
      fetch(`/api/nilai?siswaId=${selectedSiswa}`)
        .then(res => res.json())
        .then(data => setNilaiSiswa(data))
        .catch(() => setNilaiSiswa([]))
    }
  }, [selectedSiswa])

  const selectedSiswaData = siswaList.find(s => s.id === selectedSiswa)

  const handleGenerate = async () => {
    if (!selectedSiswa || !selectedSiswaData) return
    setGenerating(true)
    setResult('')
    try {
      const res = await fetch('/api/rekomendasi-jurusan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nama: selectedSiswaData.nama,
          kelas: selectedSiswaData.rombel?.kelas,
          jurusan: selectedSiswaData.rombel?.jurusan,
          nilai: nilaiSiswa.map(n => ({
            mapel: n.mataPelajaran,
            nilaiAsli: n.nilaiAsli,
            nilaiUp: n.nilaiUp,
          })),
        }),
      })
      const data = await res.json()
      setResult(data.rekomendasi || 'Tidak ada rekomendasi')
    } catch {
      setResult('Gagal menghasilkan rekomendasi. Silakan coba lagi.')
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-emerald-600" />
            <CardTitle className="text-base">Rekomendasi Jurusan Kuliah</CardTitle>
          </div>
          <CardDescription>
            Pilih siswa untuk mendapatkan rekomendasi jurusan kuliah berdasarkan nilai dan profil akademik
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex-1 min-w-[240px] space-y-2">
              <label className="text-sm font-medium">Pilih Siswa</label>
              <Select value={selectedSiswa} onValueChange={setSelectedSiswa}>
                <SelectTrigger><SelectValue placeholder="Pilih siswa..." /></SelectTrigger>
                <SelectContent>
                  {siswaList.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.nis} - {s.nama} ({s.rombel?.nama})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleGenerate} disabled={!selectedSiswa || generating}>
              {generating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Menganalisis...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-1" /> Generate Rekomendasi
                </>
              )}
            </Button>
          </div>

          {selectedSiswaData && nilaiSiswa.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Profil Akademik: {selectedSiswaData.nama}</h4>
                <div className="flex flex-wrap gap-2">
                  {nilaiSiswa.map(n => (
                    <Badge key={n.id} variant="outline" className="text-xs">
                      {n.mataPelajaran}: {n.nilaiAsli}
                      {n.nilaiUp !== n.nilaiAsli && <span className="text-emerald-600 ml-1">→ {n.nilaiUp}</span>}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Rata-rata: {(nilaiSiswa.reduce((a, n) => a + n.nilaiAsli, 0) / nilaiSiswa.length).toFixed(1)} (asli) |{' '}
                  {(nilaiSiswa.reduce((a, n) => a + n.nilaiUp, 0) / nilaiSiswa.length).toFixed(1)} (up)
                </p>
              </div>
            </>
          )}

          {selectedSiswaData && nilaiSiswa.length === 0 && (
            <p className="text-sm text-muted-foreground">Siswa ini belum memiliki data nilai</p>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-600" />
              <CardTitle className="text-base">Hasil Rekomendasi</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              {result.split('\n').map((line, i) => (
                <p key={i} className="text-sm leading-relaxed whitespace-pre-wrap">{line}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
