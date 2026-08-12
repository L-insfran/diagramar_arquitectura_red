/**
 * Orthogonal cable router with obstacle avoidance and lane reservation.
 * Runs in batch over all edges (not per-edge inside React Flow).
 */

import { dedupePoints, type DiagramPoint } from './orthogonalPath'

export type DiagramRect = {
  id: string
  x: number
  y: number
  width: number
  height: number
}

export type DiagramRouteEndpoint = {
  x: number
  y: number
  /** Preferred exit/entry direction for stub. */
  side: 'top' | 'bottom' | 'left' | 'right'
}

export type DiagramRouteRequest = {
  id: string
  source: DiagramRouteEndpoint
  target: DiagramRouteEndpoint
  /** Optional manual waypoints the path must pass near. */
  waypoints?: DiagramPoint[]
}

export type DiagramRouteResult = {
  points: DiagramPoint[]
}

export type OrthogonalRouterOptions = {
  padding?: number
  laneSpacing?: number
  stub?: number
  turnCost?: number
  reuseCost?: number
}

type Interval = { start: number; end: number }

type GridKey = string

function keyOf(x: number, y: number): GridKey {
  return `${Math.round(x)}:${Math.round(y)}`
}

function expandRect(r: DiagramRect, pad: number): DiagramRect {
  return {
    id: r.id,
    x: r.x - pad,
    y: r.y - pad,
    width: r.width + pad * 2,
    height: r.height + pad * 2,
  }
}

function pointInRect(p: DiagramPoint, r: DiagramRect): boolean {
  return p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height
}

function expandIntervals(list: Interval[], start: number, end: number) {
  const a = Math.min(start, end)
  const b = Math.max(start, end)
  list.push({ start: a, end: b })
}

function overlaps(list: Interval[], start: number, end: number): number {
  const a = Math.min(start, end)
  const b = Math.max(start, end)
  let count = 0
  for (const iv of list) {
    if (a < iv.end && b > iv.start) count++
  }
  return count
}

function stubPoint(ep: DiagramRouteEndpoint, stub: number): DiagramPoint {
  switch (ep.side) {
    case 'top':
      return { x: ep.x, y: ep.y - stub }
    case 'bottom':
      return { x: ep.x, y: ep.y + stub }
    case 'left':
      return { x: ep.x - stub, y: ep.y }
    case 'right':
      return { x: ep.x + stub, y: ep.y }
  }
}

function uniqueSorted(nums: number[]): number[] {
  const set = new Set(nums.map((n) => Math.round(n)))
  return Array.from(set).sort((a, b) => a - b)
}

/**
 * Build a Hanan-like grid from obstacle edges + endpoints, then A* with
 * turn / reuse penalties. Falls back to a simple orthogonal corridor.
 */
export function routeOrthogonalEdges(
  requests: DiagramRouteRequest[],
  obstacles: DiagramRect[],
  options: OrthogonalRouterOptions = {}
): Record<string, DiagramRouteResult> {
  const padding = options.padding ?? 12
  const laneSpacing = options.laneSpacing ?? 10
  const stub = options.stub ?? 16
  const turnCost = options.turnCost ?? 18
  const reuseCost = options.reuseCost ?? 40

  const expanded = obstacles.map((o) => expandRect(o, padding))
  const usedH = new Map<number, Interval[]>()
  const usedV = new Map<number, Interval[]>()

  const sorted = [...requests].sort((a, b) => a.id.localeCompare(b.id))
  const results: Record<string, DiagramRouteResult> = {}

  for (const req of sorted) {
    const start = stubPoint(req.source, stub)
    const end = stubPoint(req.target, stub)

    const xs = uniqueSorted([
      start.x,
      end.x,
      req.source.x,
      req.target.x,
      ...(req.waypoints ?? []).map((p) => p.x),
      ...expanded.flatMap((r) => [r.x, r.x + r.width]),
    ])
    const ys = uniqueSorted([
      start.y,
      end.y,
      req.source.y,
      req.target.y,
      ...(req.waypoints ?? []).map((p) => p.y),
      ...expanded.flatMap((r) => [r.y, r.y + r.height]),
    ])

    // Filter grid points that sit inside obstacles (keep endpoints).
    const nodes: DiagramPoint[] = []
    for (const x of xs) {
      for (const y of ys) {
        const p = { x, y }
        const isEndpoint =
          (Math.abs(p.x - start.x) < 1 && Math.abs(p.y - start.y) < 1) ||
          (Math.abs(p.x - end.x) < 1 && Math.abs(p.y - end.y) < 1)
        if (!isEndpoint && expanded.some((r) => pointInRect(p, r))) continue
        nodes.push(p)
      }
    }

    const path = aStar(
      start,
      end,
      nodes,
      usedH,
      usedV,
      turnCost,
      reuseCost,
      laneSpacing
    )

    const full = dedupePoints([
      { x: req.source.x, y: req.source.y },
      ...path,
      { x: req.target.x, y: req.target.y },
    ])

    // Soften with lane offset when reusing channels.
    const offsetPoints = applyLaneOffsets(full, usedH, usedV, laneSpacing)
    reserveSegments(offsetPoints, usedH, usedV)

    results[req.id] = { points: offsetPoints }
  }

  return results
}

