import { Exception } from '@adonisjs/core/exceptions'
import type Connection from '#models/connection'
import type {
  CableCategory,
  ConnectionMetadata,
  FiberType,
  MediumType,
  ConnectionStatus,
  PortFace,
} from '#models/connection'
import CableType from '#models/cable_type'
import Device from '#models/device'
import Rack from '#models/rack'
import RackAccessory from '#models/rack_accessory'
import type Port from '#models/port'
import ConnectionRepository from '#repositories/connection_repository'
import { facesForMountType } from '#dtos/rack_accessory_dto'
import type {
  CreateConnectionInput,
  UpdateConnectionInput,
  UpsertCanvasLayoutInput,
} from '#dtos/connection_dto'

function mapFamilyToMediumType(family: string): MediumType {
  if (family === 'fiber' || family === 'wifi' || family === 'internet' || family === 'utp') {
    return family
  }
  return 'utp'
}

type MediumInfo = {
  mediumType: MediumType
  cableTypeId: string | null
  cableCategory: Connection['cableCategory']
  fiberType: Connection['fiberType']
  fiberConnector: Connection['fiberConnector']
  wifiSsid: string | null
  wifiStandard: Connection['wifiStandard']
  wifiBand: Connection['wifiBand']
  wifiSecurity: Connection['wifiSecurity']
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

type PortFaceOccupancy = {
  front: Set<string>
  rear: Set<string>
}

type PortSummary = {
  id: string
  name: string
  portNumber: number
  portType: Port['portType']
  status: Port['status']
  isPassthrough: boolean
  connectedFront: boolean
  connectedRear: boolean
  /** True if any face is occupied (backward-compatible). */
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
    siteId: string | null
    areaId: string | null
    rackId: string | null
    rackUnitStart: number | null
    rackFace: 'front' | 'rear' | null
    rackUnits: number
    supportedByAccessoryId: string | null
    shelfSlotStart: number | null
    shelfWidthSlots: number | null
    shelfHeightU: number | null
    vlanCount: number
    vlans: VlanSummary[]
    networks: NetworkSummary[]
    portCount: number
    portsInUse: number
    ports: PortSummary[]
  }
}

type TopologyRackAccessory = {
  id: string
  name: string
  kind: 'shelf'
  unitStart: number
  heightU: number
  mountType: 'front_only' | 'four_post'
  faces: Array<'front' | 'rear'>
}

type TopologyRackSummary = {
  id: string
  name: string
  code: string | null
  heightU: number
  areaId: string
  siteId: string | null
  areaName: string | null
  siteName: string | null
  accessories: TopologyRackAccessory[]
}

type FlowTopologyEdge = {
  id: string
  source: string
  target: string
  sourcePort: string
  targetPort: string
  sourcePortId: string
  targetPortId: string
  sourceFace: PortFace
  targetFace: PortFace
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

const buildDeviceNode = (device: Device, occupancy: PortFaceOccupancy): FlowTopologyNode => {
  const ports = device.ports ?? []
  const allVlans = uniqueBy(
    ports.flatMap((port) => extractVlanSummaries(port)),
    (vlan) => vlan.id
  )
  const allNetworks = uniqueBy(
    allVlans.flatMap((vlan) => vlan.networks),
    (network) => network.id
  )
  const portsInUse = ports.filter(
    (port) => occupancy.front.has(port.id) || occupancy.rear.has(port.id)
  ).length
  const sortedPorts = [...ports].sort(
    (a, b) => a.portNumber - b.portNumber || a.name.localeCompare(b.name)
  )

  const rackUnits = Math.max(1, device.deviceTemplate?.rackUnits ?? 1)

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
      siteId: device.siteId ?? null,
      areaId: device.areaId ?? null,
      rackId: device.rackId ?? null,
      rackUnitStart: device.rackUnitStart ?? null,
      rackFace: device.rackFace ?? null,
      rackUnits,
      supportedByAccessoryId: device.supportedByAccessoryId ?? null,
      shelfSlotStart: device.shelfSlotStart ?? null,
      shelfWidthSlots: device.shelfWidthSlots ?? null,
      shelfHeightU: device.supportedByAccessoryId
        ? Math.max(1, device.shelfHeightU ?? rackUnits)
        : null,
      vlanCount: allVlans.length,
      vlans: allVlans,
      networks: allNetworks,
      portCount: ports.length,
      portsInUse,
      ports: sortedPorts.map((port) => {
        const connectedFront = occupancy.front.has(port.id)
        const connectedRear = occupancy.rear.has(port.id)
        return {
          id: port.id,
          name: port.name,
          portNumber: port.portNumber,
          portType: port.portType,
          status: port.status,
          isPassthrough: !!port.isPassthrough,
          connectedFront,
          connectedRear,
          connected: connectedFront || connectedRear,
        }
      }),
    },
  }
}

