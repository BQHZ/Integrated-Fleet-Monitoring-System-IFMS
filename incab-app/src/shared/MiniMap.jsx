import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { distance as turfDistance, point as turfPoint } from '@turf/turf'

const SATELLITE_STYLE = {
  version: 8,
  sources: {
    sat: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256, attribution: 'Esri', maxzoom: 19,
    },
  },
  layers: [{ id: 'sat', type: 'raster', source: 'sat' }],
}

const OWN_SRC = 'own-pos-src'
const OWN_LAYER = 'own-pos-arrow'
const DIG_SRC = 'dig-src'; const DIG_LAYER = 'dig-circle'
const DUMP_SRC = 'dump-src'; const DUMP_LAYER = 'dump-circle'
const ROUTE_SRC = 'route-src'; const ROUTE_LINE = 'route-line'; const ROUTE_WP = 'route-wp'

export default function MiniMap({ data, instructions = [] }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const [northUp, setNorthUp] = useState(false)

  // Ambil titik & route dari instruction terbaru per tipe
  const digging = lastInstructionPayload(instructions, 'digging_point')?.coord  // [lat,lng]
  const dumping = lastInstructionPayload(instructions, 'dumping_point')?.coord
  const route = lastInstructionPayload(instructions, 'waypoint')?.coords  // [[lat,lng]...]

  // Compute distance to next waypoint
  let nextWpDistKm = null
  if (data && route && route.length > 0) {
    const me = turfPoint([data.lon, data.lat])
    const next = turfPoint([route[0][1], route[0][0]])
    nextWpDistKm = turfDistance(me, next, { units: 'kilometers' })
  } else if (data && digging) {
    const me = turfPoint([data.lon, data.lat])
    const next = turfPoint([digging[1], digging[0]])
    nextWpDistKm = turfDistance(me, next, { units: 'kilometers' })
  } else if (data && dumping) {
    const me = turfPoint([data.lon, data.lat])
    const next = turfPoint([dumping[1], dumping[0]])
    nextWpDistKm = turfDistance(me, next, { units: 'kilometers' })
  }

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: SATELLITE_STYLE,
      center: data ? [data.lon, data.lat] : [115, -3],
      zoom: 15,
      pitch: 0,
      attributionControl: false,
    })
    m.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right')
    mapRef.current = m

    m.on('load', () => {
      // Own position arrow (symbol layer dengan glyphs tidak tersedia di style ini → pakai circle + line)
      m.addSource(OWN_SRC, { type: 'geojson', data: emptyFC() })
      m.addLayer({
        id: OWN_LAYER, type: 'circle', source: OWN_SRC,
        paint: {
          'circle-radius': 14,
          'circle-color': '#0066CC',
          'circle-stroke-width': 4,
          'circle-stroke-color': '#fff',
        },
      })
      // Heading arrow (chevron)
      m.addLayer({
        id: 'own-pos-chev', type: 'circle', source: OWN_SRC,
        paint: {
          'circle-radius': 5,
          'circle-color': '#fff',
          'circle-translate': [0, -10],
        },
      })
      m.addSource(DIG_SRC, { type: 'geojson', data: emptyFC() })
      m.addLayer({
        id: DIG_LAYER, type: 'circle', source: DIG_SRC,
        paint: { 'circle-radius': 10, 'circle-color': '#F59E0B', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
      })
      m.addSource(DUMP_SRC, { type: 'geojson', data: emptyFC() })
      m.addLayer({
        id: DUMP_LAYER, type: 'circle', source: DUMP_SRC,
        paint: { 'circle-radius': 10, 'circle-color': '#0066CC', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
      })
      m.addSource(ROUTE_SRC, { type: 'geojson', data: emptyFC() })
      m.addLayer({
        id: ROUTE_LINE, type: 'line', source: ROUTE_SRC, filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': '#06B6D4', 'line-width': 5, 'line-opacity': 0.85 },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      m.addLayer({
        id: ROUTE_WP, type: 'circle', source: ROUTE_SRC, filter: ['==', '$type', 'Point'],
        paint: { 'circle-radius': 7, 'circle-color': '#0F172A', 'circle-stroke-color': '#06B6D4', 'circle-stroke-width': 2 },
      })
    })

    return () => { m.remove(); mapRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Update own position + rotate + recenter
  useEffect(() => {
    const m = mapRef.current
    if (!m || !data) return
    if (m.getSource(OWN_SRC)) {
      m.getSource(OWN_SRC).setData({
        type: 'FeatureCollection',
        features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [data.lon, data.lat] }, properties: {} }],
      })
    }
    // Auto center smooth + rotate
    const bearing = northUp ? 0 : (data.heading_deg || 0)
    m.easeTo({ center: [data.lon, data.lat], bearing, duration: 600, essential: true })
  }, [data?.lon, data?.lat, data?.heading_deg, northUp])

  // Update digging/dumping/route
  useEffect(() => {
    const m = mapRef.current
    if (!m || !m.isStyleLoaded()) return
    if (m.getSource(DIG_SRC)) {
      m.getSource(DIG_SRC).setData(digging
        ? singlePointFC([digging[1], digging[0]])
        : emptyFC())
    }
    if (m.getSource(DUMP_SRC)) {
      m.getSource(DUMP_SRC).setData(dumping
        ? singlePointFC([dumping[1], dumping[0]])
        : emptyFC())
    }
    if (m.getSource(ROUTE_SRC)) {
      const features = []
      if (route && route.length >= 2) {
        features.push({
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: route.map(([lat, lng]) => [lng, lat]) },
          properties: {},
        })
        route.forEach(([lat, lng], i) => {
          features.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [lng, lat] },
            properties: { index: i + 1 },
          })
        })
      }
      m.getSource(ROUTE_SRC).setData({ type: 'FeatureCollection', features })
    }
  }, [digging, dumping, route])

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />

      {/* North-up toggle */}
      <button onClick={() => setNorthUp(p => !p)} style={{
        position: 'absolute', top: 8, right: 8, zIndex: 5,
        background: northUp ? '#0066CC' : '#fff', color: northUp ? '#fff' : '#1e293b',
        border: '1px solid #CBD5E1', borderRadius: 6, padding: '4px 8px',
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
      }}>
        {northUp ? 'North ↑' : 'Heading ↑'}
      </button>

      {/* Distance label */}
      {nextWpDistKm != null && (
        <div style={{
          position: 'absolute', top: 8, left: 8, zIndex: 5,
          background: 'rgba(15,23,42,0.85)', color: '#fff', borderRadius: 6,
          padding: '6px 10px', fontSize: 12, fontWeight: 700,
          fontFamily: 'Inter, sans-serif',
        }}>
          → {nextWpDistKm < 1 ? `${Math.round(nextWpDistKm * 1000)} m` : `${nextWpDistKm.toFixed(2)} km`}
        </div>
      )}
    </div>
  )
}

function emptyFC() { return { type: 'FeatureCollection', features: [] } }
function singlePointFC([lng, lat]) {
  return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [lng, lat] }, properties: {} }] }
}
function lastInstructionPayload(instructions, type) {
  const m = instructions.find(i => i.type === type && i.status !== 'ack')
    || instructions.find(i => i.type === type)
  return m?.payload
}
