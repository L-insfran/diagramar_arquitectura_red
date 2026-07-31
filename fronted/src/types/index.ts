export interface Project {
  id: string
  name: string
  domain: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface ProjectMembershipSummary {
  id?: string
  projectId: string
  role: 'admin' | 'operator' | 'viewer'
  isDefault: boolean
  project?: {
    id: string
    name: string
    domain: string | null
    isActive: boolean
  } | null
}

export interface AccessibleProject extends Project {
  role: 'admin' | 'operator' | 'viewer'
  isDefault: boolean
  deviceCount?: number
  connectionCount?: number
}

export interface Department {
  id: string
  projectId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  employeesCount?: number
}

export interface SystemUser {
  id: string
  projectId: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'operator' | 'viewer'
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberships?: ProjectMembershipSummary[]
}

export interface Employee {
  id: string
  projectId: string
  departmentId: string | null
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
  position: string | null
  createdAt: string
  updatedAt: string
  department?: Department
  devices?: Device[]
}

export interface DeviceType {
  id: string
  name: string
  icon: string | null
  description: string | null
}

export interface DeviceTemplatePort {
  id: string
  deviceTemplateId: string
  name: string
  portNumber: number
  portType: string
  speed: string | null
  description: string | null
  isPassthrough?: boolean
}

export interface DeviceTemplate {
  id: string
  deviceTypeId: string
  name: string
  manufacturer: string | null
  model: string | null
  rackUnits: number | null
  imageUrl: string | null
  frontViewUrl: string | null
  rearViewUrl: string | null
  powerConsumptionW: number | null
  weightKg: number | null
  customFields?: Record<string, unknown>
  notes: string | null
  deviceType?: DeviceType
  ports?: DeviceTemplatePort[]
  createdAt: string
  updatedAt: string
}

export interface PortType {
  id: string
  code: string
  name: string
  description: string | null
  defaultSpeed: string | null
  color: string | null
  icon: string | null
  direction: 'in' | 'out' | 'bidirectional'
}

export interface CableType {
  id: string
  code: string
  name: string
  description: string | null
  mediumFamily: 'utp' | 'fiber' | 'wifi' | 'internet' | 'power' | 'console' | 'other'
  defaultCategory: string | null
  defaultFiberType: string | null
  color: string | null
  sortOrder: number
}

export type AttachableType =
  | 'project'
  | 'site'
  | 'area'
  | 'rack'
  | 'device'
  | 'connection'
  | 'network'
  | 'vlan'
  | 'device_template'

export type AttachmentKind =
  | 'file'
  | 'pdf'
  | 'plan'
  | 'photo'
  | 'diagram'
  | 'link'
  | 'note'
  | 'other'

export type SecretKind = 'password' | 'api_key' | 'snmp' | 'wifi' | 'console' | 'other'

export interface Attachment {
  id: string
  projectId: string
  attachableType: AttachableType
  attachableId: string
  kind: AttachmentKind
  title: string
  description: string | null
  url: string | null
  mimeType: string | null
  sizeBytes: number | null
  originalFilename: string | null
  hasFile: boolean
  createdAt: string
  updatedAt: string
}

export interface ObjectSecret {
  id: string
  projectId: string
  attachableType: AttachableType
  attachableId: string
  kind: SecretKind
  label: string
  username: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export type DashboardAlertSeverity = 'info' | 'warning' | 'critical'

export interface DashboardAlert {
  severity: DashboardAlertSeverity
  code: string
  message: string
  entityType?: string
  entityId?: string
}

export interface DashboardRackSummary {
  id: string
  name: string
  code: string | null
  heightU: number
  usedU: number
  freeU: number
  percentUsed: number
}

export interface DashboardRecentDevice {
  id: string
  name: string
  status: string
  ipAddress: string | null
  deviceTypeName: string | null
  updatedAt: string | null
}

export interface DashboardMetrics {
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

export interface Site {
  id: string
  projectId: string
  name: string
  address: string | null
  notes: string | null
  areas?: Area[]
  createdAt: string
  updatedAt: string
}

export interface Area {
  id: string
  siteId: string
  name: string
  notes: string | null
  site?: Site
  createdAt: string
  updatedAt: string
}

export interface Rack {
  id: string
  projectId: string
  areaId: string
  name: string
  code: string | null
  heightU: number
  manufacturer: string | null
  model: string | null
  notes: string | null
  area?: Area
  createdAt: string
  updatedAt: string
}

export type RackFace = 'front' | 'rear'

export interface RackOccupancySlot {
  unit: number
  deviceId: string | null
  deviceName: string | null
  face: RackFace | null
  isStart: boolean
  heightU: number
}

export interface RackOccupancy {
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

export interface Device {
  id: string
  projectId: string
  deviceTypeId: string
  deviceTemplateId: string
  siteId: string | null
  areaId: string | null
  rackId: string | null
  rackUnitStart: number | null
  rackFace: RackFace | null
  name: string
  hostname: string | null
  ipAddress: string | null
  macAddress: string | null
  model: string | null
  manufacturer: string | null
  serialNumber: string | null
  firmwareVersion: string | null
  /** Legacy free-text; prefer site/area. */
  location: string | null
  status: 'online' | 'offline' | 'maintenance' | 'unknown'
  notes: string | null
  createdAt: string
  updatedAt: string
  deviceType?: DeviceType
  deviceTemplate?: DeviceTemplate
  site?: Site
  area?: Area
  rack?: Rack
  ports?: Port[]
  employees?: Employee[]
}

export interface Port {
  id: string
  deviceId: string
  name: string
  portNumber: number
  /** Código del catálogo de tipos de puerto (ej: ethernet, coaxial). */
  portType: string
  speed: string | null
  status: 'up' | 'down' | 'disabled'
  description: string | null
  /** Patch panel / bridge: front + rear faces each accept one physical link. */
  isPassthrough?: boolean
  device?: Device
  vlans?: Array<Vlan & { isTagged?: boolean }>
}

export interface Vlan {
  id: string
  projectId: string
  vlanId: number
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  networks?: Network[]
  ports?: Port[]
}

export interface Network {
  id: string
  projectId: string
  vlanId: string | null
  name: string
  subnet: string
  gateway: string | null
  dnsPrimary: string | null
  dnsSecondary: string | null
  dhcpEnabled: boolean
  description: string | null
  createdAt: string
  updatedAt: string
  inUse?: boolean
  vlan?: Vlan
}

export type MediumType = 'utp' | 'fiber' | 'wifi' | 'internet'
export type CableCategory = '5e' | '6' | '6a' | '7' | '7a' | '8'
export type FiberType = 'singlemode' | 'multimode'
export type FiberConnector = 'LC' | 'SC' | 'ST' | 'FC' | 'MPO' | 'MTRJ'
export type WifiStandard = '802.11n' | '802.11ac' | '802.11ax' | '802.11be'
export type WifiBand = '2.4GHz' | '5GHz' | '6GHz'
export type WifiSecurity = 'WPA2' | 'WPA3' | 'WPA2/WPA3' | 'Open'
export type ConnectionStatusType = 'planned' | 'implemented' | 'verified'

export interface MediumInfo {
  mediumType: MediumType
  cableTypeId?: string | null
  cableCategory: CableCategory | null
  fiberType: FiberType | null
  fiberConnector: FiberConnector | null
  wifiSsid: string | null
  wifiStandard: WifiStandard | null
  wifiBand: WifiBand | null
  wifiSecurity: WifiSecurity | null
  cableLength: string | null
}

export type PortFace = 'front' | 'rear'

export interface Connection {
  id: string
  projectId: string
  sourcePortId: string
  targetPortId: string
  sourceFace?: PortFace
  targetFace?: PortFace
  connectionType: 'physical' | 'logical'
  mediumType: MediumType
  cableTypeId?: string | null
  cableCategory: CableCategory | null
  fiberType: FiberType | null
  fiberConnector: FiberConnector | null
  wifiSsid: string | null
  wifiStandard: WifiStandard | null
  wifiBand: WifiBand | null
  wifiSecurity: WifiSecurity | null
  cableLength: string | null
  connectionStatus: ConnectionStatusType
  bandwidth: string | null
  description: string | null
  sourcePort?: Port
  targetPort?: Port
  metadata?: ConnectionMetadata | null
}

export interface ConnectionMetadata {
  vlanId?: number
  vlanName?: string
  networkName?: string
  notes?: string
  status?: 'active' | 'down'
}

export interface TopologyData {
  nodes: TopologyNode[]
  edges: TopologyEdge[]
}

export interface TopologyNetworkSummary {
  id: string
  name: string
  subnet: string
}

export interface TopologyVlanSummary {
  id: string
  vlanId: number
  name: string
  isTagged: boolean
  networks: TopologyNetworkSummary[]
}

export interface TopologyPortSummary {
  id: string
  name: string
  portNumber: number
  portType: Port['portType']
  status: Port['status']
  isPassthrough?: boolean
  connectedFront?: boolean
  connectedRear?: boolean
  /** True if any face is occupied. */
  connected: boolean
}

export interface TopologyRackSummary {
  id: string
  name: string
  code: string | null
  heightU: number
  areaId: string
  siteId: string | null
  areaName: string | null
  siteName: string | null
}

export interface TopologyNode {
  id: string
  label: string
  type: string
  data: {
    hostname: string | null
    ipAddress: string | null
    status: string
    location: string | null
    deviceType: string | null
    manufacturer: string | null
    model: string | null
    siteId?: string | null
    areaId?: string | null
    rackId?: string | null
    rackUnitStart?: number | null
    rackFace?: RackFace | null
    rackUnits?: number
    vlanCount?: number
    vlans?: TopologyVlanSummary[]
    networks?: TopologyNetworkSummary[]
    portCount?: number
    portsInUse?: number
    ports?: TopologyPortSummary[]
  }
}

export interface TopologyEdge {
  id: string
  source: string
  target: string
  sourcePort: string
  targetPort: string
  sourcePortId: string
  targetPortId: string
  sourceFace?: PortFace
  targetFace?: PortFace
  sourcePortNumber?: number
  targetPortNumber?: number
  sourcePortStatus?: Port['status']
  targetPortStatus?: Port['status']
  connectionType: 'physical' | 'logical'
  medium: MediumInfo
  connectionStatus: ConnectionStatusType
  bandwidth: string | null
  description: string | null
  metadata?: ConnectionMetadata | null
  sourceVlans?: TopologyVlanSummary[]
  targetVlans?: TopologyVlanSummary[]
  vlans?: TopologyVlanSummary[]
  networks?: TopologyNetworkSummary[]
  portRole?: 'trunk' | 'access'
  linkStatus?: 'active' | 'down'
  networkLabel?: string
  vlanLabel?: string
}

export interface TopologySummary {
  deviceCount: number
  linkCount: number
  vlanCount: number
  networkCount: number
  byMedium: Record<MediumType, number>
  byStatus: Record<ConnectionStatusType, number>
}

export interface TopologyPayload {
  graph: TopologyData
  inventory?: TopologyNode[]
  racks?: TopologyRackSummary[]
  summary: TopologySummary
}

/** @deprecated Kept as aliases during migration */
export type LogicalNetworkSummary = TopologyNetworkSummary
export type LogicalVlanSummary = TopologyVlanSummary
export type LogicalTopologyEdge = TopologyEdge
export type LogicalTopologyLayer = TopologyData

export type EmployeeCredentialKind = 'file_server' | 'vpn' | 'email' | 'rdp' | 'other'

export interface EmployeeCredential {
  id: string
  employeeId: string
  projectId: string
  kind: EmployeeCredentialKind
  label: string | null
  username: string
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T> {
  success: boolean
  data: T
  message?: string
}

export interface AuthResponse {
  user: SystemUser
  token: {
    type: string
    token: string
    expiresAt: string | null
  }
}

export interface DeviceFilters {
  status?: string
  deviceTypeId?: string
  deviceTemplateId?: string
  siteId?: string
  areaId?: string
  rackId?: string
  search?: string
  projectId?: string
}

export const MEDIUM_LABELS: Record<MediumType, string> = {
  utp: 'Cable UTP',
  fiber: 'Fibra óptica',
  wifi: 'WiFi',
  internet: 'Internet / WAN',
}

export const CABLE_CATEGORY_LABELS: Record<CableCategory, string> = {
  '5e': 'Cat 5e',
  '6': 'Cat 6',
  '6a': 'Cat 6A',
  '7': 'Cat 7',
  '7a': 'Cat 7A',
  '8': 'Cat 8',
}

export const FIBER_TYPE_LABELS: Record<FiberType, string> = {
  singlemode: 'Monomodo (SM)',
  multimode: 'Multimodo (MM)',
}

export const CONNECTION_STATUS_LABELS: Record<ConnectionStatusType, string> = {
  planned: 'Planificada',
  implemented: 'Implementada',
  verified: 'Verificada',
}

export function formatMediumLabel(medium: MediumInfo): string {
  if (medium.mediumType === 'utp') {
    const cat = medium.cableCategory ? CABLE_CATEGORY_LABELS[medium.cableCategory] : ''
    const len = medium.cableLength ? ` · ${medium.cableLength}` : ''
    return cat ? `UTP ${cat}${len}` : `UTP${len}`
  }
  if (medium.mediumType === 'fiber') {
    const type = medium.fiberType ? FIBER_TYPE_LABELS[medium.fiberType] : ''
    const conn = medium.fiberConnector ?? ''
    const len = medium.cableLength ? ` · ${medium.cableLength}` : ''
    const parts = [type, conn].filter(Boolean).join(' ')
    return parts ? `Fibra ${parts}${len}` : `Fibra${len}`
  }
  if (medium.mediumType === 'wifi') {
    const ssid = medium.wifiSsid ? `SSID: ${medium.wifiSsid}` : ''
    const std = medium.wifiStandard ?? ''
    const band = medium.wifiBand ?? ''
    const parts = [ssid, std, band].filter(Boolean).join(' · ')
    return parts ? `WiFi · ${parts}` : 'WiFi'
  }
  if (medium.mediumType === 'internet') {
    return 'Internet / WAN'
  }
  return 'Desconocido'
}

export const MEDIUM_COLORS: Record<MediumType, string> = {
  utp: '#3b82f6',
  fiber: '#f97316',
  wifi: '#22c55e',
  internet: '#0284c7',
}

export const MEDIUM_EDGE_STYLES: Record<MediumType, { stroke: string; strokeDasharray?: string }> = {
  utp: { stroke: '#3b82f6' },
  fiber: { stroke: '#f97316' },
  wifi: { stroke: '#22c55e', strokeDasharray: '6 3' },
  /** Trazo punto-raya, distinto de UTP/fibra/WiFi. */
  internet: { stroke: '#0284c7', strokeDasharray: '14 5 3 5' },
}
