import type { ConnectionDiagramGraphPayload, TopologyNode } from '../../types'

export type PhysicalContainerAssignment = {
  containerId: string | null
  areaId: string
  label: string
}

export function resolvePhysicalContainerAssignment(
  flowContainerId: string,
  graphPayload: ConnectionDiagramGraphPayload,
): PhysicalContainerAssignment | null {
  if (
    flowContainerId.startsWith('container:') ||
    flowContainerId.startsWith('rack:') ||
    flowContainerId.startsWith('board:')
  ) {
    const uuid = flowContainerId.includes(':')
      ? flowContainerId.slice(flowContainerId.indexOf(':') + 1)
      : flowContainerId

    const rack = graphPayload.racks?.find((r) => r.id === uuid)
    if (rack) {
      return { containerId: uuid, areaId: rack.areaId, label: rack.name }
    }
    const board = graphPayload.boards?.find((b) => b.id === uuid)
    if (board) {
      return { containerId: uuid, areaId: board.areaId, label: board.name }
    }
    return null
  }

  if (flowContainerId.startsWith('area:')) {
    const areaId = flowContainerId.slice(5)
    const area = graphPayload.areas?.find((a) => a.id === areaId)
    return {
      containerId: null,
      areaId,
      label: area?.name ?? 'Área',
    }
  }

  return null
}

export function deviceNeedsPhysicalAssign(
  device: TopologyNode,
  target: PhysicalContainerAssignment,
  graphPayload: ConnectionDiagramGraphPayload,
): boolean {
  if (target.containerId) {
    return device.data.containerId !== target.containerId
  }

  const rackIds = new Set(graphPayload.racks?.map((r) => r.id) ?? [])
  const boardIds = new Set(graphPayload.boards?.map((b) => b.id) ?? [])
  const containerId = device.data.containerId
  const inRackOrBoard =
    containerId != null && (rackIds.has(containerId) || boardIds.has(containerId))

  return device.data.areaId !== target.areaId || inRackOrBoard
}

export function buildDevicePickerOption(device: TopologyNode, alreadyIn: boolean) {
  const areaLabel = device.data.areaName ?? null
  return {
    id: device.id,
    label: device.label,
    name: device.label,
    deviceType: device.data.deviceType,
    ipAddress: device.data.ipAddress,
    areaName: areaLabel,
    containerName: device.data.containerName ?? null,
    templateName: device.data.templateName ?? null,
    alreadyIn,
  }
}
