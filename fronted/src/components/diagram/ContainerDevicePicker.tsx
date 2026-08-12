import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Search, X } from 'lucide-react'

export type ContainerDeviceOption = {
  id: string
  label: string
  name: string
  deviceType: string | null
  ipAddress: string | null
  alreadyIn: boolean
}

type Props = {
  options: ContainerDeviceOption[]
  onAdd: (deviceId: string) => void
  accent?: 'slate' | 'amber'
  onOpenChange?: (open: boolean) => void
}

type PanelPos = { top: number; left: number; width: number }

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
      const hay = [o.name, o.deviceType, o.ipAddress, o.label]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return hay.includes(q)
    })
  }, [available, query, typeFilter])

  const updateOpen = useCallback(
    (next: boolean) => {
      setOpen(next)
      onOpenChange?.(next)
    },
    [onOpenChange]
  )

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const width = Math.max(rect.width, 240)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    let top = rect.bottom + 4
    const estimatedHeight = 280
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 4)
    }
    setPos({ top, left: Math.max(8, left), width })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePosition()
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onReposition = () => updatePosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, updatePosition])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const target = e.target as Node
      if (rootRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      updateOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, updateOpen])

  useEffect(() => {
    if (open) {
      setQuery('')
      setTypeFilter('')
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const border =
    accent === 'amber'
      ? 'border-amber-300 dark:border-amber-700'
      : 'border-slate-300 dark:border-slate-600'
  const panelBorder =
    accent === 'amber'
      ? 'border-amber-300/80 dark:border-amber-600/70'
      : 'border-slate-300/80 dark:border-slate-600'

  const pick = (id: string) => {
    onAdd(id)
    updateOpen(false)
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
                      {[o.deviceType, o.ipAddress].filter(Boolean).join(' · ') || 'Sin tipo'}
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
    <div ref={rootRef} className="nodrag nopan relative">
      <button
        ref={buttonRef}
        type="button"
        className={`flex w-full items-center justify-between rounded-md border bg-white px-2.5 py-1.5 text-left text-xs text-slate-600 shadow-sm transition-colors hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 ${border}`}
        onClick={(e) => {
          e.stopPropagation()
          updateOpen(!open)
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <span>Agregar dispositivo…</span>
        <Search className="h-3.5 w-3.5 opacity-50" />
      </button>
      {panel}
    </div>
  )
}
