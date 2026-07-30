import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import TopologyService from '#services/topology_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireProjectContext,
  requireMutateProjectContext,
  type ProjectContext,
} from '#services/project_context_service'
import {
  createConnectionValidator,
  updateConnectionValidator,
} from '#validators/connection_validator'
import { updateTopologyCanvasLayoutValidator } from '#validators/topology_canvas_layout_validator'

export default class TopologyController {
  private topologyService = new TopologyService()

  private canvasLayoutScope(user: SystemUser, context: ProjectContext) {
    return context.role === 'viewer' ? user.id : 'shared'
  }

  async canvasLayoutShow(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const scope = this.canvasLayoutScope(user, context)
    const data = await this.topologyService.getCanvasLayout(context.projectId, scope)
    return ctx.response.ok({ success: true, data })
  }

  async canvasLayoutUpdate(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const payload = await ctx.request.validateUsing(updateTopologyCanvasLayoutValidator)
    if (!(await canAccessProject(user, payload.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const scope = this.canvasLayoutScope(user, context)
    const data = await this.topologyService.upsertCanvasLayout(scope, payload)
    return ctx.response.ok({ success: true, data })
  }

  async canvasLayoutDestroy(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const scope = this.canvasLayoutScope(user, context)
    await this.topologyService.deleteCanvasLayout(context.projectId, scope)
    return ctx.response.ok({ success: true, message: 'Layout eliminado', data: null })
  }

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const data = await this.topologyService.getTopology(context.projectId)
    return ctx.response.ok({ success: true, data })
  }

  async store(ctx: HttpContext) {
    if (!(await requireMutateProjectContext(ctx))) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const payload = await ctx.request.validateUsing(createConnectionValidator)
    if (!(await canAccessProject(user, payload.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    try {
      const connection = await this.topologyService.createConnection(payload, user.id)
      return ctx.response.created({ success: true, data: connection })
    } catch (error: any) {
      if (error?.status === 409 || error?.status === 422 || error?.status === 400) {
        return ctx.response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const connection = await this.topologyService.getActiveConnectionSummary(params.id)
    if (!(await canMutateInProject(user, connection.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const payload = await request.validateUsing(updateConnectionValidator)
    try {
      const updated = await this.topologyService.updateConnection(params.id, payload, user.id)
      return response.ok({ success: true, data: updated })
    } catch (error: any) {
      if (error?.status === 409 || error?.status === 422 || error?.status === 400) {
        return response.status(error.status).send({ success: false, message: error.message })
      }
      throw error
    }
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const connection = await this.topologyService.getActiveConnectionSummary(params.id)
    if (!(await canMutateInProject(user, connection.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.topologyService.deleteConnection(params.id, user.id)
    return response.ok({ success: true, message: 'Connection deleted', data: null })
  }
}
