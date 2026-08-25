import type { CSSProperties } from 'react'
import { Position } from '@xyflow/react'
import type { DiagramRouteEndpoint } from './orthogonalRouter'
import {
  DIAGRAM_PORT_LABEL_LINE_PX,
  DIAGRAM_PORT_LABEL_PX,
} from './diagramTypography'
import { diagramHandleCenterY } from './diagramPortHandles'

export type DiagramHandleSide = 'top' | 'bottom' | 'left' | 'right'

export type DiagramHandleAnchor = {
  side: DiagramHandleSide
  /** 0–1 along the chosen side (left→right on top/bottom, top→bottom on left/right). */
  t: number
}

/** Change perimeter side while keeping the relative position along that edge. */
export function withHandleSide(
  anchor: DiagramHandleAnchor,
  side: DiagramHandleSide
): DiagramHandleAnchor {
  return { side, t: Math.min(1, Math.max(0, anchor.t)) }
}

/**
 * Offset from the node's border-box origin to the padding box
 * (`position: absolute` is relative to the padding edge).
 * Only `left`/`top` affect coordinate conversion; `right`/`bottom` are
 * documented for the full border box but unused by style helpers.
 */
export type NodeBoxInset = {
  left: number
  top: number
  right?: number
  bottom?: number
}

const ZERO_INSET: NodeBoxInset = { left: 0, top: 0 }

export function sideToPosition(side: DiagramHandleSide): Position {
  switch (side) {
    case 'top':
      return Position.Top
    case 'bottom':
      return Position.Bottom
    case 'left':
      return Position.Left
    case 'right':
      return Position.Right
  }
}

export function handleAnchorKey(deviceId: string, handleId: string): string {
  return `${deviceId}::${handleId}`
}

export function parseHandleAnchorKey(key: string): { deviceId: string; handleId: string } | null {
  const sep = key.indexOf('::')
  if (sep <= 0) return null
  return { deviceId: key.slice(0, sep), handleId: key.slice(sep + 2) }
}

/** Default anchor: targets left, sources right (free mode); inverted when portFlowInverted. */
export function defaultHandleAnchor(
  role: 'source' | 'target',
  index: number,
  total: number,
  nodeHeight: number,
  portAreaTop: number,
  layoutMode: 'free' | 'tree' = 'free',
  portFlowInverted = false,
  forcedSide?: DiagramHandleSide
): DiagramHandleAnchor {
  const portAreaH = Math.max(1, nodeHeight - portAreaTop)
  const y = portAreaTop + diagramHandleCenterY(index, total, portAreaH)
  const tAlongVertical = Math.min(1, Math.max(0, y / nodeHeight))

  if (forcedSide) {
    const isHorizontal = forcedSide === 'top' || forcedSide === 'bottom'
    return {
      side: forcedSide,
      t: isHorizontal
        ? Math.min(1, Math.max(0, (index + 0.5) / Math.max(1, total)))
        : tAlongVertical,
    }
  }

  if (layoutMode === 'tree') {
    if (role === 'source') {
      const side = portFlowInverted ? ('top' as const) : ('bottom' as const)
      return { side, t: Math.min(1, Math.max(0, (index + 0.5) / Math.max(1, total))) }
    }
    const side = portFlowInverted ? ('bottom' as const) : ('top' as const)
    return { side, t: Math.min(1, Math.max(0, (index + 0.5) / Math.max(1, total))) }
  }

  if (role === 'target') {
    const side = portFlowInverted ? ('right' as const) : ('left' as const)
    return { side, t: tAlongVertical }
  }
  const side = portFlowInverted ? ('left' as const) : ('right' as const)
  return { side, t: tAlongVertical }
}

/** Project a pointer position (node-local px) onto the nearest point on the rectangle perimeter. */
export function projectPointerToPerimeter(
  localX: number,
  localY: number,
  width: number,
  height: number
): DiagramHandleAnchor {
  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const x = Math.min(w, Math.max(0, localX))
  const y = Math.min(h, Math.max(0, localY))

  const distTop = y
  const distBottom = h - y
  const distLeft = x
  const distRight = w - x
  const min = Math.min(distTop, distBottom, distLeft, distRight)

  if (min === distTop) {
    return { side: 'top', t: x / w }
  }
  if (min === distBottom) {
    return { side: 'bottom', t: x / w }
  }
  if (min === distLeft) {
    return { side: 'left', t: y / h }
  }
  return { side: 'right', t: y / h }
}

export function anchorToLocalPoint(
  anchor: DiagramHandleAnchor,
  width: number,
  height: number
): { x: number; y: number } {
  const t = Math.min(1, Math.max(0, anchor.t))
  switch (anchor.side) {
    case 'top':
      return { x: t * width, y: 0 }
    case 'bottom':
      return { x: t * width, y: height }
    case 'left':
      return { x: 0, y: t * height }
    case 'right':
      return { x: width, y: t * height }
  }
}

/**
 * Place the handle so its visual center sits on the perimeter point used by the
 * orthogonal router (`anchorToLocalPoint`). `inset` converts border-box coords
 * into the padding-box space of `position: absolute`.
 */
export function anchorToHandleStyle(
  anchor: DiagramHandleAnchor,
  width: number,
  height: number,
  inset: NodeBoxInset = ZERO_INSET
): { position: Position; style: CSSProperties } {
  const local = anchorToLocalPoint(anchor, width, height)
  return {
    position: sideToPosition(anchor.side),
    style: {
      left: local.x - inset.left,
      top: local.y - inset.top,
      right: 'auto',
      bottom: 'auto',
      transform: 'translate(-50%, -50%)',
    },
  }
}

export function anchorToEndpoint(
  anchor: DiagramHandleAnchor,
  absX: number,
  absY: number,
  width: number,
  height: number
): DiagramRouteEndpoint {
  const local = anchorToLocalPoint(anchor, width, height)
  return {
    x: absX + local.x,
    y: absY + local.y,
    side: anchor.side,
  }
}

/** Label placement inside the node border, adjacent to the handle. */
export function anchorToLabelStyle(
  anchor: DiagramHandleAnchor,
  width: number,
  height: number,
  inset: NodeBoxInset = ZERO_INSET
): CSSProperties {
  const local = anchorToLocalPoint(anchor, width, height)
  const top = local.y - inset.top
  const left = local.x - inset.left
  const base: CSSProperties = {
    position: 'absolute',
    maxWidth: '44%',
    fontSize: DIAGRAM_PORT_LABEL_PX,
    lineHeight: `${DIAGRAM_PORT_LABEL_LINE_PX}px`,
    padding: '0 3px',
    pointerEvents: 'auto',
  }

  switch (anchor.side) {
    case 'top':
      return {
        ...base,
        left,
        top: 4,
        right: 'auto',
        bottom: 'auto',
        transform: 'translateX(-50%)',
        textAlign: 'center',
      }
    case 'bottom':
      return {
        ...base,
        left,
        top: 'auto',
        right: 'auto',
        bottom: 4,
        transform: 'translateX(-50%)',
        textAlign: 'center',
      }
    case 'left':
      return {
        ...base,
        left: 6,
        top,
        right: 'auto',
        bottom: 'auto',
        transform: 'translateY(-50%)',
        textAlign: 'left',
      }
    case 'right':
      return {
        ...base,
        left: 'auto',
        top,
        right: 6,
        bottom: 'auto',
        transform: 'translateY(-50%)',
        textAlign: 'right',
      }
  }
}
