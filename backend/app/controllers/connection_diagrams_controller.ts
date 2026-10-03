import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import ConnectionDiagramService from '#services/connection_diagram_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireMutateProjectContext,
  requireProjectContext,
} from '#services/project_context_service'
import {
  createConnectionDiagramValidator,
  updateConnectionDiagramValidator,
} from '#validators/connection_diagram_validator'

export default class ConnectionDiagramsController {
  private diagrams = new ConnectionDiagramService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return
    const data = await this.diagrams.getAllByProject(context.projectId)
    return ctx.response.ok({ success: true, data })
  }

  async store(ctx: HttpContext) {
    const context = await requireMutateProjectContext(ctx)
    if (!context) return
    const user = ctx.auth.getUserOrFail() as SystemUser
    const data = await ctx.request.validateUsing(createConnectionDiagramValidator)
    if (!(await canAccessProject(user, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (data.projectId !== context.projectId) {
      return ctx.response.forbidden({
        success: false,
        message: 'El diagrama debe pertenecer al proyecto activo',
      })
    }
    try {
      const diagram = await this.diagrams.create(data, user.id)
      return ctx.response.created({ success: true, data: diagram })
    } catch (error: any) {
      if (error?.status === 409 || error?.status === 422) {
        return ctx.response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const diagram = await this.diagrams.getById(params.id)
    if (!(await canAccessProject(user, diagram.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: diagram })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const existing = await this.diagrams.getById(params.id)
    if (!(await canMutateInProject(user, existing.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateConnectionDiagramValidator)
    try {
      const updated = await this.diagrams.update(params.id, data, user.id)
      return response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error?.status === 409 || error?.status === 422) {
        return response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const diagram = await this.diagrams.getById(params.id)
    if (!(await canMutateInProject(user, diagram.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.diagrams.delete(params.id, user.id)
    return response.ok({ success: true, message: 'Diagram deleted', data: null })
  }

  async duplicate({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const diagram = await this.diagrams.getById(params.id)
    if (!(await canMutateInProject(user, diagram.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      const copy = await this.diagrams.duplicate(params.id, user.id)
      return response.created({ success: true, data: copy })
    } catch (error: any) {
      if (error?.status === 409) {
        return response.conflict({ success: false, message: error.message })
      }
      throw error
    }
  }

  async graph({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const diagram = await this.diagrams.getById(params.id)
    if (!(await canAccessProject(user, diagram.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await this.diagrams.getGraph(params.id)
    return response.ok({ success: true, data })
  }
}
