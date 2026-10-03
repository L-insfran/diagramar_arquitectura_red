import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import {
  isCacheableGet,
  isWriteMethod,
  projectIdOf,
  readCacheClearProject,
  readCacheGet,
  readCacheKey,
  readCacheSet,
} from './readCache'

type CachedRequestConfig = InternalAxiosRequestConfig & { readCacheHit?: boolean }

const ACTIVE_PROJECT_KEY = 'nm:active-project'
const LEGACY_ACTIVE_COMPANY_KEY = 'nm:active-company'

function resolveActiveProjectId(): string | null {
  const current = localStorage.getItem(ACTIVE_PROJECT_KEY)
  if (current) return current
  const legacy = localStorage.getItem(LEGACY_ACTIVE_COMPANY_KEY)
  if (legacy) {
    localStorage.setItem(ACTIVE_PROJECT_KEY, legacy)
    localStorage.removeItem(LEGACY_ACTIVE_COMPANY_KEY)
    return legacy
  }
  return null
}

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  const projectId = resolveActiveProjectId()
  if (projectId) {
    config.headers['X-Project-Id'] = projectId
  }
  // Let the browser set multipart boundary when sending FormData
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers?.set === 'function') {
      config.headers.set('Content-Type', false)
    } else {
      delete (config.headers as Record<string, unknown>)['Content-Type']
    }
  }

  if (isCacheableGet(config)) {
    const cached = readCacheGet(readCacheKey(config))
    if (cached !== undefined) {
      const hit = config as CachedRequestConfig
      hit.readCacheHit = true
      hit.adapter = async () =>
        ({
          data: cached,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: hit,
        }) as AxiosResponse
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const config = response.config as CachedRequestConfig
    if (config.readCacheHit) return response
    if (isCacheableGet(config) && response.status === 200) {
      readCacheSet(readCacheKey(config), response.data)
    } else if (isWriteMethod(config.method) && response.status >= 200 && response.status < 300) {
      readCacheClearProject(projectIdOf(config))
    }
    return response
  },
  (error) => {
    if (error.response?.status === 401) {
      const isAuthRoute = error.config?.url?.startsWith('/auth/')
      if (!isAuthRoute) {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
