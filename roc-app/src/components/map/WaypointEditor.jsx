// Imperative helpers untuk dispatcher tools:
// - Place single-point (digging/dumping)
// - Draw multi-waypoint route (smooth dengan bezier-spline)
// - Edit polygon (admin geofence)

import bezierSpline from '@turf/bezier-spline'
import { lineString, point as turfPoint, featureCollection } from '@turf/helpers'

// ===================== Single-point tools =====================

const POINT_SRC = (tool) => `tool-point-${tool}`
const POINT_LAYER = (tool) => `tool-point-${tool}-layer`

const TOOL_COLOR = {
  digging: '#F59E0B',
  dumping: '#0066CC',
  refuel: '#00875A',
}

export function showSinglePoint(map, tool, lngLat) {
  const srcId = POINT_SRC(tool)
  const layerId = POINT_LAYER(tool)
  const data = lngLat
    ? featureCollection([turfPoint([lngLat.lng, lngLat.lat])])
    : featureCollection([])

  if (map.getSource(srcId)) {
    map.getSource(srcId).setData(data)
    return
  }
  map.addSource(srcId, { type: 'geojson', data })
  map.addLayer({
    id: layerId,
    type: 'circle',
    source: srcId,
    paint: {
      'circle-radius': 10,
      'circle-color': TOOL_COLOR[tool] || '#475569',
      'circle-stroke-width': 3,
      'circle-stroke-color': '#fff',
    },
  })
}

export function clearSinglePoint(map, tool) {
  const srcId = POINT_SRC(tool)
  const layerId = POINT_LAYER(tool)
  if (map.getLayer(layerId)) map.removeLayer(layerId)
  if (map.getSource(srcId)) map.removeSource(srcId)
}

// ===================== Route draw =====================

const ROUTE_LINE_SRC = 'tool-route-line'
const ROUTE_CASING_LAYER = 'tool-route-casing'
const ROUTE_LINE_LAYER = 'tool-route-line-layer'
const ROUTE_LINE_DASH_LAYER = 'tool-route-line-dash'
const ROUTE_ARROW_LAYER = 'tool-route-arrow'

const ROUTE_WAYPOINTS_SRC = 'tool-route-waypoints'
const ROUTE_WAYPOINTS_LAYER = 'tool-route-waypoints-circle'
const ROUTE_WAYPOINTS_LABEL = 'tool-route-waypoints-label'

function smoothRoute(coords) {
  // bezier-spline butuh minimum 3 titik; kalau 2, return straight line.
  if (coords.length < 2) return null
  if (coords.length < 3) return lineString(coords)
  try {
    return bezierSpline(lineString(coords), { resolution: 10000, sharpness: 0.6 })
  } catch {
    return lineString(coords)
  }
}

export function renderRoute(map, waypoints) {
  // waypoints: [[lng, lat], ...]
  const lineData = waypoints.length >= 2
    ? featureCollection([smoothRoute(waypoints)].filter(Boolean))
    : featureCollection([])
  const wpData = featureCollection(waypoints.map((c, i) => turfPoint(c, { index: i + 1 })))

  if (!map.getSource(ROUTE_LINE_SRC)) {
    map.addSource(ROUTE_LINE_SRC, { type: 'geojson', data: lineData })
    map.addLayer({
      id: ROUTE_CASING_LAYER, type: 'line', source: ROUTE_LINE_SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#0F172A', 'line-width': 10, 'line-opacity': 0.7 },
    })
    map.addLayer({
      id: ROUTE_LINE_LAYER, type: 'line', source: ROUTE_LINE_SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#06B6D4', 'line-width': 6 },
    })
    map.addLayer({
      id: ROUTE_LINE_DASH_LAYER, type: 'line', source: ROUTE_LINE_SRC,
      layout: { 'line-cap': 'butt', 'line-join': 'round' },
      paint: { 'line-color': '#fff', 'line-width': 2, 'line-dasharray': [2, 4] },
    })
    map.addLayer({
      id: ROUTE_ARROW_LAYER, type: 'symbol', source: ROUTE_LINE_SRC,
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 80,
        'text-field': '▶',
        'text-size': 14,
        'text-keep-upright': false,
      },
      paint: { 'text-color': '#0F172A', 'text-halo-color': '#06B6D4', 'text-halo-width': 1.5 },
    })
  } else {
    map.getSource(ROUTE_LINE_SRC).setData(lineData)
  }

  if (!map.getSource(ROUTE_WAYPOINTS_SRC)) {
    map.addSource(ROUTE_WAYPOINTS_SRC, { type: 'geojson', data: wpData })
    map.addLayer({
      id: ROUTE_WAYPOINTS_LAYER, type: 'circle', source: ROUTE_WAYPOINTS_SRC,
      paint: {
        'circle-radius': 12, 'circle-color': '#0F172A',
        'circle-stroke-width': 3, 'circle-stroke-color': '#06B6D4',
      },
    })
    map.addLayer({
      id: ROUTE_WAYPOINTS_LABEL, type: 'symbol', source: ROUTE_WAYPOINTS_SRC,
      layout: {
        'text-field': ['get', 'index'],
        'text-size': 12, 'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-allow-overlap': true,
      },
      paint: { 'text-color': '#fff' },
    })
  } else {
    map.getSource(ROUTE_WAYPOINTS_SRC).setData(wpData)
  }

  // Animate dash
  if (!map._routeDashAnimating && map.getLayer(ROUTE_LINE_DASH_LAYER)) {
    let offset = 0
    const step = () => {
      if (!map.getLayer(ROUTE_LINE_DASH_LAYER)) { map._routeDashAnimating = false; return }
      offset = (offset + 0.4) % 6
      map.setPaintProperty(ROUTE_LINE_DASH_LAYER, 'line-dasharray', [2, 4, offset])
      map._routeDashRAF = requestAnimationFrame(step)
    }
    map._routeDashAnimating = true
    step()
  }
}

