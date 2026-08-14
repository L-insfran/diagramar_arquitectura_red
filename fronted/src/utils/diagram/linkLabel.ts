import type { DiagramLink, DiagramLinkEdge, TopologyNode } from '../../types'

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

function asText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function asId(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function relationId(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const rec = value as Record<string, unknown>
  return asId(rec.id)
}

function relationName(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const rec = value as Record<string, unknown>
  return asText(rec.name)
}

function relationDeviceId(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const rec = value as Record<string, unknown>
  return asText(rec.deviceId ?? rec.device_id)
}

/**
 * Occupancy index for SimpleLinkModal from project-wide diagram_links.
 * Skips links whose source/target is missing or not in live inventory (orphans).
 */
export function occupancyEdgesFromDiagramLinks(
  links: Array<DiagramLink | Record<string, unknown>> | null | undefined,
  liveDeviceIds?: Iterable<string>
): DiagramLinkEdge[] {
  if (!links?.length) return []
  const live = liveDeviceIds ? new Set(liveDeviceIds) : null

  return links.flatMap((raw) => {
    const link = raw as Record<string, unknown>
    const sourcePortRel = link.sourcePort ?? link.source_port
    const targetPortRel = link.targetPort ?? link.target_port
    const source =
      asText(link.sourceDeviceId ?? link.source_device_id ?? link.source) ||
      relationDeviceId(sourcePortRel)
    const target =
      asText(link.targetDeviceId ?? link.target_device_id ?? link.target) ||
      relationDeviceId(targetPortRel)
    const sourcePort =
      asText(link.sourcePortLabel ?? link.source_port_label) || relationName(sourcePortRel)
    const targetPort =
      asText(link.targetPortLabel ?? link.target_port_label) || relationName(targetPortRel)
    const sourcePortId =
      asId(link.sourcePortId ?? link.source_port_id) ?? relationId(sourcePortRel)
    const targetPortId =
      asId(link.targetPortId ?? link.target_port_id) ?? relationId(targetPortRel)
    const id = asText(link.id)
    if (!id || !source || !target) return []
    if (live && (!live.has(source) || !live.has(target))) return []
    return [
      {
        id,
        code: Number(link.code ?? 0),
        source,
        target,
        sourcePort,
        targetPort,
        sourcePortId,
        targetPortId,
        sourceLabel: '',
        targetLabel: '',
        description: typeof link.description === 'string' ? link.description : null,
      },
    ]
  })
}
