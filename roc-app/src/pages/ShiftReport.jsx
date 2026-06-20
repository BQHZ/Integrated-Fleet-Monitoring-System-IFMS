import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { fetchShiftSummary, fetchPayloadHistogram } from '../api.js'

function ProgressBar({ value, max, color = '#0066CC' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s' }} />
    </div>
  )
}

export default function ShiftReport({ units, siteFilter }) {
  const [summary, setSummary] = useState(null)
  const [histogram, setHistogram] = useState(null)

  useEffect(() => {
    const reload = () => {
      fetchShiftSummary().then(d => d && setSummary(d))
      fetchPayloadHistogram().then(d => d && setHistogram(d))
    }
    reload()
    const iv = setInterval(reload, 10000)
    return () => clearInterval(iv)
  }, [])

  const filteredUnits = siteFilter === 'all' ? units : units.filter(u => u.site_id === siteFilter)
  const haulTrucks = filteredUnits.filter(u => u.unit_type === 'haul_truck')

  const siteKeys = siteFilter === 'all' ? ['siteA', 'siteB'] : [siteFilter]
  const siteSummaries = summary?.site_summaries || {}

  const productionData = siteKeys.map(sid => ({
    site: sid === 'siteA' ? 'Site A' : 'Site B',
    'BCM Aktual': siteSummaries[sid]?.bcm_produced || 0,
    'BCM Target': siteSummaries[sid]?.target_bcm || 0,
  }))

  const db = summary?.delay_breakdown
  const delayData = db ? [
    { name: 'Productive Time', value: db.productive_pct, color: '#00875A' },
    { name: 'Operational Delay', value: db.operational_delay_pct, color: '#F59E0B' },
    { name: 'Maintenance / Fault', value: db.maintenance_pct, color: '#C41E3A' },
  ].filter(d => d.value > 0) : []

  // Aggregate histogram bins di-filter per site
  const aggregateBins = (() => {
    if (!histogram) return []
    const filteredTrucks = siteFilter === 'all'
      ? histogram.per_truck
      : histogram.per_truck.filter(t => t.site_id === siteFilter)
    return histogram.bin_labels.map(label => {
      const count = filteredTrucks.reduce((s, t) => s + (t.bins[label] || 0), 0)
      // Warna bin: 90-120 = nominal (green), <90 underload (amber), >120 overload (red)
      const lo = parseInt(label.split('-')[0], 10)
      const color = lo < 90 ? '#F59E0B' : lo >= 120 ? '#C41E3A' : '#00875A'
      return { bin: label, count, color }
    })
  })()
  const totalSamples = aggregateBins.reduce((s, b) => s + b.count, 0)

  const perUnitData = haulTrucks.map(u => {
    const secs = u.status_seconds || {}
    const idleS = secs.idle || 0
    const activeS = Object.entries(secs).filter(([k]) => k !== 'idle').reduce((s, [, v]) => s + v, 0)
    const total = idleS + activeS
    const util = total > 0 ? (activeS / total * 100).toFixed(1) : '0.0'
    const fuelEst = ((u.engine_hours || 0) * 0.001 * 35).toFixed(0) // [ASUMSI] 35 L/hr proxy
    return {
      unit_id: u.unit_id,
      site: u.site_id === 'siteA' ? 'Site A' : 'Site B',
      cycles: u.cycle_count,
      payload_avg: u.payload_ton > 0 ? `${u.payload_ton.toFixed(1)}t` : '—',
      util_pct: util,
      fuel_est: `${fuelEst} L`,
      status: u.status,
      fault: u.fault_code,
    }
  })

  const totalBcm = siteKeys.reduce((s, sid) => s + (siteSummaries[sid]?.bcm_produced || 0), 0)
  const totalTargetBcm = siteKeys.reduce((s, sid) => s + (siteSummaries[sid]?.target_bcm || 0), 0)
  const totalCycles = haulTrucks.reduce((s, u) => s + u.cycle_count, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Summary header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {/* BCM summary with progress */}
        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #0066CC' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>BCM Diproduksi</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
            {totalBcm.toLocaleString()}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Target: {totalTargetBcm.toLocaleString()} BCM</div>
          <ProgressBar value={totalBcm} max={totalTargetBcm} color="#0066CC" />
          <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 4 }}>[ASUMSI] 18 BCM/cycle</div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #00875A' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Cycles</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{totalCycles}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Haul truck cycles shift ini</div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #F59E0B' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Safety Events</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{summary?.safety_events_count ?? '—'}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>Total event shift ini</div>
        </div>

        <div className="card" style={{ padding: '12px 16px', borderLeft: '4px solid #C41E3A' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unplanned Downtime</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4, color: (summary?.unplanned_downtime_units?.length > 0) ? '#C41E3A' : '#1e293b' }}>
            {summary?.unplanned_downtime_units?.length ?? '—'}
          </div>
          <div style={{ fontSize: 12, color: '#64748B' }}>
            {(summary?.unplanned_downtime_units || []).join(', ') || 'Tidak ada'}
          </div>
        </div>
      </div>

      {/* Top performers */}
      {summary?.top_performers?.length > 0 && (
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10 }}>Top Performers Shift Ini</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {summary.top_performers.map((p, i) => (
              <div key={p.unit_id} style={{
                background: i === 0 ? '#FFF9C4' : '#F8FAFC',
                border: `1px solid ${i === 0 ? '#FDE68A' : '#E2E8F0'}`,
                borderRadius: 8, padding: '10px 16px', minWidth: 140,
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
                {i === 0 && <div style={{ fontSize: 10, fontWeight: 700, color: '#92400E' }}>★ TOP PERFORMER</div>}
                <div style={{ fontWeight: 700, fontSize: 16 }}>{p.unit_id}</div>
                <div style={{ fontSize: 12, color: '#64748B' }}>{p.cycles} cycles</div>
                <div style={{ fontSize: 12, color: '#00875A', fontWeight: 600 }}>{p.utilization_pct}% util</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payload histogram fleet-wide */}
      <div className="card" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            Payload Histogram — Distribusi {totalSamples} Sample
          </div>
          <div style={{ fontSize: 11, color: '#94A3B8' }}>
            [ASUMSI] Nominal 90-120t (truck factor analysis)
          </div>
        </div>
        {totalSamples === 0 ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 30 }}>
            Belum ada sample payload — tunggu beberapa cycle loading.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={aggregateBins} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="bin" tick={{ fontSize: 11 }} label={{ value: 'ton', position: 'insideBottomRight', offset: -5, fontSize: 10, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip formatter={(v) => `${v} sample`} />
                <Bar dataKey="count" name="Sample count" radius={[4,4,0,0]}>
                  {aggregateBins.map((b, i) => <Cell key={i} fill={b.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: 11, color: '#64748B' }}>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#F59E0B', borderRadius: 2, marginRight: 4 }} />Underload &lt;90t</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#00875A', borderRadius: 2, marginRight: 4 }} />Nominal 90-120t</span>
              <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#C41E3A', borderRadius: 2, marginRight: 4 }} />Overload &gt;120t</span>
            </div>
          </>
        )}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 12 }}>
        {/* Production bar */}
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>BCM Target vs Aktual per Site</div>
          {productionData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 20 }}>Menunggu data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={productionData} margin={{ top: 0, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="site" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="BCM Aktual" fill="#0066CC" radius={[3,3,0,0]} />
                <Bar dataKey="BCM Target" fill="#E2E8F0" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Delay pie — dari data real */}
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>Breakdown Waktu Shift</div>
          <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 8 }}>
            Dihitung dari status_seconds aktual{db?.maintenance_pct > 0 ? ' — [ASUMSI] maint = 10% shift jika fault aktif' : ''}
          </div>
          {delayData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 30 }}>
              Menunggu data shift...
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={delayData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}
                     label={({ value }) => `${value.toFixed(1)}%`} labelLine={false} fontSize={11}>
                  {delayData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Pie>
                <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          {db && (
            <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: 11, color: '#64748B', marginTop: 4 }}>
              <span>Prod: <strong>{db.productive_minutes.toFixed(0)}m</strong></span>
              <span>Delay: <strong>{db.operational_delay_minutes.toFixed(0)}m</strong></span>
              <span>Maint: <strong>{db.maintenance_minutes.toFixed(0)}m</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Per-unit table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{
          padding: '10px 14px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Summary per Unit — Haul Truck</span>
          <button disabled style={{
            border: '1px solid #E2E8F0', borderRadius: 5, padding: '4px 12px',
            fontSize: 12, color: '#94A3B8', background: '#F8FAFC', cursor: 'not-allowed',
          }}>
            Export CSV (Coming Soon)
          </button>
        </div>
        {perUnitData.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Menunggu data haul truck...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Unit ID</th><th>Site</th><th>Cycles</th>
                <th>Avg Payload</th><th>Utilisasi%</th>
                <th>Est. Fuel [ASUMSI]</th><th>Status</th><th>Fault</th>
              </tr></thead>
              <tbody>
                {perUnitData.map(u => (
                  <tr key={u.unit_id} style={{ background: u.fault ? '#FFF5F5' : undefined }}>
                    <td style={{ fontWeight: 700 }}>{u.unit_id}</td>
                    <td style={{ fontSize: 12, color: '#64748B' }}>{u.site}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{u.cycles}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{u.payload_avg}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', color: parseFloat(u.util_pct) > 70 ? '#00875A' : '#F59E0B' }}>
                      {u.util_pct}%
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12, color: '#64748B' }}>{u.fuel_est}</td>
                    <td style={{ fontSize: 12 }}>{u.status}</td>
                    <td style={{ fontSize: 12, color: u.fault ? '#C41E3A' : '#94A3B8', fontWeight: u.fault ? 600 : 400 }}>
                      {u.fault || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: '8px 14px', fontSize: 11, color: '#CBD5E1', borderTop: '1px solid #F1F5F9' }}>
          [ASUMSI] Estimasi fuel = engine hours × 35 L/hr rata-rata. Semua BCM berdasarkan 18 BCM/cycle.
        </div>
      </div>
    </div>
  )
}
