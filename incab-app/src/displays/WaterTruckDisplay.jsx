function TankVisual({ pct }) {
  const level = Math.max(0, Math.min(100, pct || 0))
  const color = level > 50 ? '#0066CC' : level > 20 ? '#F59E0B' : '#C41E3A'
  const critial = level < 15

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <div className="metric-label">LEVEL TANGKI</div>
      {/* Tank container */}
      <div style={{
        width: 100, height: 180, border: `3px solid ${color}`,
        borderRadius: '8px 8px 4px 4px', position: 'relative',
        overflow: 'hidden', background: '#F8FAFC',
      }}>
        {/* Water fill */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          height: `${level}%`, background: color + 'CC',
          transition: 'height 0.5s',
        }} />
        {/* Percentage text */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontWeight: 900, fontSize: 24, fontVariantNumeric: 'tabular-nums',
          color: level > 40 ? '#fff' : color,
          textShadow: level > 40 ? '0 1px 2px rgba(0,0,0,0.3)' : 'none',
        }}>
          {level.toFixed(0)}%
        </div>
      </div>
      {critial && (
        <div className="fault-box" style={{ fontSize: 13, padding: '8px 16px' }}>
          REFILL SEGERA
        </div>
      )}
    </div>
  )
}

export default function WaterTruckDisplay({ data: d }) {
  const isSpraying = d.status === 'spraying'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>
      {/* Top bar */}
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{d.unit_id}</div>
          <div style={{ fontSize: 12, color: '#7fa8cc' }}>Water Truck — {d.site_id === 'siteA' ? 'Site A' : 'Site B'}</div>
        </div>
        <span style={{
          background: isSpraying ? '#155E75' : '#475569',
          color: '#fff', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700,
        }}>
          {d.status?.toUpperCase().replace('_', ' ')}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#7fa8cc' }}>SHIFT WORKED</div>
          <div style={{ fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {(d.shift_hours_worked || 0).toFixed(1)}h
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, padding: 10, minHeight: 0 }}>
        {/* Left: Tank visual */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
          <TankVisual pct={d.tank_level_pct} />
          {d.status === 'refilling' && (
            <div style={{
              background: '#EDE9FE', border: '1px solid #DDD6FE', borderRadius: 8,
              padding: '8px 14px', textAlign: 'center', color: '#5B21B6', fontWeight: 700, fontSize: 13,
            }}>
              MENGISI TANGKI...
            </div>
          )}
        </div>

        {/* Right: Spraying stats + engine */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Spray stats */}
          <div className="metric-box" style={{ borderLeft: `4px solid ${isSpraying ? '#155E75' : '#E2E8F0'}` }}>
            <div className="metric-label">SPRAY STATISTICS</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>SPRAY RATE</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: isSpraying ? '#155E75' : '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
                  {isSpraying ? (d.spray_rate_l_min?.toFixed(0) ?? '0') : '0'}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>L/menit</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>KM COVERED</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>
                  {(d.km_covered_shift || 0).toFixed(1)}
                </div>
                <div style={{ fontSize: 12, color: '#94A3B8' }}>km shift ini</div>
              </div>
            </div>
          </div>

          {/* Current segment */}
          <div className="metric-box">
            <div className="metric-label">SEGMEN ROAD</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: '#1e3a5f', marginTop: 6 }}>
              {d.current_road_segment?.replace('_', ' ').toUpperCase() || '—'}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>Segmen yang sedang dikerjakan</div>
          </div>

          {/* Engine */}
          <div className="metric-box">
            <div className="metric-label" style={{ marginBottom: 10 }}>STATUS MESIN</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Fuel', value: d.fuel_level_pct, unit: '%', danger: '#C41E3A', warn: '#F59E0B', lowGood: true },
                { label: 'Engine Load', value: d.engine_load_pct, unit: '%', danger: '#C41E3A', warn: '#F59E0B' },
                { label: 'Coolant °C', value: d.coolant_temp_c, unit: '°C', danger: '#C41E3A', warn: '#F59E0B', thresh: [95, 100] },
              ].map(m => {
                const v = m.value || 0
                const color = m.thresh
                  ? v > m.thresh[1] ? '#C41E3A' : v > m.thresh[0] ? '#F59E0B' : '#00875A'
                  : m.lowGood
                    ? v < 20 ? '#C41E3A' : v < 30 ? '#F59E0B' : '#00875A'
                    : v > 90 ? '#C41E3A' : v > 75 ? '#F59E0B' : '#00875A'
                return (
                  <div key={m.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 26, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                      {v.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.unit}</div>
                  </div>
                )
              })}
            </div>
          </div>

          {d.fault_code && <div className="fault-box">FAULT: {d.fault_code}</div>}

          {(d.alerts || []).length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {d.alerts.slice(0, 2).map((a, i) => (
                <div key={i} className="alert-box" style={{ fontSize: 12 }}>{a.message}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ background: '#1e3a5f', color: '#7fa8cc', fontSize: 11, padding: '5px 16px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Jam Mesin: {d.engine_hours?.toFixed(0)} jam</span>
        <span>v3 — [ASUMSI demo data]</span>
        <span>{new Date().toLocaleTimeString('id-ID')}</span>
      </div>
    </div>
  )
}
