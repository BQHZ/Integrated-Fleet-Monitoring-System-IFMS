import { useEffect, useState } from 'react'

const BACKEND_HOST = 'localhost'
const BASE_URL = `http://${BACKEND_HOST}:8000`

const PRIO_COLOR = { low: '#475569', normal: '#0066CC', high: '#C41E3A' }
const TYPE_LABEL = {
  assignment: 'ASSIGNMENT', waypoint: 'NEW ROUTE',
  digging_point: 'DIGGING POINT', dumping_point: 'DUMPING POINT',
  speed_limit: 'SPEED LIMIT', message: 'MESSAGE',
}

function playInstructionChime(priority) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    const notes = priority === 'high' ? [880, 660, 880] : [660, 880]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.18)
      gain.gain.exponentialRampToValueAtTime(0.25, now + i * 0.18 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.18)
      osc.stop(now + i * 0.18 + 0.18)
    })
    setTimeout(() => ctx.close(), 800)
  } catch (e) { /* audio not available */ }
}

/**
 * Active instruction banner. Drived dari `active` prop (useIncabBus.latestInstruction).
 * Props:
 *  - active: instruction object or null
 *  - unitId: string
 *  - onAck: (updated) => void
 *  - onDismiss: () => void
 */
export default function InstructionBanner({ active, unitId, onAck, onDismiss }) {
  const [acking, setAcking] = useState(false)

  // Play chime when active changes to new instruction
  useEffect(() => {
    if (active) playInstructionChime(active.priority)
  }, [active?.id])

  if (!active) return null

  const handleAck = async () => {
    setAcking(true)
    try {
      const res = await fetch(`${BASE_URL}/dispatch/instructions/${active.id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: unitId }),
      })
      if (res.ok) {
        const updated = await res.json()
        onAck?.(updated)
      }
    } catch (e) { /* ignore */ }
    setAcking(false)
  }

  const color = PRIO_COLOR[active.priority] || '#475569'
  const label = TYPE_LABEL[active.type] || active.type.toUpperCase()
  const body = describePayload(active.type, active.payload)

  return (
    <div style={{
      background: color, color: '#fff',
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
      borderBottom: '3px solid rgba(255,255,255,0.3)',
      fontFamily: 'Inter, sans-serif',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.2)', borderRadius: 4,
        padding: '3px 8px', fontSize: 11, fontWeight: 800, letterSpacing: '0.06em',
      }}>
        {active.priority.toUpperCase()} · {label}
      </div>
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>
        {body}
      </div>
      <div style={{ fontSize: 11, opacity: 0.85 }}>
        from {active.sent_by}
      </div>
      <button onClick={handleAck} disabled={acking} style={{
        background: '#fff', color, border: 'none', borderRadius: 5,
        padding: '6px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
        opacity: acking ? 0.6 : 1,
      }}>
        {acking ? 'ACK...' : 'ACKNOWLEDGE'}
      </button>
    </div>
  )
}

function describePayload(type, payload) {
  if (!payload) return ''
  switch (type) {
    case 'assignment':    return `Pergi ke ${payload.excavator_id} · dump ${payload.dumping_zone}`
    case 'waypoint':      return `Ikuti rute baru — ${payload.coords?.length || 0} waypoint`
    case 'digging_point': return `Digging point baru: ${payload.coord?.map(c => c.toFixed(5)).join(', ')}`
    case 'dumping_point': return `Dumping point baru: ${payload.coord?.map(c => c.toFixed(5)).join(', ')}`
    case 'speed_limit':   return `Speed limit ${payload.kmh} km/h`
    case 'message':       return payload.text || ''
    default:              return JSON.stringify(payload).slice(0, 80)
  }
}
