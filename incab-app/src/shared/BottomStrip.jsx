import { useTheme, statusColor } from './theme.jsx'

/**
 * Bottom strip: alarms count | fuel | payload/cycle counter.
 * Per spec: alarms | fuel | payload/cycle.
 */
export default function BottomStrip({ data, alarms = [] }) {
  const { palette } = useTheme()

  const activeAlarms = alarms.filter(a => a.active)
  const fault = data?.fault_code
  const fuelPct = data?.fuel_level_pct ?? 0
  const fuelStatus = fuelPct < 15 ? 'crit' : fuelPct < 25 ? 'warn' : 'ok'

  // Per unit type, pilih cycle counter yang relevan
  const cycleInfo = getCycleInfo(data)

  return (
    <div style={{
      background: palette.panel, borderTop: `1px solid ${palette.border}`,
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14,
      color: palette.text, fontFamily: 'Inter, sans-serif',
    }}>
      <SegmentItem
        label="ALARMS"
        value={activeAlarms.length}
        accent={activeAlarms.length > 0 ? palette.crit : palette.ok}
        hint={fault ? `FAULT: ${fault}` : activeAlarms.length === 0 ? 'Clear' : activeAlarms.map(a => a.label).join(' · ')}
        palette={palette}
      />
      <Divider palette={palette} />
      <SegmentItem
        label="FUEL"
        value={`${fuelPct.toFixed(0)}%`}
        accent={statusColor(palette, fuelStatus)}
        hint={fuelStatus === 'crit' ? 'REFUEL SEGERA' : fuelStatus === 'warn' ? 'Low fuel' : 'OK'}
        palette={palette}
        showBar={fuelPct}
      />
      <Divider palette={palette} />
      <SegmentItem
        label={cycleInfo.label}
        value={cycleInfo.value}
        accent={palette.accent}
        hint={cycleInfo.hint}
        palette={palette}
      />
      <div style={{ flex: 1 }} />
      <div style={{
        fontSize: 10, color: palette.textDim, letterSpacing: '0.06em',
      }}>
        v3 · [ASUMSI data simulator]
      </div>
    </div>
  )
}

function Divider({ palette }) {
  return <div style={{ width: 1, height: 32, background: palette.border }} />
}

function SegmentItem({ label, value, hint, accent, palette, showBar }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 140 }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontSize: 22, fontWeight: 900, color: accent,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        }}>{value}</span>
      </div>
      {showBar != null && (
        <div style={{
          height: 4, background: palette.border, borderRadius: 2, marginTop: 2, overflow: 'hidden',
        }}>
          <div style={{ width: `${showBar}%`, height: '100%', background: accent }} />
        </div>
      )}
      {hint && (
        <div style={{ fontSize: 10, color: palette.textDim, marginTop: 2 }}>{hint}</div>
      )}
    </div>
  )
}

function getCycleInfo(data) {
  if (!data) return { label: 'CYCLES', value: '—', hint: '' }
  switch (data.unit_type) {
    case 'haul_truck':
      return {
        label: 'CYCLES TODAY',
        value: data.cycle_count ?? 0,
        hint: `Last payload: ${(data.payload_ton || 0).toFixed(1)}t`,
      }
    case 'excavator':
      return {
        label: 'TRUCKS LOADED',
        value: data.trucks_served_shift ?? 0,
        hint: `Queue: ${data.queue_depth ?? 0}`,
      }
    case 'dozer':
      return {
        label: 'PUSH CYCLES',
        value: data.push_cycles ?? 0,
        hint: `Material: ${(data.material_moved_bcm || 0).toFixed(0)} BCM`,
      }
    case 'grader':
      return {
        label: 'PASS COUNT',
        value: data.pass_count_shift ?? 0,
        hint: `Segment: ${data.grader_segment || '—'}`,
      }
    case 'water_truck':
      return {
        label: 'KM COVERED',
        value: (data.km_covered_shift || 0).toFixed(1),
        hint: `Tank: ${(data.tank_level_pct || 0).toFixed(0)}%`,
      }
    case 'service_truck':
      return {
        label: 'UNITS SERVICED',
        value: data.units_serviced_shift ?? 0,
        hint: `Fuel delivered: ${(data.fuel_delivered_l_shift || 0).toFixed(0)} L`,
      }
    default:
      return { label: 'CYCLES', value: data.cycle_count ?? '—', hint: '' }
  }
}
