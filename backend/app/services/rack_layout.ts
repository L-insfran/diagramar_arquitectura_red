import {
  facesForAccessory,
  facesForMountType,
  normalizeDeviceSlotCount,
  type AccessoryKind,
  type RackFace,
  type ShelfMountType,
} from '#dtos/rack_accessory_dto'
import type { DeviceRackFace, OccupantKind } from '#dtos/rack_dto'

/** Fixed horizontal columns across a 19" rack face. */
export const RACK_HORIZONTAL_COLUMNS = 6

export type RackFootprintKind = OccupantKind | 'shelf_device'

export type RackFootprint = {
  kind: RackFootprintKind
  id: string
  name: string
  face: RackFace
  unitStart: number
  unitEnd: number
  /** Horizontal columns 0–5 (sixths of 19"). */
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

/** Normalize accessory horizontal footprint onto the 6-column grid. */
export function normalizeAccessoryHorizontalSlots(
  slotStart: number | null | undefined,
  widthSlots: number | null | undefined
): { slotStart: number; slotEnd: number; widthSlots: number } {
  const width = Math.min(
    RACK_HORIZONTAL_COLUMNS,
    Math.max(2, Math.round(widthSlots ?? RACK_HORIZONTAL_COLUMNS))
  )
  const start = Math.min(
    RACK_HORIZONTAL_COLUMNS - width,
    Math.max(0, Math.round(slotStart ?? 0))
  )
  return { slotStart: start, slotEnd: start + width - 1, widthSlots: width }
}

/**
 * Map device host slots (N = 3–5) onto the 6-column rack grid.
 * Uses floor(i * 6 / N) boundaries so N=3 keeps legacy thirds→sixths.
 */
export function slotsToSixths(
  shelfSlotStart: number,
  shelfWidthSlots: number,
  deviceSlotCount: number = 3
): { slotStart: number; slotEnd: number } {
  const n = normalizeDeviceSlotCount(deviceSlotCount)
  const start = Math.min(n - 1, Math.max(0, Math.round(shelfSlotStart)))
  const width = Math.min(n - start, Math.max(1, Math.round(shelfWidthSlots)))
  const slotStart = Math.floor((start * RACK_HORIZONTAL_COLUMNS) / n)
  const slotEndExclusive = Math.floor(((start + width) * RACK_HORIZONTAL_COLUMNS) / n)
  const slotEnd = Math.max(slotStart, slotEndExclusive - 1)
  return {
    slotStart,
    slotEnd: Math.min(RACK_HORIZONTAL_COLUMNS - 1, slotEnd),
  }
}

/** @deprecated Prefer slotsToSixths — kept for N=3 callers. */
export function thirdsToSixths(
  shelfSlotStart: number,
  shelfWidthSlots: number
): { slotStart: number; slotEnd: number } {
  return slotsToSixths(shelfSlotStart, shelfWidthSlots, 3)
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

/** Effective vertical U for a shelf-resting / hang device. */
export function shelfDeviceHeightU(
  shelfHeightU: number | null | undefined,
  templateRackUnits: number | null | undefined,
  maxHeightU?: number | null
): number {
  let height: number
  if (shelfHeightU != null && shelfHeightU >= 1) {
    height = Math.min(20, Math.max(1, Math.round(shelfHeightU)))
  } else {
    height = Math.max(1, templateRackUnits ?? 1)
  }
  if (maxHeightU != null && maxHeightU >= 1) {
    height = Math.min(height, Math.round(maxHeightU))
  }
  return height
}

/**
 * Footprint(s) of a device hosted on a shelf or hang accessory.
 * Anchored at accessory.unitStart; grows upward for `heightU` units.
 */
export function shelfDeviceFootprints(params: {
  deviceId: string
  deviceName: string
  shelfUnitStart: number
  face: DeviceRackFace
  heightU: number
  shelfSlotStart: number
  shelfWidthSlots: number
  deviceSlotCount?: number
}): RackFootprint[] {
  const heightU = Math.max(1, params.heightU)
  const unitStart = params.shelfUnitStart
  const unitEnd = unitStart + heightU - 1
  const { slotStart, slotEnd } = slotsToSixths(
    params.shelfSlotStart,
    params.shelfWidthSlots,
    params.deviceSlotCount
  )

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
 * Resolve mount face for a device on a shelf (not hang).
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

/** Resolve face for a device on a hang accessory (always the accessory face). */
export function resolveHangDeviceFace(accessoryFace: RackFace | null | undefined): DeviceRackFace {
  return accessoryFace === 'rear' ? 'rear' : 'front'
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
    slotEnd: RACK_HORIZONTAL_COLUMNS - 1,
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

/** Footprint(s) for a shelf or hang accessory. */
export function shelfFootprints(params: {
  accessoryId: string
  accessoryName: string
  kind?: AccessoryKind
  unitStart: number
  heightU: number
  mountType: ShelfMountType
  face?: RackFace | null
  horizontalSlotStart?: number | null
  horizontalWidthSlots?: number | null
}): RackFootprint[] {
  const heightU = Math.max(1, params.heightU)
  const unitEnd = params.unitStart + heightU - 1
  const horiz = normalizeAccessoryHorizontalSlots(
    params.horizontalSlotStart,
    params.horizontalWidthSlots
  )
  const kind = params.kind ?? 'shelf'
  const faces = facesForAccessory({
    kind,
    mountType: params.mountType,
    face: params.face,
  })
  const footprintKind: OccupantKind =
    kind === 'hang' ? 'hang' : kind === 'chassis' ? 'chassis' : 'shelf'
  return faces.map((face) => ({
    kind: footprintKind,
    id: params.accessoryId,
    name: params.accessoryName,
    face,
    unitStart: params.unitStart,
    unitEnd,
    slotStart: horiz.slotStart,
    slotEnd: horiz.slotEnd,
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
 * Horizontal columns do not fractionate capacity: any footprint on a (face, U) marks that U used.
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
