import { facesForMountType } from '#dtos/rack_accessory_dto'
import type { RackFace, ShelfMountType } from '#dtos/rack_accessory_dto'
import type { OccupantKind } from '#dtos/rack_dto'

export type RackFootprintKind = OccupantKind | 'shelf_device'

export type RackFootprint = {
  kind: RackFootprintKind
  id: string
  name: string
  face: RackFace
  unitStart: number
  unitEnd: number
  /** Horizontal thirds: rails/shelves use 0–2 (full width). */
  slotStart: number
  slotEnd: number
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function footprintsOverlap(a: RackFootprint, b: RackFootprint): boolean {
  if (a.face !== b.face) return false
  if (!rangesOverlap(a.unitStart, a.unitEnd, b.unitStart, b.unitEnd)) return false
  return rangesOverlap(a.slotStart, a.slotEnd, b.slotStart, b.slotEnd)
}

/** Effective vertical U for a shelf-resting device. */
export function shelfDeviceHeightU(
  shelfHeightU: number | null | undefined,
  templateRackUnits: number | null | undefined
): number {
  if (shelfHeightU != null && shelfHeightU >= 1) {
    return Math.min(20, Math.max(1, Math.round(shelfHeightU)))
  }
  return Math.max(1, templateRackUnits ?? 1)
}

/**
 * One footprint per face blocked by the supporting shelf.
 * Anchored at shelf.unitStart; grows upward for `heightU` units.
 */
export function shelfDeviceFootprints(params: {
  deviceId: string
  deviceName: string
  shelfUnitStart: number
  shelfMountType: ShelfMountType
  heightU: number
  shelfSlotStart: number
  shelfWidthSlots: number
}): RackFootprint[] {
  const heightU = Math.max(1, params.heightU)
  const unitStart = params.shelfUnitStart
  const unitEnd = unitStart + heightU - 1
  const slotStart = Math.min(2, Math.max(0, params.shelfSlotStart))
  const width = params.shelfWidthSlots === 3 ? 3 : 1
  const slotEnd = Math.min(2, slotStart + width - 1)

  return facesForMountType(params.shelfMountType).map((face) => ({
    kind: 'shelf_device' as const,
    id: params.deviceId,
    name: params.deviceName,
    face,
    unitStart,
    unitEnd,
    slotStart,
    slotEnd,
  }))
}

/** Full-width footprint for a rail-mounted device. */
export function railDeviceFootprint(params: {
  deviceId: string
  deviceName: string
  face: RackFace
  unitStart: number
  heightU: number
}): RackFootprint {
  const heightU = Math.max(1, params.heightU)
  return {
    kind: 'device',
    id: params.deviceId,
    name: params.deviceName,
    face: params.face,
    unitStart: params.unitStart,
    unitEnd: params.unitStart + heightU - 1,
    slotStart: 0,
    slotEnd: 2,
  }
}

/** Full-width footprint(s) for a shelf accessory. */
export function shelfFootprints(params: {
  accessoryId: string
  accessoryName: string
  unitStart: number
  heightU: number
  mountType: ShelfMountType
}): RackFootprint[] {
  const heightU = Math.max(1, params.heightU)
  const unitEnd = params.unitStart + heightU - 1
  return facesForMountType(params.mountType).map((face) => ({
    kind: 'shelf' as const,
    id: params.accessoryId,
    name: params.accessoryName,
    face,
    unitStart: params.unitStart,
    unitEnd,
    slotStart: 0,
    slotEnd: 2,
  }))
}
