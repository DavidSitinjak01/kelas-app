import { create } from 'zustand'

// Session key used to detect page refresh vs SPA navigation
const SESSION_KEY = 'kelasAppSessionActive'

interface AuthState {
  user: { id: string; username: string } | null
  isLoading: boolean
  isAuthenticated: boolean
  setUser: (user: { id: string; username: string } | null) => void
  setLoading: (loading: boolean) => void
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  setUser: (user) => {
    if (user) {
      // Mark session as active — this flag is cleared on beforeunload
      // so that a page refresh will force re-login
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(SESSION_KEY, 'true')
      }
    }
    set({ user, isAuthenticated: !!user, isLoading: false })
  },
  setLoading: (isLoading) => set({ isLoading }),
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Ignore errors — we still want to clear local state
    }
    // Clear session flag so next load goes to login
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_KEY)
    }
    set({ user: null, isAuthenticated: false })
  },
}))

/**
 * Check if the current session is still valid (not cleared by refresh).
 * Returns true only if the session was established in this page lifecycle
 * (not from a previous page load / refresh).
 */
export function isSessionActive(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(SESSION_KEY) === 'true'
}

/**
 * Clear the session flag — called on beforeunload so that
 * a page refresh will force re-login.
 */
export function clearSessionFlag(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(SESSION_KEY)
}
