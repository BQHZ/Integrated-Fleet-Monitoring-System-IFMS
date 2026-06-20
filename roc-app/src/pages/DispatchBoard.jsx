import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import {
  fetchDispatchMatrix, fetchCycleBreakdown, fetchPayloadAnalysis,
  fetchDispatchOverrides, postDispatchOverride, fetchInstructions,
  fetchFeedback, sendFeedback,
} from '../api.js'
import { useAuth } from '../auth/AuthContext.jsx'

function QueueBar({ depth }) {
  const max = 5
  const color = depth === 0 ? '#00875A' : depth <= 2 ? '#F59E0B' : '#C41E3A'
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{
          width: 14, height: 14, borderRadius: 2,
          background: i < depth ? color : '#E2E8F0',
        }} />
      ))}
      <span style={{ fontSize: 12, color, fontWeight: 600, marginLeft: 4 }}>{depth}</span>
    </div>
  )
}

function CongestionBadge({ level }) {
  const map = {
    high: { bg: '#FEE2E2', fg: '#991B1B', label: 'HIGH' },
    medium: { bg: '#FEF3C7', fg: '#92400E', label: 'MEDIUM' },
    low: { bg: '#DCFCE7', fg: '#166534', label: 'LOW' },
  }
  const s = map[level] || map.low
  return (
    <span style={{
      background: s.bg, color: s.fg, padding: '1px 8px', borderRadius: 4,
      fontSize: 11, fontWeight: 700,
    }}>{s.label}</span>
  )
}

