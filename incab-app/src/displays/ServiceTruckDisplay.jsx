import Gauge from '../shared/Gauge.jsx'
import MetricTile from '../shared/MetricTile.jsx'
import { useTheme } from '../shared/theme.jsx'

export default function ServiceTruckDisplay({ data: d }) {
  const { palette } = useTheme()
  const fuelTank = d.fuel_level_pct ?? 0
  const fuelStatus = fuelTank < 20 ? 'crit' : fuelTank < 35 ? 'warn' : 'ok'
  const isFuelTask = d.assignment_task === 'fuel'
  const taskColor = isFuelTask ? palette.accent : '#A855F7'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, color: palette.text }}>
      <div style={{
        background: palette.panel, border: `1px solid ${palette.border}`,
        borderRadius: 10, padding: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Gauge
          value={fuelTank} min={0} max={100} unit="%" label="FUEL TANK"
          size={240}
          zones={[
            { from: 0, to: 20, color: palette.crit },
            { from: 20, to: 35, color: palette.warn },
            { from: 35, to: 100, color: palette.ok },
          ]}
          subtitle={`${d.fuel_delivered_l_shift?.toFixed(0) ?? 0} L delivered`}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <CurrentAssignment d={d} color={taskColor} palette={palette} />
          <Stat label="UNITS SERVICED" value={d.units_serviced_shift ?? 0} unit="shift" palette={palette} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        <MetricTile label="Fuel Tank" value={fuelTank.toFixed(0)} unit="%" status={fuelStatus} />
        <MetricTile label="DEF Level" value={d.def_level_pct_st?.toFixed(0)} unit="%" sim
          status={d.def_level_pct_st < 25 ? 'warn' : 'ok'} />
        <MetricTile label="Oil Level" value={d.oil_level_pct?.toFixed(0)} unit="%" sim
          status={d.oil_level_pct < 30 ? 'warn' : 'ok'} />
        <MetricTile label="Grease Level" value={d.grease_level_pct?.toFixed(0)} unit="%" sim
          status={d.grease_level_pct < 30 ? 'warn' : 'ok'} />
        <MetricTile label="Engine RPM" value={d.engine_rpm} unit="rpm" sim />
        <MetricTile label="Engine Load" value={d.engine_load_pct?.toFixed(0)} unit="%" />
        <MetricTile label="Coolant" value={d.coolant_temp_c?.toFixed(1)} unit="°C"
          status={d.coolant_temp_c > 100 ? 'crit' : 'ok'} />
        <MetricTile label="Speed" value={d.current_speed_kmh?.toFixed(0) || 0} unit="km/h" />
      </div>

      <ServiceQueuePanel queue={d.service_queue || []} palette={palette} />
    </div>
  )
}

function Stat({ label, value, unit, palette }) {
  return (
    <div style={{
      background: palette.panelAlt, border: `1px solid ${palette.border}`,
      borderLeft: `5px solid ${palette.accent}`, borderRadius: 6, padding: '8px 14px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: palette.textDim, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  )
}

function CurrentAssignment({ d, color, palette }) {
  if (!d.assignment_unit) {
    return (
      <div style={{
        background: palette.panelAlt, border: `1px solid ${palette.border}`,
        borderRadius: 6, padding: '10px 14px', fontSize: 14, color: palette.textDim,
      }}>
        No assignment
      </div>
    )
  }
  return (
    <div style={{
      background: palette.panelAlt, border: `2px solid ${color}`,
      borderRadius: 6, padding: '10px 14px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        Current Assignment
      </div>
      <div style={{ fontSize: 28, fontWeight: 900, color, marginTop: 2, lineHeight: 1 }}>
        → {d.assignment_unit}
      </div>
      <div style={{ fontSize: 13, color: palette.text, marginTop: 6 }}>
        {(d.assignment_task || '—').toUpperCase()} · {d.assignment_location}
      </div>
    </div>
  )
}

function ServiceQueuePanel({ queue, palette }) {
  return (
    <div style={{
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        Service Queue
        <span style={{
          marginLeft: 6, background: palette.warn + '33', color: palette.warn,
          fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
        }}>[SIM]</span>
      </div>
      {queue.length === 0 ? (
        <div style={{ fontSize: 14, color: palette.textDim }}>Queue kosong</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {queue.map((q, i) => {
            const prioColor = q.priority === 'high' ? palette.crit : q.priority === 'normal' ? palette.accent : palette.textDim
            return (
              <div key={`${q.unit_id}-${i}`} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: palette.panelAlt, borderRadius: 6, padding: '8px 12px',
              }}>
                <span style={{
                  background: prioColor, color: '#fff', padding: '2px 8px', borderRadius: 4,
                  fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                }}>{q.priority.toUpperCase()}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: palette.text }}>{q.unit_id}</div>
                  <div style={{ fontSize: 11, color: palette.textDim }}>{q.type.toUpperCase()}</div>
                </div>
                <div style={{ fontSize: 12, color: palette.textDim }}>
                  ETA {Math.floor(q.eta_s / 60)}m
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
