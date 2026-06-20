// Wrapper di atas axios instance yang sudah punya Bearer token interceptor.
// Halaman2 cukup import { fetchXxx } dari sini — tidak peduli mekanisme auth.
import { api, BASE_URL as _BASE_URL } from './auth/api.js'

export const BASE_URL = _BASE_URL

async function apiFetch(path) {
  try {
    const res = await api.get(path)
    return res.data
  } catch (e) {
    if (e.response?.status !== 401) {
      console.warn(`[api] Failed ${path}:`, e.message)
    }
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
export const fetchGeofences = () => apiFetch('/api/geofences')

export async function sendInstruction(body) {
  try {
    const res = await api.post('/dispatch/instructions', body)
    return res.data
  } catch (e) {
    throw e
  }
}

export async function fetchInstructions(unitId) {
  try {
    const url = unitId ? `/dispatch/instructions?unit_id=${unitId}` : '/dispatch/instructions'
    const res = await api.get(url)
    return res.data
  } catch { return [] }
}

export async function sendFeedback(body) {
  const res = await api.post('/dispatch/feedback', body)
  return res.data
}

export async function fetchFeedback(unitId) {
  try {
    const url = unitId ? `/dispatch/feedback?unit_id=${unitId}` : '/dispatch/feedback'
    const res = await api.get(url)
    return res.data
  } catch { return [] }
}

export async function postDispatchOverride(body) {
  try {
    const res = await api.post('/api/roc/dispatch-override', body)
    return res.data
  } catch (e) {
    if (e.response?.status !== 401) {
      console.warn('[api] override failed:', e.message)
    }
    return null
  }
}
