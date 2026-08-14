import { useEffect, useRef, useState } from 'react'
import { MoreVertical } from 'lucide-react'
import { Button } from '../Button'
import { DeviceStackGapControl } from './DeviceStackGapControl'

type DiagramCanvasOptionsMenuProps = {
  deviceGap: number
  onDeviceGapChange: (gap: number) => void
  deviceGapDisabled?: boolean
  showDeviceGap?: boolean
}

export function DiagramCanvasOptionsMenu({
  deviceGap,
  onDeviceGapChange,
  deviceGapDisabled = false,
  showDeviceGap = true,
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

  if (!showDeviceGap) return null

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
          <DeviceStackGapControl
            variant="menu"
            value={deviceGap}
            onChange={onDeviceGapChange}
            disabled={deviceGapDisabled}
          />
        </div>
      ) : null}
    </div>
  )
}