function neighborsOf(
  p: DiagramPoint,
  xs: number[],
  ys: number[],
  nodeSet: Set<GridKey>
): DiagramPoint[] {
  const out: DiagramPoint[] = []
  const xi = xs.indexOf(Math.round(p.x))
  const yi = ys.indexOf(Math.round(p.y))
  if (xi > 0) {
    const n = { x: xs[xi - 1], y: p.y }
    if (nodeSet.has(keyOf(n.x, n.y))) out.push(n)
  }
  if (xi >= 0 && xi < xs.length - 1) {
    const n = { x: xs[xi + 1], y: p.y }
    if (nodeSet.has(keyOf(n.x, n.y))) out.push(n)
  }
  if (yi > 0) {
    const n = { x: p.x, y: ys[yi - 1] }
    if (nodeSet.has(keyOf(n.x, n.y))) out.push(n)
  }
  if (yi >= 0 && yi < ys.length - 1) {
    const n = { x: p.x, y: ys[yi + 1] }
    if (nodeSet.has(keyOf(n.x, n.y))) out.push(n)
  }
  return out
}

function aStar(
  start: DiagramPoint,
  goal: DiagramPoint,
  nodes: DiagramPoint[],
  usedH: Map<number, Interval[]>,
  usedV: Map<number, Interval[]>,
  turnCost: number,
  reuseCost: number,
  _laneSpacing: number
): DiagramPoint[] {
  if (nodes.length === 0) {
    return simpleOrthogonal(start, goal)
  }

  const xs = uniqueSorted(nodes.map((n) => n.x))
  const ys = uniqueSorted(nodes.map((n) => n.y))
  const nodeSet = new Set(nodes.map((n) => keyOf(n.x, n.y)))
  nodeSet.add(keyOf(start.x, start.y))
  nodeSet.add(keyOf(goal.x, goal.y))

  type State = { x: number; y: number; dir: string }
  const stateKey = (s: State) => `${keyOf(s.x, s.y)}|${s.dir}`

  const open: Array<{ s: State; g: number; f: number; parent: State | null }> = []
  const best = new Map<string, number>()

  const startState: State = { x: start.x, y: start.y, dir: '' }
  open.push({
    s: startState,
    g: 0,
    f: Math.abs(goal.x - start.x) + Math.abs(goal.y - start.y),
    parent: null,
  })
  best.set(stateKey(startState), 0)

  const came = new Map<string, State | null>()
  came.set(stateKey(startState), null)

  let found: State | null = null
  const maxIters = 8000
  let iters = 0

  while (open.length > 0 && iters < maxIters) {
    iters++
    open.sort((a, b) => a.f - b.f)
    const cur = open.shift()!
    if (Math.abs(cur.s.x - goal.x) < 1 && Math.abs(cur.s.y - goal.y) < 1) {
      found = cur.s
      break
    }

    const neigh = neighborsOf(cur.s, xs, ys, nodeSet)
    // Always allow direct snaps to goal on same row/col.
    if (Math.abs(cur.s.x - goal.x) < 1 || Math.abs(cur.s.y - goal.y) < 1) {
      neigh.push({ x: goal.x, y: goal.y })
    }

    for (const n of neigh) {
      const dx = n.x - cur.s.x
      const dy = n.y - cur.s.y
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : dy > 0 ? 'S' : 'N'
      const dist = Math.abs(dx) + Math.abs(dy)
      if (dist === 0) continue

      let reuse = 0
      if (Math.abs(dx) > 0.5) {
        reuse = overlaps(usedH.get(Math.round(cur.s.y)) ?? [], cur.s.x, n.x)
      } else {
        reuse = overlaps(usedV.get(Math.round(cur.s.x)) ?? [], cur.s.y, n.y)
      }

      const turn = cur.s.dir && cur.s.dir !== dir ? turnCost : 0
      const g = cur.g + dist + turn + reuse * reuseCost
      const next: State = { x: n.x, y: n.y, dir }
      const sk = stateKey(next)
      const prevBest = best.get(sk)
      if (prevBest != null && prevBest <= g) continue
      best.set(sk, g)
      came.set(sk, cur.s)
      const h = Math.abs(goal.x - n.x) + Math.abs(goal.y - n.y)
      open.push({ s: next, g, f: g + h, parent: cur.s })
    }
  }

  if (!found) return simpleOrthogonal(start, goal)

  // Reconstruct
  const chain: DiagramPoint[] = [{ x: found.x, y: found.y }]
  let cursor: State | null = found
  let guard = 0
  while (cursor && guard < 500) {
    guard++
    const parent = came.get(stateKey(cursor))
    if (!parent) break
    chain.push({ x: parent.x, y: parent.y })
    cursor = parent
  }
  chain.reverse()
  return dedupePoints(chain)
}

