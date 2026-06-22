import type { TopologyNode } from '../types'

/** Normaliza hostname desde la API (camelCase o snake_case, cadenas vacías → null). */
export function normalizeTopologyHostname(data: unknown): string | null {
  if (data === null || data === undefined || typeof data !== 'object') return null
  const o = data as Record<string, unknown>
  const raw = o.hostname ?? o.host_name
  if (raw == null) return null
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
  return s.length > 0 ? s : null
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
