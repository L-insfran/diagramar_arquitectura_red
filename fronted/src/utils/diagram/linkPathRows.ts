import type { DiagramLinkEdge, TopologyNode } from '../../types'
import {
  PATH_SEP,
  buildLinkEndpointPath,
  formatEndpointPathText,
  formatLinkCode,
  type LinkEndpointPath,
} from './linkLabel'

type ContainerLookup = Map<string, string> | Record<string, string>
type InventoryLookup = TopologyNode[] | Map<string, TopologyNode>

export type LinkPathRow = {
  edge: DiagramLinkEdge
  code: string
  origin: LinkEndpointPath
  destination: LinkEndpointPath
  cable: string | null
}

export type LinkPathRepeatFlags = {
  originSite: boolean
  originArea: boolean
  originContainer: boolean
  originDevice: boolean
  cable: boolean
  destinationSite: boolean
  destinationArea: boolean
  destinationContainer: boolean
  destinationDevice: boolean
}

export type AnnotatedLinkPathRow = LinkPathRow & {
  repeat: LinkPathRepeatFlags
  groupStart: boolean
}

function localeCmp(a: string | null | undefined, b: string | null | undefined): number {
  return (a ?? '').localeCompare(b ?? '', 'es', { sensitivity: 'accent' })
}

function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return localeCmp(a, b) === 0
}

function sameId(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = typeof a === 'string' ? a.trim() : ''
  const right = typeof b === 'string' ? b.trim() : ''
  if (left && right) return left === right
  return sameText(a, b)
}

function compareOriginHierarchy(a: LinkPathRow, b: LinkPathRow): number {
  return (
    localeCmp(a.origin.site, b.origin.site) ||
    localeCmp(a.origin.area, b.origin.area) ||
    localeCmp(a.origin.container, b.origin.container) ||
    localeCmp(a.origin.device, b.origin.device) ||
    localeCmp(a.origin.port, b.origin.port) ||
    (a.edge.code ?? 0) - (b.edge.code ?? 0) ||
    a.edge.id.localeCompare(b.edge.id)
  )
}

/**
 * Build path rows for the linear link-reference view, sorted by origin hierarchy.
 */
export function buildLinkPathRows(
  edges: DiagramLinkEdge[],
  inventory: InventoryLookup,
  containerByDeviceId: ContainerLookup
): LinkPathRow[] {
  const rows = edges.map((edge) => ({
    edge,
    code: formatLinkCode(edge.code),
    origin: buildLinkEndpointPath(edge.source, edge.sourcePort, inventory, containerByDeviceId),
    destination: buildLinkEndpointPath(
      edge.target,
      edge.targetPort,
      inventory,
      containerByDeviceId
    ),
    cable: edge.cableTypeName?.trim() || null,
  }))
  return rows.sort(compareOriginHierarchy)
}

function emptyRepeat(): LinkPathRepeatFlags {
  return {
    originSite: false,
    originArea: false,
    originContainer: false,
    originDevice: false,
    cable: false,
    destinationSite: false,
    destinationArea: false,
    destinationContainer: false,
    destinationDevice: false,
  }
}

/**
 * Cascade suppression against the previous row.
 * Origin and destination sides are evaluated independently from their root
 * (site → area → container → device). A segment is hidden only when it and
 * all ancestors match the previous row.
 */
export function annotateRepeatedSegments(rows: LinkPathRow[]): AnnotatedLinkPathRow[] {
  return rows.map((row, index) => {
    if (index === 0) {
      return { ...row, repeat: emptyRepeat(), groupStart: true }
    }
    const prev = rows[index - 1]

    const originSite = sameId(row.origin.siteId, prev.origin.siteId) && sameText(row.origin.site, prev.origin.site)
    const originArea =
      originSite &&
      sameId(row.origin.areaId, prev.origin.areaId) &&
      sameText(row.origin.area, prev.origin.area)
    const originContainer =
      originArea && sameText(row.origin.container, prev.origin.container)
    const originDevice =
      originContainer &&
      sameId(row.origin.deviceId, prev.origin.deviceId) &&
      sameText(row.origin.device, prev.origin.device)

    const destinationSite =
      sameId(row.destination.siteId, prev.destination.siteId) &&
      sameText(row.destination.site, prev.destination.site)
    const destinationArea =
      destinationSite &&
      sameId(row.destination.areaId, prev.destination.areaId) &&
      sameText(row.destination.area, prev.destination.area)
    const destinationContainer =
      destinationArea && sameText(row.destination.container, prev.destination.container)
    const destinationDevice =
      destinationContainer &&
      sameId(row.destination.deviceId, prev.destination.deviceId) &&
      sameText(row.destination.device, prev.destination.device)

    const cable = originDevice && sameText(row.cable, prev.cable)

    return {
      ...row,
      repeat: {
        originSite,
        originArea,
        originContainer,
        originDevice,
        cable,
        destinationSite,
        destinationArea,
        destinationContainer,
        destinationDevice,
      },
      groupStart: !originSite,
    }
  })
}

/** Full linear path as plain text (ASCII separators). */
export function formatLinkPathLine(row: LinkPathRow): string {
  const origin = formatEndpointPathText(row.origin)
  const destination = formatEndpointPathText(row.destination, { mirrored: true })
  const cable = row.cable?.trim() || '—'
  return `${origin}${PATH_SEP}${cable}${PATH_SEP}${destination}`
}
