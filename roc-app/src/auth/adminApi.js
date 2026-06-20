import { api } from './api.js'

// Generic helpers — admin axios calls dengan unwrap data.
async function safe(fn) {
  try { return (await fn()).data } catch (e) { throw e }
}

// Users
export const adminListUsers = () => safe(() => api.get('/admin/users'))
export const adminCreateUser = (body) => safe(() => api.post('/admin/users', body))
export const adminUpdateUser = (id, body) => safe(() => api.patch(`/admin/users/${id}`, body))
export const adminDeleteUser = (id) => safe(() => api.delete(`/admin/users/${id}`))

// Units
export const adminListUnits = () => safe(() => api.get('/admin/units'))
export const adminCreateUnit = (body) => safe(() => api.post('/admin/units', body))
export const adminUpdateUnit = (id, body) => safe(() => api.patch(`/admin/units/${id}`, body))
export const adminDeleteUnit = (id) => safe(() => api.delete(`/admin/units/${id}`))

// Geofences
export const adminListGeofences = () => safe(() => api.get('/admin/geofences'))
export const adminCreateGeofence = (body) => safe(() => api.post('/admin/geofences', body))
export const adminUpdateGeofence = (id, body) => safe(() => api.patch(`/admin/geofences/${id}`, body))
export const adminDeleteGeofence = (id) => safe(() => api.delete(`/admin/geofences/${id}`))

// Audit
export const adminAuditLog = (params = {}) => {
  const q = new URLSearchParams(params).toString()
  return safe(() => api.get(`/admin/audit-log${q ? '?' + q : ''}`))
}
