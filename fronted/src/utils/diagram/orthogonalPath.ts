/** Shared orthogonal path helpers for diagram cable routing. */

export type DiagramPoint = { x: number; y: number }

export function dedupePoints(points: DiagramPoint[]): DiagramPoint[] {
  const out: DiagramPoint[] = []
  for (const point of points) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - point.x) < 0.5 && Math.abs(last.y - point.y) < 0.5) continue
    out.push(point)
  }
  return out
}

function shiftToward(from: DiagramPoint, to: DiagramPoint, distance: number): DiagramPoint {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)
  if (length === 0 || distance === 0) return { x: from.x, y: from.y }
  const ratio = Math.min(distance, length) / length
  return { x: from.x + dx * ratio, y: from.y + dy * ratio }
}

/** Convierte una polilínea en 90° a un trazo SVG con esquinas redondeadas. */
export function roundedOrthogonalPath(points: DiagramPoint[], radius = 8): string {
  const pts = dedupePoints(points)
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`

  let path = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i += 1) {
    const prev = pts[i - 1]
    const corner = pts[i]
    const next = pts[i + 1]
    const maxRadius = Math.min(
      radius,
      Math.hypot(corner.x - prev.x, corner.y - prev.y) / 2,
      Math.hypot(next.x - corner.x, next.y - corner.y) / 2
    )
    const entry = shiftToward(corner, prev, maxRadius)
    const exit = shiftToward(corner, next, maxRadius)
    path += ` L ${entry.x} ${entry.y} Q ${corner.x} ${corner.y} ${exit.x} ${exit.y}`
  }
  const end = pts[pts.length - 1]
  return `${path} L ${end.x} ${end.y}`
}

/** Label control point roughly mid-path. */
export function pathMidpoint(points: DiagramPoint[]): DiagramPoint {
  const pts = dedupePoints(points)
  if (pts.length === 0) return { x: 0, y: 0 }
  if (pts.length === 1) return pts[0]
  let total = 0
  const segs: number[] = []
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    segs.push(len)
    total += len
  }
  let remaining = total / 2
  for (let i = 1; i < pts.length; i++) {
    const len = segs[i - 1]
    if (remaining <= len) {
      const t = len === 0 ? 0 : remaining / len
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
      }
    }
    remaining -= len
  }
  return pts[pts.length - 1]
}

export type PathSegmentInfo = {
  mid: DiagramPoint
  /** Unit vector along the segment (toward end). */
  dir: DiagramPoint
  length: number
}

/** Midpoint of the longest segment — keeps labels on the visible cable run. */
export function pathLongestSegment(points: DiagramPoint[]): PathSegmentInfo {
  const pts = dedupePoints(points)
  if (pts.length < 2) {
    return { mid: pathMidpoint(pts), dir: { x: 1, y: 0 }, length: 0 }
  }

  let bestLen = -1
  let bestMid: DiagramPoint = { x: 0, y: 0 }
  let bestDir: DiagramPoint = { x: 1, y: 0 }

  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i].x - pts[i - 1].x
    const dy = pts[i].y - pts[i - 1].y
    const len = Math.hypot(dx, dy)
    if (len > bestLen) {
      bestLen = len
      bestMid = { x: (pts[i - 1].x + pts[i].x) / 2, y: (pts[i - 1].y + pts[i].y) / 2 }
      bestDir = len > 0 ? { x: dx / len, y: dy / len } : { x: 1, y: 0 }
    }
  }

  return { mid: bestMid, dir: bestDir, length: Math.max(0, bestLen) }
}

/** Preferred anchor for edge code labels (E1, E2…). */
export function pathLabelAnchor(points: DiagramPoint[]): DiagramPoint {
  return pathLongestSegment(points).mid
}

export function polylineLength(points: DiagramPoint[]): number {
  const pts = dedupePoints(points)
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
  }
  return total
}

/** Point at normalized distance t ∈ [0, 1] along the polyline. */
export function pointAtPathT(points: DiagramPoint[], t: number): DiagramPoint {
  const pts = dedupePoints(points)
  if (pts.length === 0) return { x: 0, y: 0 }
  if (pts.length === 1) return pts[0]
  const total = polylineLength(pts)
  if (total <= 0) return pts[0]
  let remaining = Math.min(1, Math.max(0, t)) * total
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    if (remaining <= len || i === pts.length - 1) {
      const r = len === 0 ? 0 : remaining / len
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * r,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * r,
      }
    }
    remaining -= len
  }
  return pts[pts.length - 1]
}

/** Closest point on the polyline and its normalized path parameter. */
export function closestPointOnPath(
  points: DiagramPoint[],
  p: DiagramPoint,
): { point: DiagramPoint; t: number } {
  const pts = dedupePoints(points)
  if (pts.length === 0) return { point: { x: 0, y: 0 }, t: 0 }
  if (pts.length === 1) return { point: pts[0], t: 0 }

  let bestDist = Infinity
  let bestPoint = pts[0]
  let bestAlong = 0
  let along = 0
  const total = polylineLength(pts)

  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const lenSq = dx * dx + dy * dy
    const len = Math.sqrt(lenSq)
    const u =
      lenSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
    const proj = { x: a.x + dx * u, y: a.y + dy * u }
    const d = Math.hypot(p.x - proj.x, p.y - proj.y)
    if (d < bestDist) {
      bestDist = d
      bestPoint = proj
      bestAlong = along + u * len
    }
    along += len
  }

  return { point: bestPoint, t: total > 0 ? bestAlong / total : 0 }
}

/** Default label t: midpoint of the longest visible segment. */
export function defaultLabelPathT(points: DiagramPoint[]): number {
  return closestPointOnPath(points, pathLabelAnchor(points)).t
}

/** Keep the chip off the device handles at both ends. */
export function clampLabelPathT(t: number, totalLen: number, insetPx = 20): number {
  if (totalLen <= insetPx * 2) return 0.5
  const a = insetPx / totalLen
  return Math.min(1 - a, Math.max(a, t))
}
