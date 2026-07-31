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
}

/** Occupied blocks on one face, excluding an optional device (edit mode). */
export function occupiedRangesForFace(
  occupancy: RackOccupancy,
  face: RackFace,
  excludeDeviceId?: string | null
): OccupiedRange[] {
  return occupancy.devices
    .filter((d) => d.rackFace === face && d.id !== excludeDeviceId)
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      start: d.rackUnitStart,
      end: d.rackUnitEnd,
      heightU: d.heightU,
    }))
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
  if (!slot.deviceId) return true
  return Boolean(excludeDeviceId && slot.deviceId === excludeDeviceId)
}
