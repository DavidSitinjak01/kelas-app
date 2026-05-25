'use client'

import { useEffect } from 'react'
import {
  LayoutDashboard,
  Users,
  UserCircle,
  GraduationCap,
  CheckCircle,
  BarChart3,
  Compass,
  Target,
  Building2,
  Settings,
  LogOut,
  Share2,
  ExternalLink,
} from 'lucide-react'
import { useSettingsStore } from '@/store/settings-store'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarSeparator,
} from '@/components/ui/sidebar'
import { useAppStore, type PageKey } from '@/store/app-store'
import { useAuthStore } from '@/store/auth-store'

const menuItems: { key: PageKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'rombel', label: 'Rombel', icon: Users },
  { key: 'siswa', label: 'Data Siswa', icon: UserCircle },
  { key: 'nilai', label: 'Nilai', icon: GraduationCap },
  { key: 'eligible', label: 'Eligible', icon: CheckCircle },
  { key: 'analisa', label: 'Analisa Nilai', icon: BarChart3 },
  { key: 'rekomendasi-jurusan', label: 'Rekomendasi Jurusan', icon: Compass },
  { key: 'analisa-jurusan-lanjut', label: 'Analisa Jurusan Lanjut', icon: Target },
  { key: 'rekomendasi-pt', label: 'Rekomendasi PT', icon: Building2 },
]

const settingItems: { key: PageKey; label: string; icon: React.ElementType }[] = [
  { key: 'pengaturan', label: 'Pengaturan', icon: Settings },
]

export function AppSidebar() {
  const { activePage, setActivePage } = useAppStore()
  const { user, logout } = useAuthStore()
  const { namasekolah, logopath, loadSettings } = useSettingsStore()

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const handleLogout = () => {
    logout()
  }

  const handleShareFormNilai = () => {
    const url = `${window.location.origin}/form-nilai`
    if (navigator.share) {
      navigator.share({
        title: `Form Isi Nilai - ${namasekolah}`,
        text: 'Silakan isi nilai mata pelajaran melalui link berikut:',
        url,
      }).catch(() => {})
    } else {
      navigator.clipboard.writeText(url).then(() => {
        alert('Link form nilai berhasil disalin!\n\n' + url)
      }).catch(() => {
        prompt('Salin link berikut:', url)
      })
    }
  }

  const handleOpenFormNilai = () => {
    window.open('/form-nilai', '_blank')
  }

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm overflow-hidden">
            {logopath ? (
              <img src={logopath} alt={namasekolah} className="size-5 rounded object-contain" />
            ) : (
              namasekolah.charAt(0)
            )}
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">{namasekolah}</span>
            <span className="text-xs text-sidebar-foreground/60">Manajemen Kelas</span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu Utama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={activePage === item.key}
                    onClick={() => setActivePage(item.key)}
                    tooltip={item.label}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Form Siswa</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleShareFormNilai}
                  tooltip="Bagikan Form Nilai"
                >
                  <Share2 className="size-4" />
                  <span>Bagikan Form Nilai</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleOpenFormNilai}
                  tooltip="Buka Form Nilai"
                >
                  <ExternalLink className="size-4" />
                  <span>Buka Form Nilai</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Pengaturan</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingItems.map((item) => (
                <SidebarMenuItem key={item.key}>
                  <SidebarMenuButton
                    isActive={activePage === item.key}
                    onClick={() => setActivePage(item.key)}
                    tooltip={item.label}
                  >
                    <item.icon className="size-4" />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <button
            onClick={handleLogout}
            className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-950 transition-colors"
          >
            <LogOut className="size-4 text-sidebar-accent-foreground" />
          </button>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium text-sidebar-foreground">{user?.username || 'Admin'}</span>
            <button
              onClick={handleLogout}
              className="text-xs text-sidebar-foreground/50 hover:text-red-500 transition-colors text-left"
            >
              Keluar
            </button>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
