import { useEffect, useRef, useState } from 'react'

const BACKEND_HOST = 'localhost'
const WS_URL = (unitId) => `ws://${BACKEND_HOST}:8000/ws/incab/${unitId}`

// Chime untuk feedback — beda dari instruction (lebih lembut, 1 nada ascending)
function playFeedbackChime(category) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime
    // Praise = dua nada major ascending happy
    // Safety = nada turun warning
    // Lainnya = single nada
    const seqs = {
      praise: [523, 659, 784],   // C-E-G major chord
      safety: [880, 660],        // descending warning
      productivity: [659, 523],  // descending soft
      quality: [659, 698],       // small step
    }
    const notes = seqs[category] || [659]
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + i * 0.16)
      gain.gain.exponentialRampToValueAtTime(0.18, now + i * 0.16 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.16 + 0.18)
      osc.connect(gain).connect(ctx.destination)
      osc.start(now + i * 0.16)
      osc.stop(now + i * 0.16 + 0.2)
    })
    setTimeout(() => ctx.close(), 900)
  } catch (e) { /* ignore */ }
}

/**
 * Single WebSocket connection untuk semua incab events (instruction + feedback + acks).
 * Returns {instructions, feedback, applyInstructionAck, applyFeedbackAck}.
 */
export function useIncabBus(unitId) {
  const [instructions, setInstructions] = useState([])
  const [feedback, setFeedback] = useState([])
  const [latestInstruction, setLatestInstruction] = useState(null)
  const wsRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const knownInstIdsRef = useRef(new Set())
  const knownFbIdsRef = useRef(new Set())

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
            setInstructions(prev => prev.some(p => p.id === ins.id) ? prev : [ins, ...prev])
            if (!knownInstIdsRef.current.has(ins.id) && ins.status !== 'ack') {
              knownInstIdsRef.current.add(ins.id)
              setLatestInstruction(ins)
            }
          } else if (msg.type === 'ack') {
            setInstructions(prev => prev.map(i => i.id === msg.data.id ? msg.data : i))
            setLatestInstruction(prev => prev?.id === msg.data.id ? null : prev)
          } else if (msg.type === 'feedback') {
            const fb = msg.data
            setFeedback(prev => prev.some(p => p.id === fb.id) ? prev : [fb, ...prev])
            if (!knownFbIdsRef.current.has(fb.id) && fb.status !== 'ack') {
              knownFbIdsRef.current.add(fb.id)
              playFeedbackChime(fb.category)
            }
          } else if (msg.type === 'feedback_ack') {
            setFeedback(prev => prev.map(f => f.id === msg.data.id ? msg.data : f))
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

  return {
    instructions,
    feedback,
    latestInstruction,
    clearLatestInstruction: () => setLatestInstruction(null),
    applyInstructionAck: (updated) => {
      setInstructions(prev => prev.map(i => i.id === updated.id ? updated : i))
      setLatestInstruction(prev => prev?.id === updated.id ? null : prev)
    },
    applyFeedbackAck: (updated) => {
      setFeedback(prev => prev.map(f => f.id === updated.id ? updated : f))
    },
  }
}
