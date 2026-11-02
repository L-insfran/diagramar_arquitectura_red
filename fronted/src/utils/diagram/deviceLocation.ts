import type {
  TopologyBoardSummary,
  TopologyNode,
  TopologyRackSummary,
} from '../../types'

export type DeviceLocationKind = 'area' | 'rack' | 'board'

export type DeviceLocation = {
  kind: DeviceLocationKind
  /** Compact label for the device card: `Área › Contenedor` or just the area. */
  label: string
  /** Full path for tooltips: `Sitio › Área › Contenedor`. */
  title: string
}

const SEP = ' › '

function clean(value: string | null | undefined): string | null {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || null
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, 'es', { sensitivity: 'accent' }) === 0
}

/**
 * Resolves the physical placement of a device for the tree-layout card chrome.
 * Prefers inventory names; uses rack/board lists to distinguish container kind.
 */
export function resolveDeviceLocation(
  device: TopologyNode | undefined,
  racks: TopologyRackSummary[],
  boards: TopologyBoardSummary[]
): DeviceLocation | null {
  if (!device) return null

  const site = clean(device.data.siteName)
  const area = clean(device.data.areaName)
  const containerId = clean(device.data.containerId)

  const board = containerId ? boards.find((b) => b.id === containerId) : undefined
  const rack = !board && containerId ? racks.find((r) => r.id === containerId) : undefined

  let container =
    clean(board?.name) ??
    clean(rack?.name) ??
    clean(device.data.containerName)

  // Loose device in an area: inventory may echo the area as containerName.
  if (container && area && sameName(container, area)) {
    container = null
  }

  if (board) {
    const containerLabel = container ?? clean(board.name)
    const labelParts = [area, containerLabel].filter(Boolean) as string[]
    if (labelParts.length === 0) return null
    const label = labelParts.join(SEP)
    const title = [site, ...labelParts].filter(Boolean).join(SEP)
    return { kind: 'board', label, title: title || label }
  }

  if (rack) {
    const containerLabel = container ?? clean(rack.name)
    const labelParts = [area, containerLabel].filter(Boolean) as string[]
    if (labelParts.length === 0) return null
    const label = labelParts.join(SEP)
    const title = [site, ...labelParts].filter(Boolean).join(SEP)
    return { kind: 'rack', label, title: title || label }
  }

  if (container) {
    const labelParts = [area, container].filter(Boolean) as string[]
    const label = labelParts.join(SEP)
    const title = [site, ...labelParts].filter(Boolean).join(SEP)
    return { kind: 'area', label, title: title || label }
  }

  if (area) {
    const title = [site, area].filter(Boolean).join(SEP) || area
    return { kind: 'area', label: area, title }
  }

  return null
}
