/**
 * Transform / repair orthogonal routes when devices or containers move.
 * Manual routes stay user-authored: rigid translate if both ends move together,
 * otherwise an anchored affine remap, then orthogonal cleanup.
 */

import { type DiagramPoint } from './orthogonalPath'
import { forceOrthogonal, reattachOrthogonalEnds } from './orthogonalRouteEdit'
import type { DiagramRect } from './orthogonalRouter'

const RIGID_EPS = 1.5
const AXIS_EPS = 1e-3
const STALE_SHRINK = 4

export function repairManualRoute(
  points: DiagramPoint[],
  source: DiagramPoint,
  target: DiagramPoint,
): DiagramPoint[] {
  if (!points.length || points.length === 1) {
    return reattachOrthogonalEnds(points, source, target)
  }

  const prevSource = points[0]
  const prevTarget = points[points.length - 1]
  const dSx = source.x - prevSource.x
  const dSy = source.y - prevSource.y
  const dTx = target.x - prevTarget.x
  const dTy = target.y - prevTarget.y

  const rigid =
    Math.abs(dSx - dTx) <= RIGID_EPS && Math.abs(dSy - dTy) <= RIGID_EPS

  const next = rigid
    ? translateRoute(points, (dSx + dTx) / 2, (dSy + dTy) / 2)
    : remapAnchored(points, prevSource, prevTarget, source, target)

  return reattachOrthogonalEnds(forceOrthogonal(next), source, target)
}

function translateRoute(points: DiagramPoint[], dx: number, dy: number): DiagramPoint[] {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return points.map((p) => ({ ...p }))
  }
  return points.map((p) => ({ x: p.x + dx, y: p.y + dy }))
}

function remapAnchored(
  points: DiagramPoint[],
  prevSource: DiagramPoint,
  prevTarget: DiagramPoint,
  nextSource: DiagramPoint,
  nextTarget: DiagramPoint,
): DiagramPoint[] {
  const spanX = prevTarget.x - prevSource.x
  const spanY = prevTarget.y - prevSource.y
  const avgDx =
    (nextSource.x - prevSource.x + (nextTarget.x - prevTarget.x)) / 2
  const avgDy =
    (nextSource.y - prevSource.y + (nextTarget.y - prevTarget.y)) / 2
  const nextSpanX = nextTarget.x - nextSource.x
  const nextSpanY = nextTarget.y - nextSource.y

  return points.map((p, i) => {
    if (i === 0) return { x: nextSource.x, y: nextSource.y }
    if (i === points.length - 1) return { x: nextTarget.x, y: nextTarget.y }
    const tx = Math.abs(spanX) < AXIS_EPS ? null : (p.x - prevSource.x) / spanX
    const ty = Math.abs(spanY) < AXIS_EPS ? null : (p.y - prevSource.y) / spanY
    return {
      x: tx == null ? p.x + avgDx : nextSource.x + tx * nextSpanX,
      y: ty == null ? p.y + avgDy : nextSource.y + ty * nextSpanY,
    }
  })
}

function shrinkRect(rect: DiagramRect, pad: number): DiagramRect {
  return {
    id: rect.id,
    x: rect.x + pad,
    y: rect.y + pad,
    width: Math.max(0, rect.width - pad * 2),
    height: Math.max(0, rect.height - pad * 2),
  }
}

function almostEq(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.75
}

function segmentHitsRect(a: DiagramPoint, b: DiagramPoint, r: DiagramRect): boolean {
  if (r.width <= 0 || r.height <= 0) return false
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minY = Math.min(a.y, b.y)
  const maxY = Math.max(a.y, b.y)
  const rx2 = r.x + r.width
  const ry2 = r.y + r.height
  if (maxX < r.x || minX > rx2 || maxY < r.y || minY > ry2) return false

  if (almostEq(a.y, b.y)) {
    return a.y >= r.y && a.y <= ry2 && maxX >= r.x && minX <= rx2
  }
  if (almostEq(a.x, b.x)) {
    return a.x >= r.x && a.x <= rx2 && maxY >= r.y && minY <= ry2
  }
  return true
}

/**
 * True when a repaired manual route clearly crosses another node body.
 * Source/target ids should be ignored — stubs always touch those devices.
 */
export function isRouteStale(
  points: DiagramPoint[],
  obstacles: DiagramRect[],
  opts?: { ignoreIds?: Iterable<string> },
): boolean {
  if (points.length < 2 || obstacles.length === 0) return false
  const ignore = new Set(opts?.ignoreIds ?? [])
  const shrunk = obstacles
    .filter((o) => !ignore.has(o.id))
    .map((o) => shrinkRect(o, STALE_SHRINK))
  if (!shrunk.length) return false

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    for (const obs of shrunk) {
      if (segmentHitsRect(a, b, obs)) return true
    }
  }
  return false
}