const buildMediumInfo = (conn: Connection): MediumInfo => ({
  mediumType: conn.mediumType ?? 'utp',
  cableTypeId: conn.cableTypeId ?? null,
  cableCategory: conn.cableCategory ?? null,
  fiberType: conn.fiberType ?? null,
  fiberConnector: conn.fiberConnector ?? null,
  wifiSsid: conn.wifiSsid ?? null,
  wifiStandard: conn.wifiStandard ?? null,
  wifiBand: conn.wifiBand ?? null,
  wifiSecurity: conn.wifiSecurity ?? null,
  cableLength: conn.cableLength ?? null,
})

function serializeCanvasLayout(row: {
  nodePositions: Record<string, unknown>
  labelOffsets: Record<string, unknown>
  workAreas: unknown
  nodeParents: Record<string, unknown> | null
} | null) {
  return {
    nodePositions: row?.nodePositions ?? {},
    labelOffsets: row?.labelOffsets ?? {},
    workAreas: Array.isArray(row?.workAreas) ? row.workAreas : [],
    nodeParents: row?.nodeParents ?? {},
  }
}

export default class TopologyService {
  private connections = new ConnectionRepository()

  private async assertValidPortPair(projectId: string, sourcePortId: string, targetPortId: string) {
    if (sourcePortId === targetPortId) {
      throw new Exception('Source and target ports must be different', { status: 400 })
    }
    const source = await this.connections.findPortWithDeviceOrFail(sourcePortId)
    const target = await this.connections.findPortWithDeviceOrFail(targetPortId)
    if (source.device.deletedAt || target.device.deletedAt) {
      throw new Exception('Cannot connect ports on a deleted device', { status: 400 })
    }
    if (source.device.projectId !== projectId || target.device.projectId !== projectId) {
      throw new Exception('Both ports must belong to the same project as the connection', {
        status: 400,
      })
    }
  }

  /** Resolve face for a port: endpoints always use front; passthrough accepts front|rear. */
  private resolveFace(port: Port, requested: PortFace | undefined): PortFace {
    const face = requested ?? 'front'
    if (!port.isPassthrough && face === 'rear') {
      throw new Exception(
        `El puerto "${port.name}" no es passthrough: solo admite la cara front.`,
        { status: 422 }
      )
    }
    return face
  }

  /** One active physical connection per (port, face). Soft-deleted do not count. */
  private async assertPortFacesAvailable(
    endpoints: Array<{ portId: string; face: PortFace }>,
    excludeConnectionId?: string
  ) {
    for (const { portId, face } of endpoints) {
      const existing = await this.connections.findActivePhysicalByPortFace(
        portId,
        face,
        excludeConnectionId
      )
      if (existing) {
        throw new Exception(
          `La cara ${face} del puerto ya tiene una conexión física activa. Desconectala antes de crear otra.`,
          { status: 409 }
        )
      }
    }
  }

