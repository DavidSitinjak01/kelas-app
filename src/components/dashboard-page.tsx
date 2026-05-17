'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, UserCircle, GraduationCap, CheckCircle } from 'lucide-react'

interface DashboardStats {
  totalRombel: number
  totalSiswa: number
  totalNilai: number
  totalEligible: number
  siswaPerKelas: { kelas: number; total: number }[]
  siswaPerJurusan: { jurusan: string; total: number }[]
  rataRataNilai: number
}

export function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalRombel: 0,
    totalSiswa: 0,
    totalNilai: 0,
    totalEligible: 0,
    siswaPerKelas: [],
    siswaPerJurusan: [],
    rataRataNilai: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/dashboard')
      .then(res => res.json())
      .then(data => {
        setStats(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const statCards = [
    { title: 'Total Rombel', value: stats.totalRombel, icon: Users, color: 'text-emerald-600' },
    { title: 'Total Siswa', value: stats.totalSiswa, icon: UserCircle, color: 'text-teal-600' },
    { title: 'Data Nilai', value: stats.totalNilai, icon: GraduationCap, color: 'text-green-600' },
    { title: 'Siswa Eligible', value: stats.totalEligible, icon: CheckCircle, color: 'text-cyan-600' },
  ]

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-20 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{card.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Siswa Per Kelas</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.siswaPerKelas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data</p>
            ) : (
              <div className="space-y-3">
                {stats.siswaPerKelas.map((item) => (
                  <div key={item.kelas} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20">Kelas {item.kelas}</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${stats.totalSiswa > 0 ? (item.total / stats.totalSiswa) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{item.total}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Siswa Per Jurusan</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.siswaPerJurusan.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada data</p>
            ) : (
              <div className="space-y-3">
                {stats.siswaPerJurusan.map((item) => (
                  <div key={item.jurusan} className="flex items-center gap-3">
                    <span className="text-sm font-medium w-20">{item.jurusan}</span>
                    <div className="flex-1 bg-muted rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-teal-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${stats.totalSiswa > 0 ? (item.total / stats.totalSiswa) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{item.total}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Rata-rata Nilai Keseluruhan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-emerald-600">
                {stats.rataRataNilai > 0 ? stats.rataRataNilai.toFixed(1) : '-'}
              </div>
              <div className="text-sm text-muted-foreground">
                {stats.rataRataNilai >= 75 ? (
                  <span className="text-emerald-600 font-medium">Di atas KKM</span>
                ) : stats.rataRataNilai > 0 ? (
                  <span className="text-destructive font-medium">Di bawah KKM</span>
                ) : (
                  'Belum ada data'
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
