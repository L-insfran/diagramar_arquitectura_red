import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

export type ToastKind = 'success' | 'info' | 'warning' | 'error'

export type Toast = {
  id: string
  kind: ToastKind
  title: string
  description?: string
  createdAt: number
  durationMs: number
}

type ToastInput = Omit<Toast, 'id' | 'createdAt'>

type ToastContextValue = {
  toasts: Toast[]
  show: (toast: ToastInput) => void
  dismiss: (id: string) => void
  success: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Record<string, number>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timersRef.current[id]
    if (timer) {
      window.clearTimeout(timer)
      delete timersRef.current[id]
    }
  }, [])

  const show = useCallback((input: ToastInput) => {
    const id = uid()
    const toast: Toast = { id, createdAt: Date.now(), ...input }
    setToasts((prev) => [toast, ...prev].slice(0, 5))

    timersRef.current[id] = window.setTimeout(() => dismiss(id), input.durationMs)
  }, [dismiss])

  const api = useMemo<ToastContextValue>(() => ({
    toasts,
    show,
    dismiss,
    success: (title, description) => show({ kind: 'success', title, description, durationMs: 3200 }),
    info: (title, description) => show({ kind: 'info', title, description, durationMs: 3200 }),
    warning: (title, description) => show({ kind: 'warning', title, description, durationMs: 4200 }),
    error: (title, description) => show({ kind: 'error', title, description, durationMs: 5200 }),
  }), [toasts, show, dismiss])

  return <ToastContext.Provider value={api}>{children}</ToastContext.Provider>
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}

