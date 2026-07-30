import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import RackService from '#services/rack_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import { createRackValidator, updateRackValidator } from '#validators/rack_validator'

export default class RacksController {
  private rackService = new RackService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const areaId = ctx.request.input('areaId') as string | undefined
    const siteId = ctx.request.input('siteId') as string | undefined
    const search = ctx.request.input('search') as string | undefined
    const racks = await this.rackService.getAllByProject(context.projectId, {
      areaId,
      siteId,
      search,
    })
    return ctx.response.ok({ success: true, data: racks })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createRackValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El rack debe pertenecer al proyecto activo',
      })
    }

    try {
      const rack = await this.rackService.create(data, user.id)
      return ctx.response.created({ success: true, data: rack })
    } catch (error: any) {
      if (error?.status === 422) {
        return ctx.response.unprocessableEntity({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const rack = await this.rackService.getById(params.id)
    if (!(await canAccessProject(user, rack.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: rack })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.rackService.getSummary(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateRackValidator)
    try {
      const updated = await this.rackService.update(params.id, data, user.id)
      return response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error?.status === 422 || error?.status === 409) {
        return response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const rack = await this.rackService.getSummary(params.id)
    if (!(await canMutateInProject(user, rack.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      await this.rackService.delete(params.id, user.id)
      return response.ok({ success: true, message: 'Rack deleted', data: null })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }

  async occupancy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const rack = await this.rackService.getSummary(params.id)
    if (!(await canAccessProject(user, rack.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const occupancy = await this.rackService.getOccupancy(params.id)
    return response.ok({ success: true, data: occupancy })
  }
}
