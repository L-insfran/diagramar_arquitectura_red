import { useMemo, useState } from 'react'
import type { RackFace, RackOccupancy } from '../types'
import {
  canPlaceAt,
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
}

export function RackUnitPicker({
  occupancy,
  face,
  heightU,
  value,
  onChange,
  excludeDeviceId,
  disabled = false,
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
            ({deviceHeight}U del template)
          </span>
        </p>
        {selectionLabel && (
          <p className="text-xs font-mono text-blue-600 dark:text-blue-400">
            Selección: {selectionLabel}
          </p>
        )}
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Elegí una U libre en la cara {face === 'front' ? 'frontal' : 'trasera'}. Las ocupadas y las
        que no caben con {deviceHeight}U no se pueden seleccionar.
      </p>

      <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-950">
        <div className="max-h-72 overflow-y-auto">
          {slots.map((slot) => {
            const freeForUs = isSlotFreeForPlacement(slot, excludeDeviceId)
            const occupiedBlock = Boolean(slot.deviceId) && !freeForUs
            const isBlockStart = occupiedBlock && slot.isStart
            if (occupiedBlock && !isBlockStart) return null

            const span = occupiedBlock ? Math.max(1, slot.heightU) : 1
            const placeCheck = canPlaceAt({
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
                    isShelf ? 'bg-amber-700/90' : 'bg-blue-600/90'
                  }`}
                  style={{ minHeight: `${Math.max(22, span * 18)}px` }}
                  title={`${label} · U${slot.unit}–U${slot.unit + span - 1}`}
                >
                  <span className="w-10 shrink-0 flex items-center justify-center text-[10px] font-mono border-r border-white/20 opacity-80">
                    {slot.unit}
                  </span>
                  <span className="flex flex-1 items-center min-w-0 px-2 py-1 text-xs font-medium truncate">
                    {isShelf ? 'Bandeja · ' : ''}
                    {label}{' '}
                    <span className="opacity-80 font-normal ml-1">({span}U)</span>
                  </span>
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
                title={
                  canSelect
                    ? `Montar desde U${slot.unit} (${deviceHeight}U)`
                    : placeCheck.ok
                      ? `U${slot.unit}`
                      : placeCheck.reason
                }
                className={`w-full flex items-stretch border-b border-gray-300/80 dark:border-gray-800 text-left transition-colors ${
                  isSelectedStart
                    ? 'bg-emerald-600/90 text-white'
                    : inPreview
                      ? 'bg-emerald-500/25 ring-1 ring-inset ring-emerald-500'
                      : canSelect
                        ? 'bg-white dark:bg-gray-900 hover:bg-emerald-500/10'
                        : 'bg-gray-200/80 dark:bg-gray-800/80 cursor-not-allowed opacity-60'
                }`}
                style={{ minHeight: '22px' }}
              >
                <span
                  className={`w-10 shrink-0 flex items-center justify-center text-[10px] font-mono border-r border-gray-300/60 dark:border-gray-800 ${
                    isSelectedStart ? 'text-white/80' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {slot.unit}
                </span>
                <span
                  className={`flex flex-1 items-center px-2 py-1 text-xs ${
                    isSelectedStart
                      ? 'text-white'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {isSelectedStart
                    ? `inicio · ${deviceHeight}U`
                    : inPreview
                      ? 'rango'
                      : canSelect
                        ? 'libre'
                        : 'no cabe'}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
