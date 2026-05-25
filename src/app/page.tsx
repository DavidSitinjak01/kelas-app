'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { useAppStore, type PageKey } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'
import { Separator } from '@/components/ui/separator'
import { Loader2 } from 'lucide-react'

// Lazy load page components to reduce initial bundle size
const DashboardPage = dynamic(() => import('@/components/dashboard-page').then(m => ({ default: m.DashboardPage })), { loading: () => <PageLoader /> })
const RombelPage = dynamic(() => import('@/components/rombel-page').then(m => ({ default: m.RombelPage })), { loading: () => <PageLoader /> })
const SiswaPage = dynamic(() => import('@/components/siswa-page').then(m => ({ default: m.SiswaPage })), { loading: () => <PageLoader /> })
const NilaiPage = dynamic(() => import('@/components/nilai-page').then(m => ({ default: m.NilaiPage })), { loading: () => <PageLoader /> })
const EligiblePage = dynamic(() => import('@/components/eligible-page').then(m => ({ default: m.EligiblePage })), { loading: () => <PageLoader /> })
const AnalisaPage = dynamic(() => import('@/components/analisa-page').then(m => ({ default: m.AnalisaPage })), { loading: () => <PageLoader /> })
const RekomendasiJurusanPage = dynamic(() => import('@/components/rekomendasi-jurusan-page').then(m => ({ default: m.RekomendasiJurusanPage })), { loading: () => <PageLoader /> })
const RekomendasiPtPage = dynamic(() => import('@/components/rekomendasi-pt-page').then(m => ({ default: m.RekomendasiPtPage })), { loading: () => <PageLoader /> })
const AnalisaJurusanLanjutPage = dynamic(() => import('@/components/analisa-jurusan-lanjut-page').then(m => ({ default: m.AnalisaJurusanLanjutPage })), { loading: () => <PageLoader /> })
const SettingsPage = dynamic(() => import('@/components/settings-page').then(m => ({ default: m.SettingsPage })), { loading: () => <PageLoader /> })
const LoginPage = dynamic(() => import('@/components/login-page').then(m => ({ default: m.LoginPage })), { loading: () => <PageLoader /> })
const SetupPage = dynamic(() => import('@/components/setup-page').then(m => ({ default: m.SetupPage })), { loading: () => <PageLoader /> })

function PageLoader() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="size-6 animate-spin text-emerald-600" />
    </div>
  )
}

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
  const { activePage, goBack, clearHistory } = useAppStore()
  const { isAuthenticated, isLoading, setUser, logout } = useAuthStore()
  const [setupNeeded, setSetupNeeded] = useState(false)

  // Check auth on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          if (data?.user) {
            setUser(data.user)
            return
          }
        }
        try {
          const setupRes = await fetch('/api/setup')
          if (setupRes.ok) {
            const setupData = await setupRes.json()
            if (setupData.status === 'table_missing') {
              setSetupNeeded(true)
            }
          } else {
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

  // Manage browser history for back button navigation
  useEffect(() => {
    const handlePopState = () => {
      if (isAuthenticated) {
        // Try to go back in app page history
        const previousPage = goBack()
        if (!previousPage) {
          // No more page history → go back to login
          logout()
        }
      } else {
        // On login page, back button should close the app
        // Try to close the window (works in some PWA contexts)
        // For PWA on Android, going back with no history closes the app
        window.close()
        // If window.close() doesn't work (browsers block it), just stay
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isAuthenticated, goBack, logout])

  // Push history entry when navigating between pages
  useEffect(() => {
    if (isAuthenticated) {
      // Push a new history entry for each page navigation
      // so back button can navigate through them
      history.pushState({ page: activePage }, '', '/')
    }
  }, [activePage, isAuthenticated])

  // Push initial history entry when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Replace current history entry so back button behavior is clean
      history.replaceState({ page: 'app' }, '', '/')
    } else if (!isLoading) {
      // On login page, push an entry so popstate fires on back
      history.pushState({ page: 'login' }, '', '/')
    }
  }, [isAuthenticated, isLoading])

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
