import type {
  DiagramHandleAnchor,
  DiagramHandleSide,
  DiagramLayoutMode,
  DiagramLinkEdge,
  DiagramPortDisplay,
  TopologyPortSummary,
} from '../../types'
import { defaultHandleAnchor, handleAnchorKey } from './handleAnchor'

export type DiagramPortSlot = {
  id: string
  label: string
  portNumber: number
  role: 'source' | 'target' | null
  linkId: string | null
  connected: boolean
  /** Default perimeter side before user override. */
  side: DiagramHandleSide
  /** Resolved anchor for render + routing. */
  anchor: DiagramHandleAnchor
  orderIndex: number
}

export function neutralPortHandleId(
  portId: string | null | undefined,
  portLabel: string
): string {
  if (portId) return `port:${portId}`
  const key = portLabel.trim() || 'port'
  return `label:${encodeURIComponent(key)}`
}

/** Parse neutral or legacy (`out:`/`in:`) handle ids. */
export function parsePortHandleId(handleId: string): {
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

export function legacyToNeutralHandleId(handleId: string): string {
  const parsed = parsePortHandleId(handleId)
  if (parsed.portId) return neutralPortHandleId(parsed.portId, '')
  if (parsed.portLabel) return neutralPortHandleId(null, parsed.portLabel)
  return handleId
}

export function normalizeHandleAnchorKeys(
  anchors: Record<string, DiagramHandleAnchor>
): Record<string, DiagramHandleAnchor> {
  const out: Record<string, DiagramHandleAnchor> = {}
  for (const [key, val] of Object.entries(anchors)) {
    const sep = key.indexOf('::')
    if (sep <= 0) {
      out[key] = val
      continue
    }
    const deviceId = key.slice(0, sep)
    const handleId = legacyToNeutralHandleId(key.slice(sep + 2))
    out[`${deviceId}::${handleId}`] = val
  }
  return out
}

export function edgeHandleId(
  portId: string | null | undefined,
  portLabel: string
): string {
  return neutralPortHandleId(portId, portLabel)
}

/** React Flow target handles use `::in` suffix (see SimpleDeviceNode). */
export function edgeTargetHandleId(
  portId: string | null | undefined,
  portLabel: string
): string {
  return `${edgeHandleId(portId, portLabel)}::in`
}

type LinkRoleEntry = {
  role: 'source' | 'target'
  linkId: string
}

function buildLinkRolesForDevice(
  deviceId: string,
  edges: DiagramLinkEdge[]
): Map<string, LinkRoleEntry> {
  const byHandle = new Map<string, LinkRoleEntry>()
  for (const e of edges) {
    if (e.source === deviceId) {
      const id = edgeHandleId(e.sourcePortId, e.sourcePort)
      byHandle.set(id, { role: 'source', linkId: e.id })
    }
    if (e.target === deviceId) {
      const id = edgeHandleId(e.targetPortId, e.targetPort)
      byHandle.set(id, { role: 'target', linkId: e.id })
    }
  }
  return byHandle
}

export function defaultSideForRole(
  role: 'source' | 'target' | null,
  unconnectedIndex: number,
  layoutMode: DiagramLayoutMode,
  portFlowInverted: boolean
): DiagramHandleSide {
  if (role === 'source') {
    if (layoutMode === 'tree') return portFlowInverted ? 'top' : 'bottom'
    return portFlowInverted ? 'right' : 'left'
  }
  if (role === 'target') {
    if (layoutMode === 'tree') return portFlowInverted ? 'bottom' : 'top'
    return portFlowInverted ? 'left' : 'right'
  }
  void layoutMode
  return unconnectedIndex % 2 === 0 ? 'left' : 'right'
}

function sortPorts(ports: TopologyPortSummary[]): TopologyPortSummary[] {
  return [...ports].sort((a, b) => a.portNumber - b.portNumber || a.name.localeCompare(b.name))
}

export function resolveDevicePortSlots(params: {
  deviceId: string
  ports: TopologyPortSummary[]
  edges: DiagramLinkEdge[]
  layoutMode: DiagramLayoutMode
  portDisplay: DiagramPortDisplay
  portFlowInverted: boolean
  savedAnchors: Record<string, DiagramHandleAnchor>
  nodeHeight?: number
  portAreaTop?: number
}): DiagramPortSlot[] {
  const {
    deviceId,
    ports,
    edges,
    layoutMode,
    portDisplay,
    portFlowInverted,
    savedAnchors,
    nodeHeight = 100,
    portAreaTop = 0,
  } = params

  const linkRoles = buildLinkRolesForDevice(deviceId, edges)
  const sorted = sortPorts(ports)
  let unconnectedIdx = 0

  const raw: Omit<DiagramPortSlot, 'anchor'>[] = []

  for (const port of sorted) {
    const id = neutralPortHandleId(port.id, port.name)
    const link = linkRoles.get(id)
    const connected = Boolean(link)
    if (portDisplay === 'connected' && !connected) continue

    const role = link?.role ?? null
    const side = defaultSideForRole(
      role,
      unconnectedIdx,
      layoutMode,
      portFlowInverted
    )
    if (!connected) unconnectedIdx++

    raw.push({
      id,
      label: port.name,
      portNumber: port.portNumber,
      role,
      linkId: link?.linkId ?? null,
      connected,
      side,
      orderIndex: raw.length,
    })
  }

  // Include label-only handles from links when port id missing from inventory
  for (const [handleId, link] of linkRoles) {
    if (raw.some((s) => s.id === handleId)) continue
    if (portDisplay === 'connected') {
      raw.push({
        id: handleId,
        label: parsePortHandleId(handleId).portLabel ?? handleId,
        portNumber: 9999,
        role: link.role,
        linkId: link.linkId,
        connected: true,
        side: defaultSideForRole(link.role, unconnectedIdx, layoutMode, portFlowInverted),
        orderIndex: raw.length,
      })
    }
  }

  return assignSlotAnchors(
    raw,
    savedAnchors,
    deviceId,
    layoutMode,
    portFlowInverted,
    nodeHeight,
    portAreaTop
  )
}

export function slotsPerSide(
  slots: Pick<DiagramPortSlot, 'side'>[]
): Record<DiagramHandleSide, number> {
  const counts: Record<DiagramHandleSide, number> = {
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }
  for (const s of slots) {
    counts[s.side]++
  }
  return counts
}

/** Rows needed for vertical sides (left/right); tree top/bottom add one row each if used. */
export function portSlotsVerticalRows(slots: Pick<DiagramPortSlot, 'side'>[]): number {
  const counts = slotsPerSide(slots)
  const vertical = Math.max(counts.left, counts.right)
  const horizUsed = counts.top > 0 || counts.bottom > 0 ? 1 : 0
  return Math.max(vertical, horizUsed)
}

export function assignSlotAnchors(
  slots: Omit<DiagramPortSlot, 'anchor'>[],
  savedAnchors: Record<string, DiagramHandleAnchor>,
  deviceId: string,
  layoutMode: DiagramLayoutMode = 'free',
  portFlowInverted = false,
  nodeHeight = 100,
  portAreaTop = 0
): DiagramPortSlot[] {
  const bySide = new Map<DiagramHandleSide, Omit<DiagramPortSlot, 'anchor'>[]>()
  for (const slot of slots) {
    const list = bySide.get(slot.side) ?? []
    list.push(slot)
    bySide.set(slot.side, list)
  }

  const result: DiagramPortSlot[] = []

  for (const [side, sideSlots] of bySide) {
    const sorted = [...sideSlots].sort(
      (a, b) => a.portNumber - b.portNumber || a.orderIndex - b.orderIndex
    )
    sorted.forEach((slot, index) => {
      const saved =
        savedAnchors[handleAnchorKey(deviceId, slot.id)] ??
        savedAnchors[handleAnchorKey(deviceId, legacyToNeutralHandleId(slot.id))]
      const role = slot.role ?? 'source'
      const defaultAnchor = defaultHandleAnchor(
        role === 'target' ? 'target' : 'source',
        index,
        sorted.length,
        nodeHeight,
        portAreaTop,
        layoutMode,
        portFlowInverted,
        side
      )
      // En modo árbol, anclas guardadas del layout libre (laterales) no aplican.
      const useSaved =
        saved &&
        (layoutMode === 'free' ||
          (slot.connected && saved.side === slot.side) ||
          (!slot.connected && saved.side === side))
      const anchor = useSaved ? { ...saved } : defaultAnchor
      result.push({ ...slot, anchor })
    })
  }

  return result.sort((a, b) => a.portNumber - b.portNumber || a.orderIndex - b.orderIndex)
}

/** Renormalize `t` evenly along one side after reorder. */
export function renormalizeSideAnchors(
  slots: DiagramPortSlot[],
  side: DiagramHandleSide
): DiagramPortSlot[] {
  const onSide = slots
    .filter((s) => s.anchor.side === side)
    .sort((a, b) => a.anchor.t - b.anchor.t)
  if (onSide.length <= 1) return slots

  const n = onSide.length
  const tById = new Map<string, number>()
  onSide.forEach((s, i) => {
    tById.set(s.id, n === 1 ? 0.5 : i / (n - 1))
  })

  return slots.map((s) =>
    s.anchor.side === side && tById.has(s.id)
      ? { ...s, anchor: { ...s.anchor, t: tById.get(s.id)! } }
      : s
  )
}

/** Move slot to a new side at insertion index (0-based among slots on that side). */
export function reorderSlotOnSide(
  slots: DiagramPortSlot[],
  handleId: string,
  targetSide: DiagramHandleSide,
  insertIndex: number
): DiagramPortSlot[] {
  const moving = slots.find((s) => s.id === handleId)
  if (!moving) return slots

  const others = slots.filter((s) => s.id !== handleId)
  const onTarget = others
    .filter((s) => s.anchor.side === targetSide)
    .sort((a, b) => a.anchor.t - b.anchor.t)
  const clamped = Math.max(0, Math.min(insertIndex, onTarget.length))
  onTarget.splice(clamped, 0, { ...moving, side: targetSide, anchor: { ...moving.anchor, side: targetSide } })

  const n = onTarget.length
  const updated = new Map<string, DiagramPortSlot>()
  onTarget.forEach((s, i) => {
    updated.set(s.id, {
      ...s,
      side: targetSide,
      anchor: { side: targetSide, t: n === 1 ? 0.5 : i / (n - 1) },
    })
  })

  return slots.map((s) => updated.get(s.id) ?? s)
}

export function insertIndexFromPointerT(
  slots: DiagramPortSlot[],
  side: DiagramHandleSide,
  t: number,
  excludeId?: string
): number {
  const onSide = slots
    .filter((s) => s.anchor.side === side && s.id !== excludeId)
    .sort((a, b) => a.anchor.t - b.anchor.t)
  let insertAt = onSide.length
  for (let i = 0; i < onSide.length; i++) {
    if (t < onSide[i].anchor.t) {
      insertAt = i
      break
    }
  }
  return insertAt
}
