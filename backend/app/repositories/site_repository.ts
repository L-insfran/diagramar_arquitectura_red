import { DateTime } from 'luxon'
import Site from '#models/site'
import Area from '#models/area'
import Device from '#models/device'
import type {
  CreateAreaInput,
  CreateSiteInput,
  SiteFilters,
  UpdateAreaInput,
  UpdateSiteInput,
} from '#dtos/site_dto'

export default class SiteRepository {
  async findAllByProject(projectId: string, filters?: SiteFilters) {
    const query = Site.query()
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .preload('areas', (q) => q.whereNull('deleted_at').orderBy('name', 'asc'))
      .orderBy('name', 'asc')

    if (filters?.search) {
      query.where((q) => {
        q.whereILike('name', `%${filters.search}%`).orWhereILike('address', `%${filters.search}%`)
      })
    }

    return query
  }

  async findSiteByIdOrFail(id: string) {
    return Site.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('areas', (q) => q.whereNull('deleted_at').orderBy('name', 'asc'))
      .firstOrFail()
  }

  async findSiteSummaryOrFail(id: string) {
    return Site.query().where('id', id).whereNull('deleted_at').firstOrFail()
  }

  async createSite(data: CreateSiteInput & { createdBy: string; updatedBy: string }) {
    return Site.create({
      projectId: data.projectId,
      name: data.name,
      address: data.address ?? null,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async updateSite(site: Site, data: UpdateSiteInput & { updatedBy: string }) {
    site.merge(data)
    await site.save()
    return site
  }

  async softDeleteSite(site: Site, deletedBy: string) {
    site.deletedAt = DateTime.now()
    site.deletedBy = deletedBy
    site.updatedBy = deletedBy
    await site.save()
  }

  async countActiveDevicesOnSite(siteId: string) {
    const row = await Device.query()
      .where('site_id', siteId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async countActiveAreasOnSite(siteId: string) {
    const row = await Area.query()
      .where('site_id', siteId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async findAreaByIdOrFail(id: string) {
    return Area.query()
      .where('id', id)
      .whereNull('deleted_at')
      .preload('site')
      .firstOrFail()
  }

  async findAreaSummaryOrFail(id: string) {
    return Area.query().where('id', id).whereNull('deleted_at').preload('site').firstOrFail()
  }

  async listAreasBySite(siteId: string) {
    return Area.query()
      .where('site_id', siteId)
      .whereNull('deleted_at')
      .orderBy('name', 'asc')
  }

  async createArea(data: CreateAreaInput & { createdBy: string; updatedBy: string }) {
    return Area.create({
      siteId: data.siteId,
      name: data.name,
      notes: data.notes ?? null,
      createdBy: data.createdBy,
      updatedBy: data.updatedBy,
    })
  }

  async updateArea(area: Area, data: UpdateAreaInput & { updatedBy: string }) {
    area.merge(data)
    await area.save()
    return area
  }

  async softDeleteArea(area: Area, deletedBy: string) {
    area.deletedAt = DateTime.now()
    area.deletedBy = deletedBy
    area.updatedBy = deletedBy
    await area.save()
  }

  async countActiveDevicesOnArea(areaId: string) {
    const row = await Device.query()
      .where('area_id', areaId)
      .whereNull('deleted_at')
      .count('* as total')
      .first()
    return Number(row?.$extras?.total ?? 0)
  }

  async findActiveSiteInProject(siteId: string, projectId: string) {
    return Site.query()
      .where('id', siteId)
      .where('project_id', projectId)
      .whereNull('deleted_at')
      .first()
  }

  async findActiveAreaInSite(areaId: string, siteId: string) {
    return Area.query()
      .where('id', areaId)
      .where('site_id', siteId)
      .whereNull('deleted_at')
      .first()
  }
}
