// Modal sederhana — overlay + card. Esc/click-luar untuk close.
import { useEffect } from 'react'

export default function Modal({ title, onClose, children, width = 480 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 10, maxWidth: width, width: '100%',
          maxHeight: '90vh', overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(15, 23, 42, 0.25)',
        }}
      >
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid #E2E8F0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#1e293b' }}>{title}</span>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontSize: 18, color: '#94A3B8', padding: 0, width: 24, height: 24,
          }}>×</button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

export const fieldStyle = {
  display: 'block', width: '100%', boxSizing: 'border-box',
  marginTop: 4, padding: '7px 10px', fontSize: 13,
  border: '1px solid #CBD5E1', borderRadius: 5, outline: 'none',
  fontFamily: 'inherit',
}

export const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 8,
}

export const primaryBtn = {
  background: '#0066CC', color: '#fff', border: 'none', borderRadius: 5,
  padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}

export const secondaryBtn = {
  background: '#fff', color: '#475569', border: '1px solid #CBD5E1', borderRadius: 5,
  padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
}

export const dangerBtn = {
  background: '#C41E3A', color: '#fff', border: 'none', borderRadius: 5,
  padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
}
