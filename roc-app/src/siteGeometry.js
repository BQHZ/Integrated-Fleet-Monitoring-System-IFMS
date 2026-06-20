// Koordinat selaras dengan backend SITE_WAYPOINTS & simulator NO_GO_ZONES.
// [ASUMSI] geometri demo — bukan layout PAMA riil.

const SITE_A = { lat: -3.58, lon: 115.60 }
const SITE_B = { lat: -2.18, lon: 115.24 }
const LOADING_OFFSET = [0.004, 0.002]
const DUMPING_OFFSET = [-0.003, -0.005]

function offset(site, dlat, dlon) {
  return [site.lat + dlat, site.lon + dlon]
}

export const LOADING_POINTS = [
  { id: 'LP-A', site_id: 'siteA', name: 'Loading Point North Pit', pos: offset(SITE_A, ...LOADING_OFFSET) },
  { id: 'LP-B', site_id: 'siteB', name: 'Loading Point South', pos: offset(SITE_B, ...LOADING_OFFSET) },
]

export const DUMPING_POINTS = [
  { id: 'DP-A', site_id: 'siteA', name: 'Dump Point West', pos: offset(SITE_A, ...DUMPING_OFFSET) },
  { id: 'DP-B', site_id: 'siteB', name: 'Dump Point East', pos: offset(SITE_B, ...DUMPING_OFFSET) },
]

// Haul road: titik intermediate sederhana antara loading & dumping
function roadPath(site) {
  const load = offset(site, ...LOADING_OFFSET)
  const dump = offset(site, ...DUMPING_OFFSET)
  const mid = [
    (load[0] + dump[0]) / 2 + 0.001,
    (load[1] + dump[1]) / 2 - 0.001,
  ]
  return [load, mid, dump]
}

export const HAUL_ROADS = [
  { id: 'HR-A', site_id: 'siteA', name: 'Haul Road Main A', path: roadPath(SITE_A) },
  { id: 'HR-B', site_id: 'siteB', name: 'Haul Road Main B', path: roadPath(SITE_B) },
]

// Pit boundary: kotak sederhana di sekitar center site
function pitBoundary(site, dx = 0.008, dy = 0.006) {
  return [
    [site.lat + dy, site.lon - dx],
    [site.lat + dy, site.lon + dx],
    [site.lat - dy, site.lon + dx],
    [site.lat - dy, site.lon - dx],
  ]
}

export const PIT_BOUNDARIES = [
  { id: 'PIT-A', site_id: 'siteA', name: 'Pit Boundary Site A', polygon: pitBoundary(SITE_A) },
  { id: 'PIT-B', site_id: 'siteB', name: 'Pit Boundary Site B', polygon: pitBoundary(SITE_B) },
]

// No-Go Zones — match simulator NO_GO_ZONES
export const NO_GO_ZONES = [
  { id: 'NGZ-A1', site_id: 'siteA', name: 'Blast Area North', center: [-3.5760, 115.6030], radius_m: 80 },
  { id: 'NGZ-A2', site_id: 'siteA', name: 'Slope Unstable', center: [-3.5840, 115.5960], radius_m: 60 },
  { id: 'NGZ-B1', site_id: 'siteB', name: 'Blast Prep Zone', center: [-2.1760, 115.2430], radius_m: 80 },
]

export const SITE_CENTERS = {
  siteA: SITE_A,
  siteB: SITE_B,
}
