import type { DiagramPortSlot } from './devicePortSlots'
import { anchorToLocalPoint } from './handleAnchor'

/** Screen px around a port handle that still count as a drop target. */
export const PORT_HIT_RADIUS_PX = 36

/**
 * Grab-disc diameter in flow px. Compensates zoom so the target stays about
 * 28 screen px, which is large enough to catch when ports sit on top of each other.
 */
export function portGrabDiameterPx(zoom: number): number {
  const z = zoom > 0 ? zoom : 1
  return Math.min(44, Math.max(22, 28 / z))
}

/** Flow px of cable hit-testing removed at each end so the grab disc stays reachable. */
export function portCableClearancePx(zoom: number): number {
  return portGrabDiameterPx(zoom) / 2 + 6
}

export type PortHitNode = {
  id: string
  absX: number
  absY: number
  width: number
  height: number
  slots: DiagramPortSlot[]
}

export type PortHit = {
  deviceId: string
  handleId: string
  label: string
  x: number
  y: number
}

export function portHitRadiusForZoom(zoom: number): number {
  const z = zoom > 0 ? zoom : 1
  return PORT_HIT_RADIUS_PX / z
}

/**
 * Nearest port handle within `radius` (flow px) of `point`.
 * `excludeDeviceId` skips the device that started the drag.
 */
export function hitTestPortHandle(
  nodes: PortHitNode[],
  point: { x: number; y: number },
  radius: number,
  excludeDeviceId?: string
): PortHit | null {
  let best: { hit: PortHit; dist: number } | null = null

  for (const node of nodes) {
    if (excludeDeviceId && node.id === excludeDeviceId) continue
    for (const slot of node.slots) {
      const local = anchorToLocalPoint(slot.anchor, node.width, node.height)
      const x = node.absX + local.x
      const y = node.absY + local.y
      const dist = Math.hypot(point.x - x, point.y - y)
      if (dist > radius) continue
      if (best && dist >= best.dist) continue
      best = {
        dist,
        hit: {
          deviceId: node.id,
          handleId: slot.id,
          label: slot.label,
          x,
          y,
        },
      }
    }
  }

  return best?.hit ?? null
}

function slotHit(
  node: PortHitNode,
  slot: DiagramPortSlot,
  point: { x: number; y: number }
): PortHit & { dist: number; connected: boolean } {
  const local = anchorToLocalPoint(slot.anchor, node.width, node.height)
  const x = node.absX + local.x
  const y = node.absY + local.y
  return {
    deviceId: node.id,
    handleId: slot.id,
    label: slot.label,
    x,
    y,
    dist: Math.hypot(point.x - x, point.y - y),
    connected: slot.connected,
  }
}

function chooseSlotHit(
  options: Array<PortHit & { dist: number; connected: boolean }>,
  aimRadius: number
): PortHit | null {
  if (options.length === 0) return null
  const aimed = options.filter((option) => option.dist <= aimRadius).sort((a, b) => a.dist - b.dist)[0]
  const free = options.filter((option) => !option.connected).sort((a, b) => a.dist - b.dist)[0]
  const nearest = [...options].sort((a, b) => a.dist - b.dist)[0]
  const chosen = aimed ?? free ?? nearest
  if (!chosen) return null
  return {
    deviceId: chosen.deviceId,
    handleId: chosen.handleId,
    label: chosen.label,
    x: chosen.x,
    y: chosen.y,
  }
}

/**
 * Port under the pointer, or the nearest free port of the device that contains it.
 * `excludeDeviceId` is the device that started the drag.
 */
export function flowPortDropTarget(
  nodes: PortHitNode[],
  point: { x: number; y: number },
  radius: number,
  excludeDeviceId?: string
): PortHit | null {
  const precise = hitTestPortHandle(nodes, point, radius, excludeDeviceId)
  if (precise) return precise

  const containing = nodes.filter((node) => {
    if (excludeDeviceId && node.id === excludeDeviceId) return false
    if (node.slots.length === 0) return false
    return (
      point.x >= node.absX - radius &&
      point.x <= node.absX + node.width + radius &&
      point.y >= node.absY - radius &&
      point.y <= node.absY + node.height + radius
    )
  })
  if (containing.length === 0) return null
  containing.sort((a, b) => {
    const aDist = Math.hypot(point.x - (a.absX + a.width / 2), point.y - (a.absY + a.height / 2))
    const bDist = Math.hypot(point.x - (b.absX + b.width / 2), point.y - (b.absY + b.height / 2))
    return aDist - bDist
  })
  const node = containing[0]
  return chooseSlotHit(
    node.slots.map((slot) => slotHit(node, slot, point)),
    radius
  )
}

export type DomPortDrop = {
  deviceId: string
  /** Null when the target device has no port handles (open the link form). */
  handleId: string | null
  label: string
}

/**
 * Device or port under the cursor, using the rendered handles.
 * Geometric hit-testing drifts when a node sits inside a container; the DOM does not.
 */
export function domPortDropTarget(
  clientX: number,
  clientY: number,
  sourceDeviceId: string,
  slotsByDevice: ReadonlyMap<string, DiagramPortSlot[]>
): DomPortDrop | null {
  if (typeof document === 'undefined') return null
  const stack = document.elementsFromPoint(clientX, clientY)
  let deviceEl: HTMLElement | null = null
  for (const el of stack) {
    if (!(el instanceof Element)) continue
    const node = el.closest<HTMLElement>('.react-flow__node-simpleDevice')
    const nodeId = node?.getAttribute('data-id')
    if (!node || !nodeId || nodeId === sourceDeviceId) continue
    deviceEl = node
    break
  }
  if (!deviceEl) return null
  const deviceId = deviceEl.getAttribute('data-id')
  if (!deviceId) return null
  const slots = slotsByDevice.get(deviceId) ?? []
  if (slots.length === 0) return { deviceId, handleId: null, label: '' }

  const measured: Array<{ handleId: string; label: string; dist: number; connected: boolean }> = []
  const seen = new Set<string>()
  for (const handle of deviceEl.querySelectorAll<HTMLElement>('.react-flow__handle')) {
    const raw = handle.getAttribute('data-handleid')
    if (!raw || raw === 'device-in' || raw === 'device-out') continue
    const handleId = raw.replace(/::in$/, '')
    if (seen.has(handleId)) continue
    seen.add(handleId)
    const rect = handle.getBoundingClientRect()
    const slot = slots.find((item) => item.id === handleId)
    measured.push({
      handleId,
      label: slot?.label ?? '',
      connected: slot?.connected ?? false,
      dist: Math.hypot(
        clientX - (rect.left + rect.width / 2),
        clientY - (rect.top + rect.height / 2)
      ),
    })
  }
  if (measured.length === 0) {
    const slot = slots.find((item) => !item.connected) ?? slots[0]
    return slot
      ? { deviceId, handleId: slot.id, label: slot.label }
      : { deviceId, handleId: null, label: '' }
  }
  const aimed = measured
    .filter((item) => item.dist <= PORT_HIT_RADIUS_PX)
    .sort((a, b) => a.dist - b.dist)[0]
  const free = measured.filter((item) => !item.connected).sort((a, b) => a.dist - b.dist)[0]
  const nearest = [...measured].sort((a, b) => a.dist - b.dist)[0]
  const chosen = aimed ?? free ?? nearest
  return { deviceId, handleId: chosen.handleId, label: chosen.label }
}
