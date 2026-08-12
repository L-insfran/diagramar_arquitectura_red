/**
 * Helpers to manually reshape orthogonal (H/V) cable polylines.
 * Keeps endpoints frozen on device ports and collapses colinear points.
 */

import { dedupePoints, type DiagramPoint } from './orthogonalPath'

const EPS = 0.75

function almostEq(a: number, b: number): boolean {
  return Math.abs(a - b) < EPS
}

function isHorizontal(a: DiagramPoint, b: DiagramPoint): boolean {
  return Math.abs(a.y - b.y) <= Math.abs(a.x - b.x)
}

/** Drop intermediate points that sit on the same H/V line as both neighbors. */
export function collapseColinear(points: DiagramPoint[]): DiagramPoint[] {
  const pts = dedupePoints(points.map((p) => ({ ...p })))
  if (pts.length < 3) return pts
  const out: DiagramPoint[] = [pts[0]]
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = out[out.length - 1]
    const cur = pts[i]
    const next = pts[i + 1]
    const colinearH = almostEq(prev.y, cur.y) && almostEq(cur.y, next.y)
    const colinearV = almostEq(prev.x, cur.x) && almostEq(cur.x, next.x)
    if (colinearH || colinearV) continue
    out.push(cur)
  }
  out.push(pts[pts.length - 1])
  return dedupePoints(out)
}

/** Force every segment to be purely horizontal or vertical. */
export function forceOrthogonal(points: DiagramPoint[]): DiagramPoint[] {
  const pts = dedupePoints(points.map((p) => ({ ...p })))
  if (pts.length < 2) return pts
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    if (almostEq(prev.x, cur.x) || almostEq(prev.y, cur.y)) continue
    // Prefer keeping the longer axis aligned with the previous segment's trend.
    if (Math.abs(cur.x - prev.x) >= Math.abs(cur.y - prev.y)) {
      pts[i] = { x: cur.x, y: prev.y }
    } else {
      pts[i] = { x: prev.x, y: cur.y }
    }
  }
  return collapseColinear(pts)
}

function simpleOrthogonal(start: DiagramPoint, goal: DiagramPoint): DiagramPoint[] {
  if (almostEq(start.x, goal.x) || almostEq(start.y, goal.y)) {
    return [start, goal]
  }
  const midY = (start.y + goal.y) / 2
  return [start, { x: start.x, y: midY }, { x: goal.x, y: midY }, goal]
}

/**
 * Stick first/last points to current port positions and keep the rest of the
 * manual route, repairing stub orthogonality.
 */
export function reattachOrthogonalEnds(
  points: DiagramPoint[],
  source: DiagramPoint,
  target: DiagramPoint
): DiagramPoint[] {
  if (!points.length) return simpleOrthogonal(source, target)
  if (points.length === 1) return simpleOrthogonal(source, target)

  const pts = points.map((p) => ({ ...p }))
  const prevFirst = pts[0]
  const prevLast = pts[pts.length - 1]
  pts[0] = { x: source.x, y: source.y }
  pts[pts.length - 1] = { x: target.x, y: target.y }

  if (pts.length === 2) {
    return simpleOrthogonal(source, target)
  }

  // Align second point with source along the original first-segment axis.
  const firstWasH = isHorizontal(prevFirst, points[1] ?? prevFirst)
  if (firstWasH) {
    pts[1] = { x: pts[1].x, y: source.y }
  } else {
    pts[1] = { x: source.x, y: pts[1].y }
  }

  const n = pts.length
  const lastWasH = isHorizontal(points[n - 2] ?? prevLast, prevLast)
  if (lastWasH) {
    pts[n - 2] = { x: pts[n - 2].x, y: target.y }
  } else {
    pts[n - 2] = { x: target.x, y: pts[n - 2].y }
  }

  return forceOrthogonal(pts)
}

export type SegmentHandle = {
  segmentIndex: number
  point: DiagramPoint
  orientation: 'h' | 'v'
}

export type CornerHandle = {
  pointIndex: number
  point: DiagramPoint
}

