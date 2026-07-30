import type { MediumType, TopologyData, TopologyPortSummary } from '../types'
import { isInternetCloudDeviceType, isWirelessPort, parsePortIdFromHandle } from './topologyPortPanel'

export type PortConnectLookup = {
  portId: string
  deviceId: string
  port: TopologyPortSummary
  deviceType: string | null
}

/** Índice puerto → metadatos del grafo de topología. */
export function buildPortConnectLookup(topology: TopologyData): Map<string, PortConnectLookup> {
  const map = new Map<string, PortConnectLookup>()
  for (const node of topology.nodes) {
    const ports = node.data.ports ?? []
    const deviceType = node.data.deviceType ?? node.type ?? null
    for (const port of ports) {
      map.set(port.id, {
        portId: port.id,
        deviceId: node.id,
        port,
        deviceType,
      })
    }
  }
  return map
}

export function inferDragConnectMedium(
  source: PortConnectLookup,
  target: PortConnectLookup,
): MediumType {
  if (isInternetCloudDeviceType(source.deviceType) || isInternetCloudDeviceType(target.deviceType)) {
    return 'internet'
  }
  if (isWirelessPort(source.port) || isWirelessPort(target.port)) {
    return 'wifi'
  }
  return 'utp'
}

export function isPortAvailableForConnect(entry: PortConnectLookup | undefined): boolean {
  if (!entry) return false
  return !entry.port.connected && entry.port.status === 'up'
}

/**
 * Valida un intento de conexión React Flow (handles de puerto).
 * Rechaza mismo nodo, mismo puerto, puertos ocupados o down.
 */
export function validatePortConnection(
  lookup: Map<string, PortConnectLookup>,
  params: {
    source: string | null | undefined
    target: string | null | undefined
    sourceHandle: string | null | undefined
    targetHandle: string | null | undefined
  },
): { ok: true; sourcePortId: string; targetPortId: string } | { ok: false } {
  if (!params.source || !params.target || params.source === params.target) return { ok: false }
  const sourcePortId = parsePortIdFromHandle(params.sourceHandle)
  const targetPortId = parsePortIdFromHandle(params.targetHandle)
  if (!sourcePortId || !targetPortId || sourcePortId === targetPortId) return { ok: false }

  const source = lookup.get(sourcePortId)
  const target = lookup.get(targetPortId)
  if (!isPortAvailableForConnect(source) || !isPortAvailableForConnect(target)) return { ok: false }
  if (source!.deviceId !== params.source || target!.deviceId !== params.target) return { ok: false }

  return { ok: true, sourcePortId, targetPortId }
}
