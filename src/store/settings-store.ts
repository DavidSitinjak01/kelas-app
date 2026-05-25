import { create } from 'zustand'

interface AppSettings {
  namasekolah: string
  logopath: string
  isLoaded: boolean
}

interface SettingsStore extends AppSettings {
  setSettings: (settings: Partial<AppSettings>) => void
  loadSettings: () => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  namasekolah: 'Kelas App',
  logopath: '',
  isLoaded: false,

  setSettings: (settings) => set((state) => ({ ...state, ...settings })),

  loadSettings: async () => {
    if (get().isLoaded) return
    try {
      const res = await fetch('/api/public/settings')
      if (res.ok) {
        const data = await res.json()
        set({
          namasekolah: data.namasekolah || 'Kelas App',
          logopath: data.logopath || '',
          isLoaded: true,
        })
      }
    } catch {
      // Use defaults
      set({ isLoaded: true })
    }
  },
}))
