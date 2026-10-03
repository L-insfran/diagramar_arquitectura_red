export type DeviceStatus = 'online' | 'offline' | 'maintenance' | 'unknown'
/** Physical rack face for footprints / views. */
export type RackFace = 'front' | 'rear'
/** Device mount face; `both` = full-depth (same U on front + rear). */
export type DeviceRackFace = RackFace | 'both'
export type ChassisFace = 'front' | 'rear'

export type DeviceFilters = {
  status?: string
  deviceTypeId?: string
  deviceTemplateId?: string
  siteId?: string
  areaId?: string
  containerId?: string
  search?: string
  /** List row without ports and VLANs. Detail endpoints still preload them. */
  summary?: boolean
  /** Present only when the list is requested by page. */
  page?: number
  perPage?: number
}

export type DeviceListPage<T> = {
  items: T[]
  total: number
  page: number
  perPage: number
}

export type DeviceFilterOptions = {
  areas: { id: string; name: string }[]
  templates: { id: string; name: string }[]
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
  containerId?: string | null
  rackUnitStart?: number | null
  rackFace?: DeviceRackFace | null
  boardRow?: number | null
  boardCol?: number | null
  boardRowSpan?: number | null
  boardColSpan?: number | null
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
  containerId?: string | null
  rackUnitStart?: number | null
  rackFace?: DeviceRackFace | null
  boardRow?: number | null
  boardCol?: number | null
  boardRowSpan?: number | null
  boardColSpan?: number | null
  supportedByAccessoryId?: string | null
  shelfSlotStart?: number | null
  shelfWidthSlots?: number | null
  /** Vertical U occupied when resting on a shelf (default = template.rackUnits). */
  shelfHeightU?: number | null
  status?: DeviceStatus
  notes?: string | null
  /** Confirms diagram sync (reparent or purge) when changing location path. */
  confirmDiagramRelocate?: boolean
}

export type DiagramDevicePlacement = {
  diagramId: string
  diagramName: string
  containerKey: string
  areaId: string | null
  areaName: string | null
  containerLabel: string
}

/** purge = other area (remove from diagrams + links); reparent = same area, move in layout. */
export type DeviceRelocationMode = 'reparent' | 'purge'

export type DeviceRelocationImpact = {
  requiresConfirmation: boolean
  mode: DeviceRelocationMode
  placements: DiagramDevicePlacement[]
  linkCodes: number[]
  fromAreaId: string | null
  fromAreaName: string | null
  toAreaId: string | null
  toAreaName: string | null
  fromContainerId: string | null
  fromContainerName: string | null
  toContainerId: string | null
  toContainerName: string | null
}
