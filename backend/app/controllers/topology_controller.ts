import type { HttpContext } from '@adonisjs/core/http'
import Connection from '#models/connection'
import SystemUser from '#models/system_user'
import TopologyCanvasLayout from '#models/topology_canvas_layout'
import TopologyService from '#services/topology_service'
import { canAccessCompany, canMutate } from '#services/authorization_service'
import {
  createConnectionValidator,
  updateConnectionValidator,
} from '#validators/connection_validator'
import { updateTopologyCanvasLayoutValidator } from '#validators/topology_canvas_layout_validator'

export default class TopologyController {
  private topologyService = new TopologyService()

  private canvasLayoutScope(user: SystemUser) {
    return user.role === 'viewer' ? user.id : 'shared'
  }

  async canvasLayoutShow({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const companyId = (request.input('company_id') as string | undefined) ?? user.companyId
    const layer = request.input('layer') as string | undefined
    if (!companyId) {
      return response.badRequest({ success: false, message: 'company_id es obligatorio' })
    }
    if (layer !== 'physical' && layer !== 'logical') {
      return response.badRequest({ success: false, message: 'layer debe ser physical o logical' })
    }
    if (!canAccessCompany(user, companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const scope = this.canvasLayoutScope(user)
    const row = await TopologyCanvasLayout.query()
      .where('companyId', companyId)
      .where('layer', layer)
      .where('scope', scope)
      .first()
    return response.ok({
      success: true,
      data: {
        nodePositions: row?.nodePositions ?? {},
        labelOffsets: row?.labelOffsets ?? {},
      },
    })
  }

  async canvasLayoutUpdate({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const payload = await request.validateUsing(updateTopologyCanvasLayoutValidator)
    if (!canAccessCompany(user, payload.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const scope = this.canvasLayoutScope(user)
    let row = await TopologyCanvasLayout.query()
      .where('companyId', payload.companyId)
      .where('layer', payload.layer)
      .where('scope', scope)
      .first()
    if (!row) {
      row = await TopologyCanvasLayout.create({
        companyId: payload.companyId,
        layer: payload.layer,
        scope,
        nodePositions: payload.nodePositions,
        labelOffsets: payload.labelOffsets,
      })
    } else {
      row.nodePositions = payload.nodePositions
      row.labelOffsets = payload.labelOffsets
      await row.save()
    }
    return response.ok({
      success: true,
      data: {
        nodePositions: row.nodePositions,
        labelOffsets: row.labelOffsets,
      },
    })
  }

  async canvasLayoutDestroy({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const companyId = (request.input('company_id') as string | undefined) ?? user.companyId
    const layer = request.input('layer') as string | undefined
    if (!companyId) {
      return response.badRequest({ success: false, message: 'company_id es obligatorio' })
    }
    if (layer !== 'physical' && layer !== 'logical') {
      return response.badRequest({ success: false, message: 'layer debe ser physical o logical' })
    }
    if (!canAccessCompany(user, companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const scope = this.canvasLayoutScope(user)
    const row = await TopologyCanvasLayout.query()
      .where('companyId', companyId)
      .where('layer', layer)
      .where('scope', scope)
      .first()
    if (row) await row.delete()
    return response.ok({ success: true, message: 'Layout eliminado', data: null })
  }

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const companyId = (request.input('company_id') as string | undefined) ?? user.companyId
    if (!companyId) {
      return response.badRequest({ success: false, message: 'company_id query parameter is required' })
    }
    if (!canAccessCompany(user, companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await this.topologyService.getTopology(companyId)
    return response.ok({ success: true, data })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const payload = await request.validateUsing(createConnectionValidator)
    if (!canAccessCompany(user, payload.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const connection = await this.topologyService.createConnection(payload)
    return response.created({ success: true, data: connection })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const connection = await Connection.findOrFail(params.id)
    if (!canAccessCompany(user, connection.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const payload = await request.validateUsing(updateConnectionValidator)
    const updated = await this.topologyService.updateConnection(params.id, payload)
    return response.ok({ success: true, data: updated })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const connection = await Connection.findOrFail(params.id)
    if (!canAccessCompany(user, connection.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.topologyService.deleteConnection(params.id)
    return response.ok({ success: true, message: 'Connection deleted', data: null })
  }
}
