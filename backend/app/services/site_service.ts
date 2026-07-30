import { Exception } from '@adonisjs/core/exceptions'
import SiteRepository from '#repositories/site_repository'
import type {
  CreateAreaInput,
  CreateSiteInput,
  SiteFilters,
  UpdateAreaInput,
  UpdateSiteInput,
} from '#dtos/site_dto'

export default class SiteService {
  private sites = new SiteRepository()

  async getAllByProject(projectId: string, filters?: SiteFilters) {
    return this.sites.findAllByProject(projectId, filters)
  }

  async getSiteById(id: string) {
    return this.sites.findSiteByIdOrFail(id)
  }

  async getSiteSummary(id: string) {
    return this.sites.findSiteSummaryOrFail(id)
  }

  async createSite(data: CreateSiteInput, actorId: string) {
    const site = await this.sites.createSite({
      ...data,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.sites.findSiteByIdOrFail(site.id)
  }

  async updateSite(id: string, data: UpdateSiteInput, actorId: string) {
    const site = await this.sites.findSiteSummaryOrFail(id)
    await this.sites.updateSite(site, { ...data, updatedBy: actorId })
    return this.sites.findSiteByIdOrFail(id)
  }

  async deleteSite(id: string, actorId: string) {
    const site = await this.sites.findSiteSummaryOrFail(id)
    const deviceCount = await this.sites.countActiveDevicesOnSite(id)
    if (deviceCount > 0) {
      throw new Exception(
        `No se puede eliminar el sitio: hay ${deviceCount} dispositivo(s) activo(s)`,
        { status: 409 }
      )
    }
    const areaCount = await this.sites.countActiveAreasOnSite(id)
    if (areaCount > 0) {
      throw new Exception(
        `No se puede eliminar el sitio: hay ${areaCount} área(s) activa(s). Elimínalas primero.`,
        { status: 409 }
      )
    }
    await this.sites.softDeleteSite(site, actorId)
  }

  async listAreas(siteId: string) {
    await this.sites.findSiteSummaryOrFail(siteId)
    return this.sites.listAreasBySite(siteId)
  }

  async getAreaById(id: string) {
    return this.sites.findAreaByIdOrFail(id)
  }

  async getAreaSummary(id: string) {
    return this.sites.findAreaSummaryOrFail(id)
  }

  async createArea(data: CreateAreaInput, actorId: string) {
    await this.sites.findSiteSummaryOrFail(data.siteId)
    const area = await this.sites.createArea({
      ...data,
      createdBy: actorId,
      updatedBy: actorId,
    })
    return this.sites.findAreaByIdOrFail(area.id)
  }

  async updateArea(id: string, data: UpdateAreaInput, actorId: string) {
    const area = await this.sites.findAreaSummaryOrFail(id)
    if (data.siteId && data.siteId !== area.siteId) {
      await this.sites.findSiteSummaryOrFail(data.siteId)
    }
    await this.sites.updateArea(area, { ...data, updatedBy: actorId })
    return this.sites.findAreaByIdOrFail(id)
  }

  async deleteArea(id: string, actorId: string) {
    const area = await this.sites.findAreaSummaryOrFail(id)
    const deviceCount = await this.sites.countActiveDevicesOnArea(id)
    if (deviceCount > 0) {
      throw new Exception(
        `No se puede eliminar el área: hay ${deviceCount} dispositivo(s) activo(s)`,
        { status: 409 }
      )
    }
    await this.sites.softDeleteArea(area, actorId)
  }

  /** Validate site/area belong to project and to each other. Returns normalized ids. */
  async resolvePlacement(params: {
    projectId: string
    siteId?: string | null
    areaId?: string | null
  }): Promise<{ siteId: string | null; areaId: string | null }> {
    const siteId = params.siteId ?? null
    const areaId = params.areaId ?? null

    if (!siteId && !areaId) {
      return { siteId: null, areaId: null }
    }

    if (areaId && !siteId) {
      throw new Exception('Debes indicar el sitio cuando asignas un área', { status: 422 })
    }

    if (siteId) {
      const site = await this.sites.findActiveSiteInProject(siteId, params.projectId)
      if (!site) {
        throw new Exception('El sitio no pertenece al proyecto o no existe', { status: 422 })
      }
    }

    if (areaId && siteId) {
      const area = await this.sites.findActiveAreaInSite(areaId, siteId)
      if (!area) {
        throw new Exception('El área no pertenece al sitio indicado', { status: 422 })
      }
    }

    return { siteId, areaId }
  }
}
