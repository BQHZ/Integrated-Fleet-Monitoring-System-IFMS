import { useEffect, useState } from 'react'
import { useTheme } from './theme.jsx'

const SHIFT_LABEL = (h) => h < 12 ? 'DAY SHIFT' : h < 19 ? 'AFTERNOON' : 'NIGHT SHIFT'

/**
 * Top strip persistent: unit id | operator | shift | time | bell | day/night toggle
 */
export default function TopStrip({ data, pendingCount = 0, unreadFeedback = 0, onOpenFeedback }) {
  const { palette, mode, toggle } = useTheme()
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{
      background: palette.panel,
      borderBottom: `1px solid ${palette.border}`,
      padding: '8px 16px',
      display: 'flex', alignItems: 'center', gap: 16,
      color: palette.text, fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8,
          background: palette.accent, color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 14, letterSpacing: '0.02em',
        }}>PAMA</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 22, lineHeight: 1 }}>{data?.unit_id || '—'}</div>
          <div style={{ fontSize: 11, color: palette.textDim, marginTop: 2 }}>
            {data?.unit_type?.toUpperCase().replace('_', ' ') || ''}
            {data?.site_id && ' · ' + (data.site_id === 'siteA' ? 'MTBU' : 'ADRO')}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', gap: 14, marginLeft: 8 }}>
        <StripItem label="OPERATOR" value={`OP-${(data?.unit_id || '----').slice(-2)}`} palette={palette} sim />
        <StripItem label="SHIFT" value={SHIFT_LABEL(now.getHours())} palette={palette} sim />
        <StripItem label="JAM MESIN" value={`${data?.engine_hours?.toFixed(0) ?? '—'}h`} palette={palette} />
        <StripItem label="SHIFT WORKED" value={`${(data?.shift_hours_worked || 0).toFixed(1)}h`} palette={palette} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          fontSize: 18, fontWeight: 800, fontVariantNumeric: 'tabular-nums',
          color: palette.text, letterSpacing: '0.02em',
        }}>
          {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>

        <div title={`${pendingCount} pending instructions`}
          style={{
            position: 'relative', display: 'inline-flex',
            color: pendingCount > 0 ? palette.accent : palette.textDim,
            fontSize: 22, padding: '4px 8px',
          }}>
          🔔
          {pendingCount > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              background: palette.crit, color: '#fff', borderRadius: '50%',
              width: 18, height: 18, fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{pendingCount}</span>
          )}
        </div>

        <button onClick={onOpenFeedback} title="Operator Feedback Inbox"
          style={{
            position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer',
            color: unreadFeedback > 0 ? palette.accent : palette.textDim,
            fontSize: 22, padding: '4px 8px',
          }}>
          💬
          {unreadFeedback > 0 && (
            <span style={{
              position: 'absolute', top: 0, right: 0,
              background: palette.crit, color: '#fff', borderRadius: '50%',
              width: 18, height: 18, fontSize: 10, fontWeight: 800,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{unreadFeedback}</span>
          )}
        </button>

        <button onClick={toggle} title="Toggle day/night theme"
          style={{
            background: palette.panelAlt, color: palette.text,
            border: `1px solid ${palette.border}`, borderRadius: 5,
            padding: '6px 10px', cursor: 'pointer', fontSize: 16, fontWeight: 700,
          }}>
          {mode === 'dark' ? '☀' : '☾'}
        </button>
      </div>
    </div>
  )
}

function StripItem({ label, value, palette, sim }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: palette.textDim, fontWeight: 700,
        letterSpacing: '0.08em', textTransform: 'uppercase',
      }}>
        {label}{sim && <span style={{
          marginLeft: 4, color: palette.warn, fontSize: 8,
        }}>[SIM]</span>}
      </div>
      <div style={{ fontSize: 14, fontWeight: 800, color: palette.text, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
    </div>
  )
}
