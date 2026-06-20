import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import KPICard from '../components/KPICard.jsx'
import FleetMapGL from '../components/map/FleetMapGL.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import AlertFeed from '../components/AlertFeed.jsx'
import { fetchProductionKPI, fetchInstructions } from '../api.js'

function formatLastUpdate(ts) {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 5) return 'baru saja'
  if (diff < 60) return `${diff}d lalu`
  return `${Math.floor(diff / 60)}m lalu`
}

export default function FleetOverview({ units, metricsOverall, metricsBySite, alerts, siteFilter }) {
  const [kpi, setKpi] = useState(null)
  const location = useLocation()
  const [forbiddenBanner, setForbiddenBanner] = useState(location.state?.forbidden ? location.state.attemptedPath : null)

  useEffect(() => {
    if (forbiddenBanner) {
      const t = setTimeout(() => setForbiddenBanner(null), 5000)
      return () => clearTimeout(t)
    }
  }, [forbiddenBanner])

  const [pendingByUnit, setPendingByUnit] = useState({})

  useEffect(() => {
    fetchProductionKPI().then(d => d && setKpi(d))
    const reloadInst = async () => {
      const items = await fetchInstructions()
      const map = {}
      if (Array.isArray(items)) {
        for (const i of items) {
          if (i.status === 'sent') map[i.unit_id] = (map[i.unit_id] || 0) + 1
        }
      }
      setPendingByUnit(map)
    }
    reloadInst()
    const iv = setInterval(() => {
      fetchProductionKPI().then(d => d && setKpi(d))
      reloadInst()
    }, 10000)
    return () => clearInterval(iv)
  }, [])

  const filtered = siteFilter === 'all' ? units : units.filter(u => u.site_id === siteFilter)
  const avgFuel = filtered.length > 0
    ? (filtered.reduce((s, u) => s + (u.fuel_level_pct || 0), 0) / filtered.length).toFixed(1)
    : '—'

  const utilizationData = [
    { name: 'Utilisasi', value: metricsOverall?.utilization_pct || 0, fill: '#0066CC' },
    { name: 'Idle', value: metricsOverall?.idle_pct || 0, fill: '#F59E0B' },
  ]

  const siteCompare = Object.entries(metricsBySite || {}).map(([site, m]) => ({
    site: site === 'siteA' ? 'Site A' : 'Site B',
    utilization: m.utilization_pct || 0,
    idle: m.idle_pct || 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {forbiddenBanner && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#991B1B',
          borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span>🔒</span>
          <span>Akses ditolak ke <code style={{ background: '#fff', padding: '1px 6px', borderRadius: 3 }}>{forbiddenBanner}</code> — role Anda tidak memiliki izin admin.</span>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard
          title="Total BCM Shift"
          value={kpi ? kpi.total_bcm_shift.toLocaleString() : '—'}
          unit="BCM"
          subtitle={`Target: ${kpi ? kpi.target_bcm_shift.toLocaleString() : '—'} BCM`}
          color="#0066CC"
          note="[ASUMSI] 18 BCM/cycle"
        />
        <KPICard
          title="Fleet Utilization"
          value={metricsOverall?.utilization_pct ?? '—'}
          unit="%"
          subtitle={`Idle: ${metricsOverall?.idle_pct ?? '—'}%`}
          color="#00875A"
        />
        <KPICard
          title="Unit Aktif"
          value={metricsOverall?.active_units ?? '—'}
          unit="unit"
          subtitle={`Haul trucks: ${units.filter(u => u.unit_type === 'haul_truck').length}`}
          color="#7C3AED"
        />
        <KPICard
          title="Avg Fuel Level"
          value={avgFuel}
          unit="%"
          subtitle={`${filtered.filter(u => u.fuel_level_pct < 20).length} unit perlu refuel`}
          color={parseFloat(avgFuel) < 30 ? '#C41E3A' : '#F59E0B'}
        />
      </div>

      {/* Production KPI Row */}
      {kpi && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <KPICard title="BCM/Hour" value={kpi.bcm_per_hour} unit="BCM/hr" subtitle={`Target: ${kpi.target_bcm_per_hour}`} color="#0066CC" note="[ASUMSI]" />
          <KPICard title="Availability" value={kpi.fleet_availability_pct} unit="%" subtitle="Unit tanpa fault / total" color="#00875A" note="[ASUMSI]" />
          <KPICard title="Use of Availability" value={kpi.uoa_pct} unit="%" subtitle="Utilisasi / Availability" color="#7C3AED" note="[ASUMSI] UoA%" />
          <KPICard title="Total Cycles" value={kpi.total_cycles} unit="cycles" subtitle={`Shift: ${kpi.shift_elapsed_hours?.toFixed(1)}h elapsed`} color="#0066CC" />
        </div>
      )}

      {/* Map + Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        {/* Map */}
        <div className="card" style={{ padding: 0, overflow: 'hidden', height: 380 }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
            Live Fleet Map
          </div>
          <div style={{ height: 340 }}>
            <FleetMapGL units={filtered} height={340} pendingByUnit={pendingByUnit} />
          </div>
        </div>

        {/* Charts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Utilization Radial */}
          <div className="card" style={{ padding: '12px 14px', flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Utilisasi vs Idle Fleet</div>
            <ResponsiveContainer width="100%" height={130}>
              <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="90%" data={utilizationData}>
                <RadialBar dataKey="value" cornerRadius={4} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>

          {/* Site comparison */}
          <div className="card" style={{ padding: '12px 14px', flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Perbandingan Antar Site</div>
            <ResponsiveContainer width="100%" height={130}>
              <BarChart data={siteCompare} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="site" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                <Tooltip formatter={(v) => `${v.toFixed(1)}%`} />
                <Bar dataKey="utilization" name="Utilisasi%" fill="#0066CC" radius={[3,3,0,0]} />
                <Bar dataKey="idle" name="Idle%" fill="#F59E0B" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Bottom row: table + alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        {/* Fleet table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
            Status Seluruh Unit ({filtered.length})
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
              Menunggu data telemetry...
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Unit ID</th>
                    <th>Tipe</th>
                    <th>Site</th>
                    <th>Status</th>
                    <th>Fuel%</th>
                    <th>Cycles</th>
                    <th>Speed</th>
                    <th>Payload</th>
                    <th>Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => (
                    <tr key={u.unit_id} style={{ background: u.fault_code ? '#FFF5F5' : undefined }}>
                      <td style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                        {u.unit_id}
                        {u.fault_code && <span style={{ color: '#C41E3A', marginLeft: 4, fontSize: 10 }}>⚠</span>}
                      </td>
                      <td style={{ color: '#64748B', fontSize: 12 }}>{u.unit_type}</td>
                      <td style={{ color: '#64748B', fontSize: 12 }}>{u.site_id === 'siteA' ? 'Site A' : 'Site B'}</td>
                      <td><StatusBadge status={u.status} /></td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: u.fuel_level_pct < 20 ? '#C41E3A' : undefined }}>
                        {u.fuel_level_pct?.toFixed(1)}%
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>{u.cycle_count ?? '—'}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums', color: u.speed_violation?.violated ? '#C41E3A' : undefined }}>
                        {u.current_speed_kmh != null ? `${u.current_speed_kmh.toFixed(0)} km/h` : '—'}
                      </td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {u.payload_ton != null && u.payload_ton > 0 ? `${u.payload_ton.toFixed(1)}t` : '—'}
                      </td>
                      <td style={{ color: '#94A3B8', fontSize: 12 }}>{formatLastUpdate(u.last_update)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Alert feed */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
            Alert Feed ({alerts.length})
          </div>
          <AlertFeed alerts={alerts} />
        </div>
      </div>
    </div>
  )
}
