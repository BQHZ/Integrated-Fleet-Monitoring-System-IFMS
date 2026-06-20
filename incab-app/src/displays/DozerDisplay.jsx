function GaugeBar({ label, value, max = 100, unit = '%', warn, danger, color = '#0066CC' }) {
  const pct = Math.min(100, ((value || 0) / max) * 100)
  const barColor = danger && value >= danger ? '#C41E3A' : warn && value >= warn ? '#F59E0B' : color
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 14, fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
          {value != null ? `${Number(value).toFixed(1)}${unit}` : '—'}
        </span>
      </div>
      <div style={{ height: 12, background: '#E2E8F0', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 6, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

export default function DozerDisplay({ data: d }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>
      {/* Top bar */}
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{d.unit_id}</div>
          <div style={{ fontSize: 12, color: '#7fa8cc' }}>Dozer — {d.site_id === 'siteA' ? 'Site A' : 'Site B'}</div>
        </div>
        <span style={{ background: '#3730A3', color: '#fff', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700 }}>
          {d.status?.toUpperCase().replace('_', ' ')}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#7fa8cc' }}>SHIFT WORKED</div>
          <div style={{ fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {(d.shift_hours_worked || 0).toFixed(1)}h
          </div>
        </div>
      </div>

      {/* Main: 2x2 grid + engine row */}
      <div style={{ flex: 1, padding: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 2x2 grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>
          {/* Push cycles */}
          <div className="metric-box" style={{ borderLeft: '4px solid #0066CC' }}>
            <div className="metric-label">PUSH CYCLES</div>
            <div style={{ fontSize: 56, fontWeight: 900, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
              {d.push_cycles ?? 0}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>cycles selesai shift ini</div>
          </div>

          {/* Material moved */}
          <div className="metric-box" style={{ borderLeft: '4px solid #00875A' }}>
            <div className="metric-label">MATERIAL DIPINDAHKAN</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 44, fontWeight: 900, color: '#00875A', fontVariantNumeric: 'tabular-nums' }}>
                {d.material_moved_bcm?.toFixed(0) ?? '—'}
              </span>
              <span style={{ fontSize: 14, color: '#94A3B8' }}>BCM</span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>[ASUMSI] Estimasi material</div>
          </div>

          {/* Blade load */}
          <div className="metric-box">
            <div className="metric-label" style={{ marginBottom: 10 }}>BLADE LOAD</div>
            <GaugeBar label="Blade Load" value={d.blade_load_pct} color="#7C3AED" warn={70} danger={90} />
            <GaugeBar label="Track Slip" value={d.track_slip_pct} max={20} color="#00875A" warn={8} danger={12} unit="%" />
          </div>

          {/* Segment */}
          <div className="metric-box">
            <div className="metric-label">AREA KERJA</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f', marginTop: 8 }}>
              {d.current_segment?.replace('_', ' ').toUpperCase() || '—'}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Segmen aktif</div>
            {d.status === 'idle' && (
              <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '6px 10px', marginTop: 8, fontSize: 13, fontWeight: 700, color: '#92400E' }}>
                IDLE — Menunggu penugasan
              </div>
            )}
          </div>
        </div>

        {/* Engine status row */}
        <div className="metric-box">
          <div className="metric-label" style={{ marginBottom: 10 }}>STATUS MESIN</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Fuel', value: d.fuel_level_pct, unit: '%', warn: 30, danger: 20 },
              { label: 'Engine Load', value: d.engine_load_pct, unit: '%', warn: 85, danger: 95 },
              { label: 'Coolant °C', value: d.coolant_temp_c, max: 120, unit: '°C', warn: 95, danger: 100 },
              { label: 'Oil Bar', value: d.oil_pressure_bar, max: 6, unit: ' bar', warn: 3.8, danger: 3.5 },
            ].map(m => {
              const color = m.danger && m.value <= m.danger && m.label === 'Oil Bar' ? '#C41E3A'
                : m.danger && m.value >= m.danger ? '#C41E3A'
                : m.warn && m.value <= m.warn && m.label === 'Oil Bar' ? '#F59E0B'
                : m.warn && m.value >= m.warn ? '#F59E0B' : '#00875A'
              return (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                    {m.value?.toFixed(1) ?? '—'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.unit}</div>
                </div>
              )
            })}
          </div>
        </div>

        {d.fault_code && <div className="fault-box">FAULT: {d.fault_code}</div>}
      </div>

      <div style={{ background: '#1e3a5f', color: '#7fa8cc', fontSize: 11, padding: '5px 16px', display: 'flex', justifyContent: 'space-between' }}>
        <span>Jam Mesin: {d.engine_hours?.toFixed(0)} jam</span>
        <span>v3 — [ASUMSI demo data]</span>
        <span>{new Date().toLocaleTimeString('id-ID')}</span>
      </div>
    </div>
  )
}
