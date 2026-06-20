import { useEffect, useRef, useState, useCallback } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

import LayerSwitcher, { TILE_SOURCES } from './LayerSwitcher.jsx'
import { createUnitMarker, unitStatusColor } from './UnitMarker.jsx'
import { addGeofenceLayer, updateGeofenceLayer } from './GeofenceLayer.jsx'
import {
  showSinglePoint, clearSinglePoint,
  renderRoute, clearRoute,
  renderEditablePolygon, clearEditablePolygon, POLY_VERTEX_LAYER_ID,
} from './WaypointEditor.jsx'
import { fetchGeofences, sendInstruction } from '../../api.js'
import { useAuth } from '../../auth/AuthContext.jsx'

const DEFAULT_CENTER = [115.42, -2.88]  // [lng, lat]
const DEFAULT_ZOOM = 7.5
const TRAIL_MAX_AGE_MS = 10 * 60 * 1000

const TRAIL_SRC = 'unit-trails'
const TRAIL_LAYER = 'unit-trails-line'

function buildStyle(layerKey) {
  const def = TILE_SOURCES[layerKey] || TILE_SOURCES.street
  const style = {
    version: 8,
    glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
    sources: {
      'base': { type: 'raster', tiles: def.tiles, tileSize: 256, attribution: def.attribution, maxzoom: def.maxZoom || 19 },
    },
    layers: [
      { id: 'base', type: 'raster', source: 'base' },
    ],
  }
  if (def.overlayTiles) {
    style.sources['base-overlay'] = {
      type: 'raster', tiles: def.overlayTiles, tileSize: 256, maxzoom: def.maxZoom || 19,
    }
    style.layers.push({ id: 'base-overlay', type: 'raster', source: 'base-overlay' })
  }
  return style
}

/**
 * Props:
 *  - units: array unit objects (lat, lon, status, fuel, payload, etc)
 *  - mode: 'view' | 'editGeofence'
 *  - editingGeofence: { id, polygon: [[lat,lon],...] } untuk mode editGeofence
 *  - onPolygonChange: (vertices [[lng,lat],...]) => void
 *  - onUnitSelect: (unit) => void
 *  - height: number
 */
