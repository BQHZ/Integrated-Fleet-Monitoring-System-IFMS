import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext.jsx'

const NAV = [
  { path: '/', label: 'Fleet Overview', icon: '▣' },
  { path: '/dispatch', label: 'Dispatch Board', icon: '⊞' },
  { path: '/safety', label: 'Safety Monitor', icon: '⚑' },
  { path: '/maintenance', label: 'Maintenance', icon: '⚙' },
  { path: '/report', label: 'Shift Report', icon: '▤' },
]

const ADMIN_NAV = [
  { path: '/admin/users', label: 'User Management', icon: '◉' },
  { path: '/admin/fleet', label: 'Fleet Master', icon: '◈' },
  { path: '/admin/geofences', label: 'Geofence', icon: '◇' },
  { path: '/admin/audit', label: 'Audit Log', icon: '◌' },
]

const ROLE_LABEL = {
  super_admin: 'SUPER ADMIN',
  roc_dispatcher: 'DISPATCHER',
}
const ROLE_COLOR = {
  super_admin: '#7C3AED',
  roc_dispatcher: '#0066CC',
}

export default function Sidebar({ connected }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, hasRole } = useAuth()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const isAdmin = hasRole('super_admin')

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

        {isAdmin && (
          <>
            <div style={{
              padding: '14px 16px 6px', fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
              color: '#7C3AED', textTransform: 'uppercase',
            }}>
              Admin
            </div>
            {ADMIN_NAV.map(item => {
              const active = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    width: '100%', padding: '10px 16px',
                    background: active ? '#7C3AED' : 'transparent',
                    color: active ? '#fff' : '#a8c4e0',
                    border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    textAlign: 'left', transition: 'background 0.15s',
                    borderLeft: active ? '3px solid #C4B5FD' : '3px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 16, width: 20, textAlign: 'center' }}>{item.icon}</span>
                  {item.label}
                </button>
              )
            })}
          </>
        )}
      </nav>

      {/* User info + logout */}
      {user && (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: ROLE_COLOR[user.role] || '#475569', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 13, flexShrink: 0,
            }}>
              {user.name?.split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </div>
              <div style={{
                color: ROLE_COLOR[user.role] || '#a8c4e0', fontSize: 9, fontWeight: 700, letterSpacing: '0.05em',
              }}>
                {ROLE_LABEL[user.role] || user.role?.toUpperCase()}{user.site ? ` · ${user.site}` : ''}
              </div>
            </div>
          </div>
          <button onClick={handleLogout} style={{
            background: 'rgba(255,255,255,0.08)', color: '#a8c4e0',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4,
            padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(196, 30, 58, 0.3)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
          >
            Logout
          </button>
        </div>
      )}

      {/* Connection status */}
      <div style={{
        padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,0.1)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#22C55E' : '#EF4444',
          display: 'inline-block', flexShrink: 0,
          boxShadow: connected ? '0 0 6px #22C55E' : 'none',
        }} />
        <span style={{ color: connected ? '#a8c4e0' : '#fc8181', fontSize: 11 }}>
          {connected ? 'Backend terhubung' : 'Menghubungkan...'}
        </span>
      </div>

      {/* Version */}
      <div style={{ padding: '6px 16px 12px', color: '#4a7fa0', fontSize: 10 }}>
        v3.0 — [ASUMSI demo data]
      </div>
    </div>
  )
}
