'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Database, Loader2, RefreshCw, Copy, Check, GraduationCap } from 'lucide-react'
import Link from 'next/link'

interface SetupData {
  status: string
  message: string
  sql?: string
  adminCount?: number
}

export function SetupPage() {
  const [checking, setChecking] = useState(false)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [copied, setCopied] = useState(false)

  const checkSetup = async () => {
    setChecking(true)
    try {
      const res = await fetch('/api/setup')
      let data: SetupData
      try {
        data = await res.json()
      } catch {
        data = { status: 'error', message: 'Gagal membaca respons server' }
      }
      setSetupData(data)

      // If setup is now complete, reload the page to re-check auth
      if (data.status === 'already_setup' || data.status === 'seeded') {
        setTimeout(() => window.location.reload(), 1500)
      }
    } catch {
      setSetupData({
        status: 'error',
        message: 'Gagal mengecek status setup. Pastikan server berjalan.',
      })
    } finally {
      setChecking(false)
    }
  }

  // Auto-check on first render
  useEffect(() => {
    checkSetup()
  }, [])

  const copySql = () => {
    if (setupData?.sql) {
      navigator.clipboard.writeText(setupData.sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // Loading state while checking
  if (checking && !setupData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-amber-500" />
          <p className="text-sm text-muted-foreground">Mengecek database...</p>
        </div>
      </div>
    )
  }

  // Setup complete
  if (setupData?.status === 'already_setup' || setupData?.status === 'seeded') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white font-bold text-2xl shadow-lg">
              <CheckCircle className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">Setup Selesai!</h1>
            <p className="text-sm text-muted-foreground">{setupData.message}</p>
          </CardHeader>
          <CardContent>
            <p className="text-center text-sm text-muted-foreground">
              Halaman akan di-refresh otomatis...
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Table missing — show SQL instructions
  if (setupData?.status === 'table_missing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <Card className="w-full max-w-2xl shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-2xl shadow-lg">
              <Database className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">Setup Diperlukan</h1>
            <p className="text-sm text-muted-foreground">Tabel admin belum ditemukan di database</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 p-4 text-sm text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Jalankan SQL di Supabase SQL Editor:</p>
                  <ol className="mt-2 list-decimal list-inside space-y-1 text-amber-600 dark:text-amber-400">
                    <li>Buka Supabase Dashboard → SQL Editor</li>
                    <li>Salin SQL di bawah ini</li>
                    <li>Jalankan (klik Run)</li>
                    <li>Kembali ke sini dan klik &quot;Cek Lagi&quot;</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="relative">
              <pre className="rounded-lg bg-gray-900 dark:bg-gray-800 p-4 text-sm text-green-400 overflow-x-auto max-h-72 overflow-y-auto">
                <code>{setupData.sql}</code>
              </pre>
              <Button
                variant="outline"
                size="sm"
                onClick={copySql}
                className="absolute top-2 right-2 bg-gray-800 border-gray-600 text-gray-300 hover:text-white hover:bg-gray-700"
              >
                {copied ? (
                  <>
                    <Check className="size-3 mr-1" />
                    Tersalin
                  </>
                ) : (
                  <>
                    <Copy className="size-3 mr-1" />
                    Salin
                  </>
                )}
              </Button>
            </div>

            <Button
              onClick={checkSetup}
              className="w-full bg-amber-500 hover:bg-amber-600"
              disabled={checking}
            >
              {checking ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Mengecek...
                </>
              ) : (
                <>
                  <RefreshCw className="size-4 mr-2" />
                  Cek Lagi
                </>
              )}
            </Button>

            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground text-center mb-3">
                Sementara itu, siswa bisa langsung mengakses form nilai:
              </p>
              <Link href="/form-nilai" className="block">
                <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50">
                  <GraduationCap className="size-4 mr-2" />
                  Buka Form Isi Nilai Siswa
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Error state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500 text-white font-bold text-2xl shadow-lg">
            <AlertTriangle className="size-8" />
          </div>
          <h1 className="text-2xl font-bold">Error</h1>
          <p className="text-sm text-muted-foreground">{setupData?.message || 'Terjadi kesalahan'}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            onClick={checkSetup}
            className="w-full"
            variant="outline"
            disabled={checking}
          >
            {checking ? (
              <>
                <Loader2 className="size-4 mr-2 animate-spin" />
                Mengecek...
              </>
            ) : (
              <>
                <RefreshCw className="size-4 mr-2" />
                Coba Lagi
              </>
            )}
          </Button>
          <Link href="/form-nilai" className="block">
            <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <GraduationCap className="size-4 mr-2" />
              Buka Form Isi Nilai Siswa
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
