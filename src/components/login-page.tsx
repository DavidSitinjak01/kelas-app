'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Eye, EyeOff, GraduationCap, Loader2, BookOpen } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useSettingsStore } from '@/store/settings-store'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'

export function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser } = useAuthStore()
  const { toast } = useToast()
  const { namasekolah, logopath, loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        const errorDetail = data.detail ? `${data.error} (${data.detail})` : (data.error || 'Login gagal')
        setError(errorDetail)
        return
      }

      setUser(data.user)
      toast({ title: 'Login berhasil', description: `Selamat datang, ${data.user.username}!` })
    } catch {
      setError('Terjadi kesalahan saat login')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-950 dark:to-gray-900 p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-600 text-white font-bold text-2xl shadow-lg overflow-hidden">
            {logopath ? (
              <img src={logopath} alt={namasekolah} className="size-8 object-contain" />
            ) : (
              <GraduationCap className="size-8" />
            )}
          </div>
          <h1 className="text-2xl font-bold">{namasekolah}</h1>
          <p className="text-sm text-muted-foreground">Manajemen Kelas</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
            {error && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/50 p-3 text-sm text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                type="text"
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="off"
                data-1p-ignore
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="off"
                  data-1p-ignore
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Masuk...
                </>
              ) : (
                'Masuk'
              )}
            </Button>
          </form>
          <div className="mt-6 pt-4 border-t space-y-3">
            <Link href="/form-nilai" className="block">
              <Button variant="outline" className="w-full border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30">
                <BookOpen className="size-4 mr-2" />
                Login Siswa (Form Isi Nilai)
              </Button>
            </Link>
            <p className="text-center text-xs text-muted-foreground">
              © 2025 {namasekolah}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
