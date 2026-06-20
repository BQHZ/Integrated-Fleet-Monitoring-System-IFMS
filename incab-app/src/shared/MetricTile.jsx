import { useTheme, statusColor } from './theme.jsx'
import { SimTag } from './Gauge.jsx'

/**
 * MetricTile: label + nilai besar + unit kecil + status color (ok/warn/crit).
 * Body min 18px (per spec). Value 32-40px.
 */
export default function MetricTile({
  label, value, unit, status = 'neutral', sim = false, hint = null, compact = false,
}) {
  const { palette } = useTheme()
  const color = status === 'neutral' ? palette.text : statusColor(palette, status)
  const borderColor = status === 'neutral' ? palette.border : statusColor(palette, status)

  return (
    <div style={{
      background: palette.panel,
      border: `1px solid ${borderColor}`,
      borderLeft: `5px solid ${borderColor}`,
      borderRadius: 8,
      padding: compact ? '8px 12px' : '12px 14px',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      gap: compact ? 2 : 4, minHeight: compact ? 60 : 84,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {label}
        {sim && <SimTag />}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{
          fontSize: compact ? 24 : 32, fontWeight: 900, color,
          fontVariantNumeric: 'tabular-nums', lineHeight: 1,
        }}>
          {value ?? '—'}
        </span>
        {unit && (
          <span style={{ fontSize: 14, color: palette.textDim, fontWeight: 600 }}>{unit}</span>
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: palette.textDim, marginTop: 2 }}>{hint}</div>
      )}
    </div>
  )
}
