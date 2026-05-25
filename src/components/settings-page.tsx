'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeOff, Loader2, User, Lock, Save } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useToast } from '@/hooks/use-toast'

export function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const { toast } = useToast()

  // Username state
  const [newUsername, setNewUsername] = useState('')
  const [isUsernameLoading, setIsUsernameLoading] = useState(false)

  // Password state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isPasswordLoading, setIsPasswordLoading] = useState(false)

  const handleUpdateUsername = async () => {
    if (!newUsername.trim()) {
      toast({ title: 'Error', description: 'Username tidak boleh kosong', variant: 'destructive' })
      return
    }
    if (newUsername === user?.username) {
      toast({ title: 'Info', description: 'Username sama dengan yang sekarang' })
      return
    }

    setIsUsernameLoading(true)
    try {
      const res = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
        return
      }
      setUser(data.user)
      setNewUsername('')
      toast({ title: 'Berhasil', description: 'Username berhasil diubah' })
    } catch {
      toast({ title: 'Gagal', description: 'Terjadi kesalahan', variant: 'destructive' })
    } finally {
      setIsUsernameLoading(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({ title: 'Error', description: 'Semua field harus diisi', variant: 'destructive' })
      return
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Password baru tidak cocok', variant: 'destructive' })
      return
    }
    if (newPassword.length < 6) {
      toast({ title: 'Error', description: 'Password baru minimal 6 karakter', variant: 'destructive' })
      return
    }

    setIsPasswordLoading(true)
    try {
      const res = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: 'Gagal', description: data.error, variant: 'destructive' })
        return
      }
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      toast({ title: 'Berhasil', description: 'Password berhasil diubah' })
    } catch {
      toast({ title: 'Gagal', description: 'Terjadi kesalahan', variant: 'destructive' })
    } finally {
      setIsPasswordLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Username Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="size-5 text-emerald-600" />
            Ubah Username
          </CardTitle>
          <CardDescription>
            Username saat ini: <span className="font-semibold">{user?.username}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-username">Username Baru</Label>
            <Input
              id="new-username"
              placeholder="Masukkan username baru"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
            />
          </div>
          <Button
            onClick={handleUpdateUsername}
            disabled={isUsernameLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isUsernameLoading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            Simpan Username
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Password Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-5 text-emerald-600" />
            Ubah Password
          </CardTitle>
          <CardDescription>Password harus minimal 6 karakter</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">Password Saat Ini</Label>
            <div className="relative">
              <Input
                id="current-password"
                type={showCurrentPassword ? 'text' : 'password'}
                placeholder="Masukkan password saat ini"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">Password Baru</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showNewPassword ? 'text' : 'password'}
                placeholder="Masukkan password baru"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Konfirmasi password baru"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>
          <Button
            onClick={handleUpdatePassword}
            disabled={isPasswordLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isPasswordLoading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            Simpan Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
