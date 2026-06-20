import axios from 'axios'
import { useAuthStore } from './authStore.js'

// GANTI ke IP laptop saat demo di jaringan WiFi yang sama.
export const BASE_URL = 'http://localhost:8000'

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 8000,
})

// Inject Bearer token dari store (selalu read fresh, bukan capture saat init)
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 401 → clear session. Redirect ditangani RouteGuard via reactivity.
let on401Handler = null
export function setOn401Handler(fn) {
  on401Handler = fn
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      useAuthStore.getState().clear()
      if (on401Handler) on401Handler()
    }
    return Promise.reject(err)
  }
)
