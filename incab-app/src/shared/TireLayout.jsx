import { useTheme, statusColor } from './theme.jsx'
import { SimTag } from './Gauge.jsx'

/**
 * Visual 6-tire haul truck (2 depan + 4 belakang dual).
 * Props:
 *  - tires: [{position, pressure_bar, temp_c}] (6 entries)
 *  - sim: boolean
 */
const POSITIONS = [
  // [label, gridRow, gridCol]
  ['LF', 0, 0], ['RF', 0, 2],
  ['LR-O', 1, 0], ['LR-I', 1, 0.5],
  ['RR-I', 1, 1.5], ['RR-O', 1, 2],
]

function tireStatus(pressure_bar, temp_c) {
  // Threshold [ASUMSI]: nominal 7-8 bar, kritis < 5 atau > 9; temp warn > 90, crit > 100
  if (pressure_bar < 5 || pressure_bar > 9.5) return 'crit'
  if (temp_c > 100) return 'crit'
  if (pressure_bar < 6.5 || pressure_bar > 8.5 || temp_c > 90) return 'warn'
  return 'ok'
}

export default function TireLayout({ tires = [], sim = false }) {
  const { palette } = useTheme()
  // Index tires by position label fallback
  const byPos = Object.fromEntries((tires || []).map(t => [t.position, t]))

  return (
    <div style={{
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: 12,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10,
      }}>
        Tire Pressure & Temp {sim && <SimTag />}
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 8,
      }}>
        {/* Row 1: front axle (1 tire per side, span 2 columns each) */}
        <Tire data={byPos['LF']} label="LF" palette={palette} span={2} />
        <Tire data={byPos['RF']} label="RF" palette={palette} span={2} />
        {/* Row 2: rear axle (dual tires: outer/inner per side) */}
        <Tire data={byPos['LR-O']} label="LR-O" palette={palette} />
        <Tire data={byPos['LR-I']} label="LR-I" palette={palette} />
        <Tire data={byPos['RR-I']} label="RR-I" palette={palette} />
        <Tire data={byPos['RR-O']} label="RR-O" palette={palette} />
      </div>
    </div>
  )
}

function Tire({ data, label, palette, span = 1 }) {
  const pressure = data?.pressure_bar
  const temp = data?.temp_c
  const status = pressure != null && temp != null ? tireStatus(pressure, temp) : 'neutral'
  const color = status === 'neutral' ? palette.textDim : statusColor(palette, status)
  return (
    <div style={{
      gridColumn: span > 1 ? `span ${span}` : undefined,
      background: palette.panelAlt, border: `2px solid ${color}`, borderRadius: 12,
      padding: '8px 6px', textAlign: 'center', minHeight: 70,
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: palette.textDim, letterSpacing: '0.05em',
      }}>{label}</div>
      <div style={{
        fontSize: 18, fontWeight: 900, color,
        fontVariantNumeric: 'tabular-nums', marginTop: 2,
      }}>
        {pressure != null ? pressure.toFixed(1) : '—'}
        <span style={{ fontSize: 11, color: palette.textDim, fontWeight: 600, marginLeft: 2 }}>bar</span>
      </div>
      <div style={{ fontSize: 11, color: palette.textDim, fontWeight: 600 }}>
        {temp != null ? `${temp.toFixed(0)}°C` : '—'}
      </div>
    </div>
  )
}
