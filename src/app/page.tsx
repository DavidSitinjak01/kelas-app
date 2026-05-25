'use client'

import { useEffect, useState } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useAppStore } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { DashboardPage } from '@/components/dashboard-page'
import { RombelPage } from '@/components/rombel-page'
import { SiswaPage } from '@/components/siswa-page'
import { NilaiPage } from '@/components/nilai-page'
import { EligiblePage } from '@/components/eligible-page'
import { AnalisaPage } from '@/components/analisa-page'
import { RekomendasiJurusanPage } from '@/components/rekomendasi-jurusan-page'
import { RekomendasiPtPage } from '@/components/rekomendasi-pt-page'
import { AnalisaJurusanLanjutPage } from '@/components/analisa-jurusan-lanjut-page'
import { SettingsPage } from '@/components/settings-page'
import { LoginPage } from '@/components/login-page'
import { SetupPage } from '@/components/setup-page'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  rombel: 'Rombongan Belajar',
  siswa: 'Data Siswa',
  nilai: 'Nilai',
  eligible: 'Eligible (Kelas 12)',
  analisa: 'Analisa Nilai',
  'rekomendasi-jurusan': 'Rekomendasi Jurusan',
  'analisa-jurusan-lanjut': 'Analisa Jurusan Lanjut',
  'rekomendasi-pt': 'Rekomendasi Perguruan Tinggi',
  pengaturan: 'Pengaturan',
}

export default function Home() {
  const { activePage } = useAppStore()
  const { isAuthenticated, isLoading, setUser } = useAuthStore()
  const [setupNeeded, setSetupNeeded] = useState(false)

  useEffect(() => {
    // Check if user is already logged in
    fetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          if (data?.user) {
            setUser(data.user)
            return
          }
        }
        // Auth check failed — check if admin table exists
        try {
          const setupRes = await fetch('/api/setup')
          if (setupRes.ok) {
            const setupData = await setupRes.json()
            if (setupData.status === 'table_missing') {
              setSetupNeeded(true)
            }
          } else {
            // Setup returned error (likely 503 = table missing)
            try {
              const setupData = await setupRes.json()
              if (setupData.status === 'table_missing') {
                setSetupNeeded(true)
              }
            } catch {
              // Can't parse - just show login
            }
          }
        } catch {
          // Setup check failed, just show login
        }
        setUser(null)
      })
      .catch(() => setUser(null))
  }, [setUser])

  // Loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-950 dark:to-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground">Memuat...</p>
        </div>
      </div>
    )
  }

  // Setup needed - admin table doesn't exist
  if (setupNeeded) {
    return <SetupPage />
  }

  // Not authenticated - show login
  if (!isAuthenticated) {
    return <LoginPage />
  }

  // Authenticated - show main app
  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <DashboardPage />
      case 'rombel': return <RombelPage />
      case 'siswa': return <SiswaPage />
      case 'nilai': return <NilaiPage />
      case 'eligible': return <EligiblePage />
      case 'analisa': return <AnalisaPage />
      case 'rekomendasi-jurusan': return <RekomendasiJurusanPage />
      case 'analisa-jurusan-lanjut': return <AnalisaJurusanLanjutPage />
      case 'rekomendasi-pt': return <RekomendasiPtPage />
      case 'pengaturan': return <SettingsPage />
      default: return <DashboardPage />
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <h1 className="text-lg font-semibold">{pageTitles[activePage]}</h1>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">
          {renderPage()}
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
