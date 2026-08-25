/** Handle IDs for connection-diagram devices (one visible port = one connected endpoint). */

export type DiagramPortHandle = {
  id: string
  label: string
}

export const DIAGRAM_CONNECT_SOURCE_HANDLE = 'device-out'
export const DIAGRAM_CONNECT_TARGET_HANDLE = 'device-in'

export function diagramSourceHandleId(
  portId: string | null | undefined,
  portLabel: string
): string {
  if (portId) return `out:port:${portId}`
  const key = portLabel.trim() || 'port'
  return `out:label:${encodeURIComponent(key)}`
}

export function diagramTargetHandleId(
  portId: string | null | undefined,
  portLabel: string
): string {
  if (portId) return `in:port:${portId}`
  const key = portLabel.trim() || 'port'
  return `in:label:${encodeURIComponent(key)}`
}

/** Parse a diagram handle id into optional inventory port id / free-text label. */
export function parseDiagramHandlePort(handleId: string): {
  portId: string | null
  portLabel: string | null
} {
  if (handleId.startsWith('out:port:') || handleId.startsWith('in:port:')) {
    return {
      portId: handleId.replace(/^(out|in):port:/, ''),
      portLabel: null,
    }
  }
  if (handleId.startsWith('out:label:') || handleId.startsWith('in:label:')) {
    const enc = handleId.replace(/^(out|in):label:/, '')
    try {
      return { portId: null, portLabel: decodeURIComponent(enc) }
    } catch {
      return { portId: null, portLabel: enc }
    }
  }
  if (handleId.startsWith('port:')) {
    return { portId: handleId.slice(5), portLabel: null }
  }
  if (handleId.startsWith('label:')) {
    const enc = handleId.slice(6)
    try {
      return { portId: null, portLabel: decodeURIComponent(enc) }
    } catch {
      return { portId: null, portLabel: enc }
    }
  }
  return { portId: null, portLabel: null }
}

/** Vertical center of handle `index` among `total` (0-based), in px from node top. */
export function diagramHandleCenterY(
  index: number,
  total: number,
  nodeHeight: number
): number {
  const n = Math.max(1, total)
  if (n === 1) return nodeHeight / 2
  const pad = Math.min(10, nodeHeight * 0.18)
  const span = Math.max(0, nodeHeight - pad * 2)
  return pad + (span * index) / (n - 1)
}
