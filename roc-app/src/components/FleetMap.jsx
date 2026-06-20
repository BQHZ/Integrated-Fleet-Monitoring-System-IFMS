import { MapContainer, TileLayer, Marker, Popup, LayersControl, LayerGroup, Polyline, Polygon, Circle } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LOADING_POINTS, DUMPING_POINTS, HAUL_ROADS, PIT_BOUNDARIES, NO_GO_ZONES } from '../siteGeometry.js'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STATUS_COLOR = {
  loading: '#1D4ED8', hauling_loaded: '#166534', dumping: '#92400E', hauling_empty: '#475569',
  idle: '#9A3412', pushing: '#3730A3', waiting_truck: '#92400E', loading_truck: '#166534',
  spraying: '#155E75', travelling: '#475569', refilling: '#5B21B6',
  grading: '#0E7490', repositioning: '#475569', servicing: '#7C3AED',
}

const TYPE_LABEL = {
  haul_truck: 'T', excavator: 'E', dozer: 'D', grader: 'G',
  water_truck: 'W', service_truck: 'S',
}

function makeUnitIcon(status, unitType) {
  const color = STATUS_COLOR[status] || '#64748B'
  const label = TYPE_LABEL[unitType] || '?'
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36">
    <path d="M14 0 C6.27 0 0 6.27 0 14 C0 24.5 14 36 14 36 C14 36 28 24.5 28 14 C28 6.27 21.73 0 14 0Z" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="14" y="19" text-anchor="middle" font-size="11" font-weight="bold" fill="white" font-family="sans-serif">${label}</text>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [28, 36], iconAnchor: [14, 36], popupAnchor: [0, -36] })
}

function makePoiIcon(symbol, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
    <rect x="1" y="1" width="22" height="22" rx="4" fill="${color}" stroke="white" stroke-width="2"/>
    <text x="12" y="17" text-anchor="middle" font-size="13" font-weight="bold" fill="white" font-family="sans-serif">${symbol}</text>
  </svg>`
  return L.divIcon({ html: svg, className: '', iconSize: [24, 24], iconAnchor: [12, 12], popupAnchor: [0, -12] })
}

const LOADING_ICON = makePoiIcon('L', '#0066CC')
const DUMP_ICON = makePoiIcon('D', '#92400E')

export default function FleetMap({ units = [] }) {
  const center = [-2.88, 115.42]
  const livePoximity = units.filter(u => u.no_go_proximity?.in_zone)

  return (
    <MapContainer center={center} zoom={8} style={{ height: '100%', width: '100%', borderRadius: 8 }}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Satellite (Esri)">
          <TileLayer
            attribution='Tiles &copy; Esri'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay checked name="Fleet Units">
          <LayerGroup>
            {units.filter(u => u.lat && u.lon).map(u => (
              <Marker key={u.unit_id} position={[u.lat, u.lon]} icon={makeUnitIcon(u.status, u.unit_type)}>
                <Popup>
                  <div style={{ fontSize: 13, minWidth: 160 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{u.unit_id}</div>
                    <div>Tipe: {u.unit_type}</div>
                    <div>Site: {u.site_id}</div>
                    <div>Status: {u.status}</div>
                    <div>Fuel: {u.fuel_level_pct?.toFixed(1)}%</div>
                    {u.payload_ton != null && u.payload_ton > 0 && (
                      <div>Payload: {u.payload_ton.toFixed(1)} ton</div>
                    )}
                    {u.fault_code && (
                      <div style={{ color: '#C41E3A', fontWeight: 600 }}>FAULT: {u.fault_code}</div>
                    )}
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Loading Points">
          <LayerGroup>
            {LOADING_POINTS.map(lp => (
              <Marker key={lp.id} position={lp.pos} icon={LOADING_ICON}>
                <Popup>
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{lp.name}</div>
                    <div style={{ color: '#64748B' }}>{lp.id} · {lp.site_id}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Dump Points">
          <LayerGroup>
            {DUMPING_POINTS.map(dp => (
              <Marker key={dp.id} position={dp.pos} icon={DUMP_ICON}>
                <Popup>
                  <div style={{ fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>{dp.name}</div>
                    <div style={{ color: '#64748B' }}>{dp.id} · {dp.site_id}</div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Haul Road Network">
          <LayerGroup>
            {HAUL_ROADS.map(hr => (
              <Polyline
                key={hr.id}
                positions={hr.path}
                pathOptions={{ color: '#F59E0B', weight: 5, opacity: 0.85, dashArray: '8 4' }}
              >
                <Popup>{hr.name}</Popup>
              </Polyline>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="Pit Boundary">
          <LayerGroup>
            {PIT_BOUNDARIES.map(pb => (
              <Polygon
                key={pb.id}
                positions={pb.polygon}
                pathOptions={{ color: '#1e3a5f', weight: 2, fillColor: '#1e3a5f', fillOpacity: 0.08 }}
              >
                <Popup>{pb.name}</Popup>
              </Polygon>
            ))}
          </LayerGroup>
        </LayersControl.Overlay>

        <LayersControl.Overlay checked name="No-Go Zones">
          <LayerGroup>
            {NO_GO_ZONES.map(z => {
              const active = livePoximity.some(u => u.no_go_proximity?.zone_name === z.name)
              return (
                <Circle
                  key={z.id}
                  center={z.center}
                  radius={z.radius_m}
                  pathOptions={{
                    color: active ? '#C41E3A' : '#991B1B',
                    weight: active ? 3 : 2,
                    fillColor: '#C41E3A',
                    fillOpacity: active ? 0.35 : 0.18,
                  }}
                >
                  <Popup>
                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 700, color: '#991B1B' }}>⚠ {z.name}</div>
                      <div style={{ color: '#64748B' }}>{z.id} · radius {z.radius_m}m</div>
                      {active && <div style={{ color: '#C41E3A', fontWeight: 600, marginTop: 4 }}>UNIT DI DALAM ZONA</div>}
                    </div>
                  </Popup>
                </Circle>
              )
            })}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  )
}
