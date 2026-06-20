// GANTI ke IP laptop saat demo di jaringan WiFi yang sama
const BASE_URL = 'http://localhost:8000'

async function apiFetch(path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    console.warn(`[api] Failed ${path}:`, e.message)
    return null
  }
}

export const fetchProductionKPI = () => apiFetch('/api/roc/production-kpi')
export const fetchPayloadAnalysis = () => apiFetch('/api/roc/payload-analysis')
export const fetchCycleBreakdown = () => apiFetch('/api/roc/cycle-breakdown')
export const fetchDispatchMatrix = () => apiFetch('/api/roc/dispatch-matrix')
export const fetchSafetyEvents = () => apiFetch('/api/roc/safety-events')
export const fetchMaintenanceHealth = () => apiFetch('/api/roc/maintenance-health')
export const fetchShiftSummary = () => apiFetch('/api/roc/shift-summary')
export const fetchCrossSiteBenchmark = () => apiFetch('/api/roc/cross-site-benchmark')
export const fetchPayloadHistogram = () => apiFetch('/api/roc/payload-histogram')
export const fetchDelayBreakdown = () => apiFetch('/api/roc/delay-breakdown')
export const fetchDispatchRecommendations = () => apiFetch('/api/roc/dispatch-recommendations')
export const fetchDispatchOverrides = () => apiFetch('/api/roc/dispatch-overrides')

export async function postDispatchOverride(body) {
  try {
    const res = await fetch(`${BASE_URL}/api/roc/dispatch-override`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    console.warn('[api] override failed:', e.message)
    return null
  }
}
