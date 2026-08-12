export type BoardFootprint = {
  id: string
  name: string
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
  deviceId: string
  deviceName: string
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
}): BoardFootprint {
  const rowSpan = Math.max(1, Math.round(params.rowSpan ?? 1))
  const colSpan = Math.max(1, Math.round(params.colSpan ?? 1))
  return {
    id: params.deviceId,
    name: params.deviceName,
    rowStart: params.row,
    rowEnd: params.row + rowSpan - 1,
    colStart: params.col,
    colEnd: params.col + colSpan - 1,
  }
}

export function footprintFitsGrid(
  fp: BoardFootprint,
  gridRows: number,
  gridCols: number
): boolean {
  return (
    fp.rowStart >= 0 &&
    fp.colStart >= 0 &&
    fp.rowEnd < gridRows &&
    fp.colEnd < gridCols
  )
}
