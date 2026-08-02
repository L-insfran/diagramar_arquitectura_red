import type { Node } from '@xyflow/react'
import type { DeviceFlowNodeType } from '../components/topology/DeviceFlowNode'
import type { CloudFlowNodeType } from '../components/topology/CloudFlowNode'
import type { RackFlowNodeType } from '../components/topology/RackFlowNode'
import type {
  RackFace,
  TopologyData,
  TopologyNode,
  TopologyRackSummary,
} from '../types'
import { accentColorForNodeId } from './topologyAccent'
import { layoutTopologyNodes } from './topologyLayout'
import {
  computePortPanelLayout,
  computeRackMountedPortPanelLayout,
  isCompactPortPanel,
  isInternetCloudDeviceType,
  isStructuredCablingDeviceType,
  partitionDiagramPorts,
  shouldUseEthernetFaceplateLayout,
  CLOUD_NODE_HEIGHT,
  CLOUD_NODE_WIDTH,
  TOPOLOGY_HEADER_HEIGHT,
  TOPOLOGY_HEADER_HEIGHT_PATCH,
} from './topologyPortPanel'
import { normalizeTopologyHostname } from './topologyNodeData'
import {
  devicePositionInRack,
  devicePositionOnShelf,
  freeDevicesOriginX,
  layoutRacksGrid,
  normalizeRackFace,
  normalizeRackViewFace,
  rackFlowNodeId,
  rackOuterSize,
  type RackViewFace,
} from './topologyRackLayout'
import type { TopologyCanvasNode, TopologyDeviceNode } from './topologyWorkAreas'

function devicePlacementMeta(n: TopologyNode) {
  return {
    siteId: n.data.siteId ?? null,
    areaId: n.data.areaId ?? null,
    rackId: n.data.rackId ?? null,
    rackUnitStart: n.data.rackUnitStart ?? null,
    rackFace: n.data.rackFace ?? null,
    rackUnits: Math.max(1, n.data.rackUnits ?? 1),
    manufacturer: n.data.manufacturer ?? null,
    model: n.data.model ?? null,
    supportedByAccessoryId: n.data.supportedByAccessoryId ?? null,
    shelfSlotStart: n.data.shelfSlotStart ?? null,
    shelfWidthSlots: n.data.shelfWidthSlots ?? null,
    shelfHeightU: n.data.shelfHeightU ?? null,
  }
}

/** Construye nodos device/cloud desde el grafo (sin jerarquía de rack). */
export function buildDeviceFlowNodes(data: TopologyData): TopologyDeviceNode[] {
  const drawnPortIds = new Set<string>()
  for (const edge of data.edges) {
    if (edge.sourcePortId) drawnPortIds.add(edge.sourcePortId)
    if (edge.targetPortId) drawnPortIds.add(edge.targetPortId)
  }

  return data.nodes.map((n) => {
    const allPorts = (n.data.ports ?? []).map((port) => ({
      ...port,
      connected: drawnPortIds.has(port.id),
    }))
    const portsInUse = allPorts.reduce((total, port) => (port.connected ? total + 1 : total), 0)
    const meta = devicePlacementMeta(n)
    // ISP/Internet: nube solo si está suelto. En riel o bandeja es inventario físico.
    const hasPhysicalMount =
      !!meta.supportedByAccessoryId ||
      (meta.rackId != null && meta.rackUnitStart != null)
    const isCloud = isInternetCloudDeviceType(n.data.deviceType) && !hasPhysicalMount

    if (isCloud) {
      const width = CLOUD_NODE_WIDTH
      const height = CLOUD_NODE_HEIGHT
      return {
        id: n.id,
        type: 'cloud' as const,
        position: { x: 0, y: 0 },
        width,
        height,
        style: { width, height },
        data: {
          label: n.label,
          hostname: normalizeTopologyHostname(n.data),
          ipAddress: n.data.ipAddress,
          status: n.data.status,
          accentColor: accentColorForNodeId(n.id),
          location: n.data.location ?? null,
          deviceType: n.data.deviceType ?? null,
          ...meta,
          vlanCount: n.data.vlanCount ?? n.data.vlans?.length ?? 0,
          vlans: n.data.vlans ?? [],
          networks: n.data.networks ?? [],
          portCount: n.data.portCount ?? allPorts.length,
          portsInUse,
          ports: allPorts,
          totalPortCount: n.data.portCount ?? allPorts.length,
          nodeWidth: width,
          nodeHeight: height,
        },
      } satisfies CloudFlowNodeType
    }

    const { physical, wireless } = partitionDiagramPorts(allPorts)
    const totalPortCount = n.data.portCount ?? allPorts.length
    const totalPhysicalCount = Math.max(0, totalPortCount - wireless.length)
    const compact = isCompactPortPanel(physical.length, totalPhysicalCount)
    const headerHeight =
      isStructuredCablingDeviceType(n.data.deviceType) ||
      shouldUseEthernetFaceplateLayout(n.data.deviceType, allPorts)
        ? TOPOLOGY_HEADER_HEIGHT_PATCH
        : TOPOLOGY_HEADER_HEIGHT
    const portLayout = computePortPanelLayout(
      physical.length,
      compact,
      totalPhysicalCount,
      headerHeight,
      wireless.length,
      { deviceType: n.data.deviceType, ports: allPorts },
    )
    const { width, height } = portLayout
    return {
      id: n.id,
      type: 'device' as const,
      position: { x: 0, y: 0 },
      width,
      height,
      style: { width, height },
      data: {
        label: n.label,
        hostname: normalizeTopologyHostname(n.data),
        ipAddress: n.data.ipAddress,
        status: n.data.status,
        accentColor: accentColorForNodeId(n.id),
        location: n.data.location ?? null,
        deviceType: n.data.deviceType ?? null,
        ...meta,
        vlanCount: n.data.vlanCount ?? n.data.vlans?.length ?? 0,
        vlans: n.data.vlans ?? [],
        networks: n.data.networks ?? [],
        portCount: n.data.portCount ?? allPorts.length,
        portsInUse,
        ports: allPorts,
        totalPortCount: n.data.portCount ?? allPorts.length,
        nodeWidth: width,
        nodeHeight: height,
      },
    } satisfies DeviceFlowNodeType
  })
}

