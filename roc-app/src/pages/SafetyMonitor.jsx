import { useEffect, useState } from 'react'
import { fetchSafetyEvents } from '../api.js'
import KPICard from '../components/KPICard.jsx'

function relativeTime(ts) {
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60) return `${diff}d lalu`
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`
  return new Date(ts * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

const EVENT_LABEL = {
  speed_violation: 'Overspeed',
  fault: 'Fault Code',
  fuel_low: 'Fuel Rendah',
  idle_excess: 'Idle Berlebih',
  coolant_high: 'Coolant Tinggi',
  harsh_brake: 'Harsh Brake',
  no_go_zone: 'No-Go Zone',
  fatigue: 'Fatigue Alert',
  near_miss: 'Near-Miss',
}

const EVENT_BADGE = {
  speed_violation: { bg: '#FEF3C7', fg: '#92400E' },
  fault: { bg: '#FEE2E2', fg: '#991B1B' },
  harsh_brake: { bg: '#FED7AA', fg: '#9A3412' },
  no_go_zone: { bg: '#FEE2E2', fg: '#991B1B' },
  fatigue: { bg: '#EDE9FE', fg: '#5B21B6' },
  near_miss: { bg: '#FCE7F3', fg: '#9D174D' },
  coolant_high: { bg: '#FFEDD5', fg: '#9A3412' },
  fuel_low: { bg: '#FEF9C3', fg: '#854D0E' },
}

const SEV_ORDER = { high: 0, medium: 1, low: 2 }

export default function SafetyMonitor({ units, safetyEvents: wsSafetyEvents = [], siteFilter }) {
  const [events, setEvents] = useState([])
  const [filterType, setFilterType] = useState('all')
  const [filterSev, setFilterSev] = useState('all')

  useEffect(() => {
    fetchSafetyEvents().then(d => d && setEvents(d))
    const iv = setInterval(() => fetchSafetyEvents().then(d => d && setEvents(d)), 10000)
    return () => clearInterval(iv)
  }, [])

  // Merge WS events with polled
  const allEvents = events.length > 0 ? events : wsSafetyEvents

  const filtered = allEvents
    .filter(e => siteFilter === 'all' || e.site_id === siteFilter)
    .filter(e => filterType === 'all' || e.event_type === filterType)
    .filter(e => filterSev === 'all' || e.severity === filterSev)
    .sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity] || b.timestamp - a.timestamp)

  const filteredUnits = siteFilter === 'all' ? units : units.filter(u => u.site_id === siteFilter)

  const eventsForSite = allEvents.filter(e => siteFilter === 'all' || e.site_id === siteFilter)
  const countByType = (t) => eventsForSite.filter(e => e.event_type === t).length

  const speedViolations = countByType('speed_violation')
  const harshBrakes = countByType('harsh_brake')
  const noGoZone = countByType('no_go_zone')
  const nearMiss = countByType('near_miss')
  const fatigueCount = countByType('fatigue')
  const faultCount = filteredUnits.filter(u => u.fault_code).length
  const idleExcess = filteredUnits.filter(u => u.idle_seconds_this_cycle > 300).length
  const coolantHigh = filteredUnits.filter(u => u.coolant_temp_c > 100).length

  const currentInZone = filteredUnits.filter(u => u.no_go_proximity?.in_zone)

  // Operator ranking
  const operators = filteredUnits
    .filter(u => u.unit_type === 'haul_truck')
    .map(u => {
      const violations = allEvents.filter(e => e.unit_id === u.unit_id && e.event_type === 'speed_violation').length
      const brakes = allEvents.filter(e => e.unit_id === u.unit_id && e.event_type === 'harsh_brake').length
      const nogo = allEvents.filter(e => e.unit_id === u.unit_id && e.event_type === 'no_go_zone').length
      const secs = u.status_seconds || {}
      const idleS = (secs.idle || 0)
      const activeS = Object.entries(secs).filter(([k]) => k !== 'idle').reduce((s, [, v]) => s + v, 0)
      const total = idleS + activeS
      const util = total > 0 ? (activeS / total * 100) : 0
      // [ASUMSI] formula: utilization weight 0.7 + cycles bonus − speed/brake/nogo penalty
      const score = Math.max(0, Math.min(100, Math.round(
        util * 0.7 + u.cycle_count * 2 - violations * 10 - brakes * 8 - nogo * 15
      )))
      return {
        unit_id: u.unit_id, cycles: u.cycle_count, utilization: util.toFixed(1),
        violations, brakes, nogo, score,
      }
    })
    .sort((a, b) => b.score - a.score)

  const SPEED_ZONES = [
    { segment: 'Haul Road Main', limit: 40 },
    { segment: 'Pit Access', limit: 25 },
    { segment: 'Loading Zone', limit: 15 },
    { segment: 'Dump Area', limit: 15 },
  ]

  const currentViolators = filteredUnits.filter(u => u.speed_violation?.violated)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Safety KPIs — 2 baris × 4 kolom */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard title="Speed Violations" value={speedViolations} unit="events" color="#C41E3A"
          subtitle="Overspeed terdeteksi shift ini" />
        <KPICard title="Harsh Brake" value={harshBrakes} unit="events" color="#9A3412"
          subtitle="Deselerasi >0.4g [ASUMSI MPU6050]" />
        <KPICard title="No-Go Zone" value={noGoZone} unit="events" color="#C41E3A"
          subtitle={currentInZone.length > 0 ? `${currentInZone.length} unit DI DALAM zona sekarang` : 'Pelanggaran zona terlarang'} />
        <KPICard title="Near-Miss" value={nearMiss} unit="events" color="#9D174D"
          subtitle="Jarak antar truk <30m [ASUMSI]" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        <KPICard title="Fatigue Alert" value={fatigueCount} unit="events" color="#5B21B6"
          subtitle="Operator >7 jam consecutive [ASUMSI]" />
        <KPICard title="Active Fault Codes" value={faultCount} unit="unit" color="#C41E3A"
          subtitle="Unit dengan fault aktif" />
        <KPICard title="Idle >5 Menit" value={idleExcess} unit="unit" color="#F59E0B"
          subtitle="Idle berlebih perlu penugasan" />
        <KPICard title="Coolant Alert" value={coolantHigh} unit="unit" color="#F59E0B"
          subtitle="Coolant temp >100°C [ASUMSI]" />
      </div>

      {/* Live no-go proximity panel — hanya muncul saat ada pelanggaran */}
      {currentInZone.length > 0 && (
        <div className="card" style={{
          padding: '12px 14px', border: '1px solid #FCA5A5', background: '#FEF2F2',
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: '#991B1B', marginBottom: 8 }}>
            ⚠ Live: {currentInZone.length} Unit Di Dalam No-Go Zone
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {currentInZone.map(u => (
              <div key={u.unit_id} style={{
                background: '#fff', border: '1px solid #FCA5A5', borderRadius: 6, padding: '6px 12px',
                fontSize: 12,
              }}>
                <strong>{u.unit_id}</strong> · {u.no_go_proximity.zone_name}
                <span style={{ color: '#94A3B8', marginLeft: 6 }}>({u.no_go_proximity.distance_m}m)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Speed zones + violators */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Zona Kecepatan — Batas per Segmen</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SPEED_ZONES.map(z => {
              const violators = currentViolators.filter(u => u.road_segment === z.segment.toLowerCase().replace(/ /g, '_'))
              return (
                <div key={z.segment} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 12px', background: violators.length > 0 ? '#FEF2F2' : '#F8FAFC',
                  borderRadius: 6, border: `1px solid ${violators.length > 0 ? '#FCA5A5' : '#E2E8F0'}`,
                }}>
                  <span style={{ fontSize: 13, color: '#1e293b' }}>{z.segment}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#1e3a5f' }}>{z.limit} km/h</span>
                    {violators.length > 0 && (
                      <span style={{ background: '#C41E3A', color: '#fff', borderRadius: 4, padding: '1px 6px', fontSize: 11, fontWeight: 600 }}>
                        {violators.length} VIOLATION
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Operator ranking */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
            Operator Performance Ranking — Shift Ini
            <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 6 }}>[ASUMSI scoring formula]</span>
          </div>
          {operators.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Menunggu data...</div>
          ) : (
            <table className="data-table">
              <thead><tr>
                <th>#</th><th>Unit</th><th>Cycles</th><th>Util%</th>
                <th>Speed</th><th>Brake</th><th>No-Go</th><th>Score</th>
              </tr></thead>
              <tbody>
                {operators.map((op, i) => (
                  <tr key={op.unit_id}>
                    <td style={{ color: '#94A3B8', fontWeight: 600 }}>{i + 1}</td>
                    <td style={{ fontWeight: 700 }}>{op.unit_id}</td>
                    <td>{op.cycles}</td>
                    <td>{op.utilization}%</td>
                    <td style={{ color: op.violations > 0 ? '#C41E3A' : '#00875A', fontWeight: 600 }}>
                      {op.violations}
                    </td>
                    <td style={{ color: op.brakes > 0 ? '#9A3412' : '#00875A', fontWeight: 600 }}>
                      {op.brakes}
                    </td>
                    <td style={{ color: op.nogo > 0 ? '#C41E3A' : '#00875A', fontWeight: 600 }}>
                      {op.nogo}
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 700,
                        color: op.score >= 80 ? '#00875A' : op.score >= 60 ? '#F59E0B' : '#C41E3A',
                      }}>{op.score}/100</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Event log */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Safety Event Log ({filtered.length})</span>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            style={{ border: '1px solid #E2E8F0', borderRadius: 5, padding: '3px 8px', fontSize: 12 }}>
            <option value="all">Semua Tipe</option>
            <option value="speed_violation">Overspeed</option>
            <option value="harsh_brake">Harsh Brake</option>
            <option value="no_go_zone">No-Go Zone</option>
            <option value="near_miss">Near-Miss</option>
            <option value="fatigue">Fatigue</option>
            <option value="fault">Fault</option>
            <option value="coolant_high">Coolant Tinggi</option>
            <option value="fuel_low">Fuel Rendah</option>
          </select>
          <select value={filterSev} onChange={e => setFilterSev(e.target.value)}
            style={{ border: '1px solid #E2E8F0', borderRadius: 5, padding: '3px 8px', fontSize: 12 }}>
            <option value="all">Semua Severity</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Tidak ada event</div>
        ) : (
          <div style={{ maxHeight: 320, overflowY: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Waktu</th><th>Unit</th><th>Tipe</th><th>Severity</th><th>Pesan</th>
              </tr></thead>
              <tbody>
                {filtered.slice(0, 50).map((e, i) => (
                  <tr key={i} className={`sev-${e.severity}`}>
                    <td style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {relativeTime(e.timestamp)}
                    </td>
                    <td style={{ fontWeight: 600, fontSize: 12 }}>{e.unit_id}</td>
                    <td>
                      {(() => {
                        const b = EVENT_BADGE[e.event_type] || { bg: '#F1F5F9', fg: '#475569' }
                        return (
                          <span style={{
                            background: b.bg, color: b.fg,
                            borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                          }}>
                            {EVENT_LABEL[e.event_type] || e.event_type}
                          </span>
                        )
                      })()}
                    </td>
                    <td>
                      <span style={{
                        background: e.severity === 'high' ? '#C41E3A' : e.severity === 'medium' ? '#F59E0B' : '#94A3B8',
                        color: '#fff', borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 600,
                      }}>
                        {e.severity?.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{e.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
