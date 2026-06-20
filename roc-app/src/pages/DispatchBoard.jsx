import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import {
  fetchDispatchMatrix, fetchCycleBreakdown, fetchPayloadAnalysis,
  fetchDispatchOverrides, postDispatchOverride,
} from '../api.js'

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

export default function DispatchBoard({ siteFilter }) {
  const [matrix, setMatrix] = useState(null)
  const [cycles, setCycles] = useState([])
  const [payload, setPayload] = useState([])
  const [overrides, setOverrides] = useState([])
  const [overrideFor, setOverrideFor] = useState(null)

  const reload = () => {
    fetchDispatchMatrix().then(d => d && setMatrix(d))
    fetchCycleBreakdown().then(d => d && setCycles(d))
    fetchPayloadAnalysis().then(d => d && setPayload(d))
    fetchDispatchOverrides().then(d => d && setOverrides(d))
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
