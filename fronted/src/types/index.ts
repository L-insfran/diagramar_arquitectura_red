export interface Company {
  id: string
  name: string
  domain: string | null
  address: string | null
  phone: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface CompanyMembershipSummary {
  id?: string
  companyId: string
  role: 'admin' | 'operator' | 'viewer'
  isDefault: boolean
  company?: {
    id: string
    name: string
    domain: string | null
    isActive: boolean
  } | null
}

export interface AccessibleCompany extends Company {
  role: 'admin' | 'operator' | 'viewer'
  isDefault: boolean
  deviceCount?: number
  connectionCount?: number
}

export interface Department {
  id: string
  companyId: string
  name: string
  description: string | null
  createdAt: string
  updatedAt: string
  employeesCount?: number
}

export interface SystemUser {
  id: string
  companyId: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'operator' | 'viewer'
  isActive: boolean
  createdAt: string
  updatedAt: string
  memberships?: CompanyMembershipSummary[]
}

export interface Employee {
  id: string
  companyId: string
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

export interface Device {
  id: string
  companyId: string
  deviceTypeId: string
  name: string
  hostname: string | null
  ipAddress: string | null
  macAddress: string | null
  model: string | null
  manufacturer: string | null
  serialNumber: string | null
  firmwareVersion: string | null
  location: string | null
  status: 'online' | 'offline' | 'maintenance' | 'unknown'
  notes: string | null
  createdAt: string
  updatedAt: string
  deviceType?: DeviceType
  ports?: Port[]
  employees?: Employee[]
}

export interface Port {
  id: string
  deviceId: string
  name: string
  portNumber: number
  portType: 'ethernet' | 'fiber' | 'serial' | 'wireless' | 'wan' | 'sfp'
  speed: string | null
  status: 'up' | 'down' | 'disabled'
  description: string | null
  device?: Device
  vlans?: Array<Vlan & { isTagged?: boolean }>
}

export interface Vlan {
  id: string
  companyId: string
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
  companyId: string
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

export type MediumType = 'utp' | 'fiber' | 'wifi'
export type CableCategory = '5e' | '6' | '6a' | '7' | '7a' | '8'
export type FiberType = 'singlemode' | 'multimode'
export type FiberConnector = 'LC' | 'SC' | 'ST' | 'FC' | 'MPO' | 'MTRJ'
export type WifiStandard = '802.11n' | '802.11ac' | '802.11ax' | '802.11be'
export type WifiBand = '2.4GHz' | '5GHz' | '6GHz'
export type WifiSecurity = 'WPA2' | 'WPA3' | 'WPA2/WPA3' | 'Open'
export type ConnectionStatusType = 'planned' | 'implemented' | 'verified'

export interface MediumInfo {
  mediumType: MediumType
  cableCategory: CableCategory | null
  fiberType: FiberType | null
  fiberConnector: FiberConnector | null
  wifiSsid: string | null
  wifiStandard: WifiStandard | null
  wifiBand: WifiBand | null
  wifiSecurity: WifiSecurity | null
  cableLength: string | null
}

export interface Connection {
  id: string
  companyId: string
  sourcePortId: string
  targetPortId: string
  connectionType: 'physical' | 'logical'
  mediumType: MediumType
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
  connected: boolean
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
  companyId: string
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
  search?: string
  companyId?: string
}

export const MEDIUM_LABELS: Record<MediumType, string> = {
  utp: 'Cable UTP',
  fiber: 'Fibra óptica',
  wifi: 'WiFi',
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
  return 'Desconocido'
}

export const MEDIUM_COLORS: Record<MediumType, string> = {
  utp: '#3b82f6',
  fiber: '#f97316',
  wifi: '#22c55e',
}

export const MEDIUM_EDGE_STYLES: Record<MediumType, { stroke: string; strokeDasharray?: string }> = {
  utp: { stroke: '#3b82f6' },
  fiber: { stroke: '#f97316' },
  wifi: { stroke: '#22c55e', strokeDasharray: '6 3' },
}