function countDevicesByFace(
  devices: TopologyDeviceNode[],
  rackId: string,
  face: RackFace,
): number {
  return devices.filter((d) => {
    if (d.type === 'cloud') return false
    if (d.data.rackId !== rackId) return false
    if (d.data.supportedByAccessoryId) {
      // Equipos apoyados: visibles en frontal (v1)
      return face === 'front'
    }
    return normalizeRackFace(d.data.rackFace) === face
  }).length
}

/**
 * Inserta nodos rack, anida equipos montados por U/cara y desplaza sueltos.
 * Las posiciones U se recalculan siempre desde dominio.
 */
export function applyRackHierarchy(
  devices: TopologyDeviceNode[],
  racks: TopologyRackSummary[],
  persistedPositions: Readonly<Record<string, { x: number; y: number }>>,
  rackFaces: Readonly<Record<string, RackViewFace>>,
): TopologyCanvasNode[] {
  if (!racks.length) return devices

  const rackPositions = layoutRacksGrid(racks, persistedPositions, rackFaces)
  const freeOriginX = freeDevicesOriginX(racks, rackPositions, rackFaces)

  const rackNodes: RackFlowNodeType[] = racks.map((rack) => {
    const id = rackFlowNodeId(rack.id)
    const activeFace = normalizeRackViewFace(rackFaces[id] ?? rackFaces[rack.id] ?? 'front')
    const size = rackOuterSize(rack.heightU, activeFace)
    const pos = rackPositions[id] ?? { x: 0, y: 0 }
    return {
      id,
      type: 'rack',
      position: pos,
      width: size.width,
      height: size.height,
      style: { width: size.width, height: size.height },
      zIndex: -1,
      draggable: true,
      selectable: true,
      data: {
        rackId: rack.id,
        name: rack.name,
        code: rack.code,
        heightU: rack.heightU,
        areaName: rack.areaName,
        siteName: rack.siteName,
        activeFace,
        deviceCountFront: countDevicesByFace(devices, rack.id, 'front'),
        deviceCountRear: countDevicesByFace(devices, rack.id, 'rear'),
        accessories: rack.accessories ?? [],
      },
    }
  })

  const rackById = new Map(racks.map((r) => [r.id, r]))
  const nextDevices: TopologyDeviceNode[] = devices.map((device) => {
    const rackId = device.data.rackId
    const rack = rackId ? rackById.get(rackId) : undefined
    const shelfId = device.data.supportedByAccessoryId
    const shelf =
      shelfId && rack
        ? (rack.accessories ?? []).find((a) => a.id === shelfId)
        : undefined
    const hasShelfOrRail =
      !!(shelfId && shelf) || (rack != null && device.data.rackUnitStart != null)

    // Nube suelta (sin montaje físico). Si tiene bandeja/riel, sigue el flujo de montaje.
    if (device.type === 'cloud' && !hasShelfOrRail) {
      const saved = persistedPositions[device.id]
      return {
        ...device,
        parentId: undefined,
        extent: undefined,
        position: saved ?? device.position,
        draggable: true,
      }
    }

    if (!rack || !rackId) {
      const saved = persistedPositions[device.id]
      let position = saved ?? device.position
      if (!saved && (position.x === 0 && position.y === 0) && freeOriginX > 0) {
        position = { x: freeOriginX, y: position.y }
      }
      return {
        ...device,
        parentId: undefined,
        extent: undefined,
        position,
        draggable: true,
        data: { ...device.data, rackMounted: false },
      }
    }

    // Device resting on shelf
    if (shelfId && shelf) {
      const rackNodeId = rackFlowNodeId(rackId)
      const activeFace = normalizeRackViewFace(
        rackFaces[rackNodeId] ?? rackFaces[rackId] ?? 'front',
      )
      // v1: resting devices only on front column
      const hidden = activeFace === 'rear'
      const column: 0 | 1 = 0
      const units = Math.max(1, device.data.rackUnits ?? 1)
      const visualHeightU = Math.max(1, device.data.shelfHeightU ?? units)
      const slot = devicePositionOnShelf({
        unitStart: shelf.unitStart,
        shelfHeightU: shelf.heightU,
        rackHeightU: rack.heightU,
        slotStart: device.data.shelfSlotStart ?? 0,
        widthSlots: device.data.shelfWidthSlots ?? 1,
        visualHeightU,
        column,
      })
      const { physical, wireless } = partitionDiagramPorts(device.data.ports ?? [])
      const totalPortCount = device.data.totalPortCount ?? device.data.ports?.length ?? 0
      const totalPhysicalCount = Math.max(0, totalPortCount - wireless.length)
      const rackLayout = computeRackMountedPortPanelLayout(
        physical.length,
        totalPhysicalCount,
        wireless.length,
        slot.width,
        slot.height,
        {
          deviceType: device.data.deviceType,
          ports: device.data.ports ?? [],
          shelfMounted: true,
        },
      )

      return {
        ...device,
        type: 'device' as const,
        parentId: rackNodeId,
        extent: 'parent' as const,
        expandParent: false,
        draggable: false,
        hidden,
        zIndex: 3,
        position: { x: slot.x, y: slot.y },
        width: slot.width,
        height: slot.height,
        style: { width: slot.width, height: slot.height },
        data: {
          ...device.data,
          rackMounted: true,
          rackUnits: visualHeightU,
          shelfHeightU: visualHeightU,
          rackFace: 'front',
          nodeWidth: rackLayout.width,
          nodeHeight: rackLayout.height,
        },
      }
    }

    if (device.data.rackUnitStart == null) {
      const saved = persistedPositions[device.id]
      let position = saved ?? device.position
      if (!saved && (position.x === 0 && position.y === 0) && freeOriginX > 0) {
        position = { x: freeOriginX, y: position.y }
      }
      return {
        ...device,
        parentId: undefined,
        extent: undefined,
        position,
        draggable: true,
        data: { ...device.data, rackMounted: false },
      }
    }

    const face = normalizeRackFace(device.data.rackFace)
    const rackNodeId = rackFlowNodeId(rackId)
    const activeFace = normalizeRackViewFace(
      rackFaces[rackNodeId] ?? rackFaces[rackId] ?? 'front',
    )
    const hidden = activeFace !== 'both' && face !== activeFace
    const column: 0 | 1 = activeFace === 'both' && face === 'rear' ? 1 : 0
    const units = Math.max(1, device.data.rackUnits ?? 1)
    const slot = devicePositionInRack(device.data.rackUnitStart, units, rack.heightU, column)
    const { physical, wireless } = partitionDiagramPorts(device.data.ports ?? [])
    const totalPortCount = device.data.totalPortCount ?? device.data.ports?.length ?? 0
    const totalPhysicalCount = Math.max(0, totalPortCount - wireless.length)
    const rackLayout = computeRackMountedPortPanelLayout(
      physical.length,
      totalPhysicalCount,
      wireless.length,
      slot.width,
      slot.height,
      { deviceType: device.data.deviceType, ports: device.data.ports ?? [] },
    )

    return {
      ...device,
      type: 'device' as const,
      parentId: rackNodeId,
      extent: 'parent' as const,
      expandParent: false,
      draggable: false,
      hidden,
      zIndex: 2,
      position: { x: slot.x, y: slot.y },
      width: slot.width,
      height: slot.height,
      style: { width: slot.width, height: slot.height },
      data: {
        ...device.data,
        rackMounted: true,
        rackUnits: units,
        nodeWidth: rackLayout.width,
        nodeHeight: rackLayout.height,
      },
    }
  })

  // Layout dagre solo para sueltos sin posición guardada (no montados).
  const freeIds = new Set(
    nextDevices
      .filter((d) => !d.parentId && !persistedPositions[d.id])
      .map((d) => d.id),
  )
  if (freeIds.size > 0) {
    const freeOnly = nextDevices.filter((d) => freeIds.has(d.id))
    // Sin edges: solo posicionar nodos sueltos; las conexiones ya anclan por handles.
    const { nodes: laidOut } = layoutTopologyNodes(freeOnly as Node[], [], { printFriendly: true })
    const byId = new Map(laidOut.map((n) => [n.id, n.position]))
    for (let i = 0; i < nextDevices.length; i++) {
      const d = nextDevices[i]
      if (!freeIds.has(d.id)) continue
      const pos = byId.get(d.id)
      if (!pos) continue
      nextDevices[i] = {
        ...d,
        position: { x: pos.x + freeOriginX, y: pos.y },
      }
    }
  }

  return [...rackNodes, ...nextDevices]
}

/** True si ambos extremos del edge están montados en el mismo rack (cara visible). */
export function isIntraRackEdge(
  edge: { source: string; target: string },
  nodes: readonly TopologyCanvasNode[],
): boolean {
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const source = byId.get(edge.source)
  const target = byId.get(edge.target)
  if (!source || !target) return false
  if (!source.parentId || !target.parentId) return false
  if (source.parentId !== target.parentId) return false
  if (source.hidden || target.hidden) return false
  return source.parentId.startsWith('rack:')
}