function OverrideForm({ truck, options, onSubmit, onCancel }) {
  const [target, setTarget] = useState(options[0]?.excavator_id || '')
  const [reason, setReason] = useState('')
  return (
    <div style={{
      border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: 6,
      padding: '10px 12px', marginTop: 8,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: '#1D4ED8' }}>
        Override Manual — {truck.unit_id}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={target} onChange={e => setTarget(e.target.value)}
          style={{ border: '1px solid #CBD5E1', borderRadius: 4, padding: '4px 8px', fontSize: 12 }}>
          {options.map(o => (
            <option key={o.excavator_id} value={o.excavator_id}>
              {o.excavator_id} (score {o.score})
            </option>
          ))}
        </select>
        <input value={reason} onChange={e => setReason(e.target.value)} placeholder="Alasan override..."
          style={{ flex: 1, minWidth: 160, border: '1px solid #CBD5E1', borderRadius: 4, padding: '4px 8px', fontSize: 12 }} />
        <button onClick={() => onSubmit(target, reason)}
          style={{ background: '#0066CC', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Apply
        </button>
        <button onClick={onCancel}
          style={{ background: '#fff', color: '#475569', border: '1px solid #CBD5E1', borderRadius: 4, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>
          Batal
        </button>
      </div>
    </div>
  )
}

function relTime(ts) {
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}d lalu`
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`
  return new Date(ts * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const CATEGORY_COLOR = {
  safety: '#C41E3A',
  productivity: '#0066CC',
  quality: '#7C3AED',
  praise: '#16A34A',
}

const QUICK_PRESETS = [
  { category: 'productivity', text: 'Reduce idle time' },
  { category: 'safety', text: 'Watch overspeed' },
  { category: 'praise', text: 'Good payload — keep it up' },
  { category: 'safety', text: 'Slow down on grade' },
]

function OperatorFeedbackPanel({ feedback, units, siteFilter, onSent }) {
  const { user } = useAuth()
  const haulOrAny = units.filter(u =>
    !siteFilter || siteFilter === 'all' || u.site_id === siteFilter
  )
  const [unitId, setUnitId] = useState(haulOrAny[0]?.unit_id || '')
  const [category, setCategory] = useState('productivity')
  const [text, setText] = useState('')
  const [priority, setPriority] = useState('normal')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e?.preventDefault()
    if (!unitId || !text.trim()) { setError('Pilih unit & isi pesan'); return }
    setSending(true); setError(null)
    try {
      await sendFeedback({ unit_id: unitId, category, text: text.trim(), priority })
      setText('')
      onSent?.()
    } catch (err) {
      setError(err.response?.data?.detail || err.message)
    }
    setSending(false)
  }

  const applyPreset = (p) => {
    setCategory(p.category)
    setText(p.text)
  }

  const visibleFeedback = feedback.filter(f => {
    if (!siteFilter || siteFilter === 'all') return true
    const suffix = siteFilter === 'siteA' ? '-A' : '-B'
    return (f.unit_id || '').includes(suffix)
  })

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div className="card" style={{ padding: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10 }}>
          Operator Feedback — Coaching
        </div>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
              Unit
              <select value={unitId} onChange={e => setUnitId(e.target.value)}
                style={inp}>
                {haulOrAny.length === 0 && <option value="">Tidak ada unit</option>}
                {haulOrAny.map(u => (
                  <option key={u.unit_id} value={u.unit_id}>{u.unit_id} — {u.unit_type}</option>
                ))}
              </select>
            </label>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
              Category
              <select value={category} onChange={e => setCategory(e.target.value)} style={inp}>
                <option value="safety">Safety</option>
                <option value="productivity">Productivity</option>
                <option value="quality">Quality</option>
                <option value="praise">Praise</option>
              </select>
            </label>
          </div>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
            Message (max 200)
            <textarea value={text} onChange={e => setText(e.target.value.slice(0, 200))}
              rows={2} placeholder="Pesan untuk operator..."
              style={{ ...inp, resize: 'vertical' }} maxLength={200} />
            <span style={{ float: 'right', fontSize: 10, color: '#94A3B8' }}>
              {text.length}/200
            </span>
          </label>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569' }}>
            Priority
            <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B',
              borderRadius: 5, padding: '6px 10px', fontSize: 12,
            }}>{error}</div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#64748B', marginRight: 4, alignSelf: 'center' }}>
              Quick:
            </span>
            {QUICK_PRESETS.map((p, i) => (
              <button key={i} type="button" onClick={() => applyPreset(p)} style={{
                background: '#fff', color: CATEGORY_COLOR[p.category],
                border: `1px solid ${CATEGORY_COLOR[p.category]}55`,
                borderRadius: 4, padding: '3px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}>
                {p.text}
              </button>
            ))}
          </div>
          <button type="submit" disabled={sending || !unitId || !text.trim()} style={{
            background: '#0066CC', color: '#fff', border: 'none',
            borderRadius: 5, padding: '8px 12px', fontSize: 13, fontWeight: 700,
            cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1, marginTop: 4,
          }}>
            {sending ? 'Mengirim...' : 'Send Feedback'}
          </button>
        </form>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13,
        }}>
          Feedback History ({visibleFeedback.length})
        </div>
        {visibleFeedback.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            Belum ada feedback terkirim
          </div>
        ) : (
          <div style={{ maxHeight: 260, overflowY: 'auto', padding: 10 }}>
            {visibleFeedback.slice(0, 30).map(f => (
              <FeedbackItem key={f.id} f={f} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FeedbackItem({ f }) {
  const c = CATEGORY_COLOR[f.category] || '#475569'
  return (
    <div style={{
      borderLeft: `4px solid ${c}`,
      background: f.category === 'praise' ? '#F0FDF4' : '#fff',
      border: '1px solid #E2E8F0', borderLeftWidth: 4, borderLeftColor: c,
      borderRadius: 5, padding: '8px 12px', marginBottom: 6,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13 }}>{f.unit_id}</span>
        <span style={{
          background: c + '22', color: c, padding: '1px 7px', borderRadius: 3,
          fontSize: 10, fontWeight: 800, letterSpacing: '0.05em',
        }}>{f.category.toUpperCase()}</span>
        <span style={{ fontSize: 11, color: f.status === 'ack' ? '#16A34A' : '#F59E0B', fontWeight: 700 }}>
          {f.status === 'ack' ? `ACK ✓ ${f.ack_by || ''}` : 'PENDING'}
        </span>
      </div>
      <div style={{ fontSize: 12, color: '#475569', marginTop: 3 }}>
        {f.text}
      </div>
      <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
        from {f.sent_by} · {relTime(f.ts)}
      </div>
    </div>
  )
}

const inp = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  marginTop: 4, padding: '6px 9px', fontSize: 12,
  border: '1px solid #CBD5E1', borderRadius: 5,
}

const STATUS_COLOR = { sent: '#F59E0B', ack: '#00875A', acted: '#0066CC' }
const STATUS_LABEL = { sent: 'PENDING', ack: 'ACK ✓', acted: 'ACTED' }
const PRIO_COLOR = { low: '#94A3B8', normal: '#0066CC', high: '#C41E3A' }

function ActiveInstructionsPanel({ instructions, onRefresh }) {
  const sentCount = instructions.filter(i => i.status === 'sent').length

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{
        padding: '10px 14px', borderBottom: '1px solid #E2E8F0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          Active Instructions ({instructions.length}{sentCount > 0 ? ` · ${sentCount} pending` : ''})
        </span>
        <button onClick={onRefresh} style={{
          background: '#fff', border: '1px solid #CBD5E1', borderRadius: 4,
          padding: '3px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600, color: '#475569',
        }}>Refresh</button>
      </div>
      {instructions.length === 0 ? (
        <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
          Belum ada instruksi terkirim
        </div>
      ) : (
        <div style={{ maxHeight: 260, overflowY: 'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Waktu</th><th>Unit</th><th>Tipe</th><th>Priority</th>
              <th>Sent By</th><th>Status</th><th>Ack By</th>
            </tr></thead>
            <tbody>
              {instructions.slice(0, 30).map(i => (
                <tr key={i.id}>
                  <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {relTime(i.ts)}
                  </td>
                  <td style={{ fontWeight: 700 }}>{i.unit_id}</td>
                  <td style={{ fontSize: 12, fontFamily: 'monospace' }}>{i.type}</td>
                  <td>
                    <span style={{
                      background: `${PRIO_COLOR[i.priority] || '#475569'}15`,
                      color: PRIO_COLOR[i.priority] || '#475569',
                      padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    }}>{i.priority.toUpperCase()}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748B' }}>{i.sent_by}</td>
                  <td>
                    <span style={{
                      background: `${STATUS_COLOR[i.status] || '#475569'}15`,
                      color: STATUS_COLOR[i.status] || '#475569',
                      padding: '1px 7px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                    }}>{STATUS_LABEL[i.status] || i.status.toUpperCase()}</span>
                  </td>
                  <td style={{ fontSize: 12, color: '#64748B' }}>
                    {i.ack_by || (i.ack_at ? '—' : '')}
                    {i.ack_at && (
                      <span style={{ marginLeft: 4, fontSize: 10, color: '#94A3B8' }}>
                        ({relTime(i.ack_at)})
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function DispatchBoard({ siteFilter, units = [] }) {
  const [matrix, setMatrix] = useState(null)
  const [cycles, setCycles] = useState([])
  const [payload, setPayload] = useState([])
  const [overrides, setOverrides] = useState([])
  const [overrideFor, setOverrideFor] = useState(null)
  const [instructions, setInstructions] = useState([])
  const [feedback, setFeedback] = useState([])

  const reload = () => {
    fetchDispatchMatrix().then(d => d && setMatrix(d))
    fetchCycleBreakdown().then(d => d && setCycles(d))
    fetchPayloadAnalysis().then(d => d && setPayload(d))
    fetchDispatchOverrides().then(d => d && setOverrides(d))
    fetchInstructions().then(d => Array.isArray(d) && setInstructions(d))
    fetchFeedback().then(d => Array.isArray(d) && setFeedback(d))
  }

  useEffect(() => {
    reload()
    const iv = setInterval(reload, 10000)
    return () => clearInterval(iv)
  }, [])

  const filteredPayload = siteFilter === 'all' ? payload : payload.filter(p => p.site_id === siteFilter)
  const filteredExcavators = matrix?.excavators?.filter(e => siteFilter === 'all' || e.site_id === siteFilter) || []
  const filteredRecs = (matrix?.recommendations || []).filter(r => siteFilter === 'all' || r.site_id === siteFilter)
  const filteredRoad = (matrix?.road_utilization || []).filter(r => siteFilter === 'all' || r.site_id === siteFilter)
  const filteredOverrides = overrides.filter(o => {
    if (siteFilter === 'all') return true
    return (o.unit_id || '').includes(siteFilter === 'siteA' ? '-A' : '-B')
  })

  const cycleChartData = cycles.filter(c => siteFilter === 'all' || c.site_id === siteFilter).map(c => ({
    name: c.unit_id,
    Queue: Math.round((c.queue_idle_time_s || 0) / 60),
    Load: Math.round((c.loading_time_s || 0) / 60),
    Haul: Math.round((c.haul_loaded_time_s || 0) / 60),
    Dump: Math.round((c.dump_time_s || 0) / 60),
    Return: Math.round((c.return_time_s || 0) / 60),
  }))

  const PAYLOAD_COLOR = { underload: '#F59E0B', nominal: '#00875A', overload: '#C41E3A' }
  const ROAD_COLOR = { high: '#C41E3A', medium: '#F59E0B', low: '#00875A' }

  const submitOverride = async (truck, newTarget, reason) => {
    const result = await postDispatchOverride({
      unit_id: truck.unit_id,
      original_target: truck.best_path_to,
      new_target: newTarget,
      reason: reason || '—',
      operator: 'ROC-Operator',
    })
    setOverrideFor(null)
    if (result) reload()
  }

  const filteredInstructions = siteFilter === 'all'
    ? instructions
    : instructions.filter(i => {
        const id = i.unit_id || ''
        return id.includes(siteFilter === 'siteA' ? '-A' : '-B')
      })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <ActiveInstructionsPanel instructions={filteredInstructions} onRefresh={reload} />

      <OperatorFeedbackPanel
        feedback={feedback}
        units={units}
        siteFilter={siteFilter}
        onSent={reload}
      />

      {/* Best-path recommendations dengan scoring formula */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            Best-Path Recommendations ({filteredRecs.length})
          </span>
          <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace' }}>
            {matrix?.formula || ''}
          </span>
        </div>
        {filteredRecs.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            Tidak ada truk dengan status idle/hauling_empty — fleet aligned
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 10, padding: 12 }}>
            {filteredRecs.map(rec => {
              const best = rec.options[0]
              const isHigh = rec.best_score > 80
              return (
                <div key={rec.unit_id} style={{
                  border: `1px solid ${isHigh ? '#86EFAC' : '#CBD5E1'}`,
                  background: isHigh ? '#F0FDF4' : '#fff',
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{rec.unit_id}</span>
                    <span style={{ fontSize: 11, color: '#64748B' }}>
                      {rec.current_status} · {rec.idle_seconds}s idle
                    </span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13 }}>
                    <strong style={{ color: '#0066CC' }}>→ {rec.best_path_to}</strong>
                    {' '}<span style={{
                      background: isHigh ? '#86EFAC' : '#FDE68A',
                      color: isHigh ? '#166534' : '#92400E',
                      padding: '1px 7px', borderRadius: 4, fontWeight: 700, fontSize: 11, marginLeft: 4,
                    }}>score {rec.best_score}</span>
                  </div>
                  <div style={{ marginTop: 6, fontSize: 11, color: '#64748B', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>🛣 {best.distance_m}m</span>
                    <span>⏱ {Math.round(best.travel_time_s / 60)}m</span>
                    <span>👥 queue {best.queue_depth}</span>
                    <span>🎯 gap {best.target_gap_pct}%</span>
                  </div>
                  {rec.options.length > 1 && (
                    <div style={{ marginTop: 6, fontSize: 11, color: '#94A3B8' }}>
                      Alternatif: {rec.options.slice(1).map(o => `${o.excavator_id}(${o.score})`).join(', ')}
                    </div>
                  )}
                  <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                    <button onClick={() => setOverrideFor(overrideFor === rec.unit_id ? null : rec.unit_id)}
                      style={{
                        background: '#fff', color: '#1D4ED8', border: '1px solid #BFDBFE',
                        borderRadius: 4, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                      }}>
                      {overrideFor === rec.unit_id ? 'Batal Override' : 'Override Manual'}
                    </button>
                  </div>
                  {overrideFor === rec.unit_id && (
                    <OverrideForm
                      truck={rec}
                      options={rec.options}
                      onSubmit={(t, r) => submitOverride(rec, t, r)}
                      onCancel={() => setOverrideFor(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Haul Road Utilization heatmap */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
            Haul Road Utilization — Congestion Indicator
          </div>
          {filteredRoad.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 24 }}>
              Tidak ada truk di road segments
            </div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>Segmen</th><th>Site</th><th>Unit</th><th>Avg Speed</th><th>Congestion</th>
              </tr></thead>
              <tbody>
                {filteredRoad.map((r, i) => (
                  <tr key={i} style={{ background: `${ROAD_COLOR[r.congestion]}11` }}>
                    <td style={{ fontWeight: 600 }}>{r.segment.replace(/_/g, ' ')}</td>
                    <td style={{ fontSize: 12, color: '#64748B' }}>
                      {r.site_id === 'siteA' ? 'Site A' : 'Site B'}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>
                      {r.unit_count}
                      <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 400, marginLeft: 4 }}>
                        ({r.units.join(', ')})
                      </span>
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{r.avg_speed_kmh.toFixed(1)} km/h</td>
                    <td><CongestionBadge level={r.congestion} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Override audit trail */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
            Dispatch Override — Audit Trail
          </div>
          {filteredOverrides.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Belum ada override
            </div>
          ) : (
            <div style={{ maxHeight: 240, overflowY: 'auto' }}>
              <table className="data-table">
                <thead><tr>
                  <th>Waktu</th><th>Unit</th><th>Dari → Ke</th><th>Operator</th><th>Alasan</th>
                </tr></thead>
                <tbody>
                  {filteredOverrides.map(o => (
                    <tr key={o.id}>
                      <td style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        {relTime(o.timestamp)}
                      </td>
                      <td style={{ fontWeight: 700 }}>{o.unit_id}</td>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ color: '#94A3B8' }}>{o.original_target || '—'}</span>
                        {' → '}
                        <strong style={{ color: '#0066CC' }}>{o.new_target}</strong>
                      </td>
                      <td style={{ fontSize: 12, color: '#64748B' }}>{o.operator}</td>
                      <td style={{ fontSize: 12 }}>{o.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Excavator assignment matrix */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
          Excavator — Truck Assignment Matrix
        </div>
        {filteredExcavators.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
            Menunggu data excavator...
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Excavator</th>
                <th>Site</th>
                <th>Status</th>
                <th>Dig Rate [ASUMSI]</th>
                <th>Queue Depth</th>
                <th>Assigned Trucks</th>
              </tr>
            </thead>
            <tbody>
              {filteredExcavators.map(ex => (
                <tr key={ex.unit_id}>
                  <td style={{ fontWeight: 700 }}>{ex.unit_id}</td>
                  <td style={{ color: '#64748B', fontSize: 12 }}>{ex.site_id === 'siteA' ? 'Site A' : 'Site B'}</td>
                  <td style={{ fontSize: 12 }}>{ex.status}</td>
                  <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {ex.dig_rate_bcm_hr ? `${ex.dig_rate_bcm_hr.toFixed(0)} BCM/hr` : '—'}
                  </td>
                  <td><QueueBar depth={ex.queue_depth || 0} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {(ex.assigned_trucks || []).map(t => (
                        <span key={t} style={{
                          background: '#DBEAFE', color: '#1D4ED8',
                          borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600,
                        }}>{t}</span>
                      ))}
                      {(!ex.assigned_trucks || ex.assigned_trucks.length === 0) && (
                        <span style={{ color: '#94A3B8', fontSize: 12 }}>Tidak ada</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bottom row: cycle breakdown + payload */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
            Cycle Time Breakdown per Truck (menit)
          </div>
          {cycleChartData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 20 }}>Menunggu data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cycleChartData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Queue" stackId="a" fill="#94A3B8" />
                <Bar dataKey="Load" stackId="a" fill="#0066CC" />
                <Bar dataKey="Haul" stackId="a" fill="#00875A" />
                <Bar dataKey="Dump" stackId="a" fill="#F59E0B" />
                <Bar dataKey="Return" stackId="a" fill="#7C3AED" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
            Payload Distribution per Truck
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 10 }}>
            [ASUMSI] &lt;90t=Underload, 90-120t=Nominal, &gt;120t=Overload
          </div>
          {filteredPayload.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 20 }}>Menunggu data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={filteredPayload} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="unit_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 140]} />
                <Tooltip formatter={(v) => `${v} ton`} />
                <Bar dataKey="current_payload_ton" name="Payload (ton)" radius={[4,4,0,0]}>
                  {filteredPayload.map((entry, i) => (
                    <Cell key={i} fill={PAYLOAD_COLOR[entry.category] || '#94A3B8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {Object.entries(PAYLOAD_COLOR).map(([cat, color]) => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: color }} />
                <span style={{ fontSize: 11, color: '#64748B', textTransform: 'capitalize' }}>{cat}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
