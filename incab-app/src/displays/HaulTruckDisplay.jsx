import Gauge from '../shared/Gauge.jsx'
import MetricTile from '../shared/MetricTile.jsx'
import TireLayout from '../shared/TireLayout.jsx'
import { useTheme } from '../shared/theme.jsx'

export default function HaulTruckDisplay({ data: d }) {
  const { palette } = useTheme()

  const fuelStatus = (d.fuel_level_pct ?? 100) < 15 ? 'crit' : (d.fuel_level_pct ?? 100) < 25 ? 'warn' : 'ok'
  const coolantStatus = d.coolant_temp_c > 100 ? 'crit' : d.coolant_temp_c > 95 ? 'warn' : 'ok'
  const oilStatus = d.oil_pressure_bar < 3.5 ? 'crit' : 'ok'
  const payloadStatus = !d.payload_ton ? 'neutral' :
    d.payload_ton > 120 ? 'crit' : d.payload_ton < 90 ? 'warn' : 'ok'

  // Fuel rate estimate [SIM]: based on engine_load
  const fuelRateLh = (40 + (d.engine_load_pct || 0) * 1.2).toFixed(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4, color: palette.text }}>
      <div style={{
        background: palette.panel, border: `1px solid ${palette.border}`,
        borderRadius: 10, padding: 12,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Gauge
          value={d.current_speed_kmh || 0}
          min={0} max={60} unit="km/h" label="GROUND SPEED"
          size={240}
          zones={[
            { from: 0, to: d.speed_limit_kmh || 40, color: palette.ok },
            { from: d.speed_limit_kmh || 40, to: 60, color: palette.crit },
          ]}
          subtitle={`Limit ${d.speed_limit_kmh || 40} km/h`}
        />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Banner label="ROAD" value={d.road_segment?.replace(/_/g, ' ').toUpperCase() || '—'} palette={palette} />
          {d.speed_violation?.violated && (
            <Banner label="OVERSPEED" value={`+${d.speed_violation.excess_kmh} km/h`}
              color={palette.crit} palette={palette} />
          )}
          {d.harsh_brake_event?.detected && (
            <Banner label="HARSH BRAKE" value={`${d.harsh_brake_event.deceleration_g}g`}
              color={palette.warn} palette={palette} />
          )}
          {d.no_go_proximity?.in_zone && (
            <Banner label="NO-GO ZONE" value={d.no_go_proximity.zone_name}
              color={palette.crit} palette={palette} />
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        <MetricTile label="Engine RPM" value={d.engine_rpm} unit="rpm" sim />
        <MetricTile label="Engine Load" value={d.engine_load_pct?.toFixed(0)} unit="%" />
        <MetricTile label="Coolant" value={d.coolant_temp_c?.toFixed(1)} unit="°C" status={coolantStatus} />
        <MetricTile label="Oil Pressure" value={d.oil_pressure_bar?.toFixed(2)} unit="bar" status={oilStatus} />
        <MetricTile label="Fuel Level" value={d.fuel_level_pct?.toFixed(0)} unit="%" status={fuelStatus} />
        <MetricTile label="Fuel Rate" value={fuelRateLh} unit="L/h" sim />
        <MetricTile label="Gear" value={d.gear_position} unit="" sim />
        <MetricTile label="Retarder" value={d.retarder_grade} unit="grade" sim
          hint={d.retarder_grade > 0 ? 'Engine brake active' : 'OFF'} />
        <MetricTile label="Brake Oil" value={d.brake_oil_temp_c?.toFixed(0)} unit="°C" sim
          status={d.brake_oil_temp_c > 90 ? 'warn' : 'ok'} />
        <MetricTile label="DEF Level" value={d.def_level_pct?.toFixed(0)} unit="%" sim
          status={d.def_level_pct < 15 ? 'crit' : 'ok'} />
        <MetricTile label="Payload" value={d.payload_ton?.toFixed(1)} unit="ton" status={payloadStatus}
          hint={d.payload_ton > 0
            ? `L ${d.payload_left_pct?.toFixed(0)}% · R ${d.payload_right_pct?.toFixed(0)}%`
            : 'EMPTY'} />
        <MetricTile label="Status" value={d.status?.toUpperCase().replace('_', ' ')} unit=""
          hint={d.idle_seconds > 60 ? `Idle ${d.idle_seconds}s` : ''} />
      </div>

      <TireLayout tires={d.tires || []} sim />
    </div>
  )
}

function Banner({ label, value, color, palette }) {
  const c = color || palette.accent
  return (
    <div style={{
      background: palette.panelAlt, border: `1px solid ${c}`,
      borderLeft: `5px solid ${c}`, borderRadius: 6, padding: '8px 14px',
    }}>
      <div style={{
        fontSize: 11, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: c, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}
