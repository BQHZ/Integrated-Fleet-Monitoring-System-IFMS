// Tile sources gratis tanpa API key.
export const TILE_SOURCES = {
  street: {
    label: 'Street',
    tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  },
  satellite: {
    label: 'Satellite',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Tiles © Esri',
    maxZoom: 19,
  },
  hybrid: {
    label: 'Hybrid',
    tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    overlayTiles: ['https://basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}.png'],
    attribution: 'Esri + CARTO',
    maxZoom: 19,
  },
  terrain: {
    label: 'Terrain',
    tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'],
    attribution: '© OpenTopoMap (CC-BY-SA)',
    maxZoom: 17,
  },
}

export default function LayerSwitcher({ value, onChange, pitch3D, onToggle3D }) {
  return (
    <div style={{
      position: 'absolute', top: 10, left: 10, zIndex: 5,
      background: '#fff', borderRadius: 6, padding: 4, display: 'flex', gap: 2,
      boxShadow: '0 2px 8px rgba(15,23,42,0.15)',
    }}>
      {Object.entries(TILE_SOURCES).map(([key, def]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            background: value === key ? '#0066CC' : 'transparent',
            color: value === key ? '#fff' : '#475569',
            border: 'none', borderRadius: 4, padding: '5px 10px',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          {def.label}
        </button>
      ))}
      <div style={{ width: 1, background: '#E2E8F0', margin: '0 2px' }} />
      <button
        onClick={onToggle3D}
        title="Toggle 3D pitch"
        style={{
          background: pitch3D ? '#7C3AED' : 'transparent',
          color: pitch3D ? '#fff' : '#475569',
          border: 'none', borderRadius: 4, padding: '5px 10px',
          fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}
      >
        3D
      </button>
    </div>
  )
}
