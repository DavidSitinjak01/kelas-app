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
  | 'pengaturan'

interface AppState {
  activePage: PageKey
  pageHistory: PageKey[]
  setActivePage: (page: PageKey) => void
  goBack: () => PageKey | null
  clearHistory: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  activePage: 'dashboard',
  pageHistory: [],
  setActivePage: (page) => set((state) => ({
    activePage: page,
    pageHistory: [...state.pageHistory, state.activePage],
  })),
  goBack: () => {
    const { pageHistory } = get()
    if (pageHistory.length === 0) return null
    const previousPage = pageHistory[pageHistory.length - 1]
    set((state) => ({
      activePage: previousPage,
      pageHistory: state.pageHistory.slice(0, -1),
    }))
    return previousPage
  },
  clearHistory: () => set({ pageHistory: [] }),
}))
