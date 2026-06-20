/**
 * Skeleton block — shimmer pulse animation.
 * Props: width, height, radius, count (jumlah baris untuk list skeleton).
 */
export default function Skeleton({ width = '100%', height = 16, radius = 4, count = 1, gap = 8 }) {
  if (count > 1) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap }}>
        {Array.from({ length: count }).map((_, i) => (
          <SkelBlock key={i} width={width} height={height} radius={radius} />
        ))}
      </div>
    )
  }
  return <SkelBlock width={width} height={height} radius={radius} />
}

function SkelBlock({ width, height, radius }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'linear-gradient(90deg, #E2E8F0 0%, #F1F5F9 50%, #E2E8F0 100%)',
      backgroundSize: '200% 100%',
      animation: 'skel 1.6s ease-in-out infinite',
    }} />
  )
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('skel-anim')) {
  const style = document.createElement('style')
  style.id = 'skel-anim'
  style.textContent = `
    @keyframes skel { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
  `
  document.head.appendChild(style)
}

export function CardSkeleton({ height = 100 }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <Skeleton height={12} width="40%" />
      <div style={{ height: 8 }} />
      <Skeleton height={height - 40} />
    </div>
  )
}

export function TableSkeleton({ rows = 5 }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <Skeleton height={14} width="30%" />
      <div style={{ height: 12 }} />
      <Skeleton count={rows} height={20} gap={10} />
    </div>
  )
}