export function listSegmentHandles(points: DiagramPoint[]): SegmentHandle[] {
  const pts = dedupePoints(points)
  const out: SegmentHandle[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len < 8) continue
    out.push({
      segmentIndex: i,
      point: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      orientation: isHorizontal(a, b) ? 'h' : 'v',
    })
  }
  return out
}

export function listCornerHandles(points: DiagramPoint[]): CornerHandle[] {
  const pts = dedupePoints(points)
  const out: CornerHandle[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    out.push({ pointIndex: i, point: pts[i] })
  }
  return out
}

/**
 * Drag a segment's midpoint. Port endpoints stay fixed; segments that touch a
 * port grow an elbow so the cable remains orthogonal.
 */
export function dragOrthogonalSegment(
  raw: DiagramPoint[],
  segmentIndex: number,
  cursor: DiagramPoint
): DiagramPoint[] {
  const pts = dedupePoints(raw.map((p) => ({ ...p })))
  if (pts.length < 2) return pts
  const last = pts.length - 1
  if (segmentIndex < 0 || segmentIndex >= last) return pts

  const a = segmentIndex
  const b = segmentIndex + 1
  const horizontal = isHorizontal(pts[a], pts[b])
  const stubLen = 16
  const touchesStart = a === 0
  const touchesEnd = b === last

  // First segment (from port): build elbow from fixed source.
  if (touchesStart && !touchesEnd) {
    const source = pts[0]
    const oldB = pts[1]
    if (horizontal) {
      const x = source.x + (oldB.x >= source.x ? stubLen : -stubLen)
      return forceOrthogonal([
        source,
        { x, y: source.y },
        { x, y: cursor.y },
        { x: oldB.x, y: cursor.y },
        ...pts.slice(2),
      ])
    }
    const y = source.y + (oldB.y >= source.y ? stubLen : -stubLen)
    return forceOrthogonal([
      source,
      { x: source.x, y },
      { x: cursor.x, y },
      { x: cursor.x, y: oldB.y },
      ...pts.slice(2),
    ])
  }

  // Last segment (into port): build elbow into fixed target.
  if (touchesEnd && !touchesStart) {
    const target = pts[last]
    const oldA = pts[last - 1]
    if (horizontal) {
      const x = target.x + (oldA.x >= target.x ? stubLen : -stubLen)
      return forceOrthogonal([
        ...pts.slice(0, last - 1),
        { x: oldA.x, y: cursor.y },
        { x, y: cursor.y },
        { x, y: target.y },
        target,
      ])
    }
    const y = target.y + (oldA.y >= target.y ? stubLen : -stubLen)
    return forceOrthogonal([
      ...pts.slice(0, last - 1),
      { x: cursor.x, y: oldA.y },
      { x: cursor.x, y },
      { x: target.x, y },
      target,
    ])
  }

  // Degenerate single segment source→target.
  if (touchesStart && touchesEnd) {
    const source = pts[0]
    const target = pts[last]
    if (horizontal) {
      const x1 = source.x + (target.x >= source.x ? stubLen : -stubLen)
      const x2 = target.x + (source.x >= target.x ? stubLen : -stubLen)
      return forceOrthogonal([
        source,
        { x: x1, y: source.y },
        { x: x1, y: cursor.y },
        { x: x2, y: cursor.y },
        { x: x2, y: target.y },
        target,
      ])
    }
    const y1 = source.y + (target.y >= source.y ? stubLen : -stubLen)
    const y2 = target.y + (source.y >= target.y ? stubLen : -stubLen)
    return forceOrthogonal([
      source,
      { x: source.x, y: y1 },
      { x: cursor.x, y: y1 },
      { x: cursor.x, y: y2 },
      { x: target.x, y: y2 },
      target,
    ])
  }

  // Interior segment: move both ends on the perpendicular axis.
  if (horizontal) {
    pts[a] = { x: pts[a].x, y: cursor.y }
    pts[b] = { x: pts[b].x, y: cursor.y }
  } else {
    pts[a] = { x: cursor.x, y: pts[a].y }
    pts[b] = { x: cursor.x, y: pts[b].y }
  }
  return forceOrthogonal(pts)
}

