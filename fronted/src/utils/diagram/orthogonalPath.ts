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
