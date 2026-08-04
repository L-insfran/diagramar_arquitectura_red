import type { Site, TopologyNode } from '../types'

/** Normaliza hostname desde la API (camelCase o snake_case, cadenas vacías → null). */
export function normalizeTopologyHostname(data: unknown): string | null {
  if (data === null || data === undefined || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const raw = o.hostname ?? o.host_name
  if (raw == null) return null
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
  return s.length > 0 ? s : null
}

function nonEmptyString(value: unknown): string | null {
  if (value == null) return null
  const s = typeof value === 'string' ? value.trim() : String(value).trim()
  return s.length > 0 ? s : null
}

/** Lee siteName/areaName tolerando camelCase o snake_case. */
export function readTopologySiteAreaNames(data: unknown): {
  siteName: string | null
  areaName: string | null
} {
  if (data === null || data === undefined || typeof data !== 'object') {
    return { siteName: null, areaName: null }
  }
  const o = data as Record<string, unknown>
  return {
    siteName: nonEmptyString(o.siteName ?? o.site_name),
    areaName: nonEmptyString(o.areaName ?? o.area_name),
  }
}

/** Completa `data.hostname` usando el inventario cuando la capa física/lógica no lo trae. */
export function mergeHostnamesFromInventory(
  nodes: TopologyNode[],
  inventory: TopologyNode[] | undefined
): TopologyNode[] {
  if (!inventory?.length) return nodes
  const byId = new Map<string, string | null>()
  for (const n of inventory) {
    byId.set(n.id, normalizeTopologyHostname(n.data))
  }
  return nodes.map((n) => {
    const fromNode = normalizeTopologyHostname(n.data)
    const fromInv = byId.get(n.id) ?? null
    const hostname = fromNode ?? fromInv ?? null
    if (hostname === n.data.hostname) return n
    return { ...n, data: { ...n.data, hostname } }
  })
}

/**
 * Completa siteName/areaName desde el catálogo de sitios/áreas del proyecto
 * cuando la API de topología trae IDs pero no nombres (o nombres vacíos).
 */
export function enrichTopologyNodesSiteArea(
  nodes: TopologyNode[],
  sites: Site[],
): TopologyNode[] {
  if (!nodes.length) return nodes

  const siteById = new Map(sites.map((s) => [s.id, s]))
  const areaById = new Map<string, { name: string; siteId: string }>()
  for (const site of sites) {
    for (const area of site.areas ?? []) {
      areaById.set(area.id, { name: area.name, siteId: area.siteId || site.id })
    }
  }

  return nodes.map((node) => {
    const fromApi = readTopologySiteAreaNames(node.data)
    const siteId = nonEmptyString(node.data.siteId) ?? null
    const areaId = nonEmptyString(node.data.areaId) ?? null
    const area = areaId ? areaById.get(areaId) : undefined

    const areaName = fromApi.areaName ?? area?.name ?? null
    const siteName =
      fromApi.siteName ??
      (siteId ? siteById.get(siteId)?.name ?? null : null) ??
      (area ? siteById.get(area.siteId)?.name ?? null : null)

    if (siteName === (node.data.siteName ?? null) && areaName === (node.data.areaName ?? null)) {
      return node
    }
    return {
      ...node,
      data: {
        ...node.data,
        siteName,
        areaName,
        siteId: siteId ?? area?.siteId ?? node.data.siteId ?? null,
        areaId: areaId ?? node.data.areaId ?? null,
      },
    }
  })
}
