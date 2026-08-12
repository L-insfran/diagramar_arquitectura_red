import type { TopologyNode } from '../../types'

export const LINK_CODE_PREFIX = 'E'

type ContainerLookup = Map<string, string> | Record<string, string>

function containerName(lookup: ContainerLookup, deviceId: string): string | undefined {
  if (lookup instanceof Map) return lookup.get(deviceId)
  return lookup[deviceId]
}

/** Visible code on the canvas / reference list, e.g. "E1". */
export function formatLinkCode(code: number | null | undefined): string {
  if (code == null || !Number.isFinite(code)) return `${LINK_CODE_PREFIX}?`
  return `${LINK_CODE_PREFIX}${code}`
}

/** "RACK-01 -> ES -LAN1" — container -> device -port */
export function formatEndpointLabel(
  deviceId: string,
  portLabel: string,
  inventory: TopologyNode[],
  containerByDeviceId: ContainerLookup
): string {
  const device = inventory.find((d) => d.id === deviceId)
  const deviceName = device?.label ?? 'Equipo'
  const container = containerName(containerByDeviceId, deviceId)
  const portPart = portLabel.startsWith('-') ? portLabel : `-${portLabel}`
  if (container) return `${container} -> ${deviceName} ${portPart}`
  return `${deviceName} ${portPart}`
}

/** Full reference: "RACK-01 -> PH -LAN2 A Tablero Rio 1 -> PB1 -P1" */
export function formatLinkReference(
  edge: { source: string; target: string; sourcePort: string; targetPort: string },
  inventory: TopologyNode[],
  containerByDeviceId: ContainerLookup
): string {
  const sourceText = formatEndpointLabel(
    edge.source,
    edge.sourcePort,
    inventory,
    containerByDeviceId
  )
  const targetText = formatEndpointLabel(
    edge.target,
    edge.targetPort,
    inventory,
    containerByDeviceId
  )
  return `${sourceText} A ${targetText}`
}
