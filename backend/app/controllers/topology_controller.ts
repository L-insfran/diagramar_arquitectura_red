import type { HttpContext } from '@adonisjs/core/http'
import Connection from '#models/connection'
import SystemUser from '#models/system_user'
import TopologyCanvasLayout from '#models/topology_canvas_layout'
import TopologyService from '#services/topology_service'
import { canAccessCompany, canMutateInCompany } from '#services/authorization_service'
import {
  requireCompanyContext,
  requireMutateCompanyContext,
  type CompanyContext,
} from '#services/company_context_service'
import {
  createConnectionValidator,
  updateConnectionValidator,
} from '#validators/connection_validator'
import { updateTopologyCanvasLayoutValidator } from '#validators/topology_canvas_layout_validator'

const UNIFIED_LAYER = 'unified'

export default class TopologyController {
  private topologyService = new TopologyService()

  private canvasLayoutScope(user: SystemUser, context: CompanyContext) {
    return context.role === 'viewer' ? user.id : 'shared'
  }

  async canvasLayoutShow(ctx: HttpContext) {
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const scope = this.canvasLayoutScope(user, context)
    const row = await TopologyCanvasLayout.query()
      .where('companyId', context.companyId)
      .where('layer', UNIFIED_LAYER)
      .where('scope', scope)
      .first()
    return ctx.response.ok({
      success: true,
      data: {
        nodePositions: row?.nodePositions ?? {},
        labelOffsets: row?.labelOffsets ?? {},
        workAreas: row?.workAreas ?? [],
        nodeParents: row?.nodeParents ?? {},
      },
    })
  }

  async canvasLayoutUpdate(ctx: HttpContext) {
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const payload = await ctx.request.validateUsing(updateTopologyCanvasLayoutValidator)
    if (!(await canAccessCompany(user, payload.companyId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const scope = this.canvasLayoutScope(user, context)
    const workAreas = payload.workAreas ?? []
    const nodeParents = payload.nodeParents ?? {}
    let row = await TopologyCanvasLayout.query()
      .where('companyId', payload.companyId)
      .where('layer', UNIFIED_LAYER)
      .where('scope', scope)
      .first()
    if (!row) {
      row = await TopologyCanvasLayout.create({
        companyId: payload.companyId,
        layer: UNIFIED_LAYER,
        scope,
        nodePositions: payload.nodePositions,
        labelOffsets: payload.labelOffsets,
        workAreas,
        nodeParents,
      })
    } else {
      row.nodePositions = payload.nodePositions
      row.labelOffsets = payload.labelOffsets
      row.workAreas = workAreas
      row.nodeParents = nodeParents
      await row.save()
    }
    return ctx.response.ok({
      success: true,
      data: {
        nodePositions: row.nodePositions,
        labelOffsets: row.labelOffsets,
        workAreas: row.workAreas,
        nodeParents: row.nodeParents,
      },
    })
  }

  async canvasLayoutDestroy(ctx: HttpContext) {
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    const scope = this.canvasLayoutScope(user, context)
    const row = await TopologyCanvasLayout.query()
      .where('companyId', context.companyId)
      .where('layer', UNIFIED_LAYER)
      .where('scope', scope)
      .first()
    if (row) await row.delete()
    return ctx.response.ok({ success: true, message: 'Layout eliminado', data: null })
  }

  async index(ctx: HttpContext) {
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const data = await this.topologyService.getTopology(context.companyId)
    return ctx.response.ok({ success: true, data })
  }

  async store(ctx: HttpContext) {
    if (!(await requireMutateCompanyContext(ctx))) return

    const payload = await ctx.request.validateUsing(createConnectionValidator)
    if (!(await canAccessCompany(ctx.auth.getUserOrFail() as SystemUser, payload.companyId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const connection = await this.topologyService.createConnection(payload)
    return ctx.response.created({ success: true, data: connection })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const connection = await Connection.findOrFail(params.id)
    if (!(await canMutateInCompany(user, connection.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const payload = await request.validateUsing(updateConnectionValidator)
    const updated = await this.topologyService.updateConnection(params.id, payload)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const connection = await Connection.findOrFail(params.id)
    if (!(await canMutateInCompany(user, connection.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.topologyService.deleteConnection(params.id)
    return response.ok({ success: true, message: 'Connection deleted', data: null })
  }
}
