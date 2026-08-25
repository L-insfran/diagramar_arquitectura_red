import { memo } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
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
import {
  DIAGRAM_CONTAINER_BADGE,
  DIAGRAM_CONTAINER_TITLE,
  DIAGRAM_EMPTY_HINT,
} from '../../utils/diagram/diagramTypography'
import {
  rackBoardContentTop,
  rackBoardResizeFloor,
} from '../../utils/diagram/containerLayout'

export type RackContainerData = {
  rack: TopologyRackSummary
  /** Unified container ID (replaces legacy rackId reference). */
  containerId?: string
  label?: string
  deviceIds: string[]
  deviceOptions: ContainerDeviceOption[]
  contentMinWidth?: number
  contentMinHeight?: number
  readOnly?: boolean
  /** Oculta el buscador (p. ej. exportación PDF). */
  hidePicker?: boolean
  onAddDevice?: (deviceId: string) => void
  onRemoveDevice?: (deviceId: string) => void
  onPickerOpenChange?: (open: boolean) => void
  [key: string]: unknown
}

export type RackContainerNodeType = Node<RackContainerData, 'rackContainer'>

/** @deprecated Legacy stack sizing — prefer saved container extent + free XY. */
export function rackContainerSize(
  deviceHeights: number[],
  opts?: DeviceStackLayoutOpts,
) {
  const gap = resolveDeviceGap(opts)
  const contentTop = rackBoardContentTop(opts)
  const body =
    deviceHeights.length === 0
      ? 40
      : deviceHeights.reduce((sum, h) => sum + h, 0) +
        gap * Math.max(0, deviceHeights.length - 1)
  return {
    width: CONTAINER_PAD * 2 + SIMPLE_DEVICE_WIDTH + 8,
    height: contentTop + body + CONTAINER_PAD,
  }
}

function RackContainerNodeComponent({
  data,
  selected,
  width,
  height,
}: NodeProps<RackContainerNodeType>) {
  const rack = data.rack
  const showPicker = !data.readOnly && !data.hidePicker
  const floor = rackBoardResizeFloor({ hidePicker: data.hidePicker })
  const minW = floor.width
  const minH = floor.height

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-slate-50 shadow-sm dark:bg-slate-900/90 ${
        selected
          ? 'border-blue-500 ring-1 ring-blue-400/30'
          : 'border-slate-300 dark:border-slate-600'
      }`}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
        minWidth: minW,
        minHeight: minH,
      }}
    >
      {!data.readOnly && !data.hidePicker ? (
        <NodeResizer
          minWidth={minW}
          minHeight={minH}
          isVisible={selected}
          keepAspectRatio={false}
          lineClassName="!border-blue-400/80 !border-[2px]"
          handleClassName="!h-3.5 !w-3.5 !rounded-sm !border-2 !border-blue-500 !bg-white dark:!bg-slate-900"
        />
      ) : null}

      <div
        className="rack-drag-handle flex shrink-0 cursor-grab items-center justify-between gap-2 overflow-hidden border-b border-slate-200/80 px-3 py-1.5 active:cursor-grabbing dark:border-slate-700/80"
        style={{ minHeight: CONTAINER_HEADER_H, height: CONTAINER_HEADER_H }}
        title="Arrastrá el rack desde aquí · redimensioná desde los bordes"
      >
        <div className="min-w-0 flex-1">
          <div className={`truncate ${DIAGRAM_CONTAINER_TITLE} text-slate-900 dark:text-slate-100`}>
            {data.label ?? rack.name}
          </div>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 ${DIAGRAM_CONTAINER_BADGE} text-slate-500 ring-1 ring-slate-300/80 dark:text-slate-400 dark:ring-slate-600`}>
          Rack
        </span>
      </div>

      {showPicker ? (
        <div
          className="nodrag nopan shrink-0 border-b border-slate-200/80 px-2 py-1.5 dark:border-slate-700/80"
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

      <div
        className="pointer-events-none relative min-h-0 flex-1 bg-[radial-gradient(circle,_rgb(148_163_184/0.35)_1px,_transparent_1px)] [background-size:14px_14px] dark:bg-[radial-gradient(circle,_rgb(100_116_139/0.45)_1px,_transparent_1px)]"
        style={{ margin: CONTAINER_PAD, marginTop: SIMPLE_DEVICE_STACK_PAD }}
      >
        {data.deviceIds.length === 0 ? (
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center ${DIAGRAM_EMPTY_HINT} text-slate-400 dark:text-slate-500`}>
            {data.hidePicker ? 'Sin equipos' : 'Sin equipos · usá el buscador'}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const RackContainerNode = memo(RackContainerNodeComponent)

/** Stack Y positions for child devices inside a simple container (legacy fallback). */
export function stackDevicePositions(
  deviceIds: string[],
  heightById: Record<string, number>,
  opts?: DeviceStackLayoutOpts,
): Record<string, { x: number; y: number }> {
  const gap = resolveDeviceGap(opts)
  const out: Record<string, { x: number; y: number }> = {}
  let y = rackBoardContentTop(opts)
  for (const id of deviceIds) {
    out[id] = { x: CONTAINER_PAD, y }
    y += (heightById[id] ?? simpleDeviceHeight(0)) + gap
  }
  return out
}
