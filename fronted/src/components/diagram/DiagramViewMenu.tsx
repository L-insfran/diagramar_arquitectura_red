import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, GitBranch, Network, RefreshCw } from 'lucide-react'
import { Button } from '../Button'
import type { DiagramLayoutMode } from '../../types'

type DiagramViewMenuProps = {
  layoutMode?: DiagramLayoutMode
  onLayoutModeChange?: (mode: DiagramLayoutMode) => void
  onReorganizeTree?: () => void
  disabled?: boolean
}

const VIEWS: {
  mode: DiagramLayoutMode
  label: string
  hint: string
  icon: typeof Network
}[] = [
  {
    mode: 'free',
    label: 'Vista libre',
    hint: 'Movés equipos y contenedores a mano.',
    icon: Network,
  },
  {
    mode: 'tree',
    label: 'Vista árbol',
    hint: 'Orden automático según los enlaces.',
    icon: GitBranch,
  },
]

export function DiagramViewMenu({
  layoutMode = 'free',
  onLayoutModeChange,
  onReorganizeTree,
  disabled = false,
}: DiagramViewMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const current = layoutMode === 'tree' ? 'Árbol' : 'Libre'
  const canChange = Boolean(onLayoutModeChange) && !disabled

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div className="relative" ref={menuRef}>
      <Button
        size="sm"
        variant={open ? 'primary' : 'secondary'}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Vistas, actual: ${current}`}
        title="Cambiar entre vista libre y vista árbol"
        disabled={!canChange && !onReorganizeTree}
      >
        Vistas
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            open
              ? 'bg-white/20 text-white'
              : 'bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-200'
          }`}
        >
          {current}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
      </Button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="menu"
        >
          <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Cómo se ve el diagrama
          </p>
          {VIEWS.map((view) => {
            const active = layoutMode === view.mode
            const Icon = view.icon
            return (
              <button
                key={view.mode}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                disabled={!canChange}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left disabled:cursor-default ${
                  active
                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-100'
                    : 'text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800'
                }`}
                onClick={() => {
                  if (!canChange) return
                  if (!active) onLayoutModeChange?.(view.mode)
                  setOpen(false)
                }}
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{view.label}</span>
                  <span className="block text-[11px] font-normal leading-snug text-slate-500 dark:text-slate-400">
                    {view.hint}
                  </span>
                </span>
                {active ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : null}
              </button>
            )
          })}
          {layoutMode === 'tree' && onReorganizeTree ? (
            <div className="border-t border-slate-100 p-1 dark:border-slate-800">
              <button
                type="button"
                role="menuitem"
                disabled={disabled}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                onClick={() => {
                  onReorganizeTree()
                  setOpen(false)
                }}
              >
                <RefreshCw className="h-4 w-4" />
                Reorganizar árbol
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
