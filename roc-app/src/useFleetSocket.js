import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuthStore } from './auth/authStore.js'

// GANTI ke IP laptop saat demo di jaringan WiFi yang sama
const BACKEND_HOST = 'localhost'
const BACKEND_PORT = 8000
const WS_BASE = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws/fleet`
const RECONNECT_DELAY_MS = 3000

export function useFleetSocket() {
  const token = useAuthStore(s => s.token)
  const clearAuth = useAuthStore(s => s.clear)

  const [units, setUnits] = useState({})
  const [metricsOverall, setMetricsOverall] = useState(null)
  const [metricsBySite, setMetricsBySite] = useState({})
  const [alerts, setAlerts] = useState([])
  const [safetyEvents, setSafetyEvents] = useState([])
  const [dispatch, setDispatch] = useState([])
  const [connected, setConnected] = useState(false)

  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const cancelledRef = useRef(false)

  const connect = useCallback((tk) => {
    if (!tk) return
    const ws = new WebSocket(`${WS_BASE}?token=${encodeURIComponent(tk)}`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      if (data.type === 'initial_snapshot') {
        const unitMap = {}
        for (const u of (data.units || [])) unitMap[u.unit_id] = u
        setUnits(unitMap)
        setMetricsOverall(data.metrics_overall)
        setMetricsBySite(data.metrics_by_site || {})
        setAlerts(data.alerts || [])
        setSafetyEvents(data.safety_events || [])
        setDispatch(data.dispatch || [])
      }

      if (data.type === 'telemetry_update') {
        if (data.unit) {
          setUnits(prev => ({ ...prev, [data.unit.unit_id]: data.unit }))
        }
        setMetricsOverall(data.metrics_overall)
        setMetricsBySite(data.metrics_by_site || {})
        setAlerts(data.alerts || [])
        setSafetyEvents(data.safety_events || [])
        setDispatch(data.dispatch || [])
      }
    }

    ws.onclose = (ev) => {
      setConnected(false)
      // 4401 = backend "Token invalid atau tidak ada" → bersihkan session
      if (ev.code === 4401) {
        clearAuth()
        return
      }
      if (cancelledRef.current) return
      reconnectTimerRef.current = setTimeout(() => connect(useAuthStore.getState().token), RECONNECT_DELAY_MS)
    }

    ws.onerror = (err) => console.error('[ws] Error:', err)
  }, [clearAuth])

  // Reconnect kalau token berubah (login/logout/refresh)
  useEffect(() => {
    cancelledRef.current = false
    // tutup koneksi existing kalau ada
    if (wsRef.current && wsRef.current.readyState <= 1) {
      wsRef.current.close()
    }
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)

    if (token) connect(token)

    return () => {
      cancelledRef.current = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [token, connect])

  return {
    units: Object.values(units),
    metricsOverall,
    metricsBySite,
    alerts,
    safetyEvents,
    dispatch,
    connected,
  }
}
