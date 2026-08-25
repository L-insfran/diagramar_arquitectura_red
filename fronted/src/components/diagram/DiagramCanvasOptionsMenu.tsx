import { useEffect, useRef, useState } from 'react'
import { MoreVertical, Network, GitBranch } from 'lucide-react'
import { Button } from '../Button'
import type { DiagramLayoutMode, DiagramPortDisplay } from '../../types'

type DiagramCanvasOptionsMenuProps = {
  layoutMode?: DiagramLayoutMode
  onLayoutModeChange?: (mode: DiagramLayoutMode) => void
  portDisplay?: DiagramPortDisplay
  onPortDisplayChange?: (mode: DiagramPortDisplay) => void
  portFlowInverted?: boolean
  onPortFlowInvertedChange?: (inverted: boolean) => void
  onReorganizeTree?: () => void
  layoutDisabled?: boolean
}

export function DiagramCanvasOptionsMenu({
  layoutMode = 'free',
  onLayoutModeChange,
  portDisplay = 'all',
  onPortDisplayChange,
  portFlowInverted = false,
  onPortFlowInvertedChange,
  onReorganizeTree,
  layoutDisabled = false,
}: DiagramCanvasOptionsMenuProps) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

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

  if (!onLayoutModeChange && !onPortDisplayChange && !onPortFlowInvertedChange) return null

  return (
    <div className="relative" ref={menuRef}>
      <Button
        size="sm"
        variant={open ? 'primary' : 'secondary'}
        icon={<MoreVertical className="h-4 w-4" />}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Opciones del diagrama"
      >
        Opciones
      </Button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[min(calc(100vw-1.5rem),22rem)] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="menu"
        >
          {onLayoutModeChange ? (
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-800">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Tipo de diagrama
              </p>
              <div className="flex gap-1">
                <button
                  type="button"
                  disabled={layoutDisabled}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    layoutMode === 'free'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => {
                    if (layoutMode !== 'free') onLayoutModeChange('free')
                    setOpen(false)
                  }}
                >
                  <Network className="h-3.5 w-3.5" />
                  Libre
                </button>
                <button
                  type="button"
                  disabled={layoutDisabled}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition ${
                    layoutMode === 'tree'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                  }`}
                  onClick={() => {
                    if (layoutMode !== 'tree') onLayoutModeChange('tree')
                    setOpen(false)
                  }}
                >
                  <GitBranch className="h-3.5 w-3.5" />
                  Árbol
                </button>
              </div>
              {layoutMode === 'tree' && onReorganizeTree ? (
                <button
                  type="button"
                  disabled={layoutDisabled}
                  className="mt-2 w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  onClick={() => {
                    onReorganizeTree()
                    setOpen(false)
                  }}
                >
                  Reorganizar árbol
                </button>
              ) : null}
            </div>
          ) : null}

          {onPortDisplayChange || onPortFlowInvertedChange ? (
            <div className="space-y-2 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Puertos
              </p>
              {onPortDisplayChange ? (
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <span>Mostrar todos los puertos</span>
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={portDisplay === 'all'}
                    disabled={layoutDisabled}
                    onChange={(e) =>
                      onPortDisplayChange(e.target.checked ? 'all' : 'connected')
                    }
                  />
                </label>
              ) : null}
              {onPortFlowInvertedChange ? (
                <label className="flex cursor-pointer items-center justify-between gap-2 text-xs text-slate-700 dark:text-slate-200">
                  <span>Invertir origen / destino</span>
                  <input
                    type="checkbox"
                    className="rounded border-slate-300"
                    checked={portFlowInverted}
                    disabled={layoutDisabled}
                    onChange={(e) => onPortFlowInvertedChange(e.target.checked)}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
