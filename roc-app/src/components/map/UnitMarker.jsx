// Imperative helper: build DOM element untuk MapLibre marker.
// Disebut "UnitMarker.jsx" sesuai spec walaupun bukan React component murni
// (MapLibre marker API butuh DOM, bukan React node).

const STATUS_COLOR = {
  loading: '#1D4ED8', hauling_loaded: '#166534', dumping: '#92400E', hauling_empty: '#475569',
  idle: '#9A3412', pushing: '#3730A3', waiting_truck: '#92400E', loading_truck: '#166534',
  spraying: '#155E75', travelling: '#475569', refilling: '#5B21B6',
  grading: '#0E7490', repositioning: '#475569', servicing: '#7C3AED',
  swing_back: '#166534',
}

const TYPE_LABEL = {
  haul_truck: 'T', excavator: 'E', dozer: 'D', grader: 'G',
  water_truck: 'W', service_truck: 'S',
}

/**
 * Build DOM element untuk marker satu unit.
 * @param {Object} unit
 * @param {Object} opts { selected: boolean, onClick, onHover, onHoverEnd }
 * @returns {{el: HTMLElement, update: (unit, opts) => void}}
 */
export function createUnitMarker(initialUnit, opts = {}) {
  // PENTING: jangan sentuh el.style.transform — MapLibre pakai itu untuk
  // positioning (translate(x,y)). Scaling/rotasi custom kita taruh di inner div.
  const el = document.createElement('div')
  el.className = 'pama-unit-marker'
  el.style.cursor = 'pointer'

  const inner = document.createElement('div')
  inner.style.transition = 'transform 0.2s'
  inner.style.willChange = 'transform'
  inner.style.transformOrigin = '50% 100%'  // anchor bottom (sama dengan marker anchor)
  el.appendChild(inner)

  const render = (unit, o = {}) => {
    const color = STATUS_COLOR[unit.status] || '#64748B'
    const label = TYPE_LABEL[unit.unit_type] || '?'
    const heading = unit.heading_deg ?? 0
    const ring = o.selected
      ? `<circle cx="14" cy="14" r="14" fill="none" stroke="#0066CC" stroke-width="3" />`
      : ''
    const fault = unit.fault_code
      ? `<circle cx="22" cy="6" r="5" fill="#C41E3A" stroke="white" stroke-width="1.5" />`
      : ''
    const pending = (o.pendingCount || 0) > 0
      ? `<g><circle cx="22" cy="6" r="7" fill="#7C3AED" stroke="white" stroke-width="1.5" />
           <text x="22" y="9" text-anchor="middle" font-size="9" font-weight="bold" fill="white"
                 font-family="Inter,sans-serif">${o.pendingCount}</text></g>`
      : ''
    inner.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="28" height="36" viewBox="0 0 28 36" style="display:block">
        ${ring}
        <g transform="rotate(${heading} 14 14)">
          <path d="M14 0 C6.27 0 0 6.27 0 14 C0 24.5 14 36 14 36 C14 36 28 24.5 28 14 C28 6.27 21.73 0 14 0Z"
                fill="${color}" stroke="white" stroke-width="2"/>
        </g>
        <text x="14" y="19" text-anchor="middle" font-size="11" font-weight="bold" fill="white"
              font-family="Inter,sans-serif">${label}</text>
        ${pending}
        ${fault}
      </svg>`
    // Scaling pada inner — el.style.transform tetap milik MapLibre
    inner.style.transform = o.selected ? 'scale(1.15)' : 'scale(1)'
  }

  render(initialUnit, opts)

  if (opts.onClick) el.addEventListener('click', opts.onClick)
  if (opts.onHover) el.addEventListener('mouseenter', opts.onHover)
  if (opts.onHoverEnd) el.addEventListener('mouseleave', opts.onHoverEnd)

  return { el, update: render }
}

export function unitTypeLabel(type) { return TYPE_LABEL[type] || '?' }
export function unitStatusColor(status) { return STATUS_COLOR[status] || '#64748B' }
