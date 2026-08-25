import { Exception } from '@adonisjs/core/exceptions'
import BoardRepository from '#repositories/board_repository'
import type {
  BoardFilters,
  BoardOccupancy,
  BoardOccupancyCell,
  CreateBoardInput,
  UpdateBoardInput,
} from '#dtos/board_dto'
import {
  boardDeviceFootprint,
  footprintFitsGrid,
  footprintsOverlap,
} from '#services/board_layout'

export default class BoardService {
  private boards = new BoardRepository()

  async getAllByProject(projectId: string, filters?: BoardFilters) {
    return this.boards.findAllByProject(projectId, filters)
  }

  async getById(id: string) {
    return this.boards.findByIdOrFail(id)
  }

  async getSummary(id: string) {
    return this.boards.findSummaryOrFail(id)
  }

  async create(data: CreateBoardInput, actorId: string) {
    const area = await this.boards.findAreaWithSite(data.areaId)
    if (!area || area.site.projectId !== data.projectId) {
      throw new Exception('El área no pertenece al proyecto indicado', { status: 422 })
    }
    const gridRows = data.gridRows ?? 6
    const gridCols = data.gridCols ?? 8
    if (gridRows < 1 || gridRows > 40 || gridCols < 1 || gridCols > 40) {
      throw new Exception('gridRows y gridCols deben estar entre 1 y 40', { status: 422 })
    }
    const board = await this.boards.create({
      ...data,
      gridRows,
      gridCols,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.boards.findByIdOrFail(board.id)
  }

  async update(id: string, data: UpdateBoardInput, actorId: string) {
    const board = await this.boards.findSummaryOrFail(id)
    let relocatedSiteId: string | null = null
    if (data.areaId) {
      const area = await this.boards.findAreaWithSite(data.areaId)
      if (!area || area.site.projectId !== board.projectId) {
        throw new Exception('El área no pertenece al proyecto del tablero', { status: 422 })
      }
      if (data.areaId !== board.areaId) {
        relocatedSiteId = area.siteId
      }
    }

    const nextRows = data.gridRows ?? board.gridRows ?? 6
    const nextCols = data.gridCols ?? board.gridCols ?? 8
    if (nextRows < 1 || nextRows > 40 || nextCols < 1 || nextCols > 40) {
      throw new Exception('gridRows y gridCols deben estar entre 1 y 40', { status: 422 })
    }

    if (data.gridRows !== undefined || data.gridCols !== undefined) {
      const mounted = await this.boards.findMountedDevices(id)
      for (const device of mounted) {
        const fp = boardDeviceFootprint({
          deviceId: device.id,
          deviceName: device.name,
          row: device.boardRow ?? 0,
          col: device.boardCol ?? 0,
          rowSpan: device.boardRowSpan ?? 1,
          colSpan: device.boardColSpan ?? 1,
        })
        if (!footprintFitsGrid(fp, nextRows, nextCols)) {
          throw new Exception(
            `No se puede reducir la grilla: "${device.name}" queda fuera (${fp.rowStart},${fp.colStart})`,
            { status: 409 }
          )
        }
      }
    }

    await this.boards.update(board, { ...data, updatedBy: actorId })
    if (data.areaId && relocatedSiteId) {
      await this.boards.syncMountedDevicesLocation(id, {
        areaId: data.areaId,
        siteId: relocatedSiteId,
        updatedBy: actorId,
      })
    }
    return this.boards.findByIdOrFail(id)
  }

  async delete(id: string, actorId: string) {
    const board = await this.boards.findSummaryOrFail(id)
    const count = await this.boards.countActiveDevices(id)
    if (count > 0) {
      throw new Exception(
        `No se puede eliminar el tablero: hay ${count} dispositivo(s) montado(s)`,
        { status: 409 }
      )
    }
    await this.boards.softDelete(board, actorId)
  }

  async getOccupancy(id: string): Promise<BoardOccupancy> {
    const board = await this.boards.findByIdOrFail(id)
    const mounted = await this.boards.findMountedDevices(id)

    const devices = mounted.map((d) => ({
      id: d.id,
      name: d.name,
      boardRow: d.boardRow ?? 0,
      boardCol: d.boardCol ?? 0,
      boardRowSpan: Math.max(1, d.boardRowSpan ?? 1),
      boardColSpan: Math.max(1, d.boardColSpan ?? 1),
    }))

    const occupied = new Map<string, { deviceId: string; deviceName: string; isStart: boolean }>()
    for (const d of devices) {
      for (let r = d.boardRow; r < d.boardRow + d.boardRowSpan; r++) {
        for (let c = d.boardCol; c < d.boardCol + d.boardColSpan; c++) {
          occupied.set(`${r}:${c}`, {
            deviceId: d.id,
            deviceName: d.name,
            isStart: r === d.boardRow && c === d.boardCol,
          })
        }
      }
    }

    const cells: BoardOccupancyCell[] = []
    for (let r = 0; r < (board.gridRows ?? 0); r++) {
      for (let c = 0; c < (board.gridCols ?? 0); c++) {
        const owner = occupied.get(`${r}:${c}`)
        cells.push({
          row: r,
          col: c,
          deviceId: owner?.deviceId ?? null,
          deviceName: owner?.deviceName ?? null,
          isStart: owner?.isStart ?? false,
        })
      }
    }

    const usedCells = occupied.size
    const rows = board.gridRows ?? 0
    const cols = board.gridCols ?? 0
    const total = rows * cols
    const freeCells = Math.max(0, total - usedCells)

    return {
      boardId: board.id,
      gridRows: rows,
      gridCols: cols,
      usedCells,
      freeCells,
      percentUsed: total === 0 ? 0 : Math.round((usedCells / total) * 1000) / 10,
      devices,
      cells,
    }
  }

  /**
   * Validate board mount and sync site/area from board.
   * Clears rack/shelf fields when mounting on a board (caller responsibility).
   */
  async resolveBoardPlacement(params: {
    projectId: string
    containerId?: string | null
    boardRow?: number | null
    boardCol?: number | null
    boardRowSpan?: number | null
    boardColSpan?: number | null
    excludeDeviceId?: string
  }): Promise<{
    containerId: string
    boardRow: number
    boardCol: number
    boardRowSpan: number
    boardColSpan: number
    siteId: string
    areaId: string
  }> {
    const boardId = params.containerId
    if (!boardId) {
      throw new Exception('containerId es requerido para montar en tablero', { status: 422 })
    }

    const board = await this.boards.findActiveInProject(boardId, params.projectId)
    if (!board) {
      throw new Exception('El tablero no pertenece al proyecto o no existe', { status: 422 })
    }

    const row = params.boardRow
    const col = params.boardCol
    if (row == null || row < 0 || col == null || col < 0) {
      throw new Exception('boardRow y boardCol son obligatorios al montar en tablero (≥ 0)', {
        status: 422,
      })
    }

    const rowSpan = Math.max(1, Math.round(params.boardRowSpan ?? 1))
    const colSpan = Math.max(1, Math.round(params.boardColSpan ?? 1))

    const candidate = boardDeviceFootprint({
      deviceId: params.excludeDeviceId ?? 'new',
      deviceName: 'equipo',
      row,
      col,
      rowSpan,
      colSpan,
    })

    if (!footprintFitsGrid(candidate, board.gridRows ?? 0, board.gridCols ?? 0)) {
      throw new Exception(
        `El equipo (${rowSpan}×${colSpan} desde ${row},${col}) no cabe en la grilla ${board.gridRows ?? 0}×${board.gridCols ?? 0}`,
        { status: 422 }
      )
    }

    const mounted = await this.boards.findMountedDevices(boardId)
    for (const other of mounted) {
      if (params.excludeDeviceId && other.id === params.excludeDeviceId) continue
      if (other.boardRow == null || other.boardCol == null) continue
      const otherFp = boardDeviceFootprint({
        deviceId: other.id,
        deviceName: other.name,
        row: other.boardRow,
        col: other.boardCol,
        rowSpan: other.boardRowSpan ?? 1,
        colSpan: other.boardColSpan ?? 1,
      })
      if (footprintsOverlap(candidate, otherFp)) {
        throw new Exception(
          `Solape con "${other.name}" (fila ${otherFp.rowStart}–${otherFp.rowEnd}, col ${otherFp.colStart}–${otherFp.colEnd})`,
          { status: 409 }
        )
      }
    }

    return {
      containerId: boardId,
      boardRow: row,
      boardCol: col,
      boardRowSpan: rowSpan,
      boardColSpan: colSpan,
      siteId: board.area.siteId,
      areaId: board.areaId,
    }
  }
}