function simpleOrthogonal(start: DiagramPoint, goal: DiagramPoint): DiagramPoint[] {
  if (Math.abs(start.x - goal.x) < 1 || Math.abs(start.y - goal.y) < 1) {
    return [start, goal]
  }
  const midY = (start.y + goal.y) / 2
  return [start, { x: start.x, y: midY }, { x: goal.x, y: midY }, goal]
}

function reserveSegments(
  points: DiagramPoint[],
  usedH: Map<number, Interval[]>,
  usedV: Map<number, Interval[]>
) {
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]
    const b = points[i]
    if (Math.abs(a.y - b.y) < 0.5) {
      const y = Math.round(a.y)
      const list = usedH.get(y) ?? []
      expandIntervals(list, a.x, b.x)
      usedH.set(y, list)
    } else if (Math.abs(a.x - b.x) < 0.5) {
      const x = Math.round(a.x)
      const list = usedV.get(x) ?? []
      expandIntervals(list, a.y, b.y)
      usedV.set(x, list)
    }
  }
}

/**
 * Nudge segments that share a channel onto parallel lanes.
 * Applied once after path find; subsequent edges see reserved intervals.
 */
function applyLaneOffsets(
  points: DiagramPoint[],
  usedH: Map<number, Interval[]>,
  usedV: Map<number, Interval[]>,
  laneSpacing: number
): DiagramPoint[] {
  if (points.length < 2) return points
  const out = points.map((p) => ({ ...p }))

  for (let i = 1; i < out.length; i++) {
    const a = out[i - 1]
    const b = out[i]
    if (Math.abs(a.y - b.y) < 0.5) {
      const y = Math.round(a.y)
      const count = overlaps(usedH.get(y) ?? [], a.x, b.x)
      if (count > 0) {
        const offset = ((count % 2 === 0 ? 1 : -1) * Math.ceil(count / 2)) * laneSpacing
        a.y += offset
        b.y += offset
      }
    } else if (Math.abs(a.x - b.x) < 0.5) {
      const x = Math.round(a.x)
      const count = overlaps(usedV.get(x) ?? [], a.y, b.y)
      if (count > 0) {
        const offset = ((count % 2 === 0 ? 1 : -1) * Math.ceil(count / 2)) * laneSpacing
        a.x += offset
        b.x += offset
      }
    }
  }
  return dedupePoints(out)
}
