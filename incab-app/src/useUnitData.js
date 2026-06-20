import { useEffect, useRef, useState } from 'react'

// GANTI ke IP laptop saat demo di jaringan WiFi yang sama
const BACKEND_HOST = 'localhost'
const BASE_URL = `http://${BACKEND_HOST}:8000`
const POLL_INTERVAL_MS = 3000

function getUnitId() {
  const params = new URLSearchParams(window.location.search)
  return params.get('unit') || 'DT-A01'
}

// Daftar field yang nilainya disintesis dari simulator data — UI mark [SIM]
export const SIM_FIELDS = new Set([
  'engine_rpm', 'gear_position', 'retarder_grade', 'brake_oil_temp_c', 'def_level_pct',
  'payload_left_pct', 'payload_right_pct', 'tires',
  'boom_pressure_bar', 'arm_pressure_bar', 'bucket_pressure_bar', 'hydraulic_oil_temp_c',
  'bucket_fill_factor_pct', 'avg_cycle_time_s', 'truck_queue',
  'transmission_temp_c', 'track_slip_pct', 'ripper_status', 'smr_hours',
  'blade_position', 'blade_angle_deg', 'blade_lift_left_mm', 'blade_lift_right_mm',
  'articulation_angle_deg', 'gear_direction',
  'spray_pump_active', 'spray_pattern', 'refill_distance_m', 'next_segment',
  'def_level_pct_st', 'oil_level_pct', 'grease_level_pct', 'service_queue',
])

// Seed deterministik dari unit_id supaya nilai stabil antar tick
function seedHash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

function enrichWithSim(d) {
  if (!d) return d
  const out = { ...d }
  const seed = seedHash(d.unit_id || 'x')
  const j = (n) => ((seed >> n) & 0xff) / 255  // jitter 0..1 stable per unit
  const load = (d.engine_load_pct || 30) / 100
  const speed = d.current_speed_kmh || 0

  // Common
  out.engine_rpm = Math.round(700 + load * 1500 + (speed > 5 ? 150 : 0))
  out.def_level_pct = Math.max(20, 100 - (d.engine_hours || 0) * 0.005 % 80)
  out.brake_oil_temp_c = 55 + load * 30 + j(0) * 8

  // Haul truck specifics
  if (d.unit_type === 'haul_truck') {
    out.gear_position = gearFromSpeed(speed, d.status)
    out.retarder_grade = (d.status === 'hauling_loaded' && speed > 20) ? Math.round(2 + load * 5) : 0
    const payload = d.payload_ton || 0
    const balance = j(1) * 0.1 - 0.05  // ±5%
    out.payload_left_pct = payload > 0 ? 50 + balance * 100 : 0
    out.payload_right_pct = payload > 0 ? 50 - balance * 100 : 0
    // 6 tires: 2 front + 4 rear (dual)
    out.tires = [
      makeTire('LF', 7.5, 65, j(2)),
      makeTire('RF', 7.5, 65, j(3)),
      makeTire('LR-O', 7.8, 78, j(4)),
      makeTire('LR-I', 7.8, 76, j(5)),
      makeTire('RR-I', 7.8, 77, j(6)),
      makeTire('RR-O', 7.8, 80, j(7)),
    ]
  }

  // Excavator
  if (d.unit_type === 'excavator') {
    out.boom_pressure_bar = 200 + load * 100 + j(1) * 20
    out.arm_pressure_bar = 180 + load * 90 + j(2) * 18
    out.bucket_pressure_bar = 160 + load * 100 + j(3) * 22
    out.hydraulic_oil_temp_c = 65 + load * 25 + j(4) * 6
    out.bucket_fill_factor_pct = 78 + j(5) * 18
    out.avg_cycle_time_s = 22 + j(6) * 8
    // Truck queue [SIM]
    const baseQ = d.queue_depth || 0
    const siteLetter = (d.site_id === 'siteA') ? 'A' : 'B'
    out.truck_queue = Array.from({ length: Math.min(3, baseQ) }, (_, i) => ({
      unit_id: `DT-${siteLetter}0${i + 1}`,
      eta_s: 30 + i * 50,
    }))
  }

  // Dozer
  if (d.unit_type === 'dozer') {
    out.hydraulic_oil_temp_c = 60 + load * 25 + j(1) * 6
    out.transmission_temp_c = 75 + load * 20 + j(2) * 5
    out.ripper_status = (d.status === 'pushing' && j(3) > 0.7) ? 'engaged' : 'lifted'
    out.smr_hours = Math.round(d.engine_hours || 0)
    out.blade_position = {
      lift_mm: Math.round((j(4) - 0.5) * 300),
      tilt_deg: Math.round((j(5) - 0.5) * 12),
      angle_deg: Math.round((j(6) - 0.5) * 25),
    }
  }

  // Grader
  if (d.unit_type === 'grader') {
    out.transmission_temp_c = 70 + load * 20 + j(1) * 5
    out.blade_angle_deg = Math.round(d.cross_slope_pct ? (d.cross_slope_pct * 6) : (j(2) - 0.5) * 30)
    out.blade_lift_left_mm = Math.round(50 + j(3) * 80)
    out.blade_lift_right_mm = Math.round(50 + j(4) * 80)
    out.articulation_angle_deg = Math.round((j(5) - 0.5) * 20)
    out.gear_direction = speed > 0 ? 'F' : (j(6) > 0.9 ? 'R' : 'N')
  }

  // Water truck
  if (d.unit_type === 'water_truck') {
    out.spray_pump_active = d.status === 'spraying'
    out.spray_pattern = {
      front: d.status === 'spraying',
      rear: d.status === 'spraying' && j(1) > 0.3,
      side: d.status === 'spraying' && j(2) > 0.5,
    }
    out.next_segment = d.current_road_segment || 'segment_2'
    out.refill_distance_m = Math.round(400 + j(3) * 600)
  }

  // Service truck
  if (d.unit_type === 'service_truck') {
    out.def_level_pct_st = 60 + j(1) * 30
    out.oil_level_pct = 70 + j(2) * 25
    out.grease_level_pct = 55 + j(3) * 35
    out.service_queue = [
      { unit_id: 'DT-B02', type: 'fuel', priority: 'high', eta_s: 200 },
      { unit_id: 'EX-B01', type: 'lube', priority: 'normal', eta_s: 480 },
    ]
  }

  return out
}

function gearFromSpeed(speed, status) {
  if (speed < 1) return 'N'
  if (status === 'hauling_loaded') {
    if (speed < 8) return '1'
    if (speed < 18) return '2'
    if (speed < 28) return '3'
    if (speed < 38) return '4'
    return '5'
  }
  if (speed < 10) return '1'
  if (speed < 20) return '2'
  if (speed < 30) return '3'
  if (speed < 40) return '4'
  return '5'
}

function makeTire(position, basePressure, baseTemp, jitter) {
  // Sesekali bikin tire kritis untuk demo
  const isCrit = jitter > 0.92
  const isWarn = jitter > 0.78
  return {
    position,
    pressure_bar: isCrit ? basePressure - 2.8 : isWarn ? basePressure - 1.0 : basePressure + (jitter - 0.5) * 0.4,
    temp_c: isCrit ? baseTemp + 35 : isWarn ? baseTemp + 18 : baseTemp + jitter * 6,
  }
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
            setData({ ...enrichWithSim(json), heading_deg: headingRef.current })
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
