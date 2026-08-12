import {
  pathLabelAnchor,
  pathLongestSegment,
  type DiagramPoint,
} from './orthogonalPath'

export type LabelObstacle = {
  x: number
  y: number
  width: number
  height: number
}

export type LabelOffset = { x: number; y: number }

/** Approx. label footprint for collision (compact code chip — E12). */
const LABEL_W = 52
const LABEL_H = 22
const PAD = 3
/** Max distance from cable anchor before accepting overlap. */
const MAX_ANCHOR_DIST = 28

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: LabelObstacle,
  pad: number,
): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.width + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.height + pad <= a.y
  )
}

function labelBox(cx: number, cy: number): { x: number; y: number; w: number; h: number } {
  // Coincide con transform translate(-50%, -50%) del EdgeLabelRenderer
  return {
    x: cx - LABEL_W / 2,
    y: cy - LABEL_H / 2,
    w: LABEL_W,
    h: LABEL_H,
  }
}

function collides(cx: number, cy: number, obstacles: LabelObstacle[]): boolean {
  const box = labelBox(cx, cy)
  return obstacles.some((o) => rectsOverlap(box, o, PAD))
}

function offsetFromAnchor(anchor: DiagramPoint, cx: number, cy: number): LabelOffset {
  return { x: cx - anchor.x, y: cy - anchor.y }
}

function dist(a: DiagramPoint, b: DiagramPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

/**
 * Candidatos pegados al tramo más largo del cable: primero sobre la línea,
 * luego desplazamientos mínimos perpendiculares o a lo largo del tramo.
 */
function buildCandidateAnchors(
  routePoints: DiagramPoint[] | undefined,
): DiagramPoint[] {
  const seg = pathLongestSegment(routePoints ?? [])
  const { mid, dir } = seg
  const anchors: DiagramPoint[] = [{ x: mid.x, y: mid.y }]

  const perpX = -dir.y
  const perpY = dir.x

  for (const d of [6, -6, 10, -10]) {
    anchors.push({ x: mid.x + perpX * d, y: mid.y + perpY * d })
  }

  for (const d of [-20, -10, 10, 20, -32, 32]) {
    anchors.push({ x: mid.x + dir.x * d, y: mid.y + dir.y * d })
  }

  return anchors
}

function labelAnchor(routePoints: DiagramPoint[] | undefined): DiagramPoint {
  return pathLabelAnchor(routePoints ?? [])
}

/**
 * Elige un offset pegado al cable. Prefiere claridad, pero no aleja la
 * etiqueta más de lo necesario.
 */
export function findClearLabelOffset(
  routePoints: DiagramPoint[] | undefined,
  obstacles: LabelObstacle[],
  existing?: LabelOffset | null,
): LabelOffset {
  const anchor = labelAnchor(routePoints)

  if (existing) {
    const ex = { x: anchor.x + existing.x, y: anchor.y + existing.y }
    if (!collides(ex.x, ex.y, obstacles) && dist(ex, anchor) <= MAX_ANCHOR_DIST) {
      return existing
    }
  }

  let bestClear: { anchor: DiagramPoint; d: number } | null = null
  let bestAny: { anchor: DiagramPoint; d: number } | null = null

  for (const candidate of buildCandidateAnchors(routePoints)) {
    const d = dist(candidate, anchor)
    if (!bestAny || d < bestAny.d) bestAny = { anchor: candidate, d }
    if (!collides(candidate.x, candidate.y, obstacles)) {
      if (!bestClear || d < bestClear.d) bestClear = { anchor: candidate, d }
      if (d <= 12) return offsetFromAnchor(anchor, candidate.x, candidate.y)
    }
  }

  if (bestClear && bestClear.d <= MAX_ANCHOR_DIST) {
    return offsetFromAnchor(anchor, bestClear.anchor.x, bestClear.anchor.y)
  }

  if (bestAny) {
    return offsetFromAnchor(anchor, bestAny.anchor.x, bestAny.anchor.y)
  }

  return { x: 0, y: 0 }
}

/**
 * Calcula offsets por edge id. Coloca en orden y trata etiquetas ya ubicadas
 * como obstáculos para evitar solapes entre sí.
 */
export function computeClearLabelOffsets(
  edges: Array<{
    id: string
    routePoints?: DiagramPoint[]
    labelOffsetX?: number
    labelOffsetY?: number
  }>,
  obstacles: LabelObstacle[],
): Record<string, LabelOffset> {
  const out: Record<string, LabelOffset> = {}
  const dynamic: LabelObstacle[] = [...obstacles]

  const sorted = [...edges].sort((a, b) => a.id.localeCompare(b.id))
  for (const e of sorted) {
    const off = findClearLabelOffset(
      e.routePoints,
      dynamic,
      e.labelOffsetX != null || e.labelOffsetY != null
        ? { x: e.labelOffsetX ?? 0, y: e.labelOffsetY ?? 0 }
        : null,
    )
    out[e.id] = off

    const anchor = labelAnchor(e.routePoints)
    const cx = anchor.x + off.x
    const cy = anchor.y + off.y
    const box = labelBox(cx, cy)
    dynamic.push({
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
    })
  }
  return out
}
