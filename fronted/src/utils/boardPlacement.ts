/** Client-side board grid placement helpers (mirror of board_layout.ts). */

export type BoardFootprint = {
  id: string
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
}

export function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart <= bEnd && bStart <= aEnd
}

export function footprintsOverlap(a: BoardFootprint, b: BoardFootprint): boolean {
  return (
    rangesOverlap(a.rowStart, a.rowEnd, b.rowStart, b.rowEnd) &&
    rangesOverlap(a.colStart, a.colEnd, b.colStart, b.colEnd)
  )
}

export function boardDeviceFootprint(params: {
  id: string
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
}): BoardFootprint {
  const rowSpan = Math.max(1, params.rowSpan ?? 1)
  const colSpan = Math.max(1, params.colSpan ?? 1)
  return {
    id: params.id,
    rowStart: params.row,
    rowEnd: params.row + rowSpan - 1,
    colStart: params.col,
    colEnd: params.col + colSpan - 1,
  }
}

export function canPlaceOnBoard(params: {
  gridRows: number
  gridCols: number
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  occupied: BoardFootprint[]
  excludeId?: string
}): boolean {
  const candidate = boardDeviceFootprint({
    id: 'candidate',
    row: params.row,
    col: params.col,
    rowSpan: params.rowSpan,
    colSpan: params.colSpan,
  })
  if (
    candidate.rowStart < 0 ||
    candidate.colStart < 0 ||
    candidate.rowEnd >= params.gridRows ||
    candidate.colEnd >= params.gridCols
  ) {
    return false
  }
  for (const other of params.occupied) {
    if (params.excludeId && other.id === params.excludeId) continue
    if (footprintsOverlap(candidate, other)) return false
  }
  return true
}

export const BOARD_CELL_PX = 56
export const BOARD_HEADER_H = 48
export const BOARD_PAD = 8

export function boardOuterSize(gridRows: number, gridCols: number) {
  return {
    width: BOARD_PAD * 2 + gridCols * BOARD_CELL_PX,
    height: BOARD_HEADER_H + BOARD_PAD * 2 + gridRows * BOARD_CELL_PX,
  }
}

export function devicePositionOnBoard(row: number, col: number, rowSpan = 1, colSpan = 1) {
  return {
    x: BOARD_PAD + col * BOARD_CELL_PX,
    y: BOARD_HEADER_H + BOARD_PAD + row * BOARD_CELL_PX,
    width: Math.max(1, colSpan) * BOARD_CELL_PX,
    height: Math.max(1, rowSpan) * BOARD_CELL_PX,
  }
}

export function boardFlowNodeId(boardId: string) {
  return `board:${boardId}`
}