  private async resolveCableTypeFields(
    data: CreateConnectionInput | UpdateConnectionInput
  ): Promise<Partial<CreateConnectionInput>> {
    if (data.cableTypeId === undefined) return {}
    if (data.cableTypeId === null) {
      return { cableTypeId: null }
    }
    const cableType = await CableType.find(data.cableTypeId)
    if (!cableType) {
      throw new Exception('Tipo de cable no encontrado', { status: 422 })
    }
    const patch: Partial<CreateConnectionInput> = {
      cableTypeId: cableType.id,
      mediumType: data.mediumType ?? mapFamilyToMediumType(cableType.mediumFamily),
    }
    if (data.cableCategory === undefined && cableType.defaultCategory) {
      patch.cableCategory = cableType.defaultCategory as CableCategory
    }
    if (data.fiberType === undefined && cableType.defaultFiberType) {
      patch.fiberType = cableType.defaultFiberType as FiberType
    }
    return patch
  }

  async getActiveConnectionSummary(id: string) {
    return this.connections.findActiveSummaryOrFail(id)
  }

  async getTopology(projectId: string) {
    const connections = await this.connections.findAllByProjectWithPorts(projectId)

    const activeConnections = connections.filter((conn) => {
      const sourceDevice = conn.sourcePort?.device
      const targetDevice = conn.targetPort?.device
      if (!sourceDevice || !targetDevice) return false
      if (sourceDevice.deletedAt || targetDevice.deletedAt) return false
      return true
    })

    const occupancy: PortFaceOccupancy = { front: new Set(), rear: new Set() }
    for (const conn of activeConnections) {
      const sourceFace = conn.sourceFace ?? 'front'
      const targetFace = conn.targetFace ?? 'front'
      occupancy[sourceFace].add(conn.sourcePortId)
      occupancy[targetFace].add(conn.targetPortId)
    }

    const allDevices = await Device.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('deviceType')
      .preload('deviceTemplate')
      .preload('ports', (p) => p.preload('vlans', (v) => v.preload('networks')))

    const deviceNodes = new Map<string, FlowTopologyNode>()
    for (const device of allDevices) {
      deviceNodes.set(device.id, buildDeviceNode(device, occupancy))
    }

    const allRacks = await Rack.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('area', (a) => a.preload('site'))
      .orderBy('name', 'asc')

    const allAccessories = await RackAccessory.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .orderBy('unit_start', 'asc')

    const accessoriesByRack = new Map<string, TopologyRackAccessory[]>()
    for (const acc of allAccessories) {
      const list = accessoriesByRack.get(acc.rackId) ?? []
      list.push({
        id: acc.id,
        name: acc.name,
        kind: 'shelf',
        unitStart: acc.unitStart,
        heightU: acc.heightU,
        mountType: acc.mountType,
        faces: facesForMountType(acc.mountType),
      })
      accessoriesByRack.set(acc.rackId, list)
    }

    const racks: TopologyRackSummary[] = allRacks.map((rack) => ({
      id: rack.id,
      name: rack.name,
      code: rack.code,
      heightU: rack.heightU,
      areaId: rack.areaId,
      siteId: rack.area?.siteId ?? null,
      areaName: rack.area?.name ?? null,
      siteName: rack.area?.site?.name ?? null,
      accessories: accessoriesByRack.get(rack.id) ?? [],
    }))

    const graphNodes = new Map<string, FlowTopologyNode>()
    const edges: FlowTopologyEdge[] = []
    const allVlans = new Map<string, VlanSummary>()
    const allNetworks = new Map<string, NetworkSummary>()
    const byMedium: Record<MediumType, number> = { utp: 0, fiber: 0, wifi: 0, internet: 0 }
    const byStatus: Record<ConnectionStatus, number> = {
      planned: 0,
      implemented: 0,
      verified: 0,
    }

    for (const conn of activeConnections) {
      const sourceDevice = conn.sourcePort.device
      const targetDevice = conn.targetPort.device
      const medium = buildMediumInfo(conn)

      const sourceNode =
        deviceNodes.get(sourceDevice.id) ?? buildDeviceNode(sourceDevice, occupancy)
      const targetNode =
        deviceNodes.get(targetDevice.id) ?? buildDeviceNode(targetDevice, occupancy)
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
        sourceFace: conn.sourceFace ?? 'front',
        targetFace: conn.targetFace ?? 'front',
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
      racks,
      summary,
    }
  }

