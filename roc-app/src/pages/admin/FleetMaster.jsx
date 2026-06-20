import { useEffect, useState } from 'react'
import { adminListUnits, adminCreateUnit, adminUpdateUnit, adminDeleteUnit } from '../../auth/adminApi.js'
import Modal, { fieldStyle, labelStyle, primaryBtn, secondaryBtn, dangerBtn } from './Modal.jsx'

const UNIT_TYPES = ['haul_truck', 'excavator', 'dozer', 'grader', 'water_truck', 'service_truck']
const SITES = ['MTBU', 'ADRO']
const EMPTY = {
  id: '', unit_type: 'haul_truck', site: 'MTBU',
  model: '', capacity_ton: 91, commissioning_date: new Date().toISOString().slice(0, 10),
}

export default function FleetMaster() {
  const [units, setUnits] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [editing, setEditing] = useState(null)
  const [filterSite, setFilterSite] = useState('all')

  const reload = async () => {
    setLoading(true)
    try {
      setUnits(await adminListUnits())
      setError(null)
    } catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [])

  const onSave = async (form) => {
    try {
      const body = { ...form, capacity_ton: form.capacity_ton ? Number(form.capacity_ton) : null }
      if (editing.mode === 'create') {
        await adminCreateUnit(body)
      } else {
        await adminUpdateUnit(editing.data.id, body)
      }
      setEditing(null)
      reload()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  const onDelete = async (u) => {
    if (!confirm(`Hapus unit ${u.id}?`)) return
    try {
      await adminDeleteUnit(u.id)
      reload()
    } catch (e) { alert(e.response?.data?.detail || e.message) }
  }

  const filtered = filterSite === 'all' ? units : units.filter(u => u.site === filterSite)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Fleet Master Data</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Daftar unit operasional & spesifikasinya</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select value={filterSite} onChange={e => setFilterSite(e.target.value)} style={{
            border: '1px solid #CBD5E1', borderRadius: 5, padding: '6px 10px', fontSize: 12,
          }}>
            <option value="all">Semua Site</option>
            {SITES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button style={primaryBtn} onClick={() => setEditing({ mode: 'create', data: EMPTY })}>
            + Tambah Unit
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {loading && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Memuat...</div>}
        {error && <div style={{ padding: 16, color: '#C41E3A' }}>Error: {error}</div>}
        {!loading && !error && (
          <table className="data-table">
            <thead><tr>
              <th>Unit ID</th><th>Tipe</th><th>Site</th><th>Model</th>
              <th>Capacity (ton)</th><th>Commissioning</th><th>Aksi</th>
            </tr></thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 700 }}>{u.id}</td>
                  <td style={{ fontSize: 12, color: '#64748B' }}>{u.unit_type}</td>
                  <td style={{ fontSize: 12 }}>{u.site}</td>
                  <td style={{ fontSize: 12 }}>{u.model || '—'}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>{u.capacity_ton ?? '—'}</td>
                  <td style={{ fontSize: 12, color: '#64748B' }}>{u.commissioning_date || '—'}</td>
                  <td style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...secondaryBtn, padding: '4px 10px', fontSize: 11 }}
                      onClick={() => setEditing({ mode: 'edit', data: u })}>Edit</button>
                    <button style={{ ...dangerBtn, padding: '4px 10px', fontSize: 11 }}
                      onClick={() => onDelete(u)}>Hapus</button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                  Tidak ada unit
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {editing && <UnitForm initial={editing.data} mode={editing.mode}
        onSave={onSave} onCancel={() => setEditing(null)} />}
    </div>
  )
}

function UnitForm({ initial, mode, onSave, onCancel }) {
  const [form, setForm] = useState(initial)
  const update = (k, v) => setForm({ ...form, [k]: v })

  return (
    <Modal title={mode === 'create' ? 'Tambah Unit Baru' : `Edit Unit — ${initial.id}`} onClose={onCancel}>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form) }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label style={labelStyle}>Unit ID (mis. DT-A01)
          <input value={form.id} onChange={e => update('id', e.target.value)}
            disabled={mode === 'edit'} style={fieldStyle} required />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>Tipe
            <select value={form.unit_type} onChange={e => update('unit_type', e.target.value)} style={fieldStyle}>
              {UNIT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label style={labelStyle}>Site
            <select value={form.site} onChange={e => update('site', e.target.value)} style={fieldStyle}>
              {SITES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
        </div>
        <label style={labelStyle}>Model
          <input value={form.model || ''} onChange={e => update('model', e.target.value)} style={fieldStyle} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <label style={labelStyle}>Capacity (ton)
            <input type="number" value={form.capacity_ton ?? ''}
              onChange={e => update('capacity_ton', e.target.value)} style={fieldStyle} />
          </label>
          <label style={labelStyle}>Commissioning Date
            <input type="date" value={form.commissioning_date || ''}
              onChange={e => update('commissioning_date', e.target.value)} style={fieldStyle} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" style={secondaryBtn} onClick={onCancel}>Batal</button>
          <button type="submit" style={primaryBtn}>{mode === 'create' ? 'Buat' : 'Simpan'}</button>
        </div>
      </form>
    </Modal>
  )
}
