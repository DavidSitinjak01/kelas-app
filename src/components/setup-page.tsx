'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, CheckCircle, Database, Loader2, RefreshCw, Copy, Check } from 'lucide-react'

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
      const data = await res.json()
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

  const copySql = () => {
    if (setupData?.sql) {
      navigator.clipboard.writeText(setupData.sql)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // If no data yet, show initial check UI
  if (!setupData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-2xl shadow-lg">
              <Database className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">Setup Diperlukan</h1>
            <p className="text-sm text-muted-foreground">Database belum dikonfigurasi</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 p-4 text-sm text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Tabel admin belum ditemukan</p>
                  <p className="mt-1 text-amber-600 dark:text-amber-400">
                    Klik tombol di bawah untuk mengecek status database. Jika tabel belum ada, Anda perlu menjalankan SQL di Supabase SQL Editor.
                  </p>
                </div>
              </div>
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
                  <Database className="size-4 mr-2" />
                  Cek Status Database
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Setup complete
  if (setupData.status === 'already_setup' || setupData.status === 'seeded') {
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
  if (setupData.status === 'table_missing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-950 dark:to-gray-900 p-4">
        <Card className="w-full max-w-2xl shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white font-bold text-2xl shadow-lg">
              <Database className="size-8" />
            </div>
            <h1 className="text-2xl font-bold">Buat Tabel Admin</h1>
            <p className="text-sm text-muted-foreground">Jalankan SQL berikut di Supabase SQL Editor</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-amber-50 dark:bg-amber-950/50 p-4 text-sm text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Instruksi</p>
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
              <pre className="rounded-lg bg-gray-900 dark:bg-gray-800 p-4 text-sm text-green-400 overflow-x-auto max-h-64 overflow-y-auto">
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
          <p className="text-sm text-muted-foreground">{setupData.message}</p>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>
    </div>
  )
}