export default function FleetMapGL({
  units = [],
  mode = 'view',
  editingGeofence = null,
  onPolygonChange = null,
  onUnitSelect = null,
  pendingByUnit = {},   // {unit_id: count}
  onInstructionSent = null,
  height = 380,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef({})       // unit_id → { marker, update }
  const trailsRef = useRef({})        // unit_id → [{ ts, lng, lat }]
  const popupRef = useRef(null)
  const draggingVertexRef = useRef(null)

  const [layer, setLayer] = useState('satellite')
  const [pitch3D, setPitch3D] = useState(false)
  const [tool, setTool] = useState(null)            // 'digging' | 'dumping' | 'route' | null
  const [diggingPoint, setDiggingPoint] = useState(null)   // {lat,lng}
  const [dumpingPoint, setDumpingPoint] = useState(null)
  const [routeWaypoints, setRouteWaypoints] = useState([]) // [[lng,lat], ...]
  const [selectedUnitId, setSelectedUnitId] = useState(null)
  const [geofences, setGeofences] = useState([])
  const [editPolygon, setEditPolygon] = useState([])  // [[lng,lat], ...]
  const [sendDialog, setSendDialog] = useState(null)  // {candidates, defaultUnitId}

  const { hasRole, user } = useAuth()
  const canDispatch = hasRole('roc_dispatcher', 'super_admin')

  // -------- Init map (once) --------
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const m = new maplibregl.Map({
      container: containerRef.current,
      style: buildStyle(layer),
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      pitch: 0,
    })
    m.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'top-right')
    m.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right')
    mapRef.current = m

    m.on('load', () => {
      // Trails source
      m.addSource(TRAIL_SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
      m.addLayer({
        id: TRAIL_LAYER, type: 'line', source: TRAIL_SRC,
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 2.5,
          'line-opacity': 0.55,
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      })
      // Fetch geofences once
      fetchGeofences().then(d => {
        if (Array.isArray(d)) {
          setGeofences(d)
          addGeofenceLayer(m, d)
        }
      })
    })

    return () => {
      m.remove()
      mapRef.current = null
      markersRef.current = {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------- Layer switch --------
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    m.setStyle(buildStyle(layer))
    // Re-add overlays after style swap
    m.once('styledata', () => {
      if (!m.getSource(TRAIL_SRC)) {
        m.addSource(TRAIL_SRC, { type: 'geojson', data: buildTrailsGeoJSON(trailsRef.current, units) })
        m.addLayer({
          id: TRAIL_LAYER, type: 'line', source: TRAIL_SRC,
          paint: { 'line-color': ['get', 'color'], 'line-width': 2.5, 'line-opacity': 0.55 },
          layout: { 'line-cap': 'round', 'line-join': 'round' },
        })
      }
      if (geofences.length > 0) addGeofenceLayer(m, geofences)
      // Re-render route + points
      if (routeWaypoints.length > 0) renderRoute(m, routeWaypoints)
      if (diggingPoint) showSinglePoint(m, 'digging', diggingPoint)
      if (dumpingPoint) showSinglePoint(m, 'dumping', dumpingPoint)
      if (mode === 'editGeofence' && editPolygon.length > 0) renderEditablePolygon(m, editPolygon)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer])

  // -------- Pitch toggle --------
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    m.easeTo({ pitch: pitch3D ? 50 : 0, duration: 400 })
  }, [pitch3D])

  // -------- Update geofences on backend update --------
  useEffect(() => {
    const m = mapRef.current
    if (!m || !m.isStyleLoaded() || geofences.length === 0) return
    updateGeofenceLayer(m, geofences)
  }, [geofences])

  // -------- Unit markers & trails --------
  useEffect(() => {
    const m = mapRef.current
    if (!m) return

    // Update marker per unit
    const seen = new Set()
    units.forEach(u => {
      if (!u.lat || !u.lon) return
      seen.add(u.unit_id)
      const lngLat = [u.lon, u.lat]
      const selected = selectedUnitId === u.unit_id

      const pendingCount = pendingByUnit[u.unit_id] || 0
      if (markersRef.current[u.unit_id]) {
        markersRef.current[u.unit_id].marker.setLngLat(lngLat)
        markersRef.current[u.unit_id].update(u, { selected, pendingCount })
      } else {
        const handlers = {
          selected, pendingCount,
          onClick: () => {
            setSelectedUnitId(prev => prev === u.unit_id ? null : u.unit_id)
            onUnitSelect?.(u)
          },
          onHover: (e) => {
            if (popupRef.current) popupRef.current.remove()
            popupRef.current = new maplibregl.Popup({ closeButton: false, offset: 24 })
              .setLngLat(lngLat)
              .setHTML(buildPopupHTML(u))
              .addTo(m)
          },
          onHoverEnd: () => {
            if (popupRef.current) { popupRef.current.remove(); popupRef.current = null }
          },
        }
        const { el, update } = createUnitMarker(u, handlers)
        const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
          .setLngLat(lngLat)
          .addTo(m)
        markersRef.current[u.unit_id] = { marker, update, handlers }
      }

      // Update trail
      const list = trailsRef.current[u.unit_id] || []
      const now = Date.now()
      list.push({ ts: now, lng: u.lon, lat: u.lat })
      while (list.length > 0 && (now - list[0].ts) > TRAIL_MAX_AGE_MS) list.shift()
      trailsRef.current[u.unit_id] = list
    })

    // Remove stale markers
    Object.keys(markersRef.current).forEach(uid => {
      if (!seen.has(uid)) {
        markersRef.current[uid].marker.remove()
        delete markersRef.current[uid]
      }
    })

    // Push trails to source
    const trailSrc = m.getSource(TRAIL_SRC)
    if (trailSrc) trailSrc.setData(buildTrailsGeoJSON(trailsRef.current, units))
  }, [units, selectedUnitId, onUnitSelect, pendingByUnit])

  // -------- Tool handlers (click) --------
  useEffect(() => {
    const m = mapRef.current
    if (!m || mode === 'editGeofence') return

    const handler = (e) => {
      if (!tool) return
      if (tool === 'digging') {
        setDiggingPoint({ lng: e.lngLat.lng, lat: e.lngLat.lat })
        showSinglePoint(m, 'digging', e.lngLat)
      } else if (tool === 'dumping') {
        setDumpingPoint({ lng: e.lngLat.lng, lat: e.lngLat.lat })
        showSinglePoint(m, 'dumping', e.lngLat)
      } else if (tool === 'route') {
        setRouteWaypoints(prev => {
          const next = [...prev, [e.lngLat.lng, e.lngLat.lat]]
          renderRoute(m, next)
          return next
        })
      }
    }
    const dblHandler = () => {
      if (tool === 'route') setTool(null)
    }
    m.on('click', handler)
    m.on('dblclick', dblHandler)
    return () => {
      m.off('click', handler)
      m.off('dblclick', dblHandler)
    }
  }, [tool, mode])

  // Disable map dblclick zoom when in route mode (supaya tidak konflik)
  useEffect(() => {
    const m = mapRef.current
    if (!m) return
    if (tool === 'route') m.doubleClickZoom.disable()
    else m.doubleClickZoom.enable()
  }, [tool])

  // -------- Polygon editor mode --------
  useEffect(() => {
    const m = mapRef.current
    if (!m || mode !== 'editGeofence' || !editingGeofence) return

    // Inisialisasi vertices dari geofence [lat,lon] → [lng,lat]
    const init = editingGeofence.polygon.map(([lat, lng]) => [lng, lat])
    setEditPolygon(init)

    // Fit ke polygon
    if (init.length > 0) {
      const bounds = init.reduce((b, c) => b.extend(c), new maplibregl.LngLatBounds(init[0], init[0]))
      m.fitBounds(bounds, { padding: 60, duration: 0 })
    }

    if (m.isStyleLoaded()) renderEditablePolygon(m, init)
    else m.once('idle', () => renderEditablePolygon(m, init))

    // Click → tambah vertex baru di akhir
    const onClick = (e) => {
      if (draggingVertexRef.current !== null) return
      const features = m.queryRenderedFeatures(e.point, { layers: [POLY_VERTEX_LAYER_ID] })
      if (features.length > 0) return  // klik di vertex existing, biarkan drag handler
      setEditPolygon(prev => {
        const next = [...prev, [e.lngLat.lng, e.lngLat.lat]]
        renderEditablePolygon(m, next)
        onPolygonChange?.(next)
        return next
      })
    }

    // Right-click vertex → hapus
    const onContext = (e) => {
      const features = m.queryRenderedFeatures(e.point, { layers: [POLY_VERTEX_LAYER_ID] })
      if (features.length === 0) return
      const idx = features[0].properties.index
      setEditPolygon(prev => {
        if (prev.length <= 3) {
          alert('Polygon minimal 3 vertex')
          return prev
        }
        const next = prev.filter((_, i) => i !== idx)
        renderEditablePolygon(m, next)
        onPolygonChange?.(next)
        return next
      })
    }

    // Drag vertex
    const onMouseDown = (e) => {
      const features = m.queryRenderedFeatures(e.point, { layers: [POLY_VERTEX_LAYER_ID] })
      if (features.length === 0) return
      e.preventDefault()
      draggingVertexRef.current = features[0].properties.index
      m.getCanvas().style.cursor = 'grabbing'
      const onMove = (ev) => {
        const idx = draggingVertexRef.current
        if (idx == null) return
        setEditPolygon(prev => {
          const next = prev.map((c, i) => i === idx ? [ev.lngLat.lng, ev.lngLat.lat] : c)
          renderEditablePolygon(m, next)
          return next
        })
      }
      const onUp = () => {
        m.off('mousemove', onMove)
        m.off('mouseup', onUp)
        m.getCanvas().style.cursor = ''
        // Push final to parent
        setEditPolygon(prev => { onPolygonChange?.(prev); return prev })
        draggingVertexRef.current = null
      }
      m.on('mousemove', onMove)
      m.once('mouseup', onUp)
    }
    const onEnter = () => { m.getCanvas().style.cursor = 'grab' }
    const onLeave = () => { m.getCanvas().style.cursor = '' }

    m.on('click', onClick)
    m.on('contextmenu', onContext)
    m.on('mousedown', POLY_VERTEX_LAYER_ID, onMouseDown)
    m.on('mouseenter', POLY_VERTEX_LAYER_ID, onEnter)
    m.on('mouseleave', POLY_VERTEX_LAYER_ID, onLeave)

    return () => {
      m.off('click', onClick)
      m.off('contextmenu', onContext)
      m.off('mousedown', POLY_VERTEX_LAYER_ID, onMouseDown)
      m.off('mouseenter', POLY_VERTEX_LAYER_ID, onEnter)
      m.off('mouseleave', POLY_VERTEX_LAYER_ID, onLeave)
      clearEditablePolygon(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, editingGeofence])

  // -------- Dispatcher toolbar handlers --------
  const resetRoute = () => {
    setRouteWaypoints([])
    if (mapRef.current) clearRoute(mapRef.current)
  }
  const resetSinglePoints = () => {
    setDiggingPoint(null); setDumpingPoint(null)
    if (mapRef.current) { clearSinglePoint(mapRef.current, 'digging'); clearSinglePoint(mapRef.current, 'dumping') }
  }

  return (
    <div style={{ position: 'relative', height, width: '100%' }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, borderRadius: 8 }} />

      <LayerSwitcher
        value={layer} onChange={setLayer}
        pitch3D={pitch3D} onToggle3D={() => setPitch3D(p => !p)}
      />

      {mode === 'view' && canDispatch && (
        <DispatcherToolbar
          tool={tool} setTool={setTool}
          hasRoute={routeWaypoints.length > 0}
          hasPoints={!!(diggingPoint || dumpingPoint)}
          onClearRoute={resetRoute}
          onClearPoints={resetSinglePoints}
          waypointCount={routeWaypoints.length}
        />
      )}

      {mode === 'view' && (diggingPoint || dumpingPoint || routeWaypoints.length > 0) && (
        <CandidatesPanel
          diggingPoint={diggingPoint} dumpingPoint={dumpingPoint}
          routeWaypoints={routeWaypoints}
          canSend={canDispatch}
          onSend={() => setSendDialog({
            digging: diggingPoint, dumping: dumpingPoint, route: routeWaypoints,
          })}
        />
      )}

      {sendDialog && (
        <SendInstructionDialog
          candidates={sendDialog}
          units={units}
          user={user}
          onClose={() => setSendDialog(null)}
          onSent={() => {
            setSendDialog(null)
            resetSinglePoints(); resetRoute()
            onInstructionSent?.()
          }}
        />
      )}
    </div>
  )
}

function SendInstructionDialog({ candidates, units, user, onClose, onSent }) {
  // Filter units by site untuk dispatcher (super_admin lihat semua)
  const siteFilter = user?.role === 'roc_dispatcher' ? user.site : null
  const eligible = units.filter(u => {
    if (u.unit_type !== 'haul_truck' && u.unit_type !== 'service_truck') return false
    if (!siteFilter) return true
    // unit.site_id pakai 'siteA'/'siteB'; user.site pakai 'MTBU'/'ADRO'
    const map = { siteA: 'MTBU', siteB: 'ADRO' }
    return map[u.site_id] === siteFilter
  })

  const [unitId, setUnitId] = useState(eligible[0]?.unit_id || '')
  const [priority, setPriority] = useState('normal')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const [sentCount, setSentCount] = useState(0)

  const send = async () => {
    if (!unitId) { setError('Pilih unit'); return }
    setSending(true); setError(null)
    let count = 0
    try {
      if (candidates.digging) {
        await sendInstruction({
          unit_id: unitId, type: 'digging_point', priority,
          payload: { coord: [candidates.digging.lat, candidates.digging.lng] },
        })
        count++
      }
      if (candidates.dumping) {
        await sendInstruction({
          unit_id: unitId, type: 'dumping_point', priority,
          payload: { coord: [candidates.dumping.lat, candidates.dumping.lng] },
        })
        count++
      }
      if (candidates.route && candidates.route.length >= 2) {
        await sendInstruction({
          unit_id: unitId, type: 'waypoint', priority,
          payload: { coords: candidates.route.map(([lng, lat]) => [lat, lng]) },
        })
        count++
      }
      setSentCount(count)
      setTimeout(() => onSent?.(), 600)
    } catch (e) {
      setError(e.response?.data?.detail || e.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 100,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#fff', borderRadius: 10, padding: '20px 24px', width: 380,
        boxShadow: '0 20px 60px rgba(15,23,42,0.25)',
      }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: '#1e293b', marginBottom: 12 }}>
          Send Instructions
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginBottom: 14 }}>
          Akan dikirim:
          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
            {candidates.digging && <li>🟠 Digging Point</li>}
            {candidates.dumping && <li>🔵 Dumping Point</li>}
            {candidates.route?.length >= 2 && <li>🛣 Waypoint route ({candidates.route.length} titik)</li>}
          </ul>
        </div>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 10 }}>
          Target Unit{siteFilter ? ` (Site ${siteFilter})` : ''}
          <select value={unitId} onChange={e => setUnitId(e.target.value)} style={{
            display: 'block', width: '100%', marginTop: 4, padding: '7px 10px',
            border: '1px solid #CBD5E1', borderRadius: 5, fontSize: 13,
          }}>
            {eligible.length === 0 && <option value="">Tidak ada unit eligible</option>}
            {eligible.map(u => (
              <option key={u.unit_id} value={u.unit_id}>
                {u.unit_id} — {u.unit_type} ({u.status})
              </option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 12, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 14 }}>
          Priority
          <select value={priority} onChange={e => setPriority(e.target.value)} style={{
            display: 'block', width: '100%', marginTop: 4, padding: '7px 10px',
            border: '1px solid #CBD5E1', borderRadius: 5, fontSize: 13,
          }}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
          </select>
        </label>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B',
            borderRadius: 5, padding: '6px 10px', fontSize: 12, marginBottom: 10,
          }}>{error}</div>
        )}
        {sentCount > 0 && (
          <div style={{
            background: '#F0FDF4', border: '1px solid #86EFAC', color: '#166534',
            borderRadius: 5, padding: '6px 10px', fontSize: 12, marginBottom: 10,
          }}>✓ {sentCount} instruksi terkirim</div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={sending} style={{
            background: '#fff', color: '#475569', border: '1px solid #CBD5E1',
            borderRadius: 5, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Batal</button>
          <button onClick={send} disabled={sending || !unitId} style={{
            background: '#0066CC', color: '#fff', border: 'none', borderRadius: 5,
            padding: '8px 14px', fontSize: 13, fontWeight: 700,
            cursor: sending ? 'not-allowed' : 'pointer', opacity: sending || !unitId ? 0.6 : 1,
          }}>{sending ? 'Mengirim...' : 'Send'}</button>
        </div>
      </div>
    </div>
  )
}

// ========== sub-components ==========

function DispatcherToolbar({ tool, setTool, hasRoute, hasPoints, onClearRoute, onClearPoints, waypointCount }) {
  const Btn = ({ id, label, color }) => (
    <button
      onClick={() => setTool(tool === id ? null : id)}
      style={{
        background: tool === id ? color : '#fff',
        color: tool === id ? '#fff' : '#1e293b',
        border: `1px solid ${tool === id ? color : '#CBD5E1'}`,
        borderRadius: 5, padding: '6px 10px', fontSize: 12, fontWeight: 700,
        cursor: 'pointer', minWidth: 140, textAlign: 'left',
      }}
    >
      {tool === id ? '● ' : ''}{label}
    </button>
  )
  return (
    <div style={{
      position: 'absolute', top: 60, right: 10, zIndex: 5,
      background: '#fff', borderRadius: 8, padding: 8,
      boxShadow: '0 4px 12px rgba(15,23,42,0.15)',
      display: 'flex', flexDirection: 'column', gap: 6, minWidth: 160,
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#64748B', letterSpacing: '0.06em' }}>
        DISPATCHER TOOLS
      </div>
      <Btn id="digging" label="Set Digging Point" color="#F59E0B" />
      <Btn id="dumping" label="Set Dumping Point" color="#0066CC" />
      <Btn id="route" label="Draw Route" color="#06B6D4" />
      {tool === 'route' && (
        <div style={{ fontSize: 10, color: '#64748B', padding: '2px 4px' }}>
          {waypointCount} titik · double-click selesai
        </div>
      )}
      {(hasRoute || hasPoints) && (
        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
          {hasRoute && (
            <button onClick={onClearRoute} style={smallBtn}>Clear Route</button>
          )}
          {hasPoints && (
            <button onClick={onClearPoints} style={smallBtn}>Clear Points</button>
          )}
        </div>
      )}
    </div>
  )
}

const smallBtn = {
  flex: 1, background: '#F8FAFC', color: '#475569',
  border: '1px solid #E2E8F0', borderRadius: 4, padding: '4px 6px',
  fontSize: 10, cursor: 'pointer', fontWeight: 600,
}

function CandidatesPanel({ diggingPoint, dumpingPoint, routeWaypoints, canSend, onSend }) {
  return (
    <div style={{
      position: 'absolute', bottom: 10, left: 10, zIndex: 5,
      background: '#fff', borderRadius: 6, padding: '8px 12px',
      boxShadow: '0 2px 8px rgba(15,23,42,0.15)', fontSize: 11, color: '#475569',
      maxWidth: 300, display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontWeight: 800, fontSize: 10, color: '#64748B', letterSpacing: '0.06em' }}>
        CANDIDATES (LOCAL)
      </div>
      {diggingPoint && (
        <div>🟠 Digging: {diggingPoint.lat.toFixed(5)}, {diggingPoint.lng.toFixed(5)}</div>
      )}
      {dumpingPoint && (
        <div>🔵 Dumping: {dumpingPoint.lat.toFixed(5)}, {dumpingPoint.lng.toFixed(5)}</div>
      )}
      {routeWaypoints.length > 0 && (
        <div>🛣 Route: {routeWaypoints.length} waypoint smoothed</div>
      )}
      {canSend && onSend && (
        <button onClick={onSend} style={{
          marginTop: 4, background: '#0066CC', color: '#fff', border: 'none',
          borderRadius: 4, padding: '6px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer',
        }}>
          Send to Unit →
        </button>
      )}
    </div>
  )
}

// ========== helpers ==========

function buildTrailsGeoJSON(trailsMap, units) {
  const features = []
  const unitColorMap = Object.fromEntries(units.map(u => [u.unit_id, unitStatusColor(u.status)]))
  for (const [uid, points] of Object.entries(trailsMap)) {
    if (points.length < 2) continue
    features.push({
      type: 'Feature',
      properties: { unit_id: uid, color: unitColorMap[uid] || '#64748B' },
      geometry: { type: 'LineString', coordinates: points.map(p => [p.lng, p.lat]) },
    })
  }
  return { type: 'FeatureCollection', features }
}

function buildPopupHTML(u) {
  const fault = u.fault_code
    ? `<div style="color:#C41E3A;font-weight:600;">FAULT: ${u.fault_code}</div>`
    : ''
  const payload = (u.payload_ton != null && u.payload_ton > 0)
    ? `<div>Payload: <b>${u.payload_ton.toFixed(1)}t</b></div>` : ''
  const speed = (u.current_speed_kmh != null)
    ? `<div>Speed: <b>${u.current_speed_kmh.toFixed(1)} km/h</b></div>` : ''
  return `
    <div style="font-family:Inter,sans-serif;font-size:12px;min-width:160px;">
      <div style="font-weight:800;font-size:13px;color:#1e3a5f;">${u.unit_id}</div>
      <div style="color:#64748B;font-size:11px;margin-bottom:4px;">${u.unit_type} · ${u.site_id || ''}</div>
      <div>Status: <b>${u.status || '—'}</b></div>
      ${speed}
      ${payload}
      <div>Fuel: <b>${u.fuel_level_pct?.toFixed(1) ?? '—'}%</b></div>
      ${fault}
    </div>`
}
