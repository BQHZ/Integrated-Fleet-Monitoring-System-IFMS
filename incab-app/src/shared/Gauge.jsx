import { useTheme } from './theme.jsx'

/**
 * Ring/arc gauge SVG.
 * Props:
 *  - value: number
 *  - min, max: range
 *  - unit: string (mis. 'km/h')
 *  - label: string
 *  - zones: [{from, to, color}] — overlay band ranges
 *  - size: px (default 240)
 *  - sim: boolean — show [SIM] tag
 *  - subtitle: optional text below value
 */
export default function Gauge({
  value = 0, min = 0, max = 100, unit = '', label = '',
  zones = [], size = 240, sim = false, subtitle = null,
  formatValue = null,
}) {
  const { palette } = useTheme()

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.42
  const stroke = size * 0.075

  // Arc dari -135° ke +135° (270° total)
  const START = -135
  const END = 135
  const SWEEP = END - START

  const safeValue = Math.max(min, Math.min(max, value || 0))
  const pct = (safeValue - min) / (max - min || 1)
  const angle = START + pct * SWEEP

  const polar = (deg) => {
    const rad = deg * Math.PI / 180
    return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)]
  }
  const arcPath = (fromDeg, toDeg) => {
    const [x1, y1] = polar(fromDeg)
    const [x2, y2] = polar(toDeg)
    const large = (toDeg - fromDeg) > 180 ? 1 : 0
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
  }
  const fromValDeg = (v) => START + ((Math.max(min, Math.min(max, v)) - min) / (max - min || 1)) * SWEEP

  const display = formatValue ? formatValue(safeValue) : safeValue.toFixed(safeValue < 100 ? 1 : 0)

  return (
    <div style={{ position: 'relative', width: size, height: size, color: palette.text }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Track */}
        <path d={arcPath(START, END)} fill="none"
          stroke={palette.border} strokeWidth={stroke} strokeLinecap="round" />
        {/* Zones */}
        {zones.map((z, i) => (
          <path key={i} d={arcPath(fromValDeg(z.from), fromValDeg(z.to))}
            fill="none" stroke={z.color} strokeWidth={stroke - 4}
            strokeLinecap="butt" opacity={0.55} />
        ))}
        {/* Value arc */}
        <path d={arcPath(START, angle)} fill="none"
          stroke={palette.accent} strokeWidth={stroke} strokeLinecap="round" />
        {/* Needle */}
        <line
          x1={cx} y1={cy}
          x2={polar(angle)[0]} y2={polar(angle)[1]}
          stroke={palette.text} strokeWidth={3} strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={size * 0.04} fill={palette.text} />

        {/* Tick labels min/max */}
        <text x={polar(START)[0]} y={polar(START)[1] + 16}
              textAnchor="middle" fontSize={size * 0.05}
              fill={palette.textDim}>
          {min}
        </text>
        <text x={polar(END)[0]} y={polar(END)[1] + 16}
              textAnchor="middle" fontSize={size * 0.05}
              fill={palette.textDim}>
          {max}
        </text>
      </svg>

      {/* Center label */}
      <div style={{
        position: 'absolute', top: '40%', left: 0, right: 0, textAlign: 'center',
        pointerEvents: 'none',
      }}>
        <div style={{
          fontSize: size * 0.22, fontWeight: 900, lineHeight: 1,
          fontVariantNumeric: 'tabular-nums', color: palette.text,
        }}>
          {display}
        </div>
        <div style={{ fontSize: size * 0.07, color: palette.textDim, marginTop: 6, fontWeight: 600 }}>
          {unit}
        </div>
        {subtitle && (
          <div style={{ fontSize: size * 0.06, color: palette.text, marginTop: 2 }}>
            {subtitle}
          </div>
        )}
      </div>

      {/* Label below */}
      <div style={{
        position: 'absolute', bottom: -6, left: 0, right: 0, textAlign: 'center',
        fontSize: 13, fontWeight: 700, color: palette.textDim, letterSpacing: '0.06em',
      }}>
        {label}
        {sim && <SimTag />}
      </div>
    </div>
  )
}

export function SimTag() {
  const { palette } = useTheme()
  return (
    <span style={{
      marginLeft: 6, background: palette.warn + '33', color: palette.warn,
      fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 3,
      letterSpacing: '0.05em', verticalAlign: 'middle',
    }}>[SIM]</span>
  )
}
