import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { fetchMaintenanceHealth, fetchCrossSiteBenchmark } from '../api.js'

function HealthCircle({ score }) {
  const color = score >= 80 ? '#00875A' : score >= 50 ? '#F59E0B' : '#C41E3A'
  return (
    <div style={{
      width: 48, height: 48, borderRadius: '50%',
      border: `4px solid ${color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: 14, color,
    }}>
      {score}
    </div>
  )
}

export default function Maintenance({ siteFilter }) {
  const [health, setHealth] = useState([])
  const [benchmark, setBenchmark] = useState(null)

  const reload = () => {
    fetchMaintenanceHealth().then(d => d && setHealth(d))
    fetchCrossSiteBenchmark().then(d => d && setBenchmark(d))
  }

  useEffect(() => {
    reload()
    const iv = setInterval(reload, 10000)
    return () => clearInterval(iv)
  }, [])

  const filtered = siteFilter === 'all' ? health : health.filter(h => h.site_id === siteFilter)
  const atRisk = filtered.filter(h => h.health_score < 70)

  const benchSites = benchmark?.sites || {}
  const benchData = Object.entries(benchSites).map(([site, d]) => ({
    site: site === 'siteA' ? 'Site A' : 'Site B',
    'Utilisasi%': d.avg_utilization_pct || 0,
    'Avg Cycles': d.avg_cycles_per_truck || 0,
    'MTBF (jam)': d.mtbf_hours || 0,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Health score cards */}
      <div className="card" style={{ padding: '12px 14px' }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
          Component Health Score per Unit
          <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>[ASUMSI] Score = 100 minus penalty</span>
        </div>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 24 }}>Menunggu data...</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
            {filtered.map(h => (
              <div key={h.unit_id} style={{
                border: `1px solid ${h.fault_code ? '#FCA5A5' : h.health_score < 70 ? '#FDE68A' : '#E2E8F0'}`,
                background: h.fault_code ? '#FFF5F5' : '#fff',
                borderRadius: 8, padding: '12px 14px',
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{h.unit_id}</span>
                  <HealthCircle score={h.health_score} />
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{h.unit_type} — {h.site_id === 'siteA' ? 'Site A' : 'Site B'}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{h.engine_hours?.toFixed(0)} jam mesin</div>
                {h.fault_code && (
                  <div style={{
                    background: '#C41E3A', color: '#fff',
                    borderRadius: 4, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                  }}>FAULT: {h.fault_code}</div>
                )}
                <div style={{ fontSize: 11, color: '#94A3B8' }}>
                  Service berikutnya: {h.next_service_hours?.toFixed(0)} jam
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* At-risk predictive alerts */}
      {atRisk.length > 0 && (
        <div className="card" style={{ padding: '12px 14px', border: '1px solid #FDE68A', background: '#FFFBEB' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: '#92400E' }}>
            Predictive Maintenance Alerts — {atRisk.length} Unit Berisiko
            <span style={{ fontSize: 11, color: '#B45309', marginLeft: 8 }}>[ASUMSI prediktif]</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {atRisk.map(h => (
              <div key={h.unit_id} style={{
                background: '#fff', borderRadius: 6, padding: '8px 12px',
                border: `1px solid ${h.health_score < 50 ? '#FCA5A5' : '#FDE68A'}`,
                fontSize: 13,
              }}>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{h.unit_id}</span>
                {' '}— health score <span style={{ fontWeight: 700, color: h.health_score < 50 ? '#C41E3A' : '#F59E0B' }}>{h.health_score}</span>.
                {h.fault_code && <span style={{ color: '#C41E3A' }}> Fault: {h.fault_code}.</span>}
                {' '}Perlu inspeksi sebelum shift berikutnya.
                {h.predicted_failure_hours && (
                  <span style={{ color: '#C41E3A', fontWeight: 600 }}> [ASUMSI] Estimasi failure dalam ~{h.predicted_failure_hours} jam.</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Component health table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: 600, fontSize: 13 }}>
          Detail Komponen per Unit
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>Menunggu data...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr>
                <th>Unit</th><th>Tipe</th><th>Jam Mesin</th>
                <th>Coolant °C</th><th>Oil Bar</th><th>Hydraulic Bar</th>
                <th>Tyre Life%</th><th>Next Service</th><th>Health</th><th>Fault</th>
              </tr></thead>
              <tbody>
                {filtered.map(h => (
                  <tr key={h.unit_id} style={{
                    background: h.fault_code ? '#FFF5F5' : h.health_score < 70 ? '#FFFBEB' : undefined,
                  }}>
                    <td style={{ fontWeight: 700 }}>{h.unit_id}</td>
                    <td style={{ fontSize: 12, color: '#64748B' }}>{h.unit_type}</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{h.engine_hours?.toFixed(0)}</td>
                    <td style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: h.coolant_temp_c > 100 ? '#C41E3A' : h.coolant_temp_c > 95 ? '#F59E0B' : '#00875A',
                      fontWeight: h.coolant_temp_c > 100 ? 700 : 400,
                    }}>{h.coolant_temp_c?.toFixed(1)}</td>
                    <td style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: h.oil_pressure_bar < 3.5 ? '#C41E3A' : '#00875A',
                    }}>{h.oil_pressure_bar?.toFixed(2)}</td>
                    <td style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: h.hydraulic_pressure_bar > 370 ? '#C41E3A' : h.hydraulic_pressure_bar > 350 ? '#F59E0B' : '#00875A',
                    }}>{h.hydraulic_pressure_bar?.toFixed(0) || '—'}</td>
                    <td style={{
                      fontVariantNumeric: 'tabular-nums',
                      color: h.tyre_life_remaining_pct < 20 ? '#C41E3A' : h.tyre_life_remaining_pct < 40 ? '#F59E0B' : undefined,
                    }}>{h.tyre_life_remaining_pct?.toFixed(0)}% [ASUMSI]</td>
                    <td style={{ fontVariantNumeric: 'tabular-nums' }}>{h.next_service_hours?.toFixed(0)} jam</td>
                    <td style={{
                      fontWeight: 700,
                      color: h.health_score >= 80 ? '#00875A' : h.health_score >= 50 ? '#F59E0B' : '#C41E3A',
                    }}>{h.health_score}</td>
                    <td style={{ fontSize: 12, color: '#C41E3A', fontWeight: 600 }}>{h.fault_code || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cross-site benchmark */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>
            Cross-Site Benchmark
            <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 8 }}>[ASUMSI cross-site learning]</span>
          </div>
          {benchData.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 20 }}>Menunggu data...</div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={benchData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="site" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Utilisasi%" fill="#0066CC" radius={[3,3,0,0]} />
                <Bar dataKey="Avg Cycles" fill="#00875A" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card" style={{ padding: '12px 14px' }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 12 }}>Tabel Perbandingan</div>
          {Object.keys(benchSites).length === 0 ? (
            <div style={{ textAlign: 'center', color: '#94A3B8', fontSize: 13, padding: 20 }}>Menunggu data...</div>
          ) : (
            <>
              <table className="data-table" style={{ marginBottom: 12 }}>
                <thead><tr>
                  <th>Metrik</th><th>Site A</th><th>Site B</th>
                </tr></thead>
                <tbody>
                  {[
                    ['Utilisasi %', 'avg_utilization_pct', '%'],
                    ['Avg Cycles/Truck', 'avg_cycles_per_truck', ''],
                    ['Fuel/BCM [ASUMSI]', 'fuel_l_per_bcm', ' L/BCM'],
                    ['MTBF [ASUMSI]', 'mtbf_hours', ' jam'],
                  ].map(([label, key, unit]) => {
                    const a = benchSites.siteA?.[key]
                    const b = benchSites.siteB?.[key]
                    return (
                      <tr key={key}>
                        <td style={{ fontSize: 12 }}>{label}</td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: (a > b) ? '#00875A' : '#1e293b', fontWeight: (a > b) ? 700 : 400 }}>
                          {a != null ? `${typeof a === 'number' ? a.toFixed(1) : a}${unit}` : '—'}
                        </td>
                        <td style={{ fontVariantNumeric: 'tabular-nums', color: (b > a) ? '#00875A' : '#1e293b', fontWeight: (b > a) ? 700 : 400 }}>
                          {b != null ? `${typeof b === 'number' ? b.toFixed(1) : b}${unit}` : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {benchmark?.insight && (
                <div style={{
                  background: '#EFF6FF', border: '1px solid #BFDBFE',
                  borderRadius: 6, padding: '8px 12px', fontSize: 12, color: '#1D4ED8',
                }}>
                  {benchmark.insight}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
