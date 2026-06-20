export default function KPICard({ title, value, unit, subtitle, color = '#0066CC', trend, trendValue, note }) {
  const trendUp = trend === 'up'
  const trendDown = trend === 'down'

  return (
    <div className="card" style={{
      padding: '14px 16px',
      borderLeft: `4px solid ${color}`,
      display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color: '#1e293b', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
          {value ?? '—'}
        </span>
        {unit && <span style={{ fontSize: 13, color: '#64748B', fontWeight: 500 }}>{unit}</span>}
        {trendValue !== undefined && (
          <span style={{
            fontSize: 12, fontWeight: 600, marginLeft: 4,
            color: trendUp ? '#00875A' : trendDown ? '#C41E3A' : '#64748B',
          }}>
            {trendUp ? '↑' : trendDown ? '↓' : ''} {trendValue}
          </span>
        )}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: '#94A3B8' }}>{subtitle}</div>
      )}
      {note && (
        <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>{note}</div>
      )}
    </div>
  )
}
