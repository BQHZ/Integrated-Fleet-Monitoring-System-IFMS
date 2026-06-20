import { createContext, useContext, useEffect, useCallback } from 'react'
import { useAuthStore } from './authStore.js'
import { api, setOn401Handler } from './api.js'

const AuthContext = createContext(null)

export function AuthProvider({ children, onUnauthorized }) {
  const { token, user, setSession, clear } = useAuthStore()

  // Hubungkan handler 401 ke router (set di App.jsx)
  useEffect(() => {
    setOn401Handler(() => onUnauthorized?.())
  }, [onUnauthorized])

  // Validasi token persisten saat mount — kalau backend bilang 401, store akan dibersihkan oleh interceptor.
  useEffect(() => {
    if (!token) return
    api.get('/auth/me').then((res) => {
      // Sync user object kalau berbeda
      if (JSON.stringify(res.data) !== JSON.stringify(user)) {
        setSession(token, res.data)
      }
    }).catch(() => { /* interceptor sudah handle */ })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const login = useCallback(async (username, password) => {
    const res = await api.post('/auth/login', { username, password })
    setSession(res.data.access_token, res.data.user)
    return res.data.user
  }, [setSession])

  const logout = useCallback(() => {
    clear()
  }, [clear])

  const hasRole = useCallback((...roles) => {
    return user && roles.includes(user.role)
  }, [user])

  const value = { token, user, login, logout, hasRole, isAuthenticated: !!token }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() harus di dalam <AuthProvider>')
  return ctx
}
