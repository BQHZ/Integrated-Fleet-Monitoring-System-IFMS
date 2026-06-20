import { useEffect, useRef, useState, useCallback } from 'react'

// GANTI ke IP laptop saat demo di jaringan WiFi yang sama
const BACKEND_HOST = 'localhost'
const BACKEND_PORT = 8000
const WS_URL = `ws://${BACKEND_HOST}:${BACKEND_PORT}/ws`
const RECONNECT_DELAY_MS = 3000

export function useFleetSocket() {
  const [units, setUnits] = useState({})
  const [metricsOverall, setMetricsOverall] = useState(null)
  const [metricsBySite, setMetricsBySite] = useState({})
  const [alerts, setAlerts] = useState([])
  const [safetyEvents, setSafetyEvents] = useState([])
  const [dispatch, setDispatch] = useState([])
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)

  const connect = useCallback(() => {
    const ws = new WebSocket(WS_URL)
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

    ws.onclose = () => {
      setConnected(false)
      setTimeout(connect, RECONNECT_DELAY_MS)
    }

    ws.onerror = (err) => console.error('[ws] Error:', err)
  }, [])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

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
