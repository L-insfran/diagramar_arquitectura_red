import type { DiagramLinkEdge, TopologyNode } from '../../types'
import { formatLinkCode, formatLinkReference } from './linkLabel'
import {
  annotateRepeatedSegments,
  buildLinkPathRows,
  formatLinkPathLine,
  type LinkPathRow,
} from './linkPathRows'

export type DiagramLinkReferenceFilters = {
  query: string
  siteId: string
  areaId: string
  container: string
  deviceId: string
}

export const EMPTY_LINK_REFERENCE_FILTERS: DiagramLinkReferenceFilters = {
  query: '',
  siteId: '',
  areaId: '',
  container: '',
  deviceId: '',
}

export type LinkReferenceFilterOption = {
  value: string
  label: string
}

export type LinkReferenceFilterOptions = {
  sites: LinkReferenceFilterOption[]
  areas: LinkReferenceFilterOption[]
  containers: LinkReferenceFilterOption[]
  devices: LinkReferenceFilterOption[]
}

export function hasActiveLinkReferenceFilters(filters: DiagramLinkReferenceFilters): boolean {
  return Boolean(
    filters.query.trim() ||
      filters.siteId ||
      filters.areaId ||
      filters.container ||
      filters.deviceId
  )
}

function deviceSearchText(device: TopologyNode | undefined): string {
  if (!device) return ''
  return [device.label, device.data.hostname, device.data.ipAddress, device.data.location]
    .filter(Boolean)
    .join(' ')
}

function endpointMatchesHierarchy(
  path: LinkPathRow['origin'],
  filters: DiagramLinkReferenceFilters
): boolean {
  if (filters.siteId && path.siteId !== filters.siteId) return false
  if (filters.areaId && path.areaId !== filters.areaId) return false
  if (filters.container) {
    const name = path.container ?? ''
    if (name !== filters.container) return false
  }
  if (filters.deviceId && path.deviceId !== filters.deviceId) return false
  return true
}

function uniqueSortedOptions(
  values: Array<{ value: string; label: string }>
): LinkReferenceFilterOption[] {
  const seen = new Set<string>()
  const unique: LinkReferenceFilterOption[] = []
  for (const option of values) {
    if (!option.value || seen.has(option.value)) continue
    seen.add(option.value)
    unique.push(option)
  }
  return unique.sort((a, b) => a.label.localeCompare(b.label, 'es'))
}

/**
 * Cascade filter options from path rows.
 * Selecting a parent level narrows the child options.
 */
export function buildLinkReferenceFilterOptions(
  rows: LinkPathRow[],
  filters: DiagramLinkReferenceFilters
): LinkReferenceFilterOptions {
  const sites = uniqueSortedOptions(
    rows.flatMap((row) =>
      [
        row.origin.siteId
          ? { value: row.origin.siteId, label: row.origin.site ?? row.origin.siteId }
          : null,
        row.destination.siteId
          ? {
              value: row.destination.siteId,
              label: row.destination.site ?? row.destination.siteId,
            }
          : null,
      ].filter((item): item is LinkReferenceFilterOption => Boolean(item))
    )
  )

  const afterSite = filters.siteId
    ? rows.filter(
        (row) =>
          row.origin.siteId === filters.siteId || row.destination.siteId === filters.siteId
      )
    : rows

  const areas = uniqueSortedOptions(
    afterSite.flatMap((row) =>
      [
        row.origin.areaId
          ? { value: row.origin.areaId, label: row.origin.area ?? row.origin.areaId }
          : null,
        row.destination.areaId
          ? {
              value: row.destination.areaId,
              label: row.destination.area ?? row.destination.areaId,
            }
          : null,
      ].filter((item): item is LinkReferenceFilterOption => Boolean(item))
    )
  )

  const afterArea = filters.areaId
    ? afterSite.filter(
        (row) =>
          row.origin.areaId === filters.areaId || row.destination.areaId === filters.areaId
      )
    : afterSite

  const containers = uniqueSortedOptions(
    afterArea.flatMap((row) =>
      [
        row.origin.container
          ? { value: row.origin.container, label: row.origin.container }
          : null,
        row.destination.container
          ? { value: row.destination.container, label: row.destination.container }
          : null,
      ].filter((item): item is LinkReferenceFilterOption => Boolean(item))
    )
  )

  const afterContainer = filters.container
    ? afterArea.filter(
        (row) =>
          row.origin.container === filters.container ||
          row.destination.container === filters.container
      )
    : afterArea

  const devices = uniqueSortedOptions(
    afterContainer.flatMap((row) => [
      { value: row.origin.deviceId, label: row.origin.device },
      { value: row.destination.deviceId, label: row.destination.device },
    ])
  )

  return { sites, areas, containers, devices }
}

/**
 * Filter edges: hierarchy filters match if EITHER endpoint satisfies them.
 * Free-text search still tokenizes against enriched haystack (incl. full path + cable).
 */
export function filterDiagramLinkReferences(
  edges: DiagramLinkEdge[],
  inventory: TopologyNode[],
  containerByDeviceId: Record<string, string>,
  filters: DiagramLinkReferenceFilters
): DiagramLinkEdge[] {
  const tokens = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const byId = new Map(inventory.map((d) => [d.id, d]))
  const pathRows = buildLinkPathRows(edges, byId, containerByDeviceId)
  const pathByEdgeId = new Map(pathRows.map((row) => [row.edge.id, row]))

  return edges.filter((edge) => {
    const row = pathByEdgeId.get(edge.id)
    if (!row) return false

    const hierarchyActive = Boolean(
      filters.siteId || filters.areaId || filters.container || filters.deviceId
    )
    if (hierarchyActive) {
      const matches =
        endpointMatchesHierarchy(row.origin, filters) ||
        endpointMatchesHierarchy(row.destination, filters)
      if (!matches) return false
    }

    if (!tokens.length) return true

    const haystack = [
      formatLinkCode(edge.code),
      String(edge.code ?? ''),
      edge.sourceLabel,
      edge.targetLabel,
      edge.sourcePort,
      edge.targetPort,
      edge.description ?? '',
      edge.cableTypeName ?? '',
      containerByDeviceId[edge.source] ?? '',
      containerByDeviceId[edge.target] ?? '',
      deviceSearchText(byId.get(edge.source)),
      deviceSearchText(byId.get(edge.target)),
      formatLinkReference(edge, inventory, containerByDeviceId),
      formatLinkPathLine(row),
    ]
      .join(' ')
      .toLowerCase()

    return tokens.every((token) => haystack.includes(token))
  })
}

/** Filter + annotate path rows for the linear view (keeps hierarchical sort). */
export function filterAndAnnotateLinkPathRows(
  edges: DiagramLinkEdge[],
  inventory: TopologyNode[],
  containerByDeviceId: Record<string, string>,
  filters: DiagramLinkReferenceFilters
): ReturnType<typeof annotateRepeatedSegments> {
  const filtered = filterDiagramLinkReferences(edges, inventory, containerByDeviceId, filters)
  const filteredIds = new Set(filtered.map((e) => e.id))
  const rows = buildLinkPathRows(edges, inventory, containerByDeviceId).filter((row) =>
    filteredIds.has(row.edge.id)
  )
  return annotateRepeatedSegments(rows)
}
