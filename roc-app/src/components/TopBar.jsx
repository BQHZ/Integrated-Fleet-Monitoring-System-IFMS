import { useEffect, useState } from 'react'
import { useAuth } from '../auth/AuthContext.jsx'

const PAGE_TITLES = {
  '/': 'Fleet Overview',
  '/dispatch': 'Dispatch & Fleet Assignment',
  '/safety': 'Safety & Health Monitoring',
  '/maintenance': 'Predictive Maintenance',
  '/report': 'Shift Report & Analytics',
}

function useShiftTimer() {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(iv)
  }, [])
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60)
  const s = elapsed % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function useNow() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(iv)
  }, [])
  return now
}

export default function TopBar({ pathname, siteFilter, onSiteFilter }) {
  const timer = useShiftTimer()
  const now = useNow()
  const title = PAGE_TITLES[pathname] || 'Fleet Operations Center'
  const { user, hasRole } = useAuth()

  const siteContext = user?.role === 'roc_dispatcher' && user.site
    ? `${user.site} Site`
    : 'All Sites'
  const siteColor = user?.role === 'roc_dispatcher' ? '#0066CC' : '#7C3AED'

  return (
    <div style={{
      height: 52, background: '#fff', borderBottom: '1px solid #E2E8F0',
      display: 'flex', alignItems: 'center', padding: '0 20px',
      gap: 16, position: 'sticky', top: 0, zIndex: 50,
    }}>
      {/* Page title + site context badge */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#1e3a5f' }}>{title}</span>
        <span style={{
          background: `${siteColor}15`, color: siteColor,
          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.02em',
        }}>
          {siteContext}
        </span>
      </div>

      {/* Shift timer */}
      <div style={{
        background: '#F1F5F9', borderRadius: 6, padding: '4px 12px',
        fontSize: 13, fontVariantNumeric: 'tabular-nums',
      }}>
        <span style={{ color: '#64748B', marginRight: 6 }}>Shift Elapsed</span>
        <span style={{ fontWeight: 700, color: '#1e3a5f' }}>{timer}</span>
      </div>

      {/* Site filter */}
      <select
        value={siteFilter}
        onChange={e => onSiteFilter(e.target.value)}
        style={{
          border: '1px solid #E2E8F0', borderRadius: 6, padding: '5px 10px',
          fontSize: 13, color: '#1e293b', background: '#fff', cursor: 'pointer',
        }}
      >
        <option value="all">Semua Site</option>
        <option value="siteA">Site A (MTBU)</option>
        <option value="siteB">Site B (ADRO)</option>
      </select>

      {/* Current time */}
      <div style={{ fontSize: 13, color: '#64748B', fontVariantNumeric: 'tabular-nums' }}>
        {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>

      {/* System status */}
      <div style={{
        background: '#DCFCE7', color: '#166534',
        borderRadius: 6, padding: '3px 10px', fontSize: 12, fontWeight: 600,
      }}>
        SYSTEM OPERATIONAL
      </div>
    </div>
  )
}
