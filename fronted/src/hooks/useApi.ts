import { useState, useEffect, useCallback, useRef } from 'react'

interface UseApiState<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useApi<T>(fetcher: () => Promise<T>, deps: any[] = []): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [trigger, setTrigger] = useState(0)
  /** Refetch explícito: no poner isLoading (evita desmontar UI, p. ej. React Flow). */
  const softRefreshRef = useRef(false)

  const refetch = useCallback(() => {
    softRefreshRef.current = true
    setTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    const softRefresh = softRefreshRef.current
    softRefreshRef.current = false
    if (!softRefresh) setIsLoading(true)
    setError(null)

    fetcher()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err?.response?.data?.message || err.message || 'An error occurred')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [trigger, ...deps])

  return { data, isLoading, error, refetch }
}