export function clearRoute(map) {
  ;[ROUTE_ARROW_LAYER, ROUTE_LINE_DASH_LAYER, ROUTE_LINE_LAYER, ROUTE_CASING_LAYER,
    ROUTE_WAYPOINTS_LABEL, ROUTE_WAYPOINTS_LAYER].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
  ;[ROUTE_LINE_SRC, ROUTE_WAYPOINTS_SRC].forEach(id => {
    if (map.getSource(id)) map.removeSource(id)
  })
  if (map._routeDashRAF) cancelAnimationFrame(map._routeDashRAF)
  map._routeDashAnimating = false
}

// ===================== Polygon editor (admin) =====================

const POLY_FILL_SRC = 'edit-polygon-src'
const POLY_FILL_LAYER = 'edit-polygon-fill'
const POLY_LINE_LAYER = 'edit-polygon-line'
const POLY_VERTEX_SRC = 'edit-polygon-vertex-src'
const POLY_VERTEX_LAYER = 'edit-polygon-vertex'

/** vertices: [[lng,lat], ...] */
export function renderEditablePolygon(map, vertices) {
  const closed = vertices.length >= 3
  const polyData = closed
    ? featureCollection([{
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...vertices, vertices[0]]] },
        properties: {},
      }])
    : featureCollection([])
  const lineCoords = vertices.length >= 2
    ? (closed ? [...vertices, vertices[0]] : vertices)
    : null
  const lineData = lineCoords ? featureCollection([lineString(lineCoords)]) : featureCollection([])
  const vertexData = featureCollection(vertices.map((c, i) => turfPoint(c, { index: i })))

  if (!map.getSource(POLY_FILL_SRC)) {
    map.addSource(POLY_FILL_SRC, { type: 'geojson', data: polyData })
    map.addSource(POLY_VERTEX_SRC, { type: 'geojson', data: vertexData })
    map.addLayer({
      id: POLY_FILL_LAYER, type: 'fill', source: POLY_FILL_SRC,
      paint: { 'fill-color': '#0066CC', 'fill-opacity': 0.15 },
    })
    map.addLayer({
      id: POLY_LINE_LAYER, type: 'line', source: POLY_FILL_SRC,
      paint: { 'line-color': '#0066CC', 'line-width': 2.5, 'line-dasharray': [2, 2] },
    })
    map.addLayer({
      id: POLY_VERTEX_LAYER, type: 'circle', source: POLY_VERTEX_SRC,
      paint: {
        'circle-radius': 7, 'circle-color': '#fff',
        'circle-stroke-width': 3, 'circle-stroke-color': '#0066CC',
      },
    })
  } else {
    map.getSource(POLY_FILL_SRC).setData(polyData)
    map.getSource(POLY_VERTEX_SRC).setData(vertexData)
  }
}

export function clearEditablePolygon(map) {
  ;[POLY_VERTEX_LAYER, POLY_LINE_LAYER, POLY_FILL_LAYER].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
  ;[POLY_FILL_SRC, POLY_VERTEX_SRC].forEach(id => {
    if (map.getSource(id)) map.removeSource(id)
  })
}

export const POLY_VERTEX_LAYER_ID = POLY_VERTEX_LAYER
