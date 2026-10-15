import { useEffect, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button } from '../Button'
import type { DiagramPortDisplay } from '../../types'

type DiagramCanvasOptionsMenuProps = {
  portDisplay?: DiagramPortDisplay
  onPortDisplayChange?: (mode: DiagramPortDisplay) => void
  portFlowInverted?: boolean
  onPortFlowInvertedChange?: (inverted: boolean) => void
  disabled?: boolean
}

export function DiagramCanvasOptionsMenu({
  portDisplay = 'all',
  onPortDisplayChange,
  portFlowInverted = false,
  onPortFlowInvertedChange,
  disabled = false,
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

  if (!onPortDisplayChange && !onPortFlowInvertedChange) return null

  return (
    <div className="relative" ref={menuRef}>
      <Button
        size="sm"
        variant={open ? 'primary' : 'secondary'}
        icon={<SlidersHorizontal className="h-4 w-4" />}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        title="Opciones de puertos"
      >
        Opciones
      </Button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-[min(calc(100vw-1.5rem),18rem)] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          role="menu"
        >
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
                    disabled={disabled}
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
                    disabled={disabled}
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
