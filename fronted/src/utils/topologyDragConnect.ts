import type { MediumType, PortFace, TopologyData, TopologyPortSummary } from '../types'
import {
  isInternetCloudDeviceType,
  isWirelessPort,
  parsePortFaceFromHandle,
  parsePortIdFromHandle,
  portFaceConnectable,
} from './topologyPortPanel'

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

export function isPortFaceAvailableForConnect(
  entry: PortConnectLookup | undefined,
  face: PortFace,
): boolean {
  if (!entry) return false
  return portFaceConnectable(entry.port, face, false)
}

/**
 * Valida un intento de conexión React Flow (handles de puerto).
 * Rechaza mismo nodo, mismo puerto, caras ocupadas o down.
 */
export function validatePortConnection(
  lookup: Map<string, PortConnectLookup>,
  params: {
    source: string | null | undefined
    target: string | null | undefined
    sourceHandle: string | null | undefined
    targetHandle: string | null | undefined
  },
):
  | {
      ok: true
      sourcePortId: string
      targetPortId: string
      sourceFace: PortFace
      targetFace: PortFace
    }
  | { ok: false } {
  if (!params.source || !params.target || params.source === params.target) return { ok: false }
  const sourcePortId = parsePortIdFromHandle(params.sourceHandle)
  const targetPortId = parsePortIdFromHandle(params.targetHandle)
  if (!sourcePortId || !targetPortId || sourcePortId === targetPortId) return { ok: false }

  const sourceFace = parsePortFaceFromHandle(params.sourceHandle)
  const targetFace = parsePortFaceFromHandle(params.targetHandle)

  const source = lookup.get(sourcePortId)
  const target = lookup.get(targetPortId)
  if (!isPortFaceAvailableForConnect(source, sourceFace) || !isPortFaceAvailableForConnect(target, targetFace)) {
    return { ok: false }
  }
  if (source!.deviceId !== params.source || target!.deviceId !== params.target) return { ok: false }

  return { ok: true, sourcePortId, targetPortId, sourceFace, targetFace }
}
