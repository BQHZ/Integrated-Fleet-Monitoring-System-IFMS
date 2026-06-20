const LABEL = {
  loading: 'Loading',
  hauling_loaded: 'Hauling (Loaded)',
  dumping: 'Dumping',
  hauling_empty: 'Hauling (Empty)',
  idle: 'Idle',
  pushing: 'Pushing',
  repositioning: 'Repositioning',
  waiting_truck: 'Waiting Truck',
  loading_truck: 'Loading Truck',
  swing_back: 'Swing Back',
  spraying: 'Spraying',
  travelling: 'Travelling',
  refilling: 'Refilling',
  unknown: 'Unknown',
}

export default function StatusBadge({ status }) {
  const cls = `status-${status || 'unknown'}`
  return (
    <span className={cls} style={{
      display: 'inline-block', padding: '2px 8px',
      borderRadius: 4, fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {LABEL[status] || status || 'Unknown'}
    </span>
  )
}
