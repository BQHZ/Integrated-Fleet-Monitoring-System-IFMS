import { useTheme, statusColor } from './theme.jsx'

/**
 * AlarmStrip — strip warning lights bawah.
 * Props:
 *  - alarms: [{key, label, active, severity:'ok'|'warn'|'crit'}]
 */
export default function AlarmStrip({ alarms = [] }) {
  const { palette } = useTheme()
  if (alarms.length === 0) return null

  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
      background: palette.panel, border: `1px solid ${palette.border}`,
      borderRadius: 8, padding: '8px 12px',
    }}>
      <span style={{
        fontSize: 11, fontWeight: 800, color: palette.textDim,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        Alarms
      </span>
      {alarms.map(a => (
        <AlarmLight key={a.key} {...a} palette={palette} />
      ))}
    </div>
  )
}

function AlarmLight({ label, active, severity = 'ok', palette }) {
  const color = active ? statusColor(palette, severity) : palette.border
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 4,
      background: active ? color + '22' : 'transparent',
      border: `1px solid ${active ? color : palette.border}`,
    }}>
      <span style={{
        width: 10, height: 10, borderRadius: '50%',
        background: color,
        boxShadow: active ? `0 0 6px ${color}` : 'none',
      }} />
      <span style={{
        fontSize: 11, color: active ? palette.text : palette.textDim,
        fontWeight: active ? 700 : 600, letterSpacing: '0.04em',
      }}>{label}</span>
    </div>
  )
}
