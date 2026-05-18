import { create } from 'zustand'

export type PageKey = 
  | 'dashboard'
  | 'rombel'
  | 'siswa'
  | 'nilai'
  | 'eligible'
  | 'analisa'
  | 'rekomendasi-jurusan'
  | 'analisa-jurusan-lanjut'
  | 'rekomendasi-pt'

interface AppState {
  activePage: PageKey
  setActivePage: (page: PageKey) => void
}

export const useAppStore = create<AppState>((set) => ({
  activePage: 'dashboard',
  setActivePage: (page) => set({ activePage: page }),
}))
