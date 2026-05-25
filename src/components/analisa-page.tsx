'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts'

interface Rombel { id: string; nama: string; kelas: number; jurusan: string }
interface AnalisaData {
  rataRataPerMapel: { mapel: string; rerata: number }[]
  distribusiNilai: { range: string; jumlah: number }[]
  perRombel: { rombel: string; rataRata: number }[]
  topSiswa: { nama: string; rataRata: number }[]
}

const COLORS = ['#059669', '#0d9488', '#0ea5e9', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1']

export function AnalisaPage() {
  const [data, setData] = useState<AnalisaData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterRombel, setFilterRombel] = useState('all')
  const [rombelList, setRombelList] = useState<Rombel[]>([])

  const fetchData = async () => {
    try {
      const [analisaRes, rombelRes] = await Promise.all([
        fetch(`/api/analisa?rombelid=${filterRombel}`),
        fetch('/api/rombel'),
      ])
      setData(await analisaRes.json())
      setRombelList(await rombelRes.json())
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [filterRombel])

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>
  }

  if (!data || (data.rataRataPerMapel.length === 0 && data.distribusiNilai.length === 0)) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
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
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            Belum ada data nilai untuk dianalisis
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rata-rata Rerata per Mata Pelajaran</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.rataRataPerMapel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mapel" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="rerata" fill="#059669" name="Rerata" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Nilai</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.distribusiNilai}
                  dataKey="jumlah"
                  nameKey="range"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ range, jumlah }) => `${range}: ${jumlah}`}
                >
                  {data.distribusiNilai.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Perbandingan per Rombel</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.perRombel}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="rombel" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Bar dataKey="rataRata" fill="#059669" name="Rata-rata" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Radar Kompetensi</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={data.rataRataPerMapel.slice(0, 8)}>
                <PolarGrid />
                <PolarAngleAxis dataKey="mapel" tick={{ fontSize: 10 }} />
                <PolarRadiusAxis domain={[0, 100]} />
                <Radar name="Rerata" dataKey="rerata" stroke="#059669" fill="#059669" fillOpacity={0.3} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Top 10 Siswa (Rata-rata Nilai Tertinggi)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.topSiswa} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} />
                <YAxis dataKey="nama" type="category" tick={{ fontSize: 11 }} width={120} />
                <Tooltip />
                <Bar dataKey="rataRata" fill="#059669" name="Rata-rata" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
