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

/** Celda fusionada verticalmente: inicio de bloque o continuación (no renderizar). */
export type LinkPathCellSpan = { rowSpan: number } | { skip: true }

export type LinkPathSpans = {
  originSite: LinkPathCellSpan
  originArea: LinkPathCellSpan
  originContainer: LinkPathCellSpan
  originDevice: LinkPathCellSpan
  cable: LinkPathCellSpan
  destinationSite: LinkPathCellSpan
  destinationArea: LinkPathCellSpan
  destinationContainer: LinkPathCellSpan
  destinationDevice: LinkPathCellSpan
}

/** Flags de continuación respecto a la fila anterior (base del cálculo de spans). */
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
  spans: LinkPathSpans
  /** True cuando la celda es continuación del bloque anterior (equivalente a skip). */
  repeat: LinkPathRepeatFlags
  groupStart: boolean
}

type SpanKey = keyof LinkPathSpans

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

function unitSpans(): LinkPathSpans {
  return {
    originSite: { rowSpan: 1 },
    originArea: { rowSpan: 1 },
    originContainer: { rowSpan: 1 },
    originDevice: { rowSpan: 1 },
    cable: { rowSpan: 1 },
    destinationSite: { rowSpan: 1 },
    destinationArea: { rowSpan: 1 },
    destinationContainer: { rowSpan: 1 },
    destinationDevice: { rowSpan: 1 },
  }
}

/**
 * Cascade continuation against the previous row.
 * Origin and destination sides are evaluated independently from their root
 * (site → area → container → device). A segment continues only when it and
 * all ancestors match the previous row.
 */
function continuationFlags(prev: LinkPathRow, row: LinkPathRow): LinkPathRepeatFlags {
  const originSite =
    sameId(row.origin.siteId, prev.origin.siteId) && sameText(row.origin.site, prev.origin.site)
  const originArea =
    originSite &&
    sameId(row.origin.areaId, prev.origin.areaId) &&
    sameText(row.origin.area, prev.origin.area)
  const originContainer = originArea && sameText(row.origin.container, prev.origin.container)
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
    originSite,
    originArea,
    originContainer,
    originDevice,
    cable,
    destinationSite,
    destinationArea,
    destinationContainer,
    destinationDevice,
  }
}

const SPAN_KEYS: SpanKey[] = [
  'originSite',
  'originArea',
  'originContainer',
  'originDevice',
  'cable',
  'destinationSite',
  'destinationArea',
  'destinationContainer',
  'destinationDevice',
]

/**
 * Assign rowSpan / skip for each mergeable column from continuation flags.
 */
function assignSpans(continuations: LinkPathRepeatFlags[]): LinkPathSpans[] {
  const n = continuations.length
  const spans: LinkPathSpans[] = Array.from({ length: n }, () => unitSpans())

  for (const key of SPAN_KEYS) {
    let i = 0
    while (i < n) {
      let span = 1
      while (i + span < n && continuations[i + span][key]) {
        span++
      }
      spans[i][key] = { rowSpan: span }
      for (let k = 1; k < span; k++) {
        spans[i + k][key] = { skip: true }
      }
      i += span
    }
  }

  return spans
}

/**
 * Annotate path rows with cascade suppression + vertical merge spans.
 */
export function annotateRepeatedSegments(rows: LinkPathRow[]): AnnotatedLinkPathRow[] {
  if (rows.length === 0) return []

  const continuations: LinkPathRepeatFlags[] = rows.map((row, index) => {
    if (index === 0) return emptyRepeat()
    return continuationFlags(rows[index - 1], row)
  })

  const spans = assignSpans(continuations)

  return rows.map((row, index) => ({
    ...row,
    spans: spans[index],
    repeat: continuations[index],
    groupStart: index === 0 || !continuations[index].originSite,
  }))
}

/** Full linear path as plain text (ASCII separators). */
export function formatLinkPathLine(row: LinkPathRow): string {
  const origin = formatEndpointPathText(row.origin)
  const destination = formatEndpointPathText(row.destination, { mirrored: true })
  const cable = row.cable?.trim() || '—'
  return `${origin}${PATH_SEP}${cable}${PATH_SEP}${destination}`
}
