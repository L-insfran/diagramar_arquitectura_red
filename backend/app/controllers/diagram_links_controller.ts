import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import DiagramLinkService from '#services/diagram_link_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import {
  createDiagramLinkValidator,
  updateDiagramLinkValidator,
} from '#validators/diagram_link_validator'

export default class DiagramLinksController {
  private diagramLinks = new DiagramLinkService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    await this.diagramLinks.softDeleteOrphansWithDeletedDevices(user.id)
    const links = await this.diagramLinks.getAllByProject(context.projectId)
    return ctx.response.ok({
      success: true,
      data: links.map((link) => this.diagramLinks.toApi(link)),
    })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createDiagramLinkValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El enlace debe pertenecer al proyecto activo',
      })
    }

    try {
      const link = await this.diagramLinks.create(data, user.id)
      return ctx.response.created({ success: true, data: this.diagramLinks.toApi(link) })
    } catch (error: any) {
      if (error?.status === 422 || error?.status === 409) {
        return ctx.response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const link = await this.diagramLinks.getById(params.id)
    if (!(await canAccessProject(user, link.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: this.diagramLinks.toApi(link) })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.diagramLinks.getSummary(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateDiagramLinkValidator)
    try {
      const updated = await this.diagramLinks.update(params.id, data, user.id)
      return response.ok({ success: true, data: this.diagramLinks.toApi(updated) })
    } catch (error: any) {
      if (error?.status === 422 || error?.status === 409) {
        return response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const link = await this.diagramLinks.getSummary(params.id)
    if (!(await canMutateInProject(user, link.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.diagramLinks.delete(params.id, user.id)
    return response.ok({ success: true, message: 'Diagram link deleted', data: null })
  }
}
