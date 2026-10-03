import type { DiagramPortSlot } from './devicePortSlots'
import { anchorToLocalPoint } from './handleAnchor'

/** Screen px around a port handle that still count as a drop target. */
export const PORT_HIT_RADIUS_PX = 18

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
