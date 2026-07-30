import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import SiteService from '#services/site_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import {
  createAreaValidator,
  createSiteValidator,
  updateAreaValidator,
  updateSiteValidator,
} from '#validators/site_validator'

export default class SitesController {
  private siteService = new SiteService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const search = ctx.request.input('search') as string | undefined
    const sites = await this.siteService.getAllByProject(context.projectId, { search })
    return ctx.response.ok({ success: true, data: sites })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createSiteValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El sitio debe pertenecer al proyecto activo',
      })
    }

    const site = await this.siteService.createSite(data, user.id)
    return ctx.response.created({ success: true, data: site })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const site = await this.siteService.getSiteById(params.id)
    if (!(await canAccessProject(user, site.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: site })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.siteService.getSiteSummary(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateSiteValidator)
    const updated = await this.siteService.updateSite(params.id, data, user.id)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const site = await this.siteService.getSiteSummary(params.id)
    if (!(await canMutateInProject(user, site.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.siteService.deleteSite(params.id, user.id)
      return response.ok({ success: true, message: 'Site deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }

  async areasIndex({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const site = await this.siteService.getSiteSummary(params.id)
    if (!(await canAccessProject(user, site.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const areas = await this.siteService.listAreas(params.id)
    return response.ok({ success: true, data: areas })
  }

  async areasStore(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const site = await this.siteService.getSiteSummary(ctx.params.id)
    if (!(await canMutateInProject(user, site.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await ctx.request.validateUsing(createAreaValidator)
    const area = await this.siteService.createArea(
      { siteId: ctx.params.id, ...data },
      user.id
    )
    return ctx.response.created({ success: true, data: area })
  }

  async areasUpdate(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const area = await this.siteService.getAreaSummary(ctx.params.areaId)
    const site = await this.siteService.getSiteSummary(area.siteId)
    if (!(await canMutateInProject(user, site.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await ctx.request.validateUsing(updateAreaValidator)
    const updated = await this.siteService.updateArea(ctx.params.areaId, data, user.id)
    return ctx.response.ok({ success: true, data: updated })
  }

  async areasDestroy(ctx: HttpContext) {
    const user = ctx.auth.getUserOrFail() as SystemUser
    const area = await this.siteService.getAreaSummary(ctx.params.areaId)
    const site = await this.siteService.getSiteSummary(area.siteId)
    if (!(await canMutateInProject(user, site.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.siteService.deleteArea(ctx.params.areaId, user.id)
      return ctx.response.ok({ success: true, message: 'Area deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return ctx.response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }
}
