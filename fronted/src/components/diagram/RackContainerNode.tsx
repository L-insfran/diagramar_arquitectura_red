import { memo } from 'react'
import { type Node, type NodeProps } from '@xyflow/react'
import type { TopologyRackSummary } from '../../types'
import {
  ContainerDevicePicker,
  type ContainerDeviceOption,
} from './ContainerDevicePicker'
import {
  CONTAINER_HEADER_H,
  CONTAINER_PAD,
  CONTAINER_SELECTOR_H,
  resolveDeviceGap,
  SIMPLE_DEVICE_STACK_PAD,
  SIMPLE_DEVICE_WIDTH,
  simpleDeviceHeight,
  type DeviceStackLayoutOpts,
} from './SimpleDeviceNode'

export type RackContainerData = {
  rack: TopologyRackSummary
  label?: string
  deviceIds: string[]
  deviceOptions: ContainerDeviceOption[]
  readOnly?: boolean
  /** Oculta el buscador (p. ej. exportación PDF). */
  hidePicker?: boolean
  onAddDevice?: (deviceId: string) => void
  onRemoveDevice?: (deviceId: string) => void
  onPickerOpenChange?: (open: boolean) => void
  [key: string]: unknown
}

export type RackContainerNodeType = Node<RackContainerData, 'rackContainer'>

export function rackContainerSize(
  deviceHeights: number[],
  opts?: DeviceStackLayoutOpts,
) {
  const selectorH = opts?.hidePicker ? 0 : CONTAINER_SELECTOR_H
  const gap = resolveDeviceGap(opts)
  const body =
    deviceHeights.length === 0
      ? 40
      : deviceHeights.reduce((sum, h) => sum + h, 0) +
        gap * Math.max(0, deviceHeights.length - 1)
  return {
    width: CONTAINER_PAD * 2 + SIMPLE_DEVICE_WIDTH + 8,
    height: CONTAINER_HEADER_H + selectorH + SIMPLE_DEVICE_STACK_PAD * 2 + body,
  }
}

function RackContainerNodeComponent({ data, selected }: NodeProps<RackContainerNodeType>) {
  const rack = data.rack
  const hidePicker = Boolean(data.hidePicker || data.readOnly)
  const showPicker = !data.readOnly && !data.hidePicker

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-slate-50 shadow-sm dark:bg-slate-900/90 ${
        selected
          ? 'border-blue-500 ring-1 ring-blue-400/30'
          : 'border-slate-300 dark:border-slate-600'
      }`}
      style={{
        minWidth: CONTAINER_PAD * 2 + SIMPLE_DEVICE_WIDTH + 8,
        minHeight: CONTAINER_HEADER_H + (hidePicker && !data.readOnly ? 0 : CONTAINER_SELECTOR_H) + 56,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-slate-200/80 px-3 py-1.5 dark:border-slate-700/80"
        style={{ minHeight: CONTAINER_HEADER_H, height: CONTAINER_HEADER_H }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            {data.label ?? rack.name}
          </div>
        </div>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500 ring-1 ring-slate-300/80 dark:text-slate-400 dark:ring-slate-600">
          Rack
        </span>
      </div>

      {showPicker ? (
        <div
          className="shrink-0 border-b border-slate-200/80 px-2 py-1.5 dark:border-slate-700/80"
          style={{ height: CONTAINER_SELECTOR_H }}
        >
          <ContainerDevicePicker
            options={data.deviceOptions}
            onAdd={(id) => data.onAddDevice?.(id)}
            onOpenChange={data.onPickerOpenChange}
            accent="slate"
          />
        </div>
      ) : data.readOnly && !data.hidePicker ? (
        <div
          style={{ height: CONTAINER_SELECTOR_H }}
          className="shrink-0 border-b border-slate-200/80 dark:border-slate-700/80"
        />
      ) : null}

      {data.deviceIds.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-[11px] text-slate-400 dark:text-slate-500">
          {data.hidePicker ? 'Sin equipos' : 'Sin equipos · usá el buscador'}
        </div>
      ) : null}
    </div>
  )
}

export const RackContainerNode = memo(RackContainerNodeComponent)

/** Stack Y positions for child devices inside a simple container. */
export function stackDevicePositions(
  deviceIds: string[],
  heightById: Record<string, number>,
  opts?: DeviceStackLayoutOpts,
): Record<string, { x: number; y: number }> {
  const selectorH = opts?.hidePicker ? 0 : CONTAINER_SELECTOR_H
  const gap = resolveDeviceGap(opts)
  const out: Record<string, { x: number; y: number }> = {}
  let y = CONTAINER_HEADER_H + selectorH + SIMPLE_DEVICE_STACK_PAD
  for (const id of deviceIds) {
    out[id] = { x: CONTAINER_PAD, y }
    y += (heightById[id] ?? simpleDeviceHeight(0)) + gap
  }
  return out
}

/**
 * Reorder deviceIds so the dragged device lands at the slot whose vertical
 * midpoint is closest to dropY (relative to the parent container).
 */
export function reorderDeviceIdsByY(
  deviceIds: string[],
  heightById: Record<string, number>,
  draggedId: string,
  dropY: number,
  opts?: DeviceStackLayoutOpts,
): string[] {
  const from = deviceIds.indexOf(draggedId)
  if (from < 0 || deviceIds.length < 2) return deviceIds

  const without = deviceIds.filter((id) => id !== draggedId)
  const stack = stackDevicePositions(without, heightById, opts)
  const draggedH = heightById[draggedId] ?? simpleDeviceHeight(0)
  const centerY = dropY + draggedH / 2

  let insertAt = without.length
  for (let i = 0; i < without.length; i++) {
    const id = without[i]
    const pos = stack[id]
    if (!pos) continue
    const h = heightById[id] ?? simpleDeviceHeight(0)
    const mid = pos.y + h / 2
    if (centerY < mid) {
      insertAt = i
      break
    }
  }

  const next = [...without.slice(0, insertAt), draggedId, ...without.slice(insertAt)]
  if (next.every((id, i) => id === deviceIds[i])) return deviceIds
  return next
}