/**
 * Drag an interior corner freely; neighbors stay orthogonal and ports stay fixed.
 */
export function dragOrthogonalCorner(
  raw: DiagramPoint[],
  pointIndex: number,
  cursor: DiagramPoint
): DiagramPoint[] {
  const pts = dedupePoints(raw.map((p) => ({ ...p })))
  if (pointIndex <= 0 || pointIndex >= pts.length - 1) return pts

  const last = pts.length - 1
  const source = pts[0]
  const target = pts[last]
  const nearStart = pointIndex === 1
  const nearEnd = pointIndex === last - 1

  // Only corner in an L-path (3 points): expand to a Z through the cursor.
  if (pts.length === 3) {
    return forceOrthogonal([
      source,
      { x: cursor.x, y: source.y },
      { x: cursor.x, y: target.y },
      target,
    ])
  }

  if (nearStart && nearEnd) {
    // 4-point path: move the two interior points as a vertical/horizontal corridor.
    return forceOrthogonal([
      source,
      { x: cursor.x, y: source.y },
      { x: cursor.x, y: target.y },
      target,
    ])
  }

  if (nearStart) {
    const next = pts[pointIndex + 1]
    const outgoingH = isHorizontal(pts[pointIndex], next)
    if (outgoingH) {
      return forceOrthogonal([
        source,
        { x: cursor.x, y: source.y },
        { x: cursor.x, y: cursor.y },
        { x: next.x, y: cursor.y },
        ...pts.slice(pointIndex + 2),
      ])
    }
    return forceOrthogonal([
      source,
      { x: source.x, y: cursor.y },
      { x: cursor.x, y: cursor.y },
      { x: cursor.x, y: next.y },
      ...pts.slice(pointIndex + 2),
    ])
  }

  if (nearEnd) {
    const prev = pts[pointIndex - 1]
    const incomingH = isHorizontal(prev, pts[pointIndex])
    if (incomingH) {
      return forceOrthogonal([
        ...pts.slice(0, pointIndex - 1),
        { x: prev.x, y: cursor.y },
        { x: cursor.x, y: cursor.y },
        { x: cursor.x, y: target.y },
        target,
      ])
    }
    return forceOrthogonal([
      ...pts.slice(0, pointIndex - 1),
      { x: cursor.x, y: prev.y },
      { x: cursor.x, y: cursor.y },
      { x: target.x, y: cursor.y },
      target,
    ])
  }

  const prev = pts[pointIndex - 1]
  const next = pts[pointIndex + 1]
  const incomingH = isHorizontal(prev, pts[pointIndex])
  const outgoingH = isHorizontal(pts[pointIndex], next)

  pts[pointIndex] = { x: cursor.x, y: cursor.y }
  pts[pointIndex - 1] = incomingH
    ? { x: prev.x, y: cursor.y }
    : { x: cursor.x, y: prev.y }
  pts[pointIndex + 1] = outgoingH
    ? { x: next.x, y: cursor.y }
    : { x: cursor.x, y: next.y }

  return forceOrthogonal(pts)
}

/**
 * Insert a U-bend on a segment so the user gets extra grab points.
 */
export function insertBendOnSegment(
  raw: DiagramPoint[],
  segmentIndex: number,
  cursor: DiagramPoint
): DiagramPoint[] {
  const pts = dedupePoints(raw.map((p) => ({ ...p })))
  if (segmentIndex < 0 || segmentIndex >= pts.length - 1) return pts
  const a = pts[segmentIndex]
  const b = pts[segmentIndex + 1]
  if (isHorizontal(a, b)) {
    const cx = cursor.x
    const cy = cursor.y
    pts.splice(
      segmentIndex + 1,
      0,
      { x: cx, y: a.y },
      { x: cx, y: cy },
      { x: b.x, y: cy }
    )
  } else {
    const cx = cursor.x
    const cy = cursor.y
    pts.splice(
      segmentIndex + 1,
      0,
      { x: a.x, y: cy },
      { x: cx, y: cy },
      { x: cx, y: b.y }
    )
  }
  return forceOrthogonal(pts)
}
