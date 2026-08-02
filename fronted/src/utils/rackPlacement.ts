import type { RackFace, RackOccupancy, RackOccupancySlot } from '../types'

export function rangeEnd(start: number, heightU: number): number {
  return start + Math.max(1, heightU) - 1
}

export function rangesOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number
): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export type OccupiedRange = {
  deviceId: string
  deviceName: string
  start: number
  end: number
  heightU: number
  kind?: 'device' | 'shelf' | 'shelf_device'
}

/** Occupied blocks on one face (devices + shelves + shelf-resting devices). */
export function occupiedRangesForFace(
  occupancy: RackOccupancy,
  face: RackFace,
  excludeDeviceId?: string | null
): OccupiedRange[] {
  const fromDevices = occupancy.devices
    .filter((d) => d.rackFace === face && d.id !== excludeDeviceId)
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      start: d.rackUnitStart,
      end: d.rackUnitEnd,
      heightU: d.heightU,
      kind: 'device' as const,
    }))

  const fromShelves = (occupancy.accessories ?? [])
    .filter((a) => a.faces.includes(face))
    .map((a) => ({
      deviceId: a.id,
      deviceName: a.name,
      start: a.unitStart,
      end: a.unitEnd,
      heightU: a.heightU,
      kind: 'shelf' as const,
    }))

  const fromShelfDevices = (occupancy.accessories ?? [])
    .filter((a) => a.faces.includes(face))
    .flatMap((a) =>
      a.devices
        .filter((d) => d.id !== excludeDeviceId)
        .map((d) => {
          const heightU = Math.max(1, d.heightU)
          const end = d.unitEnd ?? a.unitStart + heightU - 1
          return {
            deviceId: d.id,
            deviceName: d.name,
            start: a.unitStart,
            end,
            heightU,
            kind: 'shelf_device' as const,
          }
        })
    )

  return [...fromDevices, ...fromShelves, ...fromShelfDevices]
}

export function canPlaceAt(params: {
  start: number
  heightU: number
  rackHeightU: number
  occupied: OccupiedRange[]
}): { ok: true } | { ok: false; reason: string } {
  const heightU = Math.max(1, params.heightU)
  const start = params.start
  if (!Number.isFinite(start) || start < 1) {
    return { ok: false, reason: 'La U de inicio debe ser un número ≥ 1.' }
  }
  const end = rangeEnd(start, heightU)
  if (end > params.rackHeightU) {
    return {
      ok: false,
      reason: `El equipo (${heightU}U desde U${start}) no cabe en el rack de ${params.rackHeightU}U`,
    }
  }
  for (const other of params.occupied) {
    if (rangesOverlap(start, end, other.start, other.end)) {
      return {
        ok: false,
        reason: `Solape con "${other.deviceName}" (U${other.start}–U${other.end})`,
      }
    }
  }
  return { ok: true }
}

export function slotsForFace(occupancy: RackOccupancy, face: RackFace): RackOccupancySlot[] {
  return face === 'front' ? occupancy.slotsFront : occupancy.slotsRear
}

/** Slot treated as free for placement UI when it belongs to the device being edited. */
export function isSlotFreeForPlacement(
  slot: RackOccupancySlot,
  excludeDeviceId?: string | null
): boolean {
  if (slot.accessoryId) return false
  if (slot.occupantKind === 'shelf_device') {
    return Boolean(excludeDeviceId && slot.deviceId === excludeDeviceId)
  }
  if (!slot.deviceId) return true
  return Boolean(excludeDeviceId && slot.deviceId === excludeDeviceId)
}

export function mountTypeLabel(mountType: string): string {
  return mountType === 'four_post' ? 'Integral (4 postes)' : 'Solo frontal'
}
