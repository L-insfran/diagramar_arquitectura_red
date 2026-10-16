import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Plus, Search, X } from 'lucide-react'

export type ContainerDeviceOption = {
  id: string
  label: string
  name: string
  deviceType: string | null
  ipAddress: string | null
  areaName?: string | null
  containerName?: string | null
  templateName?: string | null
  alreadyIn: boolean
}

type Props = {
  options: ContainerDeviceOption[]
  onAdd: (deviceId: string) => void
  accent?: 'slate' | 'amber' | 'sky'
  onOpenChange?: (open: boolean) => void
}

type PanelPos = { top: number; left: number; width: number }

const PANEL_WIDTH = 280
const PANEL_ESTIMATED_H = 280

/** Solo un picker abierto a la vez en el diagrama. */
let closeActivePicker: (() => void) | null = null

export function ContainerDevicePicker({
  options,
  onAdd,
  accent = 'slate',
  onOpenChange,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [pos, setPos] = useState<PanelPos | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const anchorRectRef = useRef<{ top: number; left: number; bottom: number } | null>(null)
  const openRef = useRef(false)

  const available = useMemo(() => options.filter((o) => !o.alreadyIn), [options])

  const typeOptions = useMemo(() => {
    const set = new Set<string>()
    for (const o of available) {
      if (o.deviceType) set.add(o.deviceType)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'es'))
  }, [available])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return available.filter((o) => {
      if (typeFilter && (o.deviceType ?? '') !== typeFilter) return false
      if (!q) return true
      const hay = [
        o.name,
        o.deviceType,
        o.ipAddress,
        o.areaName,
        o.containerName,
        o.templateName,
        o.label,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [available, query, typeFilter])

  const closerRef = useRef<(() => void) | null>(null)

  const close = useCallback(() => {
    if (!openRef.current) return
    openRef.current = false
    setOpen(false)
    onOpenChange?.(false)
    if (closerRef.current && closeActivePicker === closerRef.current) {
      closeActivePicker = null
    }
    closerRef.current = null
  }, [onOpenChange])

  const openPicker = useCallback(() => {
    closeActivePicker?.()
    const closer = () => {
      openRef.current = false
      setOpen(false)
      onOpenChange?.(false)
      if (closeActivePicker === closer) closeActivePicker = null
      closerRef.current = null
    }
    closerRef.current = closer
    closeActivePicker = closer
    openRef.current = true
    setOpen(true)
    onOpenChange?.(true)
  }, [onOpenChange])

  const toggle = useCallback(() => {
    if (openRef.current) close()
    else openPicker()
  }, [close, openPicker])

  const computePosition = useCallback((): PanelPos | null => {
    const btn = buttonRef.current
    if (!btn) return null
    const rect = btn.getBoundingClientRect()
    const width = PANEL_WIDTH
    // Prefer align right edge of panel with right edge of button
    let left = rect.right - width
    left = Math.min(Math.max(8, left), window.innerWidth - width - 8)
    let top = rect.bottom + 4
    if (top + PANEL_ESTIMATED_H > window.innerHeight - 8) {
      top = Math.max(8, rect.top - PANEL_ESTIMATED_H - 4)
    }
    return { top, left, width }
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      anchorRectRef.current = null
      return
    }
    const next = computePosition()
    setPos(next)
    const btn = buttonRef.current
    if (btn) {
      const r = btn.getBoundingClientRect()
      anchorRectRef.current = { top: r.top, left: r.left, bottom: r.bottom }
    }
  }, [open, computePosition])

  // Close when the canvas pans/zooms or the container is dragged (React Flow uses CSS transform).
  useEffect(() => {
    if (!open) return
    let raf = 0
    const tick = () => {
      const btn = buttonRef.current
      const anchor = anchorRectRef.current
      if (btn && anchor) {
        const r = btn.getBoundingClientRect()
        const moved =
          Math.abs(r.top - anchor.top) > 1 ||
          Math.abs(r.left - anchor.left) > 1 ||
          Math.abs(r.bottom - anchor.bottom) > 1
        if (moved) {
          close()
          return
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [open, close])

  useEffect(() => {
    if (!open) return
    const onResize = () => {
      const next = computePosition()
      setPos(next)
      const btn = buttonRef.current
      if (btn) {
        const r = btn.getBoundingClientRect()
        anchorRectRef.current = { top: r.top, left: r.left, bottom: r.bottom }
      }
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open, computePosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        close()
      }
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTypeFilter('')
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => {
    return () => {
      if (openRef.current) {
        openRef.current = false
        closeActivePicker = null
      }
    }
  }, [])

  const panelBorder =
    accent === 'amber'
      ? 'border-amber-300/80 dark:border-amber-600/70'
      : accent === 'sky'
        ? 'border-sky-300/80 dark:border-sky-600/70'
        : 'border-slate-300/80 dark:border-slate-600'

  const buttonHover =
    accent === 'amber'
      ? 'hover:bg-amber-100 hover:text-amber-900 dark:hover:bg-amber-900/50 dark:hover:text-amber-100'
      : accent === 'sky'
        ? 'hover:bg-sky-100 hover:text-sky-900 dark:hover:bg-sky-900/50 dark:hover:text-sky-100'
        : 'hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200'

  const pick = (id: string) => {
    onAdd(id)
    close()
    setQuery('')
    setTypeFilter('')
  }

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            className={`overflow-hidden rounded-lg border bg-white shadow-xl dark:bg-slate-900 ${panelBorder}`}
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 9999,
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5 border-b border-slate-100 p-2.5 dark:border-slate-800">
              <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Agregar dispositivo
              </p>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar por nombre, IP o tipo…"
                  className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-8 text-xs text-slate-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600"
                    onClick={() => setQuery('')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {typeOptions.length > 0 ? (
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">Todos los tipos</option>
                  {typeOptions.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="max-h-48 overflow-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-center text-[11px] text-slate-400">
                  {available.length === 0
                    ? 'No hay más dispositivos en el área'
                    : 'Sin resultados'}
                </p>
              ) : (
                filtered.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    className="flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors hover:bg-blue-50 dark:hover:bg-slate-800"
                    onClick={() => pick(o.id)}
                  >
                    <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                      {o.name}
                    </span>
                    <span className="truncate text-[10px] text-slate-500 dark:text-slate-400">
                      {[o.areaName, o.containerName, o.templateName]
                        .filter(Boolean)
                        .join(' - ') || 'Sin ubicación'}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="nodrag nopan relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        title="Agregar dispositivo"
        aria-label="Agregar dispositivo"
        aria-expanded={open}
        className={`nodrag nopan rounded p-0.5 text-slate-400 transition-colors ${buttonHover} ${
          open ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200' : ''
        }`}
        onClick={(e) => {
          e.stopPropagation()
          toggle()
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      {panel}
    </div>
  )
}
