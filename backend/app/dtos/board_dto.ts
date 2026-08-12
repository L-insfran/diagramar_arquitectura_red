export type BoardKind = 'electrical' | 'communications' | 'generic'

export type BoardFilters = {
  areaId?: string
  siteId?: string
  search?: string
}

export type CreateBoardInput = {
  projectId: string
  areaId: string
  name: string
  code?: string | null
  kind?: BoardKind
  gridRows?: number
  gridCols?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type UpdateBoardInput = {
  areaId?: string
  name?: string
  code?: string | null
  kind?: BoardKind
  gridRows?: number
  gridCols?: number
  manufacturer?: string | null
  model?: string | null
  notes?: string | null
}

export type BoardOccupancyDevice = {
  id: string
  name: string
  boardRow: number
  boardCol: number
  boardRowSpan: number
  boardColSpan: number
}

export type BoardOccupancyCell = {
  row: number
  col: number
  deviceId: string | null
  deviceName: string | null
  isStart: boolean
}

export type BoardOccupancy = {
  boardId: string
  gridRows: number
  gridCols: number
  usedCells: number
  freeCells: number
  percentUsed: number
  devices: BoardOccupancyDevice[]
  cells: BoardOccupancyCell[]
}
