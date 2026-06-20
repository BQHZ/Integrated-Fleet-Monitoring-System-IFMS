function relativeTime(ts) {
  const diff = Math.floor((Date.now() / 1000) - ts)
  if (diff < 60) return `${diff}d lalu`
  if (diff < 3600) return `${Math.floor(diff / 60)}m lalu`
  return `${Math.floor(diff / 3600)}j lalu`
}

const KIND_COLOR = {
  fault: { bg: '#FEE2E2', color: '#991B1B', border: '#C41E3A' },
  fuel_low: { bg: '#FFFBEB', color: '#92400E', border: '#F59E0B' },
  idle: { bg: '#FFF7ED', color: '#9A3412', border: '#FB923C' },
  speed_violation: { bg: '#FEF3C7', color: '#92400E', border: '#F59E0B' },
  default: { bg: '#F8FAFC', color: '#475569', border: '#94A3B8' },
}

export default function AlertFeed({ alerts = [] }) {
  if (alerts.length === 0) {
    return (
      <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
        Tidak ada alert aktif
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 12, maxHeight: 320, overflowY: 'auto' }}>
      {alerts.slice(0, 20).map((a, i) => {
        const c = KIND_COLOR[a.kind] || KIND_COLOR.default
        return (
          <div key={i} style={{
            background: c.bg, borderLeft: `3px solid ${c.border}`,
            borderRadius: 4, padding: '7px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
          }}>
            <div>
              <span style={{ fontWeight: 700, color: c.color, fontSize: 12 }}>{a.unit_id}</span>
              <span style={{ color: c.color, fontSize: 12, marginLeft: 6 }}>{a.message}</span>
            </div>
            <span style={{ color: '#94A3B8', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {relativeTime(a.timestamp)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
