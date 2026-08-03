import { useMemo, useState } from 'react'
import type { RackFace, RackOccupancy } from '../../types'
import {
  canPlaceAt,
  canPlaceFullDepthAt,
  isSlotFreeForPlacement,
  occupiedRangesForFace,
  rangeEnd,
  slotsForFace,
} from '../../utils/rackPlacement'

type RackUnitPickerProps = {
  occupancy: RackOccupancy
  face: RackFace
  heightU: number
  value: number | null
  onChange: (unit: number) => void
  excludeDeviceId?: string | null
  disabled?: boolean
  /** When true, U must be free on both front and rear. */
  fullDepth?: boolean
}

export function RackUnitPicker({
  occupancy,
  face,
  heightU,
  value,
  onChange,
  excludeDeviceId,
  disabled = false,
  fullDepth = false,
}: RackUnitPickerProps) {
  const [hoverUnit, setHoverUnit] = useState<number | null>(null)
  const deviceHeight = Math.max(1, heightU)

  const occupied = useMemo(
    () => occupiedRangesForFace(occupancy, face, excludeDeviceId),
    [occupancy, face, excludeDeviceId]
  )

  const slots = useMemo(() => slotsForFace(occupancy, face), [occupancy, face])

  const previewStart = hoverUnit ?? value
  const previewEnd =
    previewStart != null ? rangeEnd(previewStart, deviceHeight) : null

  const selectionLabel =
    value != null
      ? deviceHeight === 1
        ? `U${value}`
        : `U${value}–U${rangeEnd(value, deviceHeight)}`
      : null

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Unidad de inicio
          <span className="ml-1.5 font-normal text-gray-500 dark:text-gray-400">
            ({deviceHeight}U del template
            {fullDepth ? ' · ambas caras' : ''})
          </span>
        </p>
        {selectionLabel && (
          <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
            Selección: {selectionLabel}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {fullDepth
          ? `Elegí una U libre en frente y dorso. Las ocupadas y las que no caben con ${deviceHeight}U no se pueden seleccionar.`
          : `Elegí una U libre en la cara ${face === 'front' ? 'frontal' : 'trasera'}. Las ocupadas y las que no caben con ${deviceHeight}U no se pueden seleccionar.`}
      </p>

      <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-950">
        <div className="max-h-72 overflow-y-auto">
          {slots.map((slot) => {
            const freeForUs = isSlotFreeForPlacement(slot, excludeDeviceId)
            const occupiedBlock = Boolean(slot.deviceId) && !freeForUs
            const isBlockStart = occupiedBlock && slot.isStart
            if (occupiedBlock && !isBlockStart) return null

            const span = occupiedBlock ? Math.max(1, slot.heightU) : 1
            const placeCheck = fullDepth
              ? canPlaceFullDepthAt({
                  start: slot.unit,
                  heightU: deviceHeight,
                  rackHeightU: occupancy.heightU,
                  occupancy,
                  excludeDeviceId,
                })
              : canPlaceAt({
                  start: slot.unit,
                  heightU: deviceHeight,
                  rackHeightU: occupancy.heightU,
                  occupied,
                })
            const canSelect = freeForUs && placeCheck.ok && !disabled
            const inPreview =
              previewStart != null &&
              previewEnd != null &&
              slot.unit >= previewStart &&
              slot.unit <= previewEnd
            const isSelectedStart = value === slot.unit

            if (occupiedBlock) {
              const isShelf = slot.occupantKind === 'shelf' || Boolean(slot.accessoryId)
              const label = isShelf ? slot.accessoryName : slot.deviceName
              return (
                <div
                  key={`${face}-${slot.unit}`}
                  className={`w-full flex items-stretch border-b border-gray-300/80 dark:border-gray-800 text-white ${
                    isShelf
                      ? 'bg-amber-600/90 dark:bg-amber-700/80'
                      : 'bg-slate-600/90 dark:bg-slate-700/80'
                  }`}
                  style={{ minHeight: `${Math.max(28, span * 28)}px` }}
                >
                  <div className="w-12 shrink-0 flex items-center justify-center text-xs font-mono opacity-90 border-r border-white/20">
                    U{slot.unit}
                  </div>
                  <div className="flex-1 px-2 py-1 text-xs flex items-center truncate">
                    {label || 'Ocupado'}
                    {span > 1 ? ` · ${span}U` : ''}
                  </div>
                </div>
              )
            }

            return (
              <button
                key={`${face}-${slot.unit}`}
                type="button"
                disabled={!canSelect}
                onMouseEnter={() => setHoverUnit(slot.unit)}
                onMouseLeave={() => setHoverUnit(null)}
                onClick={() => {
                  if (canSelect) onChange(slot.unit)
                }}
                className={`w-full flex items-stretch border-b border-gray-300/80 dark:border-gray-800 text-left transition-colors ${
                  canSelect
                    ? inPreview
                      ? 'bg-blue-500/30 dark:bg-blue-500/25'
                      : 'bg-white dark:bg-gray-900 hover:bg-blue-50 dark:hover:bg-blue-950/40'
                    : 'bg-gray-200/80 dark:bg-gray-900/60 opacity-60 cursor-not-allowed'
                } ${isSelectedStart ? 'ring-2 ring-inset ring-blue-500' : ''}`}
                style={{ minHeight: '28px' }}
              >
                <div className="w-12 shrink-0 flex items-center justify-center text-xs font-mono text-gray-600 dark:text-gray-400 border-r border-gray-200 dark:border-gray-800">
                  U{slot.unit}
                </div>
                <div className="flex-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 flex items-center">
                  {canSelect ? (inPreview ? 'Vista previa' : 'Libre') : 'No cabe'}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
