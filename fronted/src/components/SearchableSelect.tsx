import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Search, X } from 'lucide-react'

export type SearchableSelectOption = {
  value: string
  label: string
  description?: string
  group?: string
  disabled?: boolean
  disabledReason?: string
}

type PanelPos = { top: number; left: number; width: number }

type Props = {
  label?: string
  value: string
  onChange: (value: string) => void
  options: SearchableSelectOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyOptionLabel?: string
  groupFilterLabel?: string
  disabled?: boolean
  /** Mostrar el nombre completo (sin recortar con puntos suspensivos). */
  wrapLabel?: boolean
}

function matchesQuery(option: SearchableSelectOption, query: string): boolean {
  if (!query) return true
  const hay = [option.label, option.description, option.group, option.disabledReason]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return hay.includes(query)
}

export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  placeholder = 'Seleccionar…',
  searchPlaceholder = 'Buscar…',
  emptyOptionLabel,
  groupFilterLabel = 'Ubicación',
  disabled = false,
  wrapLabel = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [groupFilter, setGroupFilter] = useState('')
  const [pos, setPos] = useState<PanelPos | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = options.find((o) => o.value === value)

  const groups = useMemo(() => {
    const names = new Set<string>()
    for (const option of options) {
      if (option.group) names.add(option.group)
    }
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [options])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return options.filter((option) => {
      if (groupFilter && option.group !== groupFilter) return false
      return matchesQuery(option, q)
    })
  }, [options, query, groupFilter])

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const width = Math.max(rect.width, wrapLabel ? 360 : 260)
    const left = Math.min(rect.left, window.innerWidth - width - 8)
    const estimatedHeight = 320
    let top = rect.bottom + 4
    if (top + estimatedHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - estimatedHeight - 4)
    }
    setPos({ top, left: Math.max(8, left), width })
  }, [wrapLabel])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setGroupFilter('')
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setPos(null)
      return
    }
    updatePosition()
  }, [open, updatePosition, filtered.length, groupFilter])

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
      close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
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
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  const pick = (next: string) => {
    onChange(next)
    close()
  }

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900"
            style={{
              position: 'fixed',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 80,
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="space-y-1.5 border-b border-gray-100 p-2.5 dark:border-gray-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-full rounded-md border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-8 text-xs text-gray-800 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
                {query ? (
                  <button
                    type="button"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:text-gray-600"
                    onClick={() => setQuery('')}
                    aria-label="Limpiar búsqueda"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
              {groups.length > 1 ? (
                <label className="block space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {groupFilterLabel}
                  </span>
                  <select
                    value={groupFilter}
                    onChange={(e) => setGroupFilter(e.target.value)}
                    className="w-full rounded-md border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    <option value="">Todas</option>
                    {groups.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className="max-h-52 overflow-auto py-1">
              {emptyOptionLabel ? (
                <button
                  type="button"
                  className={`flex w-full px-3 py-2 text-left text-xs transition-colors hover:bg-blue-50 dark:hover:bg-gray-800 ${
                    !value ? 'bg-blue-50 font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-100' : 'text-gray-500'
                  }`}
                  onClick={() => pick('')}
                >
                  {emptyOptionLabel}
                </button>
              ) : null}
              {filtered.length === 0 ? (
                <p className="px-3 py-3 text-center text-[11px] text-gray-400">
                  {options.length === 0 ? 'Sin opciones' : 'Sin resultados'}
                </p>
              ) : (
                filtered.map((option) => {
                  const isSelected = option.value === value
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={option.disabled}
                      title={option.disabled ? option.disabledReason : option.description}
                      className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                        option.disabled
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:bg-blue-50 dark:hover:bg-gray-800'
                      } ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-950/40'
                          : ''
                      }`}
                      onClick={() => {
                        if (!option.disabled) pick(option.value)
                      }}
                    >
                      <span
                        className={`${
                          wrapLabel ? 'break-words whitespace-normal' : 'truncate'
                        } text-xs font-medium text-gray-800 dark:text-gray-100`}
                      >
                        {option.label}
                        {option.disabled && option.disabledReason ? ` — ${option.disabledReason}` : ''}
                      </span>
                      {option.description ? (
                        <span
                          className={`${
                            wrapLabel ? 'break-words whitespace-normal' : 'truncate'
                          } text-[10px] text-gray-500 dark:text-gray-400`}
                        >
                          {option.description}
                        </span>
                      ) : null}
                    </button>
                  )
                })
              )}
            </div>
          </div>,
          document.body
        )
      : null

  return (
    <div ref={rootRef} className="space-y-1.5">
      {label ? (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      ) : null}
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (disabled) return
          setOpen((prev) => !prev)
        }}
        className={`flex w-full items-start justify-between gap-2 rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-left text-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 ${
          selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'
        }`}
        title={selected?.description ? `${selected.label} · ${selected.description}` : selected?.label}
      >
        <span
          className={`min-w-0 flex-1 ${
            wrapLabel ? 'break-words whitespace-normal leading-snug' : 'truncate'
          }`}
        >
          {selected?.label || placeholder}
        </span>
        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" aria-hidden />
      </button>
      {selected?.description ? (
        <p className="break-words text-xs leading-snug text-gray-500 dark:text-gray-400">
          {selected.description}
        </p>
      ) : null}
      {panel}
    </div>
  )
}
