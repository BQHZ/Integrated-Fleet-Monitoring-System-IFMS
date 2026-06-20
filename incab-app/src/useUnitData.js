import { useEffect, useState } from 'react'

// GANTI ke IP laptop saat demo di jaringan WiFi yang sama
const BACKEND_HOST = 'localhost'
const BASE_URL = `http://${BACKEND_HOST}:8000`
const POLL_INTERVAL_MS = 3000

function getUnitId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('unit') || 'DT-A01'
}

export function useUnitData() {
  const [unitId] = useState(getUnitId)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function poll() {
      try {
        const res = await fetch(`${BASE_URL}/api/incab/${unitId}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) {
          if (json.error) {
            setError(json.error)
            setData(null)
          } else {
            setData(json)
            setError(null)
          }
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message)
          setLoading(false)
        }
      }
    }

    poll()
    const iv = setInterval(poll, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(iv)
    }
  }, [unitId])

  return { data, loading, error, unitId }
}
