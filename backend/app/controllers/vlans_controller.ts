import type { HttpContext } from '@adonisjs/core/http'
import Vlan from '#models/vlan'
import SystemUser from '#models/system_user'
import VlanService from '#services/vlan_service'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireProjectContext,
  requireMutateProjectContext,
} from '#services/project_context_service'
import { createVlanValidator, updateVlanValidator } from '#validators/vlan_validator'

export default class VlansController {
  private vlanService = new VlanService()

  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    await this.vlanService.ensureNativeVlan(context.projectId)
    const vlans = await Vlan.query()
      .where('project_id', context.projectId)
      .preload('networks')
      .orderBy('vlan_id', 'asc')
    return ctx.response.ok({ success: true, data: vlans })
  }

  async store(ctx: HttpContext) {
    if (!(await requireMutateProjectContext(ctx))) return

    const data = await ctx.request.validateUsing(createVlanValidator)
    if (!(await canAccessProject(ctx.auth.getUserOrFail() as SystemUser, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const vlan = await Vlan.create(data)
    return ctx.response.created({ success: true, data: vlan })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const vlan = await Vlan.query()
      .where('id', params.id)
      .preload('networks')
      .preload('ports')
      .firstOrFail()
    if (!(await canAccessProject(user, vlan.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: vlan })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const vlan = await Vlan.findOrFail(params.id)
    if (!(await canMutateInProject(user, vlan.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateVlanValidator)
    if (data.projectId && !(await canAccessProject(user, data.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    vlan.merge(data)
    await vlan.save()
    await vlan.load('networks')
    await vlan.load('ports')
    return response.ok({ success: true, data: vlan })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const vlan = await Vlan.findOrFail(params.id)
    if (!(await canMutateInProject(user, vlan.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (vlan.vlanId === 1) {
      return response.badRequest({
        success: false,
        message: 'The default system VLAN (802.1Q ID 1) cannot be deleted.',
      })
    }
    await vlan.delete()
    return response.ok({ success: true, message: 'VLAN deleted', data: null })
  }
}
