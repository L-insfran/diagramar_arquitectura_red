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
  kind?: 'device' | 'shelf' | 'hang' | 'chassis' | 'shelf_device'
  /** Horizontal columns 0–5; full width when omitted. */
  slotStart?: number
  slotEnd?: number
}

export const RACK_HORIZONTAL_COLUMNS = 6

/** Occupied blocks on one face (devices + shelves + shelf-resting devices). */
export function occupiedRangesForFace(
  occupancy: RackOccupancy,
  face: RackFace,
  excludeDeviceId?: string | null
): OccupiedRange[] {
  const fromDevices = occupancy.devices
    .filter(
      (d) =>
        d.id !== excludeDeviceId &&
        (d.rackFace === face || d.rackFace === 'both')
    )
    .map((d) => ({
      deviceId: d.id,
      deviceName: d.name,
      start: d.rackUnitStart,
      end: d.rackUnitEnd,
      heightU: d.heightU,
      kind: 'device' as const,
      slotStart: 0,
      slotEnd: RACK_HORIZONTAL_COLUMNS - 1,
    }))

  const fromShelves = (occupancy.accessories ?? [])
    .filter((a) => a.faces.includes(face))
    .map((a) => {
      const width = Math.min(
        RACK_HORIZONTAL_COLUMNS,
        Math.max(2, a.horizontalWidthSlots ?? RACK_HORIZONTAL_COLUMNS)
      )
      const slotStart = Math.min(
        RACK_HORIZONTAL_COLUMNS - width,
        Math.max(0, a.horizontalSlotStart ?? 0)
      )
      return {
        deviceId: a.id,
        deviceName: a.name,
        start: a.unitStart,
        end: a.unitEnd,
        heightU: a.heightU,
        kind: (a.kind === 'hang'
          ? 'hang'
          : a.kind === 'chassis'
            ? 'chassis'
            : 'shelf') as 'shelf' | 'hang' | 'chassis',
        slotStart,
        slotEnd: slotStart + width - 1,
      }
    })

  const fromShelfDevices = (occupancy.accessories ?? []).flatMap((a) =>
    a.devices
      .filter((d) => {
        if (d.id === excludeDeviceId) return false
        if (d.rackFace === 'both') return true
        const deviceFace = d.rackFace === 'rear' ? 'rear' : 'front'
        return deviceFace === face
      })
      .map((d) => {
        const heightU = Math.max(1, d.heightU)
        const end = d.unitEnd ?? a.unitStart + heightU - 1
        const n = Math.min(5, Math.max(3, a.deviceSlotCount ?? 3))
        const startSlot = Math.min(n - 1, Math.max(0, d.shelfSlotStart))
        const widthSlots = Math.min(n - startSlot, Math.max(1, d.shelfWidthSlots))
        const slotStart = Math.floor((startSlot * RACK_HORIZONTAL_COLUMNS) / n)
        const slotEndExclusive = Math.floor(((startSlot + widthSlots) * RACK_HORIZONTAL_COLUMNS) / n)
        const slotEnd = Math.max(slotStart, slotEndExclusive - 1)
        return {
          deviceId: d.id,
          deviceName: d.name,
          start: a.unitStart,
          end,
          heightU,
          kind: 'shelf_device' as const,
          slotStart,
          slotEnd: Math.min(RACK_HORIZONTAL_COLUMNS - 1, slotEnd),
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
  /** Horizontal start column (0-based). Default full width. */
  slotStart?: number
  /** Horizontal width in columns. Default full width (6). */
  widthSlots?: number
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
  const widthSlots = Math.min(
    RACK_HORIZONTAL_COLUMNS,
    Math.max(1, params.widthSlots ?? RACK_HORIZONTAL_COLUMNS)
  )
  const slotStart = Math.min(
    RACK_HORIZONTAL_COLUMNS - widthSlots,
    Math.max(0, params.slotStart ?? 0)
  )
  const slotEnd = slotStart + widthSlots - 1

  for (const other of params.occupied) {
    if (!rangesOverlap(start, end, other.start, other.end)) continue
    const otherSlotStart = other.slotStart ?? 0
    const otherSlotEnd = other.slotEnd ?? RACK_HORIZONTAL_COLUMNS - 1
    if (rangesOverlap(slotStart, slotEnd, otherSlotStart, otherSlotEnd)) {
      return {
        ok: false,
        reason: `Solape con "${other.deviceName}" (U${other.start}–U${other.end})`,
      }
    }
  }
  return { ok: true }
}

export function canPlaceFullDepthAt(params: {
  start: number
  heightU: number
  rackHeightU: number
  occupancy: RackOccupancy
  excludeDeviceId?: string | null
}): { ok: true } | { ok: false; reason: string } {
  const front = canPlaceAt({
    start: params.start,
    heightU: params.heightU,
    rackHeightU: params.rackHeightU,
    occupied: occupiedRangesForFace(params.occupancy, 'front', params.excludeDeviceId),
  })
  if (!front.ok) return front
  return canPlaceAt({
    start: params.start,
    heightU: params.heightU,
    rackHeightU: params.rackHeightU,
    occupied: occupiedRangesForFace(params.occupancy, 'rear', params.excludeDeviceId),
  })
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
  if (slot.occupantKind === 'shelf' || slot.occupantKind === 'hang' || slot.occupantKind === 'chassis')
    return false
  if (!slot.deviceId) return true
  return Boolean(excludeDeviceId && slot.deviceId === excludeDeviceId)
}

export function mountTypeLabel(mountType: string): string {
  return mountType === 'four_post' ? 'Integral (4 postes)' : 'Solo frontal'
}

export function accessoryKindLabel(kind: string): string {
  if (kind === 'hang') return 'Colgante'
  if (kind === 'chassis') return 'Ordenador'
  return 'Bandeja'
}

export function faceLabel(face: string | null | undefined): string {
  return face === 'rear' ? 'Trasera' : 'Frontal'
}
