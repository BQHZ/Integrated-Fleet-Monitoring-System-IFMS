function TopBar({ d }) {
  const statusColor = {
    loading: '#1D4ED8', hauling_loaded: '#166534', dumping: '#92400E',
    hauling_empty: '#475569', idle: '#9A3412',
  }
  const color = statusColor[d.status] || '#64748B'
  const shiftH = Math.floor(d.shift_hours_worked || 0)
  const shiftM = Math.floor(((d.shift_hours_worked || 0) - shiftH) * 60)

  return (
    <div className="topbar" style={{ justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{d.unit_id}</div>
          <div style={{ fontSize: 12, color: '#7fa8cc' }}>{d.site_id === 'siteA' ? 'Site A — MTBU' : 'Site B — ADRO'}</div>
        </div>
        <span style={{
          background: color, color: '#fff',
          borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700,
        }}>{d.status?.toUpperCase().replace('_', ' ')}</span>
      </div>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#7fa8cc' }}>SHIFT ELAPSED</div>
        <div style={{ fontWeight: 700, fontSize: 16, fontVariantNumeric: 'tabular-nums' }}>
          {String(shiftH).padStart(2,'0')}h {String(shiftM).padStart(2,'0')}m
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 11, color: '#7fa8cc' }}>CYCLES TODAY</div>
        <div style={{ fontWeight: 800, fontSize: 20 }}>{d.cycle_count ?? 0}</div>
      </div>
    </div>
  )
}