  async createConnection(data: CreateConnectionInput, actorId: string) {
    await this.assertValidPortPair(data.projectId, data.sourcePortId, data.targetPortId)
    const sourcePort = await this.connections.findPortWithDeviceOrFail(data.sourcePortId)
    const targetPort = await this.connections.findPortWithDeviceOrFail(data.targetPortId)
    const sourceFace = this.resolveFace(sourcePort, data.sourceFace)
    const targetFace = this.resolveFace(targetPort, data.targetFace)

    const connectionType = data.connectionType ?? 'physical'
    if (connectionType === 'physical') {
      await this.assertPortFacesAvailable([
        { portId: data.sourcePortId, face: sourceFace },
        { portId: data.targetPortId, face: targetFace },
      ])
    }
    const cablePatch = await this.resolveCableTypeFields(data)
    return this.connections.create({
      ...data,
      ...cablePatch,
      sourceFace,
      targetFace,
      connectionType,
      createdBy: actorId,
      updatedBy: actorId,
    })
  }

  async updateConnection(id: string, data: UpdateConnectionInput, actorId: string) {
    const conn = await this.connections.findByIdOrFail(id)
    const nextSource = data.sourcePortId ?? conn.sourcePortId
    const nextTarget = data.targetPortId ?? conn.targetPortId
    await this.assertValidPortPair(conn.projectId, nextSource, nextTarget)

    const sourcePort = await this.connections.findPortWithDeviceOrFail(nextSource)
    const targetPort = await this.connections.findPortWithDeviceOrFail(nextTarget)
    const sourceFace = this.resolveFace(
      sourcePort,
      data.sourceFace ?? (nextSource === conn.sourcePortId ? conn.sourceFace : undefined)
    )
    const targetFace = this.resolveFace(
      targetPort,
      data.targetFace ?? (nextTarget === conn.targetPortId ? conn.targetFace : undefined)
    )

    const nextType = data.connectionType ?? conn.connectionType
    if (nextType === 'physical') {
      await this.assertPortFacesAvailable(
        [
          { portId: nextSource, face: sourceFace },
          { portId: nextTarget, face: targetFace },
        ],
        conn.id
      )
    }
    const cablePatch = await this.resolveCableTypeFields(data)
    return this.connections.update(conn, {
      ...data,
      ...cablePatch,
      sourceFace,
      targetFace,
      updatedBy: actorId,
    })
  }

  async deleteConnection(id: string, actorId: string) {
    const conn = await this.connections.findActiveSummaryOrFail(id)
    await this.connections.softDelete(conn, actorId)
  }

  async getCanvasLayout(projectId: string, scope: string) {
    const row = await this.connections.findCanvasLayout(projectId, scope)
    return serializeCanvasLayout(row)
  }

  async upsertCanvasLayout(scope: string, data: UpsertCanvasLayoutInput) {
    const workAreas = Array.isArray(data.workAreas) ? data.workAreas : []
    const nodeParents = data.nodeParents ?? {}
    let row = await this.connections.findCanvasLayout(data.projectId, scope)
    if (!row) {
      row = await this.connections.createCanvasLayout(scope, {
        ...data,
        workAreas,
        nodeParents,
      })
    } else {
      row.nodePositions = data.nodePositions
      row.labelOffsets = data.labelOffsets
      row.workAreas = workAreas
      row.nodeParents = nodeParents
      await this.connections.saveCanvasLayout(row)
    }
    return serializeCanvasLayout(row)
  }

  async deleteCanvasLayout(projectId: string, scope: string) {
    const row = await this.connections.findCanvasLayout(projectId, scope)
    if (row) await this.connections.deleteCanvasLayout(row)
  }
}
