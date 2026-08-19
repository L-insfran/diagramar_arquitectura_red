import { DateTime } from 'luxon'
import Container from '#models/container'
import Device from '#models/device'
import Area from '#models/area'
import type { CreateContainerInput, ContainerFilters, UpdateContainerInput } from '#dtos/container_dto'

export default class ContainerRepository {
  async findAllByProject(projectId: string, filters?: ContainerFilters) {
    const query = Container.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('area', (q) => q.preload('site'))
      .withCount('devices', (q) => q.whereNull('deleted_at').as('deviceCount'))
      .orderBy('name', 'asc')

    if (filters?.kind) {
      query.where('kind', filters.kind)
    }
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
      .whereNull('deleted_at')
      .preload('area', (q) => q.preload('site'))
      .firstOrFail()
  }

  async findSummaryOrFail(id: string) {
    return Container.query().where('id', id).whereNull('deleted_at').preload('area').firstOrFail()
  }

  async findActiveInProject(id: string, projectId: string) {
    return Container.query()
      .where('id', id)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('area')
      .first()
  }

  async create(data: CreateContainerInput & { createdBy: string; updatedBy: string }) {
    return Container.create({
      projectId: data.projectId,
      areaId: data.areaId,
      kind: data.kind,
      name: data.name,
      code: data.code ?? null,
      manufacturer: data.manufacturer ?? null,
      model: data.model ?? null,
      notes: data.notes ?? null,
      heightU: data.heightU ?? null,
      boardKind: data.boardKind ?? null,
      gridRows: data.gridRows ?? null,
      gridCols: data.gridCols ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async update(container: Container, data: UpdateContainerInput & { updatedBy: string }) {
    container.merge(data)
    await container.save()
    return container
  }

  async softDelete(container: Container, deletedBy: string) {
    container.deletedAt = DateTime.now()
    container.deletedBy = deletedBy
    container.updatedBy = deletedBy
    await container.save()
  }

  async countActiveDevices(containerId: string) {
    const row = await Device.query()
      .where('container_id', containerId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async findDevicesInContainer(containerId: string) {
    return Device.query()
      .where('container_id', containerId)
      .whereNull('deleted_at')
      .preload('deviceTemplate')
      .orderBy('name', 'asc')
  }

  async findAreaWithSite(areaId: string) {
    return Area.query().where('id', areaId).whereNull('deleted_at').preload('site').first()
  }

  async findDefaultByArea(areaId: string) {
    return Container.query()
      .where('area_id', areaId)
      .where('kind', 'default')
      .whereNull('deleted_at')
      .first()
  }

  async ensureDefaultForArea(projectId: string, areaId: string, actorId: string) {
    const existing = await this.findDefaultByArea(areaId)
    if (existing) return existing

    const area = await this.findAreaWithSite(areaId)
    if (!area || area.site.projectId !== projectId) {
      return null
    }

    return this.create({
      projectId,
      areaId,
      kind: 'default',
      name: 'General',
      createdBy: actorId,
      updatedBy: actorId,
    })
  }
}
