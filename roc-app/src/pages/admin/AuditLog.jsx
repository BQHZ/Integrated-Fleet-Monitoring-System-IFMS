import { useEffect, useState } from 'react'
import { adminAuditLog } from '../../auth/adminApi.js'

function relTime(ts) {
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}d lalu`
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h lalu`
  return new Date(ts * 1000).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })
}

const ACTION_COLOR = { create: '#00875A', update: '#0066CC', delete: '#C41E3A' }

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = async () => {
    setLoading(true)
    try {
      const params = { limit: 200 }
      if (filterUser) params.user = filterUser
      if (filterAction) params.action = filterAction
      setEntries(await adminAuditLog(params))
      setError(null)
    } catch (e) { setError(e.response?.data?.detail || e.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { reload() }, [filterUser, filterAction])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>Audit Log</div>
        <div style={{ fontSize: 12, color: '#64748B' }}>
          Riwayat semua mutasi admin · read-only · 200 entri terbaru
        </div>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Filter:</span>
          <input value={filterUser} onChange={e => setFilterUser(e.target.value)}
            placeholder="username..."
            style={{ border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 10px', fontSize: 12 }} />
          <select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            style={{ border: '1px solid #CBD5E1', borderRadius: 5, padding: '4px 10px', fontSize: 12 }}>
            <option value="">Semua action</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
          </select>
          <button onClick={reload} style={{
            marginLeft: 'auto', background: '#fff', border: '1px solid #CBD5E1',
            borderRadius: 5, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
          }}>Refresh</button>
        </div>

        {loading && <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>Memuat...</div>}
        {error && <div style={{ padding: 16, color: '#C41E3A' }}>Error: {error}</div>}
        {!loading && !error && (
          <table className="data-table">
            <thead><tr>
              <th>Waktu</th><th>User</th><th>Action</th><th>Entity</th><th>Detail</th>
            </tr></thead>
            <tbody>
              {entries.map(e => (
                <>
                  <tr key={e.id}>
                    <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {relTime(e.ts)}
                    </td>
                    <td style={{ fontSize: 12, fontWeight: 700 }}>{e.user}</td>
                    <td>
                      <span style={{
                        background: `${ACTION_COLOR[e.action] || '#475569'}15`,
                        color: ACTION_COLOR[e.action] || '#475569',
                        padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      }}>{e.action.toUpperCase()}</span>
                    </td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{e.entity}</td>
                    <td>
                      <button onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                        style={{
                          background: 'transparent', border: '1px solid #CBD5E1', borderRadius: 4,
                          padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: '#475569',
                        }}>
                        {expanded === e.id ? 'Tutup' : 'Lihat'}
                      </button>
                    </td>
                  </tr>
                  {expanded === e.id && (
                    <tr key={`${e.id}-detail`}>
                      <td colSpan={5} style={{ background: '#F8FAFC', padding: '12px 14px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 11 }}>
                          <div>
                            <div style={{ fontWeight: 700, color: '#64748B', marginBottom: 4 }}>BEFORE</div>
                            <pre style={preStyle}>{e.before ? JSON.stringify(e.before, null, 2) : '— null —'}</pre>
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, color: '#64748B', marginBottom: 4 }}>AFTER</div>
                            <pre style={preStyle}>{e.after ? JSON.stringify(e.after, null, 2) : '— null —'}</pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: '#94A3B8' }}>
                  Tidak ada entry
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

const preStyle = {
  background: '#fff', border: '1px solid #E2E8F0', borderRadius: 4,
  padding: 8, fontFamily: 'monospace', fontSize: 11,
  overflow: 'auto', maxHeight: 240, margin: 0,
}
