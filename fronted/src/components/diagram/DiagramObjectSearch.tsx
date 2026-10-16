import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import { Search, X } from 'lucide-react'
import {
  filterDiagramSearchItems,
  groupDiagramSearchItems,
  type DiagramSearchItem,
} from '../../utils/diagram/diagramObjectSearch'

type Props = {
  items: DiagramSearchItem[]
  onSelect: (item: DiagramSearchItem) => void
  disabled?: boolean
  className?: string
}

export function DiagramObjectSearch({
  items,
  onSelect,
  disabled = false,
  className = '',
}: Props) {
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  const filtered = useMemo(
    () => filterDiagramSearchItems(items, query),
    [items, query]
  )
  const groups = useMemo(() => groupDiagramSearchItems(filtered), [filtered])
  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName?.toLowerCase()
      const typingElsewhere =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      if (typingElsewhere && target !== inputRef.current) return
      if (disabled) return
      e.preventDefault()
      setOpen(true)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [disabled])

  const pick = useCallback(
    (item: DiagramSearchItem) => {
      onSelect(item)
      setQuery(item.label)
      setOpen(false)
      inputRef.current?.blur()
    },
    [onSelect]
  )

  const clear = () => {
    setQuery('')
    setOpen(false)
    setActiveIndex(0)
    inputRef.current?.focus()
  }

  const showList = open && query.trim().length > 0

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (showList) setOpen(false)
      else if (query) clear()
      else inputRef.current?.blur()
      return
    }
    if (!showList || flat.length === 0) {
      if (e.key === 'ArrowDown' && query.trim()) {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const item = flat[activeIndex]
      if (item) pick(item)
    }
  }

  let flatOffset = 0

  return (
    <div
      ref={rootRef}
      className={`relative w-[min(calc(100vw-16rem),18rem)] ${className}`}
    >
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Buscar en el diagrama…"
          aria-label="Buscar en el diagrama"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList && flat[activeIndex]
              ? `${listId}-opt-${flat[activeIndex].id}`
              : undefined
          }
          role="combobox"
          autoComplete="off"
          className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-8 text-sm text-slate-800 shadow-md outline-none placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            if (query.trim()) setOpen(true)
          }}
          onKeyDown={onKeyDown}
        />
        {query ? (
          <button
            type="button"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            onClick={clear}
            aria-label="Limpiar búsqueda"
            title="Limpiar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {showList ? (
        <div
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
        >
          {flat.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-slate-400">
              Nada coincide con «{query.trim()}»
            </p>
          ) : (
            groups.map((group) => {
              const groupStart = flatOffset
              flatOffset += group.items.length
              return (
                <div key={group.kind} role="group" aria-label={group.label}>
                  <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </p>
                  {group.items.map((item, i) => {
                    const index = groupStart + i
                    const active = index === activeIndex
                    return (
                      <button
                        key={item.id}
                        id={`${listId}-opt-${item.id}`}
                        type="button"
                        role="option"
                        aria-selected={active}
                        className={`flex w-full flex-col gap-0.5 px-3 py-2 text-left transition-colors ${
                          active
                            ? 'bg-blue-50 dark:bg-blue-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => pick(item)}
                      >
                        <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                          {item.label}
                        </span>
                        {item.subtitle ? (
                          <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
      ) : null}
    </div>
  )
}
