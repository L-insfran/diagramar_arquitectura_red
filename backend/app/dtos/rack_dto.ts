export type RackFace = 'front' | 'rear'

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
  face: RackFace | null
  isStart: boolean
  heightU: number
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
    rackFace: RackFace
    heightU: number
    rackUnitEnd: number
  }>
  slotsFront: RackOccupancySlot[]
  slotsRear: RackOccupancySlot[]
}
