import { useEffect, useRef, useState } from 'react'

// GANTI ke IP laptop saat demo di jaringan WiFi yang sama
const BACKEND_HOST = 'localhost'
const BASE_URL = `http://${BACKEND_HOST}:8000`
const POLL_INTERVAL_MS = 3000

function getUnitId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('unit') || 'DT-A01'
}

function computeHeading(prevLat, prevLon, lat, lon) {
  // Bearing degrees (0=N, 90=E). Pakai approximasi flat-earth (jarak pendek).
  const dx = (lon - prevLon) * Math.cos(((lat + prevLat) / 2) * Math.PI / 180)
  const dy = (lat - prevLat)
  if (dx === 0 && dy === 0) return null
  let deg = Math.atan2(dx, dy) * 180 / Math.PI
  if (deg < 0) deg += 360
  return deg
}

export function useUnitData() {
  const [unitId] = useState(getUnitId)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const prevPosRef = useRef(null)
  const headingRef = useRef(0)

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
            // Compute heading from delta movement (smoothed)
            if (prevPosRef.current && (prevPosRef.current.lat !== json.lat || prevPosRef.current.lon !== json.lon)) {
              const h = computeHeading(prevPosRef.current.lat, prevPosRef.current.lon, json.lat, json.lon)
              if (h !== null) headingRef.current = h
            }
            prevPosRef.current = { lat: json.lat, lon: json.lon }
            setData({ ...json, heading_deg: headingRef.current })
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

  return { data, loading, error, unitId, baseUrl: BASE_URL }
}
