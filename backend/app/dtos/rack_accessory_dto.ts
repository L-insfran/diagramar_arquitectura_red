export type AccessoryKind = 'shelf' | 'hang' | 'chassis'
export type ShelfMountType = 'front_only' | 'four_post'
export type RackFace = 'front' | 'rear'

export const DEVICE_SLOT_COUNT_MIN = 3
export const DEVICE_SLOT_COUNT_MAX = 5
export const DEVICE_SLOT_COUNT_DEFAULT = 3
export const HANG_HEIGHT_U_DEFAULT = 3
export const HANG_HEIGHT_U_MAX = 5
export const SHELF_HEIGHT_U_MAX = 6
export const CHASSIS_HEIGHT_U_DEFAULT = 1
export const CHASSIS_HEIGHT_U_MAX = 4

export type CreateRackAccessoryTemplateInput = {
  name: string
  kind?: AccessoryKind
  heightU: number
  defaultMountType?: ShelfMountType
  deviceSlotCount?: number
  face?: RackFace | null
  horizontalSlotStart?: number
  horizontalWidthSlots?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type UpdateRackAccessoryTemplateInput = {
  name?: string
  heightU?: number
  defaultMountType?: ShelfMountType
  deviceSlotCount?: number
  face?: RackFace | null
  horizontalSlotStart?: number
  horizontalWidthSlots?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type RackAccessoryFilters = {
  rackId?: string
  kind?: AccessoryKind
  search?: string
}

export type CreateRackAccessoryInput = {
  projectId: string
  rackId: string
  accessoryTemplateId?: string | null
  name: string
  kind?: AccessoryKind
  unitStart: number
  heightU: number
  mountType: ShelfMountType
  deviceSlotCount?: number
  face?: RackFace | null
  horizontalSlotStart?: number
  horizontalWidthSlots?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type UpdateRackAccessoryInput = {
  name?: string
  unitStart?: number
  heightU?: number
  mountType?: ShelfMountType
  deviceSlotCount?: number
  face?: RackFace | null
  horizontalSlotStart?: number
  horizontalWidthSlots?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

/** Faces blocked by a shelf according to mount type (and available for resting devices). */
export function facesForMountType(mountType: ShelfMountType): RackFace[] {
  return mountType === 'four_post' ? ['front', 'rear'] : ['front']
}

/** Whether this accessory kind can host devices (shelf/hang only). */
export function accessoryHostsDevices(kind: AccessoryKind): boolean {
  return kind === 'shelf' || kind === 'hang'
}

/** Single-face kinds (hang, chassis) use `face`; shelf uses mountType. */
export function accessoryUsesFace(kind: AccessoryKind): boolean {
  return kind === 'hang' || kind === 'chassis'
}

/** Faces occupied / hosting devices for any accessory kind. */
export function facesForAccessory(params: {
  kind: AccessoryKind
  mountType: ShelfMountType
  face?: RackFace | null
}): RackFace[] {
  if (accessoryUsesFace(params.kind)) {
    return [params.face === 'rear' ? 'rear' : 'front']
  }
  return facesForMountType(params.mountType)
}

export function maxHeightForAccessoryKind(kind: AccessoryKind): number {
  if (kind === 'hang') return HANG_HEIGHT_U_MAX
  if (kind === 'chassis') return CHASSIS_HEIGHT_U_MAX
  return SHELF_HEIGHT_U_MAX
}

export function normalizeDeviceSlotCount(value: number | null | undefined): number {
  const n = Math.round(value ?? DEVICE_SLOT_COUNT_DEFAULT)
  return Math.min(DEVICE_SLOT_COUNT_MAX, Math.max(DEVICE_SLOT_COUNT_MIN, n))
}

/** Slot count for persistence: chassis always 0; others clamped 3–5. */
export function resolveDeviceSlotCount(
  kind: AccessoryKind,
  value: number | null | undefined
): number {
  if (kind === 'chassis') return 0
  return normalizeDeviceSlotCount(value)
}