function PayloadGauge({ payload }) {
  const p = payload || 0
  const isUnder = p > 0 && p < 90
  const isOver = p > 120
  const isNominal = p >= 90 && p <= 120
  const color = isOver ? '#C41E3A' : isNominal ? '#00875A' : isUnder ? '#F59E0B' : '#94A3B8'
  const label = isOver ? 'OVERLOAD' : isNominal ? 'NOMINAL' : isUnder ? 'UNDERLOAD' : p === 0 ? 'KOSONG' : '—'

  return (
    <div className="metric-box" style={{ alignItems: 'center', padding: '20px 16px', borderColor: color, borderWidth: 2 }}>
      <div className="metric-label">PAYLOAD</div>
      <div style={{ fontSize: 64, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {p > 0 ? p.toFixed(1) : '—'}
      </div>
      <div className="metric-unit">ton</div>
      <div style={{
        marginTop: 10, padding: '5px 16px', borderRadius: 20,
        background: color + '22', color, fontWeight: 800, fontSize: 14,
      }}>
        {label}
      </div>
      {/* Payload window bar */}
      <div style={{ width: '100%', marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94A3B8', marginBottom: 3 }}>
          <span>0t</span><span>90t</span><span>120t</span><span>135t</span>
        </div>
        <div style={{ height: 10, background: '#E2E8F0', borderRadius: 5, position: 'relative', overflow: 'hidden' }}>
          {/* Nominal zone */}
          <div style={{
            position: 'absolute', left: `${(90/135)*100}%`, width: `${(30/135)*100}%`,
            height: '100%', background: '#DCFCE7',
          }} />
          {/* Payload pointer */}
          {p > 0 && (
            <div style={{
              position: 'absolute', left: `${Math.min(100, (p/135)*100)}%`,
              top: 0, width: 3, height: '100%', background: color,
              transform: 'translateX(-50%)',
            }} />
          )}
        </div>
        <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
          [ASUMSI] 90-120t nominal window
        </div>
      </div>
    </div>
  )
}

function SpeedIndicator({ speed, limit, violation }) {
  const s = speed || 0
  const l = limit || 40
  const over = violation?.violated
  const color = over ? '#C41E3A' : s > l * 0.85 ? '#F59E0B' : '#00875A'

  return (
    <div className="metric-box" style={{ borderColor: over ? '#C41E3A' : '#E2E8F0', borderWidth: over ? 2 : 1 }}>
      <div className="metric-label">KECEPATAN</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 44, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
          {s.toFixed(0)}
        </span>
        <span className="metric-unit">km/h</span>
      </div>
      <div style={{ fontSize: 12, color: '#64748B' }}>Limit: {l} km/h</div>
      {over && (
        <div className="overspeed-banner" style={{ marginTop: 8, fontSize: 13 }}>
          OVERSPEED +{violation.excess_kmh?.toFixed(1)} km/h
        </div>
      )}
    </div>
  )
}

function GaugeBar({ label, value, max = 100, color, unit = '%', warn, danger }) {
  const pct = Math.min(100, ((value || 0) / max) * 100)
  const barColor = danger && value >= danger ? '#C41E3A'
    : warn && value >= warn ? '#F59E0B'
    : color || '#0066CC'

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
          {value != null ? `${typeof value === 'number' ? value.toFixed(1) : value}${unit}` : '—'}
        </span>
      </div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${pct}%`, background: barColor }} />
      </div>
    </div>
  )
}

export default function HaulTruckDisplay({ data: d }) {
  const distStr = d.distance_to_target_m != null
    ? d.distance_to_target_m >= 1000
      ? `${(d.distance_to_target_m / 1000).toFixed(1)} km`
      : `${d.distance_to_target_m} m`
    : '—'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      <TopBar d={d} />

      {/* Main content: 3 columns */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1.1fr 0.9fr', gap: 10, padding: 10, minHeight: 0 }}>

        {/* Column 1 — Payload & Speed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <PayloadGauge payload={d.payload_ton} />
          <SpeedIndicator speed={d.current_speed_kmh} limit={d.speed_limit_kmh} violation={d.speed_violation} />
        </div>

        {/* Column 2 — Dispatch & Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Dispatch instruction */}
          <div className="metric-box" style={{ borderLeft: '4px solid #0066CC', background: '#EFF6FF' }}>
            <div className="metric-label">INSTRUKSI DISPATCH</div>
            <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>PROCEED TO →</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#1e3a5f', marginTop: 2 }}>
              {d.target_label || '—'}
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#0066CC', marginTop: 4 }}>
              {distStr}
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>
              Segmen: {d.road_segment?.replace(/_/g, ' ') || '—'}
            </div>
          </div>

          {/* Cycle info */}
          <div className="metric-box">
            <div className="metric-label">PERFORMANCE SHIFT</div>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#1e3a5f' }}>{d.cycle_count ?? 0}</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Cycles</div>
              </div>
              <div style={{ width: 1, background: '#E2E8F0' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: d.operator_score >= 80 ? '#00875A' : d.operator_score >= 60 ? '#F59E0B' : '#C41E3A' }}>
                  {d.operator_score ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Score/100</div>
              </div>
              <div style={{ width: 1, background: '#E2E8F0' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#1e3a5f' }}>
                  {d.utilization_pct?.toFixed(0) ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Util%</div>
              </div>
            </div>
          </div>

          {/* Idle time */}
          {d.idle_seconds > 60 && (
            <div style={{
              background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px',
            }}>
              <div style={{ fontWeight: 700, color: '#92400E', fontSize: 13 }}>
                IDLE {Math.round(d.idle_seconds)}s — Menunggu Instruksi
              </div>
            </div>
          )}
        </div>

        {/* Column 3 — Engine & Alerts */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="metric-box">
            <div className="metric-label" style={{ marginBottom: 10 }}>STATUS MESIN</div>
            <GaugeBar label="Fuel" value={d.fuel_level_pct} color="#0066CC" warn={30} danger={20} />
            <GaugeBar label="Engine Load" value={d.engine_load_pct} color="#7C3AED" warn={85} danger={95} />
            <GaugeBar label="Coolant °C" value={d.coolant_temp_c} max={120} color="#00875A" unit="°C" warn={95} danger={100} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{ fontSize: 12, color: '#64748B' }}>Oil Pressure</span>
              <span style={{
                fontWeight: 700, fontSize: 13, fontVariantNumeric: 'tabular-nums',
                color: (d.oil_pressure_bar || 0) < 3.5 ? '#C41E3A' : '#00875A',
              }}>
                {d.oil_pressure_bar?.toFixed(2) || '—'} bar
              </span>
            </div>
          </div>

          {/* Fault */}
          {d.fault_code && (
            <div className="fault-box">FAULT: {d.fault_code}</div>
          )}

          {/* Alerts */}
          {(d.alerts || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.alerts.slice(0, 3).map((a, i) => (
                <div key={i} className="alert-box" style={{ fontSize: 12 }}>{a.message}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        background: '#1e3a5f', color: '#7fa8cc', fontSize: 11,
        padding: '5px 16px', display: 'flex', justifyContent: 'space-between',
      }}>
        <span>Jam Mesin: {d.engine_hours?.toFixed(0)} jam</span>
        <span>Fuel: {d.fuel_level_pct?.toFixed(1)}%</span>
        <span>v3 — [ASUMSI demo data]</span>
        <span>{new Date().toLocaleTimeString('id-ID')}</span>
      </div>
    </div>
  )
}
