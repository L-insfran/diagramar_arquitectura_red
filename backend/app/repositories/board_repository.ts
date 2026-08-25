import { DateTime } from 'luxon'
import Container from '#models/container'
import Device from '#models/device'
import Area from '#models/area'
import type { CreateBoardInput, BoardFilters, UpdateBoardInput } from '#dtos/board_dto'

export default class BoardRepository {
  async findAllByProject(projectId: string, filters?: BoardFilters) {
    const query = Container.query()
      .where('kind', 'board')
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('area', (q) => q.preload('site'))
      .orderBy('name', 'asc')

    if (filters?.areaId) {
      query.where('area_id', filters.areaId)
    }
    if (filters?.siteId) {
      query.whereHas('area', (aq) => {
        aq.where('site_id', filters.siteId!)
      })
    }
    if (filters?.search) {
      query.where((q) => {
        q.whereILike('name', `%${filters.search}%`)
          .orWhereILike('code', `%${filters.search}%`)
          .orWhereILike('manufacturer', `%${filters.search}%`)
          .orWhereILike('model', `%${filters.search}%`)
      })
    }

    return query
  }

  async findByIdOrFail(id: string) {
    return Container.query()
      .where('id', id)
      .where('kind', 'board')
      .whereNull('deleted_at')
      .preload('area', (q) => q.preload('site'))
      .firstOrFail()
  }

  async findSummaryOrFail(id: string) {
    return Container.query().where('id', id).where('kind', 'board').whereNull('deleted_at').preload('area').firstOrFail()
  }

  async findActiveInProject(id: string, projectId: string) {
    return Container.query()
      .where('id', id)
      .where('kind', 'board')
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('area')
      .first()
  }

  async create(data: CreateBoardInput & { createdBy: string; updatedBy: string }) {
    return Container.create({
      projectId: data.projectId,
      areaId: data.areaId,
      kind: 'board',
      name: data.name,
      code: data.code ?? null,
      boardKind: data.kind ?? 'generic',
      gridRows: data.gridRows ?? 6,
      gridCols: data.gridCols ?? 8,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(board: Container, data: UpdateBoardInput & { updatedBy: string }) {
    const { kind, ...rest } = data
    board.merge(rest)
    if (kind !== undefined) board.boardKind = kind
    await board.save()
    return board
  }

  async softDelete(board: Container, deletedBy: string) {
    board.deletedAt = DateTime.now()
    board.deletedBy = deletedBy
    board.updatedBy = deletedBy
    await board.save()
  }

  async countActiveDevices(containerId: string) {
    const row = await Device.query()
      .where('container_id', containerId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async findMountedDevices(containerId: string) {
    return Device.query()
      .where('container_id', containerId)
      .whereNull('deleted_at')
      .whereNotNull('board_row')
      .whereNotNull('board_col')
      .orderBy('board_row', 'asc')
      .orderBy('board_col', 'asc')
  }

  async syncMountedDevicesLocation(
    containerId: string,
    data: { areaId: string; siteId: string; updatedBy: string }
  ) {
    await Device.query()
      .where('container_id', containerId)
      .whereNull('deleted_at')
      .update({
        areaId: data.areaId,
        siteId: data.siteId,
        updatedBy: data.updatedBy,
      })
  }

  async findAreaWithSite(areaId: string) {
    return Area.query().where('id', areaId).whereNull('deleted_at').preload('site').first()
  }
}
