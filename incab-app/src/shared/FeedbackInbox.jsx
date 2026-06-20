import { useEffect, useState } from 'react'
import { useTheme } from './theme.jsx'

const BACKEND_HOST = 'localhost'
const BASE_URL = `http://${BACKEND_HOST}:8000`

const CATEGORY_STYLE = (palette, category) => {
  switch (category) {
    case 'safety':       return { bg: palette.crit + '22', fg: palette.crit, label: 'SAFETY' }
    case 'praise':       return { bg: palette.ok + '22', fg: palette.ok, label: 'PRAISE 🌟' }
    case 'productivity': return { bg: palette.accent + '22', fg: palette.accent, label: 'PRODUCTIVITY' }
    case 'quality':      return { bg: '#A855F722', fg: '#A855F7', label: 'QUALITY' }
    default:             return { bg: palette.border, fg: palette.text, label: category?.toUpperCase() || '?' }
  }
}

function relTime(ts) {
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

/**
 * Props:
 *  - open: boolean
 *  - onClose: fn
 *  - feedback: array (full list)
 *  - unitId: string
 *  - onAck: (id) => void  (updates parent state)
 */
export default function FeedbackInbox({ open, onClose, feedback = [], unitId, onAck }) {
  const { palette } = useTheme()
  const [ackingId, setAckingId] = useState(null)

  if (!open) return null

  const sorted = [...feedback].sort((a, b) => b.ts - a.ts)

  const handleAck = async (id) => {
    setAckingId(id)
    try {
      const res = await fetch(`${BASE_URL}/dispatch/feedback/${id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: unitId }),
      })
      if (res.ok) {
        const updated = await res.json()
        onAck?.(updated)
      }
    } catch (e) { /* ignore */ }
    setAckingId(null)
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: palette.bg, border: `1px solid ${palette.border}`,
        borderRadius: 10, width: 520, maxHeight: '85vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: `0 20px 60px ${palette.shadow}`, color: palette.text,
      }}>
        <div style={{
          padding: '14px 18px', borderBottom: `1px solid ${palette.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Operator Feedback</div>
            <div style={{ fontSize: 12, color: palette.textDim, marginTop: 2 }}>
              {sorted.length} pesan · {sorted.filter(f => f.status !== 'ack').length} belum dibaca
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: palette.textDim,
            fontSize: 22, cursor: 'pointer', padding: '4px 10px',
          }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.length === 0 ? (
            <div style={{ textAlign: 'center', color: palette.textDim, padding: 30, fontSize: 14 }}>
              Inbox kosong
            </div>
          ) : sorted.map(f => {
            const sty = CATEGORY_STYLE(palette, f.category)
            const isPraise = f.category === 'praise'
            return (
              <div key={f.id} style={{
                background: isPraise ? palette.ok + '15' : f.category === 'safety' ? palette.crit + '15' : palette.panel,
                border: `2px solid ${sty.fg}`, borderRadius: 8, padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 6 }}>
                  <span style={{
                    background: sty.bg, color: sty.fg, padding: '2px 9px', borderRadius: 4,
                    fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
                  }}>{sty.label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: f.priority === 'high' ? palette.crit : palette.textDim,
                  }}>
                    {f.priority?.toUpperCase()}
                  </span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: palette.textDim }}>{relTime(f.ts)}</span>
                </div>
                <div style={{ fontSize: 16, color: palette.text, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                  {f.text}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: palette.textDim }}>
                    dari {f.sent_by}
                  </span>
                  {f.status === 'ack' ? (
                    <span style={{ fontSize: 12, color: palette.ok, fontWeight: 700 }}>
                      ✓ ACKNOWLEDGED
                    </span>
                  ) : (
                    <button onClick={() => handleAck(f.id)}
                      disabled={ackingId === f.id} style={{
                        background: sty.fg, color: '#fff', border: 'none', borderRadius: 5,
                        padding: '6px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        opacity: ackingId === f.id ? 0.6 : 1,
                      }}>
                      {ackingId === f.id ? 'ACK...' : 'ACKNOWLEDGE'}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
