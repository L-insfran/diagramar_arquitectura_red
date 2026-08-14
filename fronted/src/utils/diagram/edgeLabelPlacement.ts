import {
  closestPointOnPath,
  defaultLabelPathT,
  pathLabelAnchor,
  pointAtPathT,
  polylineLength,
  type DiagramPoint,
} from './orthogonalPath'

export type LabelObstacle = {
  x: number
  y: number
  width: number
  height: number
}

export type LabelOffset = { x: number; y: number; t?: number }

/** Approx. label footprint for collision (compact code chip — E12). */
const LABEL_W = 52
const LABEL_H = 22
const PAD = 3

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

function offsetFromAnchor(
  anchor: DiagramPoint,
  cx: number,
  cy: number,
  t: number,
): LabelOffset {
  return { x: cx - anchor.x, y: cy - anchor.y, t }
}

function samplePathTs(routePoints: DiagramPoint[]): number[] {
  const preferred = defaultLabelPathT(routePoints)
  const ts = [preferred]
  const total = polylineLength(routePoints)
  if (total < 8) return ts
  const steps = Math.min(20, Math.max(8, Math.round(total / 28)))
  for (let i = 1; i < steps; i++) {
    ts.push(i / steps)
  }
  return ts
}

/**
 * Elige un punto sobre el cable. Si ya hay un t guardado, lo respeta.
 * Si no, busca un t libre a lo largo de la polilínea (sin salir de la línea).
 */
export function findClearLabelOffset(
  routePoints: DiagramPoint[] | undefined,
  obstacles: LabelObstacle[],
  existing?: LabelOffset | null,
): LabelOffset {
  const pts = routePoints ?? []
  const anchor = pathLabelAnchor(pts)

  if (existing?.t != null && Number.isFinite(existing.t)) {
    const t = Math.min(1, Math.max(0, existing.t))
    const pos = pointAtPathT(pts, t)
    return offsetFromAnchor(anchor, pos.x, pos.y, t)
  }

  if (existing && (existing.x !== 0 || existing.y !== 0)) {
    const desired = { x: anchor.x + existing.x, y: anchor.y + existing.y }
    const snapped = closestPointOnPath(pts, desired)
    return offsetFromAnchor(anchor, snapped.point.x, snapped.point.y, snapped.t)
  }

  let bestClear: { pos: DiagramPoint; t: number } | null = null
  let bestAny: { pos: DiagramPoint; t: number } | null = null
  const preferredT = defaultLabelPathT(pts)

  for (const t of samplePathTs(pts)) {
    const pos = pointAtPathT(pts, t)
    const dPreferred = Math.abs(t - preferredT)
    if (!bestAny || dPreferred < Math.abs(bestAny.t - preferredT)) {
      bestAny = { pos, t }
    }
    if (!collides(pos.x, pos.y, obstacles)) {
      if (!bestClear || dPreferred < Math.abs(bestClear.t - preferredT)) {
        bestClear = { pos, t }
      }
      if (dPreferred <= 0.04) {
        return offsetFromAnchor(anchor, pos.x, pos.y, t)
      }
    }
  }

  const pick = bestClear ?? bestAny
  if (pick) return offsetFromAnchor(anchor, pick.pos.x, pick.pos.y, pick.t)
  return { x: 0, y: 0, t: preferredT }
}

/**
 * Calcula offsets por edge id. Coloca en orden y trata etiquetas ya ubicadas
 * como obstáculos para evitar solapes entre sí. Siempre sobre la línea.
 */
export function computeClearLabelOffsets(
  edges: Array<{
    id: string
    routePoints?: DiagramPoint[]
    labelOffsetX?: number
    labelOffsetY?: number
    labelPathT?: number
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
      e.labelPathT != null || e.labelOffsetX != null || e.labelOffsetY != null
        ? {
            x: e.labelOffsetX ?? 0,
            y: e.labelOffsetY ?? 0,
            t: e.labelPathT,
          }
        : null,
    )
    out[e.id] = off

    const pos = pointAtPathT(e.routePoints ?? [], off.t ?? defaultLabelPathT(e.routePoints ?? []))
    const box = labelBox(pos.x, pos.y)
    dynamic.push({
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
    })
  }
  return out
}
