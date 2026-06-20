import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Zustand store untuk token + user, persist di localStorage.
// Key sengaja unik: pama_roc_token (terpisah dari incab kalau dipakai di mesin sama).
export const useAuthStore = create(
  persist(
    (set) => ({
      token: null,
      user: null,
      setSession: (token, user) => set({ token, user }),
      clear: () => set({ token: null, user: null }),
    }),
    {
      name: 'pama_roc_token',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
)
