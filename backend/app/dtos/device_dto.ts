export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'unknown'
export type RackFace = 'front' | 'rear'

export type DeviceFilters = {
  status?: string
  deviceTypeId?: string
  deviceTemplateId?: string
  siteId?: string
  areaId?: string
  rackId?: string
  search?: string
}

export type CreateDeviceInput = {
  projectId: string
  deviceTemplateId: string
  name: string
  hostname?: string | null
  ipAddress?: string | null
  macAddress?: string | null
  serialNumber?: string | null
  firmwareVersion?: string | null
  /** @deprecated Prefer siteId/areaId. Kept for legacy/API compat. */
  location?: string | null
  siteId?: string | null
  areaId?: string | null
  rackId?: string | null
  rackUnitStart?: number | null
  rackFace?: RackFace | null
  supportedByAccessoryId?: string | null
  shelfSlotStart?: number | null
  shelfWidthSlots?: number | null
  /** Vertical U occupied when resting on a shelf (default = template.rackUnits). */
  shelfHeightU?: number | null
  status?: DeviceStatus
  notes?: string | null
}

export type UpdateDeviceInput = {
  projectId?: string
  name?: string
  hostname?: string | null
  ipAddress?: string | null
  macAddress?: string | null
  serialNumber?: string | null
  firmwareVersion?: string | null
  /** @deprecated Prefer siteId/areaId. Kept for legacy/API compat. */
  location?: string | null
  siteId?: string | null
  areaId?: string | null
  rackId?: string | null
  rackUnitStart?: number | null
  rackFace?: RackFace | null
  supportedByAccessoryId?: string | null
  shelfSlotStart?: number | null
  shelfWidthSlots?: number | null
  /** Vertical U occupied when resting on a shelf (default = template.rackUnits). */
  shelfHeightU?: number | null
  status?: DeviceStatus
  notes?: string | null
}
