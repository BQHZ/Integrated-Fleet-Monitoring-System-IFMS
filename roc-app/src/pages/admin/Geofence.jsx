import { useEffect, useState } from 'react'
import { adminListGeofences, adminCreateGeofence, adminUpdateGeofence, adminDeleteGeofence } from '../../auth/adminApi.js'
import Modal, { fieldStyle, labelStyle, primaryBtn, secondaryBtn, dangerBtn } from './Modal.jsx'
import FleetMapGL from '../../components/map/FleetMapGL.jsx'

const TYPES = ['digging', 'dumping', 'restricted', 'fuel', 'workshop', 'speed']
const SITES = ['MTBU', 'ADRO']
const TYPE_COLOR = {
  digging: '#0066CC', dumping: '#92400E', restricted: '#C41E3A',
  fuel: '#F59E0B', workshop: '#7C3AED', speed: '#475569',
}

const SAMPLE_POLY = [
  [-3.5800, 115.6000],
  [-3.5800, 115.6010],
  [-3.5810, 115.6010],
  [-3.5810, 115.6000],
]

const EMPTY = {
  id: '', site: 'MTBU', type: 'digging', name: '',
  polygon: SAMPLE_POLY, speed_limit: 15,
}

export default function Geofence() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [mapEdit, setMapEdit] = useState(null)  // { geofence, polygon: [[lng,lat]...] }

  const reload = async () => {
    setLoading(true)
    try {
      setItems(await adminListGeofences())
      setError(null)
    } catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  const onSave = async (form) => {
    try {
      if (editing.mode === 'create') {
        const body = { ...form }
        if (!body.id) delete body.id
        await adminCreateGeofence(body)
      } else {
        await adminUpdateGeofence(editing.data.id, form)
      }
      setEditing(null)
      reload()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  const saveMapEdit = async () => {
    if (!mapEdit || mapEdit.polygon.length < 3) {
      alert('Polygon minimal 3 vertex')
      return
    }
    const polyLatLon = mapEdit.polygon.map(([lng, lat]) => [lat, lng])
    try {
      await adminUpdateGeofence(mapEdit.geofence.id, {
        ...mapEdit.geofence,
        polygon: polyLatLon,
      })
      setMapEdit(null)
      reload()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  const onDelete = async (g) => {
    if (!confirm(`Hapus geofence ${g.id} (${g.name || g.type})?`)) return
    try {
      await adminDeleteGeofence(g.id)
      reload()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Geofence Master</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            Zona operasional · editor polygon JSON ({'editor geometric di Prompt 4'})
          </div>
        </div>
        <button style={primaryBtn} onClick={() => setEditing({ mode: 'create', data: EMPTY })}>
          + Tambah Geofence
        </button>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Memuat...</div>}
        {error && <div style={{ padding: 16, color: '#C41E3A' }}>Error: {error}</div>}
        {!loading && !error && (
          <table className="data-table">
            <thead><tr>
              <th>ID</th><th>Name</th><th>Tipe</th><th>Site</th>
              <th>Vertices</th><th>Speed Limit</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              {items.map(g => (
                <tr key={g.id}>
                  <td style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{g.id}</td>
                  <td>{g.name || '—'}</td>
                  <td>
                    <span style={{
                      background: `${TYPE_COLOR[g.type] || '#475569'}15`,
                      color: TYPE_COLOR[g.type] || '#475569',
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    }}>{g.type.toUpperCase()}</span>
                  </td>
                  <td style={{ fontSize: 12 }}>{g.site}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{g.polygon?.length || 0}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{g.speed_limit ?? '—'}</td>
                  <td style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }}
                      onClick={() => setEditing({ mode: 'edit', data: g })}>Edit</button>
                    <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11,
                      background: '#EFF6FF', color: '#1D4ED8', borderColor: '#BFDBFE' }}
                      onClick={() => setMapEdit({ geofence: g, polygon: g.polygon.map(([lat, lng]) => [lng, lat]) })}>
                      Edit on Map
                    </button>
                    <button style={{ ...dangerBtn, padding: '4px 10px', fontSize: 11 }}
                      onClick={() => onDelete(g)}>Hapus</button>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                  Belum ada geofence
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing && <GeofenceForm initial={editing.data} mode={editing.mode}
        onSave={onSave} onCancel={() => setEditing(null)} />}

      {mapEdit && (
        <Modal title={`Edit Polygon on Map — ${mapEdit.geofence.id} (${mapEdit.geofence.type})`}
          onClose={() => setMapEdit(null)} width={900}>
          <div style={{ marginBottom: 10, fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
            <strong>Cara pakai:</strong> klik area kosong untuk tambah vertex · drag vertex untuk pindah ·
            klik kanan vertex untuk hapus. Minimal 3 vertex.
          </div>
          <FleetMapGL
            mode="editGeofence"
            editingGeofence={mapEdit.geofence}
            onPolygonChange={(poly) => setMapEdit(prev => ({ ...prev, polygon: poly }))}
            height={460}
          />
          <div style={{ marginTop: 10, fontSize: 12, color: '#64748B' }}>
            Vertex saat ini: <strong>{mapEdit.polygon.length}</strong>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 14 }}>
            <button style={secondaryBtn} onClick={() => setMapEdit(null)}>Batal</button>
            <button style={primaryBtn} onClick={saveMapEdit}>Simpan ke Backend</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function GeofenceForm({ initial, mode, onSave, onCancel }) {
  const [form, setForm] = useState({
    ...initial,
    _polygonText: JSON.stringify(initial.polygon || [], null, 2),
  })
  const [parseError, setParseError] = useState(null)
  const update = (k, v) => setForm({ ...form, [k]: v })

  const submit = (e) => {
    e.preventDefault()
    try {
      const poly = JSON.parse(form._polygonText)
      if (!Array.isArray(poly) || poly.length < 3) throw new Error('Polygon minimal 3 titik')
      const body = { ...form, polygon: poly }
      delete body._polygonText
      if (body.speed_limit === '' || body.speed_limit == null) body.speed_limit = null
      else body.speed_limit = Number(body.speed_limit)
      onSave(body)
    } catch (e) {
      setParseError(e.message)
    }
  }

  return (
    <Modal title={mode === 'create' ? 'Tambah Geofence' : `Edit Geofence — ${initial.id}`}
      onClose={onCancel} width={560}>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {mode === 'create' && (
          <label style={labelStyle}>ID (opsional — auto-generate kalau kosong)
            <input value={form.id} onChange={e => update('id', e.target.value)} style={fieldStyle} />
          </label>
        )}
        <label style={labelStyle}>Nama
          <input value={form.name || ''} onChange={e => update('name', e.target.value)} style={fieldStyle} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>Tipe
            <select value={form.type} onChange={e => update('type', e.target.value)} style={fieldStyle}>
              {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Site
            <select value={form.site} onChange={e => update('site', e.target.value)} style={fieldStyle}>
              {SITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label style={labelStyle}>Speed Limit (km/h, opsional)
          <input type="number" value={form.speed_limit ?? ''}
            onChange={e => update('speed_limit', e.target.value)} style={fieldStyle} />
        </label>
        <label style={labelStyle}>Polygon JSON — array of [lat, lon]
          <textarea value={form._polygonText}
            onChange={e => { update('_polygonText', e.target.value); setParseError(null) }}
            rows={8}
            style={{ ...fieldStyle, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }} />
        </label>
        {parseError && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B',
            borderRadius: 5, padding: '6px 10px', fontSize: 12,
          }}>{parseError}</div>
        )}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" style={secondaryBtn} onClick={onCancel}>Batal</button>
          <button type="submit" style={primaryBtn}>{mode === 'create' ? 'Buat' : 'Simpan'}</button>
        </div>
      </form>
    </Modal>
  )
}
