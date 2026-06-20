import { createContext, useContext, useEffect, useState } from 'react'

const DARK = {
  mode: 'dark',
  bg: '#0F172A',
  panel: '#1E293B',
  panelAlt: '#1A2538',
  text: '#F1F5F9',
  textDim: '#94A3B8',
  border: '#334155',
  accent: '#06B6D4',
  ok: '#22C55E',
  warn: '#F59E0B',
  crit: '#EF4444',
  shadow: 'rgba(0,0,0,0.4)',
}

const LIGHT = {
  mode: 'light',
  bg: '#F1F5F9',
  panel: '#FFFFFF',
  panelAlt: '#F8FAFC',
  text: '#0F172A',
  textDim: '#64748B',
  border: '#E2E8F0',
  accent: '#0066CC',
  ok: '#16A34A',
  warn: '#D97706',
  crit: '#C41E3A',
  shadow: 'rgba(15,23,42,0.08)',
}

const STORAGE_KEY = 'pama_incab_theme'
const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'dark'
  })
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, mode)
  }, [mode])
  const palette = mode === 'dark' ? DARK : LIGHT
  const toggle = () => setMode(m => m === 'dark' ? 'light' : 'dark')
  return (
    <ThemeContext.Provider value={{ palette, mode, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme harus di dalam ThemeProvider')
  return ctx
}

export function statusColor(palette, status) {
  if (status === 'crit') return palette.crit
  if (status === 'warn') return palette.warn
  if (status === 'ok') return palette.ok
  return palette.textDim
}
