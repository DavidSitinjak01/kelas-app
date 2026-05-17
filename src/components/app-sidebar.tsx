'use client'

import {
  LayoutDashboard,
  Users,
  UserCircle,
  GraduationCap,
  CheckCircle,
  BarChart3,
  Compass,
  Building2,
} from 'lucide-react'
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
} from '@/components/ui/sidebar'
import { useAppStore, type PageKey } from '@/store/app-store'

const menuItems: { key: PageKey; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'rombel', label: 'Rombel', icon: Users },
  { key: 'siswa', label: 'Data Siswa', icon: UserCircle },
  { key: 'nilai', label: 'Nilai', icon: GraduationCap },
  { key: 'eligible', label: 'Eligible', icon: CheckCircle },
  { key: 'analisa', label: 'Analisa Nilai', icon: BarChart3 },
  { key: 'rekomendasi-jurusan', label: 'Rekomendasi Jurusan', icon: Compass },
  { key: 'rekomendasi-pt', label: 'Rekomendasi PT', icon: Building2 },
]

export function AppSidebar() {
  const { activePage, setActivePage } = useAppStore()

  return (
    <Sidebar variant="sidebar" collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground font-bold text-sm">
            K
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold text-sidebar-foreground">Kelas App</span>
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
      </SidebarContent>
      <SidebarFooter className="p-4">
        <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center">
          <div className="h-7 w-7 rounded-full bg-sidebar-accent flex items-center justify-center">
            <GraduationCap className="size-4 text-sidebar-accent-foreground" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-xs font-medium text-sidebar-foreground">Guru / Wali Kelas</span>
            <span className="text-xs text-sidebar-foreground/50">Semester 2024/2025</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
