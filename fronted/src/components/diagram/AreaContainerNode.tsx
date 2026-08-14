import { memo } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import type { TopologyAreaSummary } from '../../types'
import {
  ContainerDevicePicker,
  type ContainerDeviceOption,
} from './ContainerDevicePicker'
import {
  CONTAINER_HEADER_H,
  CONTAINER_SELECTOR_H,
  resolveDeviceGap,
  SIMPLE_DEVICE_WIDTH,
  simpleDeviceHeight,
  type DeviceStackLayoutOpts,
} from './SimpleDeviceNode'

export type AreaContainerData = {
  area: TopologyAreaSummary
  label?: string
  deviceIds: string[]
  deviceOptions: ContainerDeviceOption[]
  /** True when racks/boards are nested inside this area. */
  hasSubContainers?: boolean
  /** Minimum size to fit packed children (NodeResizer floor). */
  contentMinWidth?: number
  contentMinHeight?: number
  readOnly?: boolean
  hidePicker?: boolean
  onAddDevice?: (deviceId: string) => void
  onPickerOpenChange?: (open: boolean) => void
  [key: string]: unknown
}

export type AreaContainerNodeType = Node<AreaContainerData, 'areaContainer'>

/** Gap between nested racks/boards inside an area (room for cables + labels). */
export const AREA_INNER_GAP = 72
/** Extra inset below chrome so children never cover the header/picker. */
export const AREA_BODY_PAD = 16
/** Reserved band between chrome and children for intra-area link labels. */
export const AREA_LABEL_LANE = 52
/** Max row width before wrapping to the next line. */
const AREA_WRAP_AT = 980

/** Height reserved for area header + device picker (must match the node chrome). */
export function areaChromeHeight(opts?: { hidePicker?: boolean }): number {
  return CONTAINER_HEADER_H + (opts?.hidePicker ? 0 : CONTAINER_SELECTOR_H)
}

/** Y where nested racks/boards may start (below chrome + label lane + body pad). */
export function areaContentTop(opts?: { hidePicker?: boolean }): number {
  return areaChromeHeight(opts) + AREA_BODY_PAD + AREA_LABEL_LANE
}

/** Y where loose devices start when the area has no nested racks/boards. */
export function areaLooseContentTop(opts?: { hidePicker?: boolean }): number {
  return areaChromeHeight(opts) + AREA_BODY_PAD
}

/**
 * Keep user extra padding on a resized area, but drop leftover space from
 * devices/racks that no longer exist. Legacy layouts without contentMin snap to content.
 */
export function applySavedAreaExtent(
  contentMin: number,
  savedSize?: number,
  savedContentMin?: number
): number {
  if (!Number.isFinite(contentMin) || contentMin <= 0) return Math.max(0, contentMin)
  if (savedSize == null || !Number.isFinite(savedSize) || savedSize <= 0) return contentMin
  if (savedContentMin == null || !Number.isFinite(savedContentMin) || savedContentMin <= 0) {
    return contentMin
  }
  return contentMin + Math.max(0, savedSize - savedContentMin)
}

/**
 * Pack nested children left→right, wrapping to new rows.
 * Always starts below the area chrome so nothing covers the header.
 */
export function layoutAreaChildren(
  childSizes: { id: string; width: number; height: number }[],
  looseHeights: number[],
  opts?: DeviceStackLayoutOpts,
): {
  width: number
  height: number
  childPositions: Record<string, { x: number; y: number }>
  looseOrigin: { x: number; y: number }
} {
  const nestedTop = areaContentTop(opts)
  const looseOnlyTop = areaLooseContentTop(opts)
  const contentTop = childSizes.length > 0 ? nestedTop : looseOnlyTop
  const gap = resolveDeviceGap(opts)
  const childPositions: Record<string, { x: number; y: number }> = {}

  let cursorX = AREA_BODY_PAD
  let cursorY = contentTop
  let rowH = 0
  let maxX = AREA_BODY_PAD
  let maxY = contentTop

  for (const child of childSizes) {
    if (cursorX > AREA_BODY_PAD && cursorX + child.width > AREA_WRAP_AT) {
      cursorX = AREA_BODY_PAD
      cursorY += rowH + AREA_INNER_GAP
      rowH = 0
    }
    childPositions[child.id] = { x: cursorX, y: cursorY }
    const right = cursorX + child.width
    const bottom = cursorY + child.height
    maxX = Math.max(maxX, right)
    maxY = Math.max(maxY, bottom)
    cursorX = right + AREA_INNER_GAP
    rowH = Math.max(rowH, child.height)
  }

  let looseOrigin = { x: AREA_BODY_PAD, y: contentTop }
  if (looseHeights.length > 0) {
    const body =
      looseHeights.reduce((sum, h) => sum + h, 0) +
      gap * Math.max(0, looseHeights.length - 1)
    if (childSizes.length > 0) {
      if (cursorX > AREA_BODY_PAD && cursorX + SIMPLE_DEVICE_WIDTH + 8 > AREA_WRAP_AT) {
        cursorX = AREA_BODY_PAD
        cursorY += rowH + AREA_INNER_GAP
        rowH = 0
      }
      looseOrigin = { x: cursorX, y: cursorY }
      maxX = Math.max(maxX, cursorX + SIMPLE_DEVICE_WIDTH + 8)
      maxY = Math.max(maxY, cursorY + Math.max(48, body))
    } else {
      looseOrigin = { x: AREA_BODY_PAD, y: contentTop }
      maxX = Math.max(maxX, AREA_BODY_PAD + SIMPLE_DEVICE_WIDTH + 8)
      maxY = Math.max(maxY, contentTop + Math.max(48, body))
    }
  }

  const emptyChrome =
    areaChromeHeight(opts) + AREA_BODY_PAD + 64 + AREA_BODY_PAD
  if (childSizes.length === 0 && looseHeights.length === 0) {
    return {
      width: AREA_BODY_PAD * 2 + SIMPLE_DEVICE_WIDTH + 24,
      height: emptyChrome,
      childPositions,
      looseOrigin,
    }
  }

  return {
    width: Math.max(maxX + AREA_BODY_PAD, AREA_BODY_PAD * 2 + SIMPLE_DEVICE_WIDTH + 24),
    height: Math.max(maxY + AREA_BODY_PAD, emptyChrome),
    childPositions,
    looseOrigin,
  }
}

