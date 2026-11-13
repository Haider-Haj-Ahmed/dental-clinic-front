import axios from 'axios'

export const portalApi = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'}/portal`,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
})

portalApi.interceptors.request.use(config => {
  const raw = localStorage.getItem('dental-portal-auth')
  if (raw) {
    try {
      const { state } = JSON.parse(raw)
      if (state?.token) config.headers.Authorization = `Bearer ${state.token}`
    } catch {}
  }
  return config
})

portalApi.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('dental-portal-auth')
      window.location.href = '/portal/login'
    }
    return Promise.reject(err)
  },
)

export function getPortalToken() {
  try { return JSON.parse(localStorage.getItem('dental-portal-auth') || '{}')?.state?.token ?? '' } catch { return '' }
}
