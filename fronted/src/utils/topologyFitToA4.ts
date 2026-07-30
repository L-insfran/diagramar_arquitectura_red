import { getNodesBounds, type Node } from '@xyflow/react'
import {
  computeExportCaptureRect,
  computeTileGrid,
  getA4DiagramUsableMm,
  getExportCapturePixelSize,
  type PrintOrientation,
} from './printDiagramSectorGrid'

export type FitToA4Result = {
  nodes: Node[]
  /** true si el contenido ya cabía en 1 sector (ajuste mínimo / centrado). */
  alreadySinglePage: boolean
  /** Sectores estimados antes del ajuste. */
  pagesBefore: number
  scale: number
}

const FIT_PADDING = 0.08
/** No encoger por debajo de esto respecto al tamaño actual (legibilidad). */
const MIN_SCALE = 0.35

function isMovableRoot(node: Node): boolean {
  if (node.parentId) {
    // Hijos de rack: se mueven con el rack. Hijos de work area: posición relativa al área.
    return false
  }
  return node.type === 'device' || node.type === 'cloud' || node.type === 'rack' || node.type === 'workArea'
}

/**
 * Traslada (y escala si hace falta) los nodos raíz para que el diagrama quepa
 * en el sector página 1 del área de captura A4 actual.
 * No toca posiciones relativas de equipos montados en rack.
 */
export function fitTopologyNodesToA4Page1(
  nodes: Node[],
  orientation: PrintOrientation,
): FitToA4Result | null {
  if (nodes.length === 0) return null

  const capture = computeExportCaptureRect(nodes, orientation)
  if (!capture) return null

  const { imgW, imgH } = getExportCapturePixelSize(nodes.length, orientation)
  const { usableW, usableH } = getA4DiagramUsableMm(orientation)
  const { cols, rows } = computeTileGrid(imgW, imgH, usableW, usableH)
  const pagesBefore = cols * rows
  const alreadySinglePage = pagesBefore <= 1

  const page1 = {
    x: capture.x,
    y: capture.y,
    width: capture.width / cols,
    height: capture.height / rows,
  }

  const movable = nodes.filter(isMovableRoot)
  if (movable.length === 0) return null

  // Bounds en coords absolutas de flujo (nodos raíz ya están en abs).
  const bounds = getNodesBounds(movable)
  if (!(bounds.width > 0) || !(bounds.height > 0)) return null

  const targetW = page1.width * (1 - FIT_PADDING * 2)
  const targetH = page1.height * (1 - FIT_PADDING * 2)
  let scale = Math.min(targetW / bounds.width, targetH / bounds.height, 1)
  if (!Number.isFinite(scale) || scale <= 0) scale = 1
  if (scale < MIN_SCALE) scale = MIN_SCALE

  const scaledW = bounds.width * scale
  const scaledH = bounds.height * scale
  const originX = page1.x + (page1.width - scaledW) / 2
  const originY = page1.y + (page1.height - scaledH) / 2

  const next = nodes.map((node) => {
    if (!isMovableRoot(node)) return node
    const relX = node.position.x - bounds.x
    const relY = node.position.y - bounds.y
    return {
      ...node,
      position: {
        x: originX + relX * scale,
        y: originY + relY * scale,
      },
    }
  })

  return { nodes: next, alreadySinglePage, pagesBefore, scale }
}