export function stackLooseDevicePositions(
  deviceIds: string[],
  heightById: Record<string, number>,
  origin: { x: number; y: number },
  opts?: DeviceStackLayoutOpts,
): Record<string, { x: number; y: number }> {
  const gap = resolveDeviceGap(opts)
  const out: Record<string, { x: number; y: number }> = {}
  let y = origin.y
  for (const id of deviceIds) {
    out[id] = { x: origin.x, y }
    y += (heightById[id] ?? simpleDeviceHeight(0)) + gap
  }
  return out
}

export function reorderLooseDeviceIdsByY(
  deviceIds: string[],
  heightById: Record<string, number>,
  draggedId: string,
  dropY: number,
  origin: { x: number; y: number },
  opts?: DeviceStackLayoutOpts,
): string[] {
  const from = deviceIds.indexOf(draggedId)
  if (from < 0 || deviceIds.length < 2) return deviceIds

  const without = deviceIds.filter((id) => id !== draggedId)
  const stack = stackLooseDevicePositions(without, heightById, origin, opts)
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

function AreaContainerNodeComponent({
  data,
  selected,
  width,
  height,
}: NodeProps<AreaContainerNodeType>) {
  const area = data.area
  const showPicker = !data.readOnly && !data.hidePicker
  const showEmpty = data.deviceIds.length === 0 && !data.hasSubContainers
  const chromeH = areaChromeHeight({ hidePicker: data.hidePicker })
  const minW = Math.max(200, data.contentMinWidth ?? 240)
  const minH = Math.max(140, data.contentMinHeight ?? 160)

  return (
    <div
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-xl border-2 shadow-md ${
        selected
          ? 'border-sky-500 bg-sky-100/95 ring-2 ring-sky-400/25 dark:bg-sky-950/70'
          : 'border-sky-500/45 bg-sky-50/95 dark:border-sky-600/55 dark:bg-slate-950/85'
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
          lineClassName="!border-sky-400/80 !border-[2px]"
          handleClassName="!h-3.5 !w-3.5 !rounded-sm !border-2 !border-sky-500 !bg-white dark:!bg-slate-900"
        />
      ) : null}

      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-20"
        style={{ height: chromeH }}
      >
        <div
          className="area-drag-handle pointer-events-auto flex cursor-grab items-start justify-between gap-2 border-b border-sky-400/40 bg-sky-100/95 px-3 py-1.5 active:cursor-grabbing dark:border-sky-700/50 dark:bg-sky-950/95"
          style={{ height: CONTAINER_HEADER_H }}
          title="Arrastrá el área desde aquí · redimensioná desde los bordes"
        >
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold leading-tight tracking-tight text-sky-950 dark:text-sky-50">
              {data.label ?? area.name}
            </div>
            {area.siteName ? (
              <div className="mt-0.5 truncate text-[10px] leading-snug text-sky-800/75 dark:text-sky-200/65">
                {area.siteName}
              </div>
            ) : null}
          </div>
          <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-800 ring-1 ring-sky-500/50 dark:text-sky-200 dark:ring-sky-500/50">
            Área
          </span>
        </div>
        {showPicker ? (
          <div
            className="nodrag nopan pointer-events-auto border-b border-sky-300/50 bg-sky-50/95 px-2 py-1.5 dark:border-sky-800/60 dark:bg-sky-950/90"
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
            className="border-b border-sky-300/40 dark:border-sky-800/50"
          />
        ) : null}
      </div>

      <div className="shrink-0" style={{ height: chromeH }} aria-hidden />

      {data.hasSubContainers ? (
        <div
          className="pointer-events-none shrink-0 border-b border-dashed border-sky-300/25 dark:border-sky-700/30"
          style={{ height: AREA_LABEL_LANE }}
          aria-hidden
        />
      ) : null}

      {showEmpty ? (
        <div className="flex flex-1 items-center justify-center px-4 text-center text-[11px] text-sky-700/65 dark:text-sky-300/55">
          {data.hidePicker
            ? 'Vacío'
            : 'Agregá racks, tableros o equipos sueltos'}
        </div>
      ) : (
        <div className="pointer-events-none flex-1" aria-hidden />
      )}
    </div>
  )
}

export const AreaContainerNode = memo(AreaContainerNodeComponent)
