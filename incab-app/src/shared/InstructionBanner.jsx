import { useEffect, useRef, useState } from 'react'

const BACKEND_HOST = 'localhost'
const WS_URL = (unitId) => `ws://${BACKEND_HOST}:8000/ws/incab/${unitId}`
const BASE_URL = `http://${BACKEND_HOST}:8000`

const PRIO_COLOR = { low: '#475569', normal: '#0066CC', high: '#C41E3A' }
const TYPE_LABEL = {
  assignment: 'ASSIGNMENT', waypoint: 'NEW ROUTE',
  digging_point: 'DIGGING POINT', dumping_point: 'DUMPING POINT',
  speed_limit: 'SPEED LIMIT', message: 'MESSAGE',
}

function playChime(priority) {
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
 * Props:
 *  - unitId: string
 *  - onInstructionsChange: (list) => void  (untuk MiniMap consume)
 */
export default function InstructionBanner({ unitId, onInstructionsChange }) {
  const [instructions, setInstructions] = useState([])  // semua received
  const [active, setActive] = useState(null)
  const [acking, setAcking] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const knownIdsRef = useRef(new Set())

  // Notify parent on change
  useEffect(() => { onInstructionsChange?.(instructions) }, [instructions, onInstructionsChange])

  // WS connect with auto-reconnect
  useEffect(() => {
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      const ws = new WebSocket(WS_URL(unitId))
      wsRef.current = ws

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'instruction') {
            const ins = msg.data
            setInstructions(prev => {
              // Avoid duplicates (initial unacked load + live push)
              if (prev.some(p => p.id === ins.id)) return prev
              return [ins, ...prev]
            })
            // Show active banner + chime hanya untuk yang belum pernah dilihat
            if (!knownIdsRef.current.has(ins.id) && ins.status !== 'ack') {
              knownIdsRef.current.add(ins.id)
              setActive(ins)
              playChime(ins.priority)
            }
          } else if (msg.type === 'ack') {
            setInstructions(prev => prev.map(i => i.id === msg.data.id ? msg.data : i))
            setActive(prev => prev?.id === msg.data.id ? null : prev)
          }
        } catch (e) { /* ignore */ }
      }

      ws.onclose = () => {
        if (cancelled) return
        reconnectTimerRef.current = setTimeout(connect, 3000)
      }
      ws.onerror = () => { /* will close */ }
    }

    connect()
    return () => {
      cancelled = true
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
    }
  }, [unitId])

  const handleAck = async () => {
    if (!active) return
    setAcking(true)
    try {
      const res = await fetch(`${BASE_URL}/dispatch/instructions/${active.id}/ack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operator: unitId }),
      })
      if (res.ok) {
        const updated = await res.json()
        setInstructions(prev => prev.map(i => i.id === updated.id ? updated : i))
        setActive(null)
      }
    } catch (e) { /* ignore, will reconnect */ }
    setAcking(false)
  }

  if (!active) return null

  const color = PRIO_COLOR[active.priority] || '#475569'
  const label = TYPE_LABEL[active.type] || active.type.toUpperCase()
  const body = describePayload(active.type, active.payload)

  return (
    <div style={{
      background: color, color: '#fff',
      padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 16,
      borderBottom: '3px solid rgba(255,255,255,0.3)',
      fontFamily: 'Inter, sans-serif',
      animation: 'flashBanner 0.6s ease-out',
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
    case 'assignment':
      return `Pergi ke ${payload.excavator_id} · dump ${payload.dumping_zone}`
    case 'waypoint':
      return `Ikuti rute baru — ${payload.coords?.length || 0} waypoint`
    case 'digging_point':
      return `Digging point baru: ${payload.coord?.map(c => c.toFixed(5)).join(', ')}`
    case 'dumping_point':
      return `Dumping point baru: ${payload.coord?.map(c => c.toFixed(5)).join(', ')}`
    case 'speed_limit':
      return `Speed limit ${payload.kmh} km/h`
    case 'message':
      return payload.text || ''
    default:
      return JSON.stringify(payload).slice(0, 80)
  }
}
