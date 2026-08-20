import {
  AREA_BODY_PAD,
  areaContentTop,
  areaLooseContentTop,
} from '../../components/diagram/AreaContainerNode'
import {
  CONTAINER_PAD,
  CONTAINER_HEADER_H,
  CONTAINER_SELECTOR_H,
  SIMPLE_DEVICE_STACK_PAD,
  SIMPLE_DEVICE_WIDTH,
  simpleDeviceHeight,
  type DeviceStackLayoutOpts,
} from '../../components/diagram/SimpleDeviceNode'

export type ContainerKind = 'area' | 'rack' | 'board'

/** Y where devices may start inside a rack or board (below chrome + picker). */
export function rackBoardContentTop(opts?: DeviceStackLayoutOpts): number {
  const selectorH = opts?.hidePicker ? 0 : CONTAINER_SELECTOR_H
  return CONTAINER_HEADER_H + selectorH + SIMPLE_DEVICE_STACK_PAD
}

export function areaLooseOrigin(
  hasSubContainers: boolean,
  opts?: DeviceStackLayoutOpts,
): { x: number; y: number } {
  return {
    x: AREA_BODY_PAD,
    y: hasSubContainers ? areaContentTop(opts) : areaLooseContentTop(opts),
  }
}

export function containerBodyPad(kind: ContainerKind): number {
  return kind === 'area' ? AREA_BODY_PAD : CONTAINER_PAD
}

export function containerContentTop(
  kind: ContainerKind,
  opts?: DeviceStackLayoutOpts & { hasSubContainers?: boolean },
): number {
  if (kind === 'area') {
    return areaLooseOrigin(Boolean(opts?.hasSubContainers), opts).y
  }
  return rackBoardContentTop(opts)
}

/** Extra width so a rack/board is a floor, not a single-device column. */
export const RACK_BOARD_EXTRA_FLOOR_W = SIMPLE_DEVICE_WIDTH + 32

/** Default size for a new empty rack/board (layout), not the resize floor. */
export function emptyRackBoardFloorSize(opts?: DeviceStackLayoutOpts): {
  width: number
  height: number
} {
  const contentTop = rackBoardContentTop(opts)
  return {
    width: CONTAINER_PAD * 2 + SIMPLE_DEVICE_WIDTH + 8 + RACK_BOARD_EXTRA_FLOOR_W,
    height: contentTop + 160,
  }
}

/** NodeResizer / CSS floor — chrome only, so the user can shrink empty padding. */
export const RACK_BOARD_RESIZE_MIN_W = 200

export function rackBoardResizeFloor(opts?: DeviceStackLayoutOpts): {
  width: number
  height: number
} {
  return {
    width: RACK_BOARD_RESIZE_MIN_W,
    height: rackBoardContentTop(opts) + 24,
  }
}

export function contentMinFromDeviceRects(
  deviceRects: { x: number; y: number; width: number; height: number }[],
  contentTop: number,
  bodyPad: number,
  emptyFloor: { width: number; height: number },
): { width: number; height: number } {
  if (deviceRects.length === 0) return emptyFloor

  let maxX = bodyPad
  let maxY = contentTop
  for (const d of deviceRects) {
    maxX = Math.max(maxX, d.x + d.width + bodyPad)
    maxY = Math.max(maxY, d.y + d.height + bodyPad)
  }
  return {
    width: Math.max(emptyFloor.width, maxX),
    height: Math.max(emptyFloor.height, maxY),
  }
}

/** Keep device below chrome / padding; do not cap max (parent can expandParent). */
export function clampDeviceMinInContainer(
  pos: { x: number; y: number },
  contentTop: number,
  bodyPad: number,
): { x: number; y: number } {
  return {
    x: Math.max(bodyPad, pos.x),
    y: Math.max(contentTop, pos.y),
  }
}

export function clampDeviceInContainer(
  pos: { x: number; y: number },
  deviceW: number,
  deviceH: number,
  containerW: number,
  containerH: number,
  contentTop: number,
  bodyPad: number,
): { x: number; y: number } {
  const minX = bodyPad
  const minY = contentTop
  const edgePad = 4
  const hasW = Number.isFinite(containerW) && containerW > deviceW
  const hasH = Number.isFinite(containerH) && containerH > deviceH
  const maxX = hasW ? Math.max(minX, containerW - deviceW - edgePad) : pos.x
  const maxY = hasH ? Math.max(minY, containerH - deviceH - edgePad) : pos.y
  return {
    x: hasW ? Math.min(maxX, Math.max(minX, pos.x)) : Math.max(minX, pos.x),
    y: hasH ? Math.min(maxY, Math.max(minY, pos.y)) : Math.max(minY, pos.y),
  }
}

export function resolveDevicePosition(
  deviceId: string,
  nodePositions: Record<string, { x: number; y: number; width?: number; height?: number }> | undefined,
  fallback: { x: number; y: number },
): { x: number; y: number } {
  const saved = nodePositions?.[deviceId]
  if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
    return { x: saved.x, y: saved.y }
  }
  return fallback
}

/** Legacy layouts without any saved XY use the full vertical stack. */
export function hasAnySavedDevicePosition(
  deviceIds: string[],
  nodePositions: Record<string, { x: number; y: number; width?: number; height?: number }> | undefined,
): boolean {
  return deviceIds.some((id) => {
    const p = nodePositions?.[id]
    return p != null && Number.isFinite(p.x) && Number.isFinite(p.y)
  })
}

/** Place a new device near existing ones (does not move siblings). */
export function initialDevicePositionForNew(
  existingIds: string[],
  nodePositions: Record<string, { x: number; y: number; width?: number; height?: number }>,
  heightById: Record<string, number>,
  contentTop: number,
  bodyPad: number,
  deviceGap: number,
): { x: number; y: number } {
  if (existingIds.length === 0) {
    return { x: bodyPad, y: contentTop }
  }

  let anchor = { x: bodyPad, y: contentTop }
  let maxBottom = contentTop - deviceGap
  for (const id of existingIds) {
    const pos = nodePositions[id] ?? { x: bodyPad, y: contentTop }
    const h = heightById[id] ?? simpleDeviceHeight(0)
    const bottom = pos.y + h
    if (bottom > maxBottom) {
      maxBottom = bottom
      anchor = pos
    }
  }
  return { x: anchor.x, y: maxBottom + deviceGap }
}

/** Resolve positions for all devices in a container (saved, legacy stack, or initial). */
export function resolveContainerDevicePositions(params: {
  deviceIds: string[]
  heightById: Record<string, number>
  nodePositions: Record<string, { x: number; y: number; width?: number; height?: number }>
  stackFallback: Record<string, { x: number; y: number }>
  contentTop: number
  bodyPad: number
  deviceGap: number
}): Record<string, { x: number; y: number }> {
  const {
    deviceIds,
    heightById,
    nodePositions,
    stackFallback,
    contentTop,
    bodyPad,
    deviceGap,
  } = params

  if (!hasAnySavedDevicePosition(deviceIds, nodePositions)) {
    return stackFallback
  }

  const out: Record<string, { x: number; y: number }> = {}
  const placed: string[] = []
  for (const id of deviceIds) {
    const saved = nodePositions[id]
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
      out[id] = { x: saved.x, y: saved.y }
    } else {
      out[id] = initialDevicePositionForNew(
        placed,
        out,
        heightById,
        contentTop,
        bodyPad,
        deviceGap,
      )
    }
    placed.push(id)
  }
  return out
}
