import { useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { path: '/', label: 'Fleet Overview', icon: '▣' },
  { path: '/dispatch', label: 'Dispatch Board', icon: '⊞' },
  { path: '/safety', label: 'Safety Monitor', icon: '⚑' },
  { path: '/maintenance', label: 'Maintenance', icon: '⚙' },
  { path: '/report', label: 'Shift Report', icon: '▤' },
]

export default function Sidebar({ connected }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div style={{
      width: 220, minHeight: '100vh', background: '#1e3a5f',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 100,
    }}>
      {/* Brand */}
      <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, letterSpacing: '-0.02em' }}>
          PAMA ROC
        </div>
        <div style={{ color: '#7fa8cc', fontSize: 11, marginTop: 2, fontWeight: 500 }}>
          Fleet Operations Center
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 0' }}>
        {NAV.map(item => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '10px 16px',
                background: active ? '#0066CC' : 'transparent',
                color: active ? '#fff' : '#a8c4e0',
                border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: active ? 600 : 400,
                textAlign: 'left', transition: 'background 0.15s',
                borderLeft: active ? '3px solid #60aaff' : '3px solid transparent',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
            >
              <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Connection status */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#22C55E' : '#EF4444',
          display: 'inline-block', flexShrink: 0,
          boxShadow: connected ? '0 0 6px #22C55E' : 'none',
        }} />
        <span style={{ color: connected ? '#a8c4e0' : '#fc8181', fontSize: 12 }}>
          {connected ? 'Backend terhubung' : 'Menghubungkan...'}
        </span>
      </div>

      {/* Version */}
      <div style={{ padding: '8px 16px 16px', color: '#4a7fa0', fontSize: 11 }}>
        v3.0 — [ASUMSI demo data]
      </div>
    </div>
  )
}
