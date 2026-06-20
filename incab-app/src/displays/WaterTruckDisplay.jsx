import Gauge from '../shared/Gauge.jsx'
import MetricTile from '../shared/MetricTile.jsx'
import { useTheme } from '../shared/theme.jsx'

export default function WaterTruckDisplay({ data: d }) {
  const { palette } = useTheme()
  const tank = d.tank_level_pct ?? 0
  const tankStatus = tank < 15 ? 'crit' : tank < 30 ? 'warn' : 'ok'
  const isSpraying = !!d.spray_pump_active
  const pattern = d.spray_pattern || { front: false, rear: false, side: false }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, color: palette.text }}>
      <div style={{
        background: palette.panel, border: `1px solid ${palette.border}`,
        borderRadius: 10, padding: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Gauge
          value={tank} min={0} max={100} unit="%" label="WATER TANK"
          size={240}
          zones={[
            { from: 0, to: 15, color: palette.crit },
            { from: 15, to: 30, color: palette.warn },
            { from: 30, to: 100, color: palette.ok },
          ]}
          subtitle={tank < 20 ? 'REFILL SOON' : isSpraying ? 'SPRAYING' : 'STANDBY'}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Stat label="SPRAY RATE" value={d.spray_rate_l_min?.toFixed(0) || 0} unit="L/min" palette={palette} />
          <Stat label="KM COVERED" value={(d.km_covered_shift || 0).toFixed(2)} unit="km shift" palette={palette} />
          <Stat label="REFILL" value={`${d.refill_distance_m ?? '—'} m`} unit="ke titik refill" palette={palette} sim />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MetricTile label="Pump Status" value={isSpraying ? 'ACTIVE' : 'OFF'}
          status={isSpraying ? 'ok' : 'neutral'} sim />
        <MetricTile label="Tank Level" value={tank.toFixed(0)} unit="%" status={tankStatus} />
        <MetricTile label="Spray Rate" value={d.spray_rate_l_min?.toFixed(0) || 0} unit="L/min" />
        <MetricTile label="Engine Temp" value={d.coolant_temp_c?.toFixed(1)} unit="°C"
          status={d.coolant_temp_c > 100 ? 'crit' : 'ok'} />
        <MetricTile label="Fuel Level" value={d.fuel_level_pct?.toFixed(0)} unit="%"
          status={d.fuel_level_pct < 20 ? 'crit' : 'ok'} />
        <MetricTile label="Engine RPM" value={d.engine_rpm} unit="rpm" sim />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <SprayPatternPanel pattern={pattern} active={isSpraying} palette={palette} />
        <SchedulePanel d={d} palette={palette} />
      </div>
    </div>
  )
}

function Stat({ label, value, unit, palette, sim }) {
  return (
    <div style={{
      background: palette.panelAlt, border: `1px solid ${palette.border}`,
      borderLeft: `5px solid ${palette.accent}`, borderRadius: 6, padding: '8px 14px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}{sim && <span style={{
        marginLeft: 4, color: palette.warn, fontSize: 8,
      }}>[SIM]</span>}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 12, color: palette.textDim, fontWeight: 600 }}>{unit}</span>}
      </div>
    </div>
  )
}

function SprayPatternPanel({ pattern, active, palette }) {
  const Box = ({ label, on }) => (
    <div style={{
      flex: 1, padding: '10px 8px', textAlign: 'center', borderRadius: 6,
      border: `2px solid ${on ? palette.accent : palette.border}`,
      background: on ? palette.accent + '22' : palette.panelAlt,
      color: on ? palette.accent : palette.textDim, fontWeight: 800,
      fontSize: 13, letterSpacing: '0.04em',
    }}>
      {label}
      <div style={{ fontSize: 11, marginTop: 2, opacity: 0.85 }}>{on ? 'ON' : 'OFF'}</div>
    </div>
  )
  return (
    <div style={{
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        Spray Pattern
        <span style={{
          marginLeft: 6, background: palette.warn + '33', color: palette.warn,
          fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
        }}>[SIM]</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Box label="FRONT" on={active && pattern.front} />
        <Box label="REAR" on={active && pattern.rear} />
        <Box label="SIDE" on={active && pattern.side} />
      </div>
    </div>
  )
}

function SchedulePanel({ d, palette }) {
  return (
    <div style={{
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        Dust Suppression Schedule
        <span style={{
          marginLeft: 6, background: palette.warn + '33', color: palette.warn,
          fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
        }}>[SIM]</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Row label="Current" value={d.current_road_segment?.replace('_', ' ').toUpperCase() || '—'} palette={palette} />
        <Row label="Next" value={d.next_segment?.replace('_', ' ').toUpperCase() || '—'} palette={palette} />
        <Row label="Refill in" value={`${d.refill_distance_m} m`} palette={palette} />
      </div>
    </div>
  )
}

function Row({ label, value, palette }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, padding: '4px 0' }}>
      <span style={{ color: palette.textDim, fontWeight: 600 }}>{label}</span>
      <span style={{ color: palette.text, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  )
}
