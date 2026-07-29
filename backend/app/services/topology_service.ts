import { Exception } from '@adonisjs/core/exceptions'
import Connection, {
  type ConnectionMetadata,
  type MediumType,
  type CableCategory,
  type FiberType,
  type FiberConnector,
  type WifiStandard,
  type WifiBand,
  type WifiSecurity,
  type ConnectionStatus,
} from '#models/connection'
import Device from '#models/device'
import Port from '#models/port'

type MediumInfo = {
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

type NetworkSummary = {
  id: string
  name: string
  subnet: string
}

type VlanSummary = {
  id: string
  vlanId: number
  name: string
  isTagged: boolean
  networks: NetworkSummary[]
}

type PortSummary = {
  id: string
  name: string
  portNumber: number
  portType: Port['portType']
  status: Port['status']
  connected: boolean
}

type FlowTopologyNode = {
  id: string
  label: string
  type: 'device'
  data: {
    hostname: string | null
    ipAddress: string | null
    status: string
    location: string | null
    deviceType: string | null
    manufacturer: string | null
    model: string | null
    vlanCount: number
    vlans: VlanSummary[]
    networks: NetworkSummary[]
    portCount: number
    portsInUse: number
    ports: PortSummary[]
  }
}

type FlowTopologyEdge = {
  id: string
  source: string
  target: string
  sourcePort: string
  targetPort: string
  sourcePortId: string
  targetPortId: string
  sourcePortNumber: number
  targetPortNumber: number
  sourcePortStatus: Port['status']
  targetPortStatus: Port['status']
  connectionType: 'physical' | 'logical'
  medium: MediumInfo
  connectionStatus: ConnectionStatus
  bandwidth: string | null
  description: string | null
  metadata: ConnectionMetadata | null
  sourceVlans: VlanSummary[]
  targetVlans: VlanSummary[]
  vlans: VlanSummary[]
  networks: NetworkSummary[]
  portRole: 'trunk' | 'access'
  linkStatus: 'active' | 'down'
}

type TopologySummary = {
  deviceCount: number
  linkCount: number
  vlanCount: number
  networkCount: number
  byMedium: Record<MediumType, number>
  byStatus: Record<ConnectionStatus, number>
}

const uniqueBy = <T>(items: T[], keyFn: (item: T) => string): T[] => {
  const map = new Map<string, T>()
  for (const item of items) {
    map.set(keyFn(item), item)
  }
  return Array.from(map.values())
}

const extractVlanSummaries = (port: Port): VlanSummary[] => {
  if (!port.vlans?.length) return []
  return port.vlans.map((vlan) => ({
    id: vlan.id,
    vlanId: vlan.vlanId,
    name: vlan.name,
    isTagged: !!vlan.$extras?.pivot?.is_tagged,
    networks: (vlan.networks ?? []).map((network) => ({
      id: network.id,
      name: network.name,
      subnet: network.subnet,
    })),
  }))
}

const resolvePortRole = (vlans: VlanSummary[]): 'trunk' | 'access' => {
  if (vlans.length > 1) return 'trunk'
  if (vlans.some((vlan) => vlan.isTagged)) return 'trunk'
  return 'access'
}

const buildDeviceNode = (device: Device, portsInUseIds: Set<string>): FlowTopologyNode => {
  const ports = device.ports ?? []
  const allVlans = uniqueBy(
    ports.flatMap((port) => extractVlanSummaries(port)),
    (vlan) => vlan.id
  )
  const allNetworks = uniqueBy(
    allVlans.flatMap((vlan) => vlan.networks),
    (network) => network.id
  )
  const portsInUse = ports.filter((port) => portsInUseIds.has(port.id)).length
  const sortedPorts = [...ports].sort((a, b) => a.portNumber - b.portNumber || a.name.localeCompare(b.name))

  return {
    id: device.id,
    label: device.name,
    type: 'device',
    data: {
      hostname: device.hostname,
      ipAddress: device.ipAddress,
      status: device.status,
      location: device.location,
      deviceType: device.deviceType?.name ?? null,
      manufacturer: device.manufacturer,
      model: device.model,
      vlanCount: allVlans.length,
      vlans: allVlans,
      networks: allNetworks,
      portCount: ports.length,
      portsInUse,
      ports: sortedPorts.map((port) => ({
        id: port.id,
        name: port.name,
        portNumber: port.portNumber,
        portType: port.portType,
        status: port.status,
        connected: portsInUseIds.has(port.id),
      })),
    },
  }
}

const buildMediumInfo = (conn: Connection): MediumInfo => ({
  mediumType: conn.mediumType ?? 'utp',
  cableCategory: conn.cableCategory ?? null,
  fiberType: conn.fiberType ?? null,
  fiberConnector: conn.fiberConnector ?? null,
  wifiSsid: conn.wifiSsid ?? null,
  wifiStandard: conn.wifiStandard ?? null,
  wifiBand: conn.wifiBand ?? null,
  wifiSecurity: conn.wifiSecurity ?? null,
  cableLength: conn.cableLength ?? null,
})

export default class TopologyService {
  private async assertValidPortPair(companyId: string, sourcePortId: string, targetPortId: string) {
    if (sourcePortId === targetPortId) {
      throw new Exception('Source and target ports must be different', { status: 400 })
    }
    const source = await Port.query().where('id', sourcePortId).preload('device').firstOrFail()
    const target = await Port.query().where('id', targetPortId).preload('device').firstOrFail()
    if (source.device.companyId !== companyId || target.device.companyId !== companyId) {
      throw new Exception('Both ports must belong to the same company as the connection', {
        status: 400,
      })
    }
  }

  async getTopology(companyId: string) {
    const connections = await Connection.query()
      .where('company_id', companyId)
      .preload('sourcePort', (query) => {
        query
          .preload('device', (dq) => dq.preload('deviceType'))
          .preload('vlans', (q) => q.preload('networks'))
      })
      .preload('targetPort', (query) => {
        query
          .preload('device', (dq) => dq.preload('deviceType'))
          .preload('vlans', (q) => q.preload('networks'))
      })

    const portsInUseIds = new Set<string>()
    for (const conn of connections) {
      portsInUseIds.add(conn.sourcePortId)
      portsInUseIds.add(conn.targetPortId)
    }

    const allDevices = await Device.query()
      .where('company_id', companyId)
      .preload('deviceType')
      .preload('ports', (p) => p.preload('vlans', (v) => v.preload('networks')))

    const deviceNodes = new Map<string, FlowTopologyNode>()
    for (const device of allDevices) {
      deviceNodes.set(device.id, buildDeviceNode(device, portsInUseIds))
    }

    const graphNodes = new Map<string, FlowTopologyNode>()
    const edges: FlowTopologyEdge[] = []
    const allVlans = new Map<string, VlanSummary>()
    const allNetworks = new Map<string, NetworkSummary>()
    const byMedium: Record<MediumType, number> = { utp: 0, fiber: 0, wifi: 0 }
    const byStatus: Record<ConnectionStatus, number> = {
      planned: 0,
      implemented: 0,
      verified: 0,
    }

    for (const conn of connections) {
      const sourceDevice = conn.sourcePort.device
      const targetDevice = conn.targetPort.device
      const medium = buildMediumInfo(conn)

      const sourceNode = deviceNodes.get(sourceDevice.id) ?? buildDeviceNode(sourceDevice, portsInUseIds)
      const targetNode = deviceNodes.get(targetDevice.id) ?? buildDeviceNode(targetDevice, portsInUseIds)
      graphNodes.set(sourceDevice.id, sourceNode)
      graphNodes.set(targetDevice.id, targetNode)

      const sourceVlans = extractVlanSummaries(conn.sourcePort)
      const targetVlans = extractVlanSummaries(conn.targetPort)
      const combinedVlans = uniqueBy([...sourceVlans, ...targetVlans], (vlan) => vlan.id)
      const combinedNetworks = uniqueBy(
        combinedVlans.flatMap((vlan) => vlan.networks),
        (network) => network.id
      )

      for (const vlan of combinedVlans) allVlans.set(vlan.id, vlan)
      for (const network of combinedNetworks) allNetworks.set(network.id, network)

      const mediumType = medium.mediumType ?? 'utp'
      if (mediumType in byMedium) byMedium[mediumType]++
      const status = conn.connectionStatus ?? 'implemented'
      if (status in byStatus) byStatus[status]++

      const sourceRole = resolvePortRole(sourceVlans)
      const targetRole = resolvePortRole(targetVlans)
      const portRole: 'trunk' | 'access' =
        sourceRole === 'trunk' || targetRole === 'trunk' ? 'trunk' : 'access'

      edges.push({
        id: conn.id,
        source: sourceDevice.id,
        target: targetDevice.id,
        sourcePort: conn.sourcePort.name,
        targetPort: conn.targetPort.name,
        sourcePortId: conn.sourcePortId,
        targetPortId: conn.targetPortId,
        sourcePortNumber: conn.sourcePort.portNumber,
        targetPortNumber: conn.targetPort.portNumber,
        sourcePortStatus: conn.sourcePort.status,
        targetPortStatus: conn.targetPort.status,
        connectionType: conn.connectionType,
        medium,
        connectionStatus: status,
        bandwidth: conn.bandwidth,
        description: conn.description,
        metadata: conn.metadata ?? null,
        sourceVlans,
        targetVlans,
        vlans: combinedVlans,
        networks: combinedNetworks,
        portRole,
        linkStatus:
          conn.sourcePort.status === 'up' && conn.targetPort.status === 'up' ? 'active' : 'down',
      })
    }

    // Include device-level VLANs/networks in summary even if not on a connection
    for (const node of deviceNodes.values()) {
      for (const vlan of node.data.vlans) allVlans.set(vlan.id, vlan)
      for (const network of node.data.networks) allNetworks.set(network.id, network)
    }

    const inventoryNodes = Array.from(deviceNodes.values())
    const summary: TopologySummary = {
      deviceCount: graphNodes.size || inventoryNodes.length,
      linkCount: edges.length,
      vlanCount: allVlans.size,
      networkCount: allNetworks.size,
      byMedium,
      byStatus,
    }

    return {
      graph: {
        nodes: Array.from(graphNodes.values()),
        edges,
      },
      inventory: inventoryNodes,
      summary,
    }
  }

  async createConnection(data: {
    companyId: string
    sourcePortId: string
    targetPortId: string
    connectionType?: 'physical' | 'logical'
    mediumType?: MediumType
    cableCategory?: CableCategory | null
    fiberType?: FiberType | null
    fiberConnector?: FiberConnector | null
    wifiSsid?: string | null
    wifiStandard?: WifiStandard | null
    wifiBand?: WifiBand | null
    wifiSecurity?: WifiSecurity | null
    cableLength?: string | null
    connectionStatus?: ConnectionStatus
    bandwidth?: string | null
    description?: string | null
    metadata?: ConnectionMetadata | null
  }) {
    await this.assertValidPortPair(data.companyId, data.sourcePortId, data.targetPortId)
    return Connection.create({
      companyId: data.companyId,
      sourcePortId: data.sourcePortId,
      targetPortId: data.targetPortId,
      connectionType: data.connectionType ?? 'physical',
      mediumType: data.mediumType ?? 'utp',
      cableCategory: data.cableCategory ?? null,
      fiberType: data.fiberType ?? null,
      fiberConnector: data.fiberConnector ?? null,
      wifiSsid: data.wifiSsid ?? null,
      wifiStandard: data.wifiStandard ?? null,
      wifiBand: data.wifiBand ?? null,
      wifiSecurity: data.wifiSecurity ?? null,
      cableLength: data.cableLength ?? null,
      connectionStatus: data.connectionStatus ?? 'implemented',
      bandwidth: data.bandwidth ?? null,
      description: data.description ?? null,
      metadata: data.metadata ?? null,
    })
  }

  async updateConnection(
    id: string,
    data: {
      sourcePortId?: string
      targetPortId?: string
      connectionType?: 'physical' | 'logical'
      mediumType?: MediumType
      cableCategory?: CableCategory | null
      fiberType?: FiberType | null
      fiberConnector?: FiberConnector | null
      wifiSsid?: string | null
      wifiStandard?: WifiStandard | null
      wifiBand?: WifiBand | null
      wifiSecurity?: WifiSecurity | null
      cableLength?: string | null
      connectionStatus?: ConnectionStatus
      bandwidth?: string | null
      description?: string | null
      metadata?: ConnectionMetadata | null
    }
  ) {
    const conn = await Connection.findOrFail(id)
    const nextSource = data.sourcePortId ?? conn.sourcePortId
    const nextTarget = data.targetPortId ?? conn.targetPortId
    await this.assertValidPortPair(conn.companyId, nextSource, nextTarget)

    if (data.sourcePortId !== undefined) conn.sourcePortId = data.sourcePortId
    if (data.targetPortId !== undefined) conn.targetPortId = data.targetPortId
    if (data.connectionType !== undefined) conn.connectionType = data.connectionType
    if (data.mediumType !== undefined) conn.mediumType = data.mediumType
    if (data.cableCategory !== undefined) conn.cableCategory = data.cableCategory
    if (data.fiberType !== undefined) conn.fiberType = data.fiberType
    if (data.fiberConnector !== undefined) conn.fiberConnector = data.fiberConnector
    if (data.wifiSsid !== undefined) conn.wifiSsid = data.wifiSsid
    if (data.wifiStandard !== undefined) conn.wifiStandard = data.wifiStandard
    if (data.wifiBand !== undefined) conn.wifiBand = data.wifiBand
    if (data.wifiSecurity !== undefined) conn.wifiSecurity = data.wifiSecurity
    if (data.cableLength !== undefined) conn.cableLength = data.cableLength
    if (data.connectionStatus !== undefined) conn.connectionStatus = data.connectionStatus
    if (data.bandwidth !== undefined) conn.bandwidth = data.bandwidth
    if (data.description !== undefined) conn.description = data.description
    if (data.metadata !== undefined) conn.metadata = data.metadata

    await conn.save()
    return conn
  }

  async deleteConnection(id: string) {
    const conn = await Connection.findOrFail(id)
    await conn.delete()
  }
}
