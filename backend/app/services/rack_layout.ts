import { facesForMountType } from '#dtos/rack_accessory_dto'
import type { RackFace, ShelfMountType } from '#dtos/rack_accessory_dto'
import type { DeviceRackFace, OccupantKind } from '#dtos/rack_dto'

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

/** Normalize device mount face to physical footprint face(s). */
export function facesForDeviceRackFace(face: DeviceRackFace | null | undefined): RackFace[] {
  if (face === 'both') return ['front', 'rear']
  if (face === 'rear') return ['rear']
  return ['front']
}

export function isFullDepthFace(face: DeviceRackFace | null | undefined): boolean {
  return face === 'both'
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
 * Footprint(s) of a shelf-resting device.
 * Anchored at shelf.unitStart; grows upward for `heightU` units.
 * Full-depth devices reserve front + rear regardless of shelf mount type.
 */
export function shelfDeviceFootprints(params: {
  deviceId: string
  deviceName: string
  shelfUnitStart: number
  face: DeviceRackFace
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

  return facesForDeviceRackFace(params.face).map((face) => ({
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

/**
 * Resolve mount face for a device resting on a shelf.
 * Full-depth templates always get `both`.
 */
export function resolveShelfDeviceFace(
  mountType: ShelfMountType,
  requested?: DeviceRackFace | null,
  isFullDepth?: boolean
): DeviceRackFace {
  if (isFullDepth || requested === 'both') return 'both'
  const allowed = facesForMountType(mountType)
  const face: RackFace = requested === 'rear' ? 'rear' : 'front'
  if (!allowed.includes(face)) {
    return 'front'
  }
  return face
}

/** Full-width footprint(s) for a rail-mounted device (`both` → front + rear). */
export function railDeviceFootprints(params: {
  deviceId: string
  deviceName: string
  face: DeviceRackFace
  unitStart: number
  heightU: number
}): RackFootprint[] {
  const heightU = Math.max(1, params.heightU)
  const unitEnd = params.unitStart + heightU - 1
  return facesForDeviceRackFace(params.face).map((face) => ({
    kind: 'device' as const,
    id: params.deviceId,
    name: params.deviceName,
    face,
    unitStart: params.unitStart,
    unitEnd,
    slotStart: 0,
    slotEnd: 2,
  }))
}

/** @deprecated Prefer railDeviceFootprints — kept for single-face helpers. */
export function railDeviceFootprint(params: {
  deviceId: string
  deviceName: string
  face: RackFace
  unitStart: number
  heightU: number
}): RackFootprint {
  return railDeviceFootprints({ ...params, face: params.face })[0]
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

export type UsedUnitsByFace = {
  usedFront: Set<number>
  usedRear: Set<number>
  usedFrontU: number
  usedRearU: number
  /** Distinct (face, U) pairs — capacity units occupied. */
  usedU: number
}

/**
 * Aggregate full-U occupancy per face from footprints.
 * Horizontal thirds do not fractionate: any footprint on a (face, U) marks that U used.
 */
export function aggregateUsedUnitsByFace(footprints: RackFootprint[]): UsedUnitsByFace {
  const usedFront = new Set<number>()
  const usedRear = new Set<number>()
  for (const fp of footprints) {
    const target = fp.face === 'rear' ? usedRear : usedFront
    for (let u = fp.unitStart; u <= fp.unitEnd; u++) {
      target.add(u)
    }
  }
  return {
    usedFront,
    usedRear,
    usedFrontU: usedFront.size,
    usedRearU: usedRear.size,
    usedU: usedFront.size + usedRear.size,
  }
}
