export default function ServiceTruckDisplay({ data: d }) {
  const isFuel = d.assignment_task === 'fuel'
  const taskColor = isFuel ? '#0066CC' : '#7C3AED'
  const taskLabel = isFuel ? 'FUEL DELIVERY' : 'SERVICE / MAINTENANCE'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#F8FAFC' }}>
      <div className="topbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{d.unit_id}</div>
          <div style={{ fontSize: 12, color: '#7fa8cc' }}>Service Truck — {d.site_id === 'siteA' ? 'Site A' : 'Site B'}</div>
        </div>
        <span style={{
          background: d.status === 'servicing' ? '#00875A' : d.status === 'travelling' ? '#0066CC' : '#475569',
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
          <div className="metric-box" style={{ borderLeft: `6px solid ${taskColor}`, background: '#fff' }}>
            <div className="metric-label">PROCEED TO</div>
            <div style={{ fontSize: 44, fontWeight: 900, color: '#1e3a5f', marginTop: 6, lineHeight: 1 }}>
              {d.assignment_unit || '—'}
            </div>
            <div style={{ marginTop: 10, fontSize: 14, color: '#475569' }}>
              <strong>Lokasi:</strong> {d.assignment_location || '—'}
            </div>
            <div style={{
              marginTop: 12, display: 'inline-block', background: taskColor, color: '#fff',
              padding: '6px 14px', borderRadius: 6, fontWeight: 800, fontSize: 14,
            }}>
              {taskLabel}
            </div>
          </div>

          <div className="metric-box">
            <div className="metric-label">SHIFT PERFORMANCE</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>UNITS SERVICED</div>
                <div style={{ fontSize: 40, fontWeight: 900, color: '#00875A', fontVariantNumeric: 'tabular-nums' }}>
                  {d.units_serviced_shift ?? 0}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#64748B', fontWeight: 600 }}>FUEL DELIVERED</div>
                <div style={{ fontSize: 30, fontWeight: 900, color: '#0066CC', fontVariantNumeric: 'tabular-nums' }}>
                  {(d.fuel_delivered_l_shift ?? 0).toFixed(0)}
                </div>
                <div style={{ fontSize: 11, color: '#94A3B8' }}>liter shift ini</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="metric-box">
            <div className="metric-label">SPEED</div>
            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <div style={{
                fontSize: 56, fontWeight: 900, color: '#1e3a5f', fontVariantNumeric: 'tabular-nums',
              }}>
                {(d.current_speed_kmh || 0).toFixed(1)}
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8' }}>km/h</div>
            </div>
          </div>

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
