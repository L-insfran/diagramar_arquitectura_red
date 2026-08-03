export type DashboardAlertSeverity = 'info' | 'warning' | 'critical'

export type DashboardAlert = {
  severity: DashboardAlertSeverity
  code: string
  message: string
  entityType?: string
  entityId?: string
}

export type DashboardRackSummary = {
  id: string
  name: string
  code: string | null
  heightU: number
  /** Unidades ocupadas en cara frontal. */
  usedFrontU: number
  /** Unidades ocupadas en cara trasera. */
  usedRearU: number
  /** Agregado front+rear (compat / alertas). */
  usedU: number
  freeU: number
  percentUsed: number
}

export type DashboardRecentDevice = {
  id: string
  name: string
  status: string
  ipAddress: string | null
  deviceTypeName: string | null
  updatedAt: string | null
}

export type DashboardMetrics = {
  counts: {
    devices: number
    devicesOnline: number
    devicesOffline: number
    devicesMaintenance: number
    racks: number
    sites: number
    areas: number
    ports: number
    portsFree: number
    portsOccupied: number
    connections: number
    connectionsPhysical: number
    vlans: number
    networks: number
    attachments: number
    secrets: number
  }
  racks: {
    totalCapacityU: number
    usedU: number
    freeU: number
    percentUsed: number
    items: DashboardRackSummary[]
  }
  documentation: {
    devicesWithoutAttachments: number
    devicesWithoutPhysicalLink: number
  }
  alerts: DashboardAlert[]
  recentDevices: DashboardRecentDevice[]
}
