import Gauge from '../shared/Gauge.jsx'
import MetricTile from '../shared/MetricTile.jsx'
import { useTheme } from '../shared/theme.jsx'

export default function DozerDisplay({ data: d }) {
  const { palette } = useTheme()

  const transmissionStatus = d.transmission_temp_c > 100 ? 'crit' : d.transmission_temp_c > 90 ? 'warn' : 'ok'
  const hydraulicStatus = d.hydraulic_oil_temp_c > 95 ? 'crit' : d.hydraulic_oil_temp_c > 85 ? 'warn' : 'ok'
  const trackSlip = d.track_slip_pct ?? 0
  const slipStatus = trackSlip > 10 ? 'warn' : 'ok'

  const rpm = d.engine_rpm || 800
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, color: palette.text }}>
      <div style={{
        background: palette.panel, border: `1px solid ${palette.border}`,
        borderRadius: 10, padding: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Gauge
          value={rpm} min={500} max={2400} unit="rpm" label="ENGINE RPM"
          size={240} sim
          zones={[
            { from: 500, to: 800, color: palette.warn },
            { from: 800, to: 2000, color: palette.ok },
            { from: 2000, to: 2400, color: palette.crit },
          ]}
          subtitle={d.status?.toUpperCase()}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stat label="TASK" value={d.status === 'pushing' ? 'PUSH GRADE' : d.status === 'repositioning' ? 'REPOSITIONING' : 'IDLE'}
            palette={palette} />
          <Stat label="PUSH CYCLES" value={d.push_cycles ?? 0} unit="this shift" palette={palette} />
          <Stat label="MATERIAL MOVED" value={(d.material_moved_bcm || 0).toFixed(1)} unit="BCM" palette={palette} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MetricTile label="Hydraulic Temp" value={d.hydraulic_oil_temp_c?.toFixed(1)} unit="°C"
          status={hydraulicStatus} sim />
        <MetricTile label="Transmission Temp" value={d.transmission_temp_c?.toFixed(1)} unit="°C"
          status={transmissionStatus} sim />
        <MetricTile label="Coolant" value={d.coolant_temp_c?.toFixed(1)} unit="°C"
          status={d.coolant_temp_c > 100 ? 'crit' : 'ok'} />
        <MetricTile label="Engine Load" value={d.engine_load_pct?.toFixed(0)} unit="%" />
        <MetricTile label="Fuel Level" value={d.fuel_level_pct?.toFixed(0)} unit="%"
          status={d.fuel_level_pct < 20 ? 'crit' : 'ok'} />
        <MetricTile label="Oil Pressure" value={d.oil_pressure_bar?.toFixed(2)} unit="bar"
          status={d.oil_pressure_bar < 3.5 ? 'crit' : 'ok'} />
        <MetricTile label="Track Slip" value={trackSlip.toFixed(1)} unit="%" status={slipStatus}
          hint={slipStatus === 'warn' ? 'Wheel spin detected' : 'Traction OK'} />
        <MetricTile label="Blade Load" value={d.blade_load_pct?.toFixed(0)} unit="%" />
        <MetricTile label="Ripper" value={d.ripper_status?.toUpperCase()} sim
          status={d.ripper_status === 'engaged' ? 'warn' : 'ok'} />
        <MetricTile label="SMR Hours" value={d.smr_hours} unit="h" sim
          hint="Service Meter Reading" />
        <MetricTile label="Segment" value={d.current_segment || '—'} sim />
        <MetricTile label="Status" value={d.status?.toUpperCase()} unit="" />
      </div>

      <BladePanel pos={d.blade_position} palette={palette} />
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
        {unit && <span style={{ fontSize: 12, color: palette.textDim, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  )
}

function BladePanel({ pos, palette }) {
  if (!pos) return null
  return (
    <div style={{
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12,
      }}>
        Blade Position
        <span style={{
          marginLeft: 6, background: palette.warn + '33', color: palette.warn,
          fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
        }}>[SIM]</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <BladeAxis label="LIFT" value={pos.lift_mm} unit="mm" range={[-300, 300]} palette={palette} />
        <BladeAxis label="TILT" value={pos.tilt_deg} unit="°" range={[-15, 15]} palette={palette} />
        <BladeAxis label="ANGLE" value={pos.angle_deg} unit="°" range={[-30, 30]} palette={palette} />
      </div>
    </div>
  )
}

function BladeAxis({ label, value, unit, range, palette }) {
  const [min, max] = range
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 700, color: palette.textDim, marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        position: 'relative', height: 24, background: palette.panelAlt, borderRadius: 4,
        border: `1px solid ${palette.border}`,
      }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '50%', width: 1,
          background: palette.border,
        }} />
        <div style={{
          position: 'absolute', top: 2, bottom: 2,
          left: `calc(${pct}% - 5px)`, width: 10,
          background: palette.accent, borderRadius: 3,
        }} />
      </div>
      <div style={{
        textAlign: 'center', fontSize: 22, fontWeight: 900,
        color: palette.text, fontVariantNumeric: 'tabular-nums', marginTop: 4,
      }}>
        {value > 0 ? '+' : ''}{value}<span style={{ fontSize: 12, color: palette.textDim, marginLeft: 4 }}>{unit}</span>
      </div>
    </div>
  )
}
