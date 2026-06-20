function ConditionGauge({ score }) {
  const v = Math.max(0, Math.min(100, score || 0))
  const color = v >= 80 ? '#00875A' : v >= 60 ? '#F59E0B' : '#C41E3A'
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="metric-label">ROAD CONDITION SCORE</div>
      <div style={{
        margin: '8px auto 0', width: 150, height: 150, borderRadius: '50%',
        background: `conic-gradient(${color} ${v * 3.6}deg, #E2E8F0 0)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%', background: '#fff',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 36, fontWeight: 900, color, fontVariantNumeric: 'tabular-nums' }}>
            {v.toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#64748B' }}>/100</div>
        </div>
      </div>
    </div>
  )
}

function CrossSlopeIndicator({ pct }) {
  const v = pct || 0
  const offset = Math.max(-5, Math.min(5, v))
  const color = Math.abs(v) > 3 ? '#C41E3A' : Math.abs(v) > 2 ? '#F59E0B' : '#00875A'
  return (
    <div className="metric-box">
      <div className="metric-label">CROSS-SLOPE</div>
      <div style={{ position: 'relative', height: 50, marginTop: 8, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: '#94A3B8' }} />
        <div style={{
          position: 'absolute', top: 8, bottom: 8,
          left: `calc(50% + ${offset * 8}%)`,
          width: 6, background: color, borderRadius: 3,
          transform: 'translateX(-50%)',
        }} />
      </div>
      <div style={{
        textAlign: 'center', marginTop: 6, fontSize: 24, fontWeight: 800,
        color, fontVariantNumeric: 'tabular-nums',
      }}>
        {v >= 0 ? '+' : ''}{v.toFixed(2)}%
      </div>
      <div style={{ fontSize: 11, color: '#64748B', textAlign: 'center' }}>
        {Math.abs(v) > 3 ? 'OUT OF SPEC' : 'IN SPEC (±3%)'}
      </div>
    </div>
  )
}

export default function GraderDisplay({ data: d }) {
  const speed = d.current_speed_kmh || 0
  const speedOk = speed >= 8 && speed <= 15
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{d.unit_id}</div>
          <div style={{ fontSize: 12, color: '#7fa8cc' }}>Grader — {d.site_id === 'siteA' ? 'Site A' : 'Site B'}</div>
        </div>
        <span style={{
          background: d.status === 'grading' ? '#00875A' : '#475569',
          color: '#fff', borderRadius: 5, padding: '3px 10px', fontSize: 12, fontWeight: 700,
        }}>
          {d.status?.toUpperCase()}
        </span>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 11, color: '#7fa8cc' }}>SHIFT WORKED</div>
          <div style={{ fontWeight: 800, fontSize: 18, fontVariantNumeric: 'tabular-nums' }}>
            {(d.shift_hours_worked || 0).toFixed(1)}h
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: 10, minHeight: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="metric-box">
            <div className="metric-label">SEGMEN SEDANG DIKERJAKAN</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#1e3a5f', marginTop: 6 }}>
              {(d.grader_segment || '—').replace('_', ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>
              Pass ke-{d.passes_on_segment ?? 0} di segmen ini
            </div>
          </div>

          <div className="metric-box">
            <div className="metric-label">PASS COUNT</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>SHIFT INI</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#0066CC', fontVariantNumeric: 'tabular-nums' }}>
                  {d.pass_count_shift ?? 0}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>SEGMEN INI</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums' }}>
                  {d.passes_on_segment ?? 0}
                </div>
              </div>
            </div>
          </div>

          <CrossSlopeIndicator pct={d.cross_slope_pct} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="metric-box" style={{ borderLeft: `4px solid ${speedOk ? '#00875A' : '#F59E0B'}` }}>
            <div className="metric-label">SPEED (HARUS KONSTAN 8-15 km/h)</div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <div style={{
                fontSize: 56, fontWeight: 900, fontVariantNumeric: 'tabular-nums',
                color: speedOk ? '#00875A' : '#F59E0B',
              }}>
                {speed.toFixed(1)}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>km/h</div>
            </div>
            {!speedOk && d.status === 'grading' && (
              <div style={{
                marginTop: 6, fontSize: 12, color: '#92400E', textAlign: 'center', fontWeight: 700,
              }}>
                {speed < 8 ? 'TERLALU LAMBAT' : 'TERLALU CEPAT'} — pertahankan ritme
              </div>
            )}
          </div>

          <ConditionGauge score={d.road_condition_score} />

          <div className="metric-box">
            <div className="metric-label" style={{ marginBottom: 10 }}>STATUS MESIN</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
              {[
                { label: 'Fuel', value: d.fuel_level_pct, unit: '%', lowGood: true },
                { label: 'Engine Load', value: d.engine_load_pct, unit: '%' },
                { label: 'Coolant', value: d.coolant_temp_c, unit: '°C', thresh: [95, 100] },
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
                    <div style={{ fontSize: 24, fontWeight: 800, color, fontVariantNumeric: 'tabular-nums' }}>
                      {v.toFixed(1)}
                    </div>
                    <div style={{ fontSize: 11, color: '#94A3B8' }}>{m.unit}</div>
                  </div>
                )
              })}
            </div>
          </div>

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
