import { create } from 'zustand'

interface AuthState {
  user: { id: string; username: string } | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: { id: string; username: string } | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    fetch('/api/auth/logout', { method: 'POST' })
    set({ user: null, isAuthenticated: false })
  },
}))
