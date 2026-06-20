// Imperative helper untuk render geofence sebagai source+layer di MapLibre.
// Polygon dari /api/geofences format [[lat,lon],...]; di-convert ke GeoJSON [[lon,lat],...].

export const GEOFENCE_COLOR = {
  digging: '#F59E0B',    // orange
  dumping: '#0066CC',    // blue
  restricted: '#C41E3A', // red
  fuel: '#00875A',       // green
  workshop: '#7C3AED',   // purple
  speed: '#475569',      // grey
}

const SOURCE_ID = 'geofences-src'
const FILL_LAYER = 'geofences-fill'
const LINE_LAYER = 'geofences-line'
const LABEL_LAYER = 'geofences-label'

function toGeoJSON(geofences) {
  return {
    type: 'FeatureCollection',
    features: geofences.map(g => ({
      type: 'Feature',
      properties: {
        id: g.id,
        type: g.type,
        name: g.name || g.id,
        site: g.site,
        speed_limit: g.speed_limit,
        color: GEOFENCE_COLOR[g.type] || '#64748B',
      },
      geometry: {
        type: 'Polygon',
        // MapLibre: rings array — first ring is outer. Convert lat,lon → lon,lat.
        coordinates: [[
          ...g.polygon.map(([lat, lon]) => [lon, lat]),
          [g.polygon[0][1], g.polygon[0][0]],  // close ring
        ]],
      },
    })),
  }
}

export function addGeofenceLayer(map, geofences) {
  const data = toGeoJSON(geofences || [])
  if (map.getSource(SOURCE_ID)) {
    map.getSource(SOURCE_ID).setData(data)
    return
  }
  map.addSource(SOURCE_ID, { type: 'geojson', data })
  map.addLayer({
    id: FILL_LAYER,
    type: 'fill',
    source: SOURCE_ID,
    paint: {
      'fill-color': ['get', 'color'],
      'fill-opacity': 0.18,
    },
  })
  map.addLayer({
    id: LINE_LAYER,
    type: 'line',
    source: SOURCE_ID,
    paint: {
      'line-color': ['get', 'color'],
      'line-width': 2,
      'line-opacity': 0.85,
    },
  })
  map.addLayer({
    id: LABEL_LAYER,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'text-field': ['get', 'name'],
      'text-size': 11,
      'text-offset': [0, 0],
      'text-allow-overlap': false,
    },
    paint: {
      'text-color': '#1e293b',
      'text-halo-color': '#fff',
      'text-halo-width': 1.5,
    },
  })
}

export function updateGeofenceLayer(map, geofences) {
  const src = map.getSource(SOURCE_ID)
  if (src) src.setData(toGeoJSON(geofences || []))
}

export function removeGeofenceLayer(map) {
  [LABEL_LAYER, LINE_LAYER, FILL_LAYER].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id)
  })
  if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID)
}
