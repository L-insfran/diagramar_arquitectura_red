export type RackFace = 'front' | 'rear'
/** Device mount face; `both` = full-depth occupancy on front + rear. */
export type DeviceRackFace = RackFace | 'both'
export type ShelfMountType = 'front_only' | 'four_post'
export type OccupantKind = 'device' | 'shelf' | 'shelf_device'

export type RackFilters = {
  areaId?: string
  siteId?: string
  search?: string
}

export type CreateRackInput = {
  projectId: string
  areaId: string
  name: string
  code?: string | null
  heightU?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type UpdateRackInput = {
  areaId?: string
  name?: string
  code?: string | null
  heightU?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type RackOccupancySlot = {
  unit: number
  deviceId: string | null
  deviceName: string | null
  accessoryId: string | null
  accessoryName: string | null
  occupantKind: OccupantKind | null
  mountType: ShelfMountType | null
  face: RackFace | null
  isStart: boolean
  heightU: number
  /** Horizontal thirds occupied (shelf_device only). */
  slotStart?: number | null
  slotEnd?: number | null
}

export type RackOccupancyAccessory = {
  id: string
  name: string
  kind: 'shelf'
  unitStart: number
  heightU: number
  unitEnd: number
  mountType: ShelfMountType
  faces: RackFace[]
  devices: Array<{
    id: string
    name: string
    shelfSlotStart: number
    shelfWidthSlots: number
    heightU: number
    /** Last U occupied upward from shelf.unitStart. */
    unitEnd: number
    /** Face of the shelf (front_only → always front; four_post → front|rear; full-depth → both). */
    rackFace: DeviceRackFace
  }>
}

export type RackOccupancy = {
  rackId: string
  heightU: number
  usedU: number
  freeU: number
  percentUsed: number
  devices: Array<{
    id: string
    name: string
    rackUnitStart: number
    rackFace: DeviceRackFace
    heightU: number
    rackUnitEnd: number
  }>
  accessories: RackOccupancyAccessory[]
  slotsFront: RackOccupancySlot[]
  slotsRear: RackOccupancySlot[]
}
