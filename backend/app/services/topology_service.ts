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
  connectionType: 'physical' | 'logical'
  medium: MediumInfo
  connectionStatus: ConnectionStatus
  bandwidth: string | null
  description: string | null
  metadata: ConnectionMetadata | null
}

type LogicalNetworkSummary = {
  id: string
  name: string
  subnet: string
}

type LogicalVlanSummary = {
  id: string
  vlanId: number
  name: string
  isTagged: boolean
  networks: LogicalNetworkSummary[]
}

type LogicalTopologyEdge = FlowTopologyEdge & {
  connectionType: 'logical'
  sourcePortNumber: number
  targetPortNumber: number
  sourcePortStatus: Port['status']
  targetPortStatus: Port['status']
  sourceVlans: LogicalVlanSummary[]
  targetVlans: LogicalVlanSummary[]
  vlans: LogicalVlanSummary[]
  networks: LogicalNetworkSummary[]
  status: 'active' | 'down'
}

const uniqueBy = <T>(items: T[], keyFn: (item: T) => string): T[] => {
  const map = new Map<string, T>()
  for (const item of items) {
    map.set(keyFn(item), item)
  }
  return Array.from(map.values())
}

const buildDeviceNode = (device: Device): FlowTopologyNode => ({
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
  },
})

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

const extractVlanSummaries = (port: Port): LogicalVlanSummary[] => {
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
        query.preload('device', (dq) => dq.preload('deviceType')).preload('vlans', (q) => q.preload('networks'))
      })
      .preload('targetPort', (query) => {
        query.preload('device', (dq) => dq.preload('deviceType')).preload('vlans', (q) => q.preload('networks'))
      })

    const physicalNodes = new Map<string, FlowTopologyNode>()
    const logicalNodes = new Map<string, FlowTopologyNode>()
    const physicalEdges: FlowTopologyEdge[] = []
    const logicalEdges: LogicalTopologyEdge[] = []

    for (const conn of connections) {
      const sourceDevice = conn.sourcePort.device
      const targetDevice = conn.targetPort.device
      const medium = buildMediumInfo(conn)

      if (conn.connectionType === 'physical') {
        if (!physicalNodes.has(sourceDevice.id)) physicalNodes.set(sourceDevice.id, buildDeviceNode(sourceDevice))
        if (!physicalNodes.has(targetDevice.id)) physicalNodes.set(targetDevice.id, buildDeviceNode(targetDevice))
        physicalEdges.push({
          id: conn.id,
          source: sourceDevice.id,
          target: targetDevice.id,
          sourcePort: conn.sourcePort.name,
          targetPort: conn.targetPort.name,
          sourcePortId: conn.sourcePortId,
          targetPortId: conn.targetPortId,
          connectionType: conn.connectionType,
          medium,
          connectionStatus: conn.connectionStatus ?? 'implemented',
          bandwidth: conn.bandwidth,
          description: conn.description,
          metadata: conn.metadata ?? null,
        })
      }

      if (conn.connectionType === 'logical') {
        if (!logicalNodes.has(sourceDevice.id)) logicalNodes.set(sourceDevice.id, buildDeviceNode(sourceDevice))
        if (!logicalNodes.has(targetDevice.id)) logicalNodes.set(targetDevice.id, buildDeviceNode(targetDevice))
        const sourceVlans = extractVlanSummaries(conn.sourcePort)
        const targetVlans = extractVlanSummaries(conn.targetPort)
        const combinedVlans = uniqueBy<LogicalVlanSummary>(
          [...sourceVlans, ...targetVlans],
          (vlan) => vlan.id
        )
        const combinedNetworks = uniqueBy<LogicalNetworkSummary>(
          combinedVlans.flatMap((vlan) => vlan.networks),
          (network) => network.id
        )
        logicalEdges.push({
          id: conn.id,
          source: sourceDevice.id,
          target: targetDevice.id,
          sourcePort: conn.sourcePort.name,
          targetPort: conn.targetPort.name,
          sourcePortId: conn.sourcePortId,
          targetPortId: conn.targetPortId,
          connectionType: conn.connectionType,
          medium,
          connectionStatus: conn.connectionStatus ?? 'implemented',
          bandwidth: conn.bandwidth,
          description: conn.description,
          metadata: conn.metadata ?? null,
          sourcePortNumber: conn.sourcePort.portNumber,
          targetPortNumber: conn.targetPort.portNumber,
          sourcePortStatus: conn.sourcePort.status,
          targetPortStatus: conn.targetPort.status,
          sourceVlans,
          targetVlans,
          vlans: combinedVlans,
          networks: combinedNetworks,
          status: conn.sourcePort.status === 'up' && conn.targetPort.status === 'up' ? 'active' : 'down',
        })
      }
    }

    const allDevices = await Device.query()
      .where('company_id', companyId)
      .preload('deviceType')

    const inventoryNodes: FlowTopologyNode[] = allDevices.map((d) => buildDeviceNode(d))

    return {
      physical: {
        nodes: Array.from(physicalNodes.values()),
        edges: physicalEdges,
      },
      logical: {
        nodes: Array.from(logicalNodes.values()),
        edges: logicalEdges,
      },
      inventory: inventoryNodes,
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
