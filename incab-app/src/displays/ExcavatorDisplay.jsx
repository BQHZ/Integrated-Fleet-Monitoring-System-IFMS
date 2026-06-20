function GaugeBar({ label, value, max = 100, unit = '', warn, danger, color = '#0066CC' }) {
  const pct = Math.min(100, ((value || 0) / max) * 100)
  const barColor = danger && value >= danger ? '#C41E3A'
    : warn && value >= warn ? '#F59E0B' : color
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
          {value != null ? `${Number(value).toFixed(1)}${unit}` : '—'}
        </span>
      </div>
      <div style={{ height: 10, background: '#E2E8F0', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 5, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function TruckQueue({ depth }) {
  const max = 5
  const color = depth === 0 ? '#00875A' : depth <= 2 ? '#F59E0B' : '#C41E3A'
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
        {Array.from({ length: max }).map((_, i) => (
          <div key={i} style={{
            width: 36, height: 36, borderRadius: 6,
            background: i < depth ? color : '#E2E8F0',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            {i < depth ? '🚛' : ''}
          </div>
        ))}
      </div>
      <div style={{ fontWeight: 700, color, fontSize: 14 }}>
        {depth} truk menunggu
        {depth === 0 && ' — Tidak ada antrian'}
        {depth >= 4 && ' — ANTRIAN PANJANG'}
      </div>
    </div>
  )
}

export default function ExcavatorDisplay({ data: d }) {
  const digColor = (d.dig_rate_bcm_hr || 0) > 350 ? '#00875A' : (d.dig_rate_bcm_hr || 0) > 280 ? '#F59E0B' : '#C41E3A'
  const hydColor = (d.hydraulic_pressure_bar || 0) > 370 ? '#C41E3A' : (d.hydraulic_pressure_bar || 0) > 350 ? '#F59E0B' : '#00875A'
  const bcmEst = ((d.bucket_swings || 0) * 12).toFixed(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFC' }}>
      {/* Top bar */}
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{d.unit_id}</div>
          <div style={{ fontSize: 12, color: '#7fa8cc' }}>Excavator — {d.site_id === 'siteA' ? 'Site A' : 'Site B'}</div>
        </div>
        <span style={{
          background: '#166534', color: '#fff',
          borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700,
        }}>{d.status?.toUpperCase().replace('_', ' ')}</span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#7fa8cc' }}>TRUCK SERVED</div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{d.trucks_served_shift ?? 0}</div>
        </div>
      </div>

      {/* Main: 2 columns */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 10, minHeight: 0 }}>

        {/* Left — Dig performance */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Dig rate */}
          <div className="metric-box" style={{ borderLeft: `4px solid ${digColor}` }}>
            <div className="metric-label">DIG RATE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 52, fontWeight: 900, color: digColor, fontVariantNumeric: 'tabular-nums' }}>
                {d.dig_rate_bcm_hr?.toFixed(0) || '—'}
              </span>
              <span style={{ fontSize: 14, color: '#94A3B8' }}>BCM/hr</span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>[ASUMSI] Target: 350 BCM/hr</div>
          </div>

          {/* Bucket swings */}
          <div className="metric-box">
            <div className="metric-label">BUCKET SWINGS</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>
              {d.bucket_swings ?? 0}
            </div>
            <div style={{ fontSize: 12, color: '#64748B' }}>
              Est. BCM loaded: <strong>{bcmEst} BCM</strong>
              <span style={{ fontSize: 10, color: '#CBD5E1', marginLeft: 4 }}>[ASUMSI 12 BCM/swing]</span>
            </div>
          </div>

          {/* Hydraulic */}
          <div className="metric-box" style={{ borderLeft: `4px solid ${hydColor}` }}>
            <div className="metric-label">HYDRAULIC PRESSURE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 36, fontWeight: 800, color: hydColor, fontVariantNumeric: 'tabular-nums' }}>
                {d.hydraulic_pressure_bar?.toFixed(0) || '—'}
              </span>
              <span style={{ fontSize: 14, color: '#94A3B8' }}>bar</span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>[ASUMSI] Normal: &lt;350 bar</div>
            {(d.hydraulic_pressure_bar || 0) > 370 && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', borderRadius: 5, padding: '4px 8px', marginTop: 6, fontSize: 12, fontWeight: 700 }}>
                TEKANAN TINGGI — Cek hydraulic!
              </div>
            )}
          </div>

          {/* Swing angle */}
          <div className="metric-box">
            <div className="metric-label">SWING ANGLE</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#1e3a5f' }}>
                {d.swing_angle_deg?.toFixed(0) || '—'}
              </span>
              <span style={{ fontSize: 14, color: '#94A3B8' }}>°</span>
            </div>
            <div style={{ fontSize: 11, color: '#94A3B8' }}>90° = posisi optimal</div>
          </div>
        </div>

        {/* Right — Queue & Production */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Queue */}
          <div className="metric-box" style={{ flex: 1 }}>
            <div className="metric-label" style={{ marginBottom: 10 }}>ANTRIAN TRUK</div>
            <TruckQueue depth={d.queue_depth || 0} />
          </div>

          {/* Idle waiting */}
          {(d.idle_waiting_seconds || 0) > 0 && (
            <div className="metric-box" style={{
              borderLeft: `4px solid ${(d.idle_waiting_seconds || 0) > 120 ? '#C41E3A' : '#F59E0B'}`,
              background: (d.idle_waiting_seconds || 0) > 120 ? '#FFF5F5' : '#FFFBEB',
            }}>
              <div className="metric-label">IDLE MENUNGGU TRUK</div>
              <div style={{ fontSize: 32, fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: '#C41E3A' }}>
                {Math.round(d.idle_waiting_seconds || 0)}s
              </div>
              {(d.idle_waiting_seconds || 0) > 120 && (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#C41E3A' }}>
                  Excavator idle terlalu lama — Dispatch truk!
                </div>
              )}
            </div>
          )}

          {/* Production target */}
          <div className="metric-box">
            <div className="metric-label">TARGET PRODUKSI</div>
            <div style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>Truk dilayani</span>
                <span style={{ fontWeight: 700 }}>{d.trucks_served_shift ?? 0} / 40 <span style={{ fontSize: 10, color: '#CBD5E1' }}>[ASUMSI]</span></span>
              </div>
              <div style={{ height: 8, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, ((d.trucks_served_shift || 0) / 40) * 100)}%`,
                  height: '100%', background: '#0066CC', borderRadius: 4,
                }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                <span style={{ fontSize: 12, color: '#64748B' }}>Est. BCM shift</span>
                <span style={{ fontWeight: 700 }}>{bcmEst} BCM</span>
              </div>
              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>[ASUMSI] Target: 800 BCM/shift</div>
            </div>
          </div>

          {/* Engine health */}
          <div className="metric-box">
            <div className="metric-label" style={{ marginBottom: 8 }}>STATUS MESIN</div>
            <GaugeBar label="Fuel" value={d.fuel_level_pct} color="#0066CC" warn={30} danger={20} unit="%" />
            <GaugeBar label="Engine Load" value={d.engine_load_pct} color="#7C3AED" warn={85} danger={95} unit="%" />
            <GaugeBar label="Coolant" value={d.coolant_temp_c} max={120} unit="°C" warn={95} danger={100} />
          </div>

          {/* Fault */}
          {d.fault_code && <div className="fault-box">FAULT: {d.fault_code}</div>}
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
