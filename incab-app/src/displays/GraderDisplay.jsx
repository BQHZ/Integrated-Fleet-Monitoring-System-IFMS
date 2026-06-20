import Gauge from '../shared/Gauge.jsx'
import MetricTile from '../shared/MetricTile.jsx'
import { useTheme } from '../shared/theme.jsx'

export default function GraderDisplay({ data: d }) {
  const { palette } = useTheme()
  const speed = d.current_speed_kmh || 0
  const speedOk = speed >= 8 && speed <= 15
  const txStatus = d.transmission_temp_c > 95 ? 'crit' : d.transmission_temp_c > 85 ? 'warn' : 'ok'
  const slopeAbs = Math.abs(d.cross_slope_pct || 0)
  const slopeStatus = slopeAbs > 3 ? 'crit' : slopeAbs > 2 ? 'warn' : 'ok'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, color: palette.text }}>
      <div style={{
        background: palette.panel, border: `1px solid ${palette.border}`,
        borderRadius: 10, padding: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Gauge
          value={speed} min={0} max={30} unit="km/h" label="SPEED"
          size={240}
          zones={[
            { from: 0, to: 8, color: palette.warn },
            { from: 8, to: 15, color: palette.ok },
            { from: 15, to: 30, color: palette.warn },
          ]}
          subtitle={`${d.gear_direction || 'F'} · Optimal 8-15`}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stat label="SEGMENT" value={(d.grader_segment || '—').replace(/_/g, ' ').toUpperCase()} palette={palette} />
          <Stat label="PASS COUNT" value={d.pass_count_shift ?? 0} unit={`shift · ${d.passes_on_segment ?? 0} segment`} palette={palette} />
          <Stat label="ROAD SCORE" value={d.road_condition_score?.toFixed(0) || '—'} unit="/100"
            palette={palette} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MetricTile label="Cross Slope" value={d.cross_slope_pct?.toFixed(2)} unit="%" status={slopeStatus}
          hint={slopeAbs > 3 ? 'OUT OF SPEC' : 'IN SPEC (±3%)'} />
        <MetricTile label="Blade Angle" value={d.blade_angle_deg} unit="°" sim
          hint="Mouldboard angle" />
        <MetricTile label="Blade Lift L" value={d.blade_lift_left_mm} unit="mm" sim />
        <MetricTile label="Blade Lift R" value={d.blade_lift_right_mm} unit="mm" sim />
        <MetricTile label="Articulation" value={d.articulation_angle_deg} unit="°" sim
          hint={Math.abs(d.articulation_angle_deg) > 8 ? 'Sharp turn' : 'Straight'} />
        <MetricTile label="Gear Direction" value={d.gear_direction} sim
          status={d.gear_direction === 'R' ? 'warn' : 'ok'} />
        <MetricTile label="Engine Temp" value={d.coolant_temp_c?.toFixed(1)} unit="°C"
          status={d.coolant_temp_c > 100 ? 'crit' : 'ok'} />
        <MetricTile label="Transmission" value={d.transmission_temp_c?.toFixed(1)} unit="°C" status={txStatus} sim />
        <MetricTile label="Engine RPM" value={d.engine_rpm} unit="rpm" sim />
        <MetricTile label="Engine Load" value={d.engine_load_pct?.toFixed(0)} unit="%" />
        <MetricTile label="Fuel Level" value={d.fuel_level_pct?.toFixed(0)} unit="%"
          status={d.fuel_level_pct < 20 ? 'crit' : 'ok'} />
        <MetricTile label="Status" value={d.status?.toUpperCase()}
          hint={d.status === 'grading' && !speedOk ? (speed < 8 ? 'Too slow' : 'Too fast') : ''}
          status={d.status === 'grading' && !speedOk ? 'warn' : 'ok'} />
      </div>
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
        <span style={{ fontSize: 22, fontWeight: 900, color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: palette.textDim, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  )
}
