import type { DiagramLink, DiagramLinkEdge, TopologyNode } from '../../types'

export const LINK_CODE_PREFIX = 'E'

/** ASCII separator — jsPDF helvetica/WinAnsi cannot render Unicode arrows. */
export const PATH_SEP = ' -> '

type ContainerLookup = Map<string, string> | Record<string, string>
type InventoryLookup = TopologyNode[] | Map<string, TopologyNode>

export type LinkEndpointPath = {
  siteId: string | null
  areaId: string | null
  deviceId: string
  site: string | null
  area: string | null
  container: string | null
  device: string
  port: string
}

function containerName(lookup: ContainerLookup, deviceId: string): string | undefined {
  if (lookup instanceof Map) return lookup.get(deviceId)
  return lookup[deviceId]
}

function resolveDevice(
  inventory: InventoryLookup,
  deviceId: string
): TopologyNode | undefined {
  if (inventory instanceof Map) return inventory.get(deviceId)
  return inventory.find((d) => d.id === deviceId)
}

function cleanSegment(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

function normalizePortLabel(portLabel: string): string {
  const trimmed = portLabel.trim()
  if (!trimmed) return '?'
  return trimmed.startsWith('-') ? trimmed.slice(1).trim() || '?' : trimmed
}

/**
 * Full physical path for one link endpoint.
 * Visual diagram container wins over inventory; if it equals the area name
 * (loose device in an area), container is omitted to avoid duplicating the area.
 */
export function buildLinkEndpointPath(
  deviceId: string,
  portLabel: string,
  inventory: InventoryLookup,
  containerByDeviceId: ContainerLookup
): LinkEndpointPath {
  const device = resolveDevice(inventory, deviceId)
  const site = cleanSegment(device?.data.siteName)
  const area = cleanSegment(device?.data.areaName)
  const fromDiagram = cleanSegment(containerName(containerByDeviceId, deviceId))
  const fromInventory = cleanSegment(device?.data.containerName)
  let container = fromDiagram ?? fromInventory
  if (container && area && container.localeCompare(area, 'es', { sensitivity: 'accent' }) === 0) {
    container = null
  }
  return {
    siteId: cleanSegment(device?.data.siteId) ?? null,
    areaId: cleanSegment(device?.data.areaId) ?? null,
    deviceId,
    site,
    area,
    container,
    device: cleanSegment(device?.label) ?? 'Equipo',
    port: normalizePortLabel(portLabel),
  }
}

/** Location segments only (site › area › container), for UI chrome. */
export function formatEndpointLocationText(path: LinkEndpointPath): string {
  return [path.site, path.area, path.container].filter(Boolean).join(PATH_SEP)
}

/**
 * Full path as plain text.
 * Origin: Sitio -> Area -> Contenedor -> Equipo -> Puerto
 * Mirrored (destination): Puerto -> Equipo -> Contenedor -> Area -> Sitio
 */
export function formatEndpointPathText(
  path: LinkEndpointPath,
  opts?: { mirrored?: boolean }
): string {
  const location = [path.site, path.area, path.container].filter(Boolean) as string[]
  if (opts?.mirrored) {
    return [path.port, path.device, ...[...location].reverse()].join(PATH_SEP)
  }
  return [...location, path.device, path.port].join(PATH_SEP)
}

/** Visible code on the canvas / reference list, e.g. "E1". */
export function formatLinkCode(code: number | null | undefined): string {
  if (code == null || !Number.isFinite(code)) return `${LINK_CODE_PREFIX}?`
  return `${LINK_CODE_PREFIX}${code}`
}

/** One endpoint: full site→…→port path (plain text). */
export function formatEndpointLabel(
  deviceId: string,
  portLabel: string,
  inventory: InventoryLookup,
  containerByDeviceId: ContainerLookup
): string {
  return formatEndpointPathText(
    buildLinkEndpointPath(deviceId, portLabel, inventory, containerByDeviceId)
  )
}

/** Full reference: origin path A mirrored destination path. */
export function formatLinkReference(
  edge: { source: string; target: string; sourcePort: string; targetPort: string },
  inventory: InventoryLookup,
  containerByDeviceId: ContainerLookup
): string {
  const sourceText = formatEndpointPathText(
    buildLinkEndpointPath(edge.source, edge.sourcePort, inventory, containerByDeviceId)
  )
  const targetText = formatEndpointPathText(
    buildLinkEndpointPath(edge.target, edge.targetPort, inventory, containerByDeviceId),
    { mirrored: true }
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
 * Occupancy index for SimpleLinkModal from diagram links or graph edges.
 * Skips links whose source/target is missing or not in live inventory (orphans).
 */
export function occupancyEdgesFromDiagramLinks(
  links: Array<DiagramLink | DiagramLinkEdge | Record<string, unknown>> | null | undefined,
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
        cableTypeId: asId(link.cableTypeId ?? link.cable_type_id),
        cableTypeName:
          asText(link.cableTypeName ?? link.cable_type_name) || null,
      },
    ]
  })
}
