'use client'

import { useEffect, useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Eye, EyeOff, Loader2, User, Lock, Save, School, GraduationCap } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useSettingsStore } from '@/store/settings-store'
import { useToast } from '@/hooks/use-toast'

export function SettingsPage() {
  const { user, setUser } = useAuthStore()
  const { toast } = useToast()
  const { namasekolah, logopath, loadSettings, setSettings, forceReload } = useSettingsStore()

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

  // App settings state
  const [schoolName, setSchoolName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [isAppSettingsLoading, setIsAppSettingsLoading] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  // Sync school name with store
  useEffect(() => {
    setSchoolName(namasekolah)
  }, [namasekolah])

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml']
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Format tidak didukung', description: 'Gunakan PNG, JPG, WebP, atau SVG', variant: 'destructive' })
      return
    }

    // Validate file size (3MB max)
    if (file.size > 3 * 1024 * 1024) {
      toast({ title: 'File terlalu besar', description: 'Ukuran file maksimal 3 MB', variant: 'destructive' })
      return
    }

    setLogoFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onloadend = () => {
      setLogoPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleSaveAppSettings = async () => {
    setIsAppSettingsLoading(true)
    try {
      // Upload logo if changed
      if (logoFile) {
        const formData = new FormData()
        formData.append('logo', logoFile)

        const logoRes = await fetch('/api/settings/upload-logo', {
          method: 'POST',
          body: formData,
        })
        const logoData = await logoRes.json()

        if (!logoRes.ok) {
          toast({ title: 'Gagal mengunggah logo', description: logoData.error, variant: 'destructive' })
          setIsAppSettingsLoading(false)
          return
        }

        // Update store with new logo
        setSettings({ logopath: logoData.logopath })
      }

      // Save school name if changed
      if (schoolName.trim() && schoolName.trim() !== namasekolah) {
        const nameRes = await fetch('/api/settings', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ namasekolah: schoolName.trim() }),
        })
        const nameData = await nameRes.json()

        if (!nameRes.ok) {
          toast({ title: 'Gagal menyimpan nama', description: nameData.error, variant: 'destructive' })
          setIsAppSettingsLoading(false)
          return
        }

        // Update store with new name
        setSettings({ namasekolah: schoolName.trim() })
      }

      // Clear logo file state
      setLogoFile(null)
      setLogoPreview('')

      // Force reload settings so DynamicFavicon updates the browser tab
      await forceReload()

      // Force browser to refresh favicon by re-adding the link
      const existingFavicons = document.querySelectorAll('link[rel="icon"]')
      existingFavicons.forEach((link) => link.remove())
      const newFavicon = document.createElement('link')
      newFavicon.rel = 'icon'
      newFavicon.type = 'image/png'
      newFavicon.href = '/api/logo?size=32&t=' + Date.now() // cache bust
      document.head.appendChild(newFavicon)

      // Update document title
      document.title = `${schoolName.trim() || namasekolah} - Manajemen Kelas`

      toast({ title: 'Berhasil', description: 'Pengaturan aplikasi berhasil disimpan. Favicon dan nama tab akan segera berubah.' })
    } catch {
      toast({ title: 'Gagal', description: 'Terjadi kesalahan saat menyimpan', variant: 'destructive' })
    } finally {
      setIsAppSettingsLoading(false)
    }
  }

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
      {/* App Settings Card - NEW */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <School className="size-5 text-emerald-600" />
            Pengaturan Aplikasi
          </CardTitle>
          <CardDescription>
            Atur nama sekolah dan logo aplikasi
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Current App Preview */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg overflow-hidden">
              {logopath ? (
                <img src={logopath} alt={namasekolah} className="size-10 object-contain" />
              ) : (
                <GraduationCap className="size-7" />
              )}
            </div>
            <div>
              <p className="font-bold text-lg">{namasekolah}</p>
              <p className="text-sm text-muted-foreground">Manajemen Kelas</p>
            </div>
          </div>

          {/* School Name Input */}
          <div className="space-y-2">
            <Label htmlFor="school-name">Nama Sekolah / Aplikasi</Label>
            <Input
              id="school-name"
              placeholder="Masukkan nama sekolah"
              value={schoolName}
              onChange={(e) => setSchoolName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Nama ini akan menjadi nama aplikasi, judul tab browser, dan nama PWA
            </p>
          </div>

          {/* Logo Upload */}
          <div className="space-y-2">
            <Label>Logo Aplikasi</Label>
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/50 overflow-hidden">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="size-16 object-contain" />
                ) : logopath ? (
                  <img src={logopath} alt="Current logo" className="size-16 object-contain" />
                ) : (
                  <GraduationCap className="size-8 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 space-y-2">
                <Input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleLogoChange}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Format: PNG, JPG, WebP, atau SVG. Maksimal 3 MB. Logo ini juga akan menjadi favicon di tab browser dan ikon PWA.
                </p>
              </div>
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSaveAppSettings}
            disabled={isAppSettingsLoading}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isAppSettingsLoading ? (
              <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
              <Save className="size-4 mr-2" />
            )}
            Simpan Pengaturan Aplikasi
          </Button>
        </CardContent>
      </Card>

      <Separator />

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
