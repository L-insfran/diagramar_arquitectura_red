import type { InternalAxiosRequestConfig } from 'axios'

const TTL_MS = 20_000
const MAX_ENTRIES = 40

type Entry = {
  at: number
  data: unknown
}

const store = new Map<string, Entry>()

export function projectIdOf(config: InternalAxiosRequestConfig): string {
  const headers = config.headers
  const raw =
    typeof headers?.get === 'function'
      ? headers.get('X-Project-Id')
      : (headers as Record<string, unknown> | undefined)?.['X-Project-Id']
  return typeof raw === 'string' ? raw : ''
}

function paramsKey(config: InternalAxiosRequestConfig): string {
  if (config.params == null) return ''
  try {
    return JSON.stringify(config.params)
  } catch {
    return ''
  }
}

export function readCacheKey(config: InternalAxiosRequestConfig): string {
  return ['GET', projectIdOf(config), config.url ?? '', paramsKey(config)].join('\n')
}

export function isCacheableGet(config: InternalAxiosRequestConfig): boolean {
  const method = (config.method ?? 'get').toLowerCase()
  if (method !== 'get') return false
  const responseType = config.responseType
  return responseType == null || responseType === 'json'
}

export function readCacheGet(key: string): unknown | undefined {
  const entry = store.get(key)
  if (!entry) return undefined
  if (Date.now() - entry.at > TTL_MS) {
    store.delete(key)
    return undefined
  }
  try {
    return JSON.parse(JSON.stringify(entry.data)) as unknown
  } catch {
    return entry.data
  }
}

export function readCacheSet(key: string, data: unknown) {
  if (typeof Blob !== 'undefined' && data instanceof Blob) return
  if (typeof data === 'undefined') return
  store.delete(key)
  store.set(key, { at: Date.now(), data })
  while (store.size > MAX_ENTRIES) {
    let oldestKey: string | null = null
    let oldestAt = Infinity
    for (const [candidate, entry] of store) {
      if (entry.at < oldestAt) {
        oldestAt = entry.at
        oldestKey = candidate
      }
    }
    if (!oldestKey) break
    store.delete(oldestKey)
  }
}

export function readCacheClearProject(projectId: string) {
  const prefix = `GET\n${projectId}\n`
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export function isWriteMethod(method: string | undefined): boolean {
  const name = (method ?? '').toLowerCase()
  return name === 'post' || name === 'put' || name === 'patch' || name === 'delete'
}
