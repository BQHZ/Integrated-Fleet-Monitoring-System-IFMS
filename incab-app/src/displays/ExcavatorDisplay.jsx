import Gauge from '../shared/Gauge.jsx'
import MetricTile from '../shared/MetricTile.jsx'
import { useTheme } from '../shared/theme.jsx'

export default function ExcavatorDisplay({ data: d }) {
  const { palette } = useTheme()

  // Swing angle (optimal 90° per spec — visual gauge)
  const swing = d.swing_angle_deg ?? 90  // simulator has it but may not always be present
  const hydraulicTemp = d.hydraulic_oil_temp_c ?? 75
  const hydraulicTempStatus = hydraulicTemp > 90 ? 'crit' : hydraulicTemp > 85 ? 'warn' : 'ok'
  const hydPress = d.hydraulic_pressure_bar
  const pressStatus = hydPress > 370 ? 'crit' : hydPress > 350 ? 'warn' : 'ok'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, color: palette.text }}>
      <div style={{
        background: palette.panel, border: `1px solid ${palette.border}`,
        borderRadius: 10, padding: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Gauge
          value={swing} min={0} max={180} unit="°" label="SWING ANGLE"
          size={240}
          zones={[
            { from: 75, to: 105, color: palette.ok },
            { from: 105, to: 135, color: palette.warn },
            { from: 135, to: 180, color: palette.crit },
          ]}
          subtitle="Optimal 90°"
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stat label="DIG RATE" value={d.dig_rate_bcm_hr?.toFixed(0) || '—'} unit="BCM/hr" palette={palette} />
          <Stat label="TRUCKS LOADED" value={d.trucks_served_shift ?? 0} unit="this shift" palette={palette} />
          <Stat label="STATUS" value={d.status?.toUpperCase().replace('_', ' ') || '—'} unit="" palette={palette} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MetricTile label="Boom Cyl" value={d.boom_pressure_bar?.toFixed(0)} unit="bar" sim
          status={d.boom_pressure_bar > 280 ? 'warn' : 'ok'} />
        <MetricTile label="Arm Cyl" value={d.arm_pressure_bar?.toFixed(0)} unit="bar" sim
          status={d.arm_pressure_bar > 260 ? 'warn' : 'ok'} />
        <MetricTile label="Bucket Cyl" value={d.bucket_pressure_bar?.toFixed(0)} unit="bar" sim
          status={d.bucket_pressure_bar > 260 ? 'warn' : 'ok'} />
        <MetricTile label="Hydraulic Temp" value={hydraulicTemp.toFixed(1)} unit="°C" status={hydraulicTempStatus} sim />
        <MetricTile label="Hyd Pressure" value={hydPress?.toFixed(0) || '—'} unit="bar" status={pressStatus} />
        <MetricTile label="Engine RPM" value={d.engine_rpm} unit="rpm" sim />
        <MetricTile label="Fuel Level" value={d.fuel_level_pct?.toFixed(0)} unit="%"
          status={d.fuel_level_pct < 20 ? 'crit' : d.fuel_level_pct < 30 ? 'warn' : 'ok'} />
        <MetricTile label="Bucket Fill" value={d.bucket_fill_factor_pct?.toFixed(0)} unit="%" sim
          hint="Target 95%+" status={d.bucket_fill_factor_pct < 80 ? 'warn' : 'ok'} />
        <MetricTile label="Avg Cycle" value={d.avg_cycle_time_s?.toFixed(1)} unit="sec" sim />
        <MetricTile label="Bucket Swings" value={d.bucket_swings ?? 0} unit="total" />
        <MetricTile label="Queue Depth" value={d.queue_depth ?? 0} unit="trucks"
          status={d.queue_depth >= 3 ? 'warn' : 'ok'} />
        <MetricTile label="Idle Waiting" value={d.idle_waiting_seconds ?? 0} unit="sec"
          status={d.idle_waiting_seconds > 60 ? 'warn' : 'ok'} />
      </div>

      <TruckQueuePanel queue={d.truck_queue || []} palette={palette} />
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
        <span style={{ fontSize: 26, fontWeight: 900, color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        <span style={{ fontSize: 12, color: palette.textDim, fontWeight: 600 }}>{unit}</span>
      </div>
    </div>
  )
}

function TruckQueuePanel({ queue, palette }) {
  return (
    <div style={{
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        Truck Queue
        <span style={{
          marginLeft: 6, background: palette.warn + '33', color: palette.warn,
          fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
        }}>[SIM]</span>
      </div>
      {queue.length === 0 ? (
        <div style={{ fontSize: 14, color: palette.textDim }}>No trucks queued</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {queue.map((t, i) => (
            <div key={t.unit_id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: palette.panelAlt, borderRadius: 6, padding: '8px 12px',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: i === 0 ? palette.accent : palette.border,
                color: '#fff', fontWeight: 900, fontSize: 14,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{i + 1}</div>
              <div style={{ flex: 1, fontWeight: 800, fontSize: 18, color: palette.text }}>
                {t.unit_id}
              </div>
              <div style={{ fontSize: 12, color: palette.textDim }}>
                ETA {Math.floor(t.eta_s / 60)}m {t.eta_s % 60}s
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
