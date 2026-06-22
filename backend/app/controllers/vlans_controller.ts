import type { HttpContext } from '@adonisjs/core/http'
import Vlan from '#models/vlan'
import SystemUser from '#models/system_user'
import VlanService from '#services/vlan_service'
import { canAccessCompany, canMutate } from '#services/authorization_service'
import { createVlanValidator, updateVlanValidator } from '#validators/vlan_validator'

export default class VlansController {
  private vlanService = new VlanService()

  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const companyId = (request.input('company_id') as string | undefined) ?? user.companyId
    if (!companyId) {
      return response.badRequest({ success: false, message: 'company_id query parameter is required' })
    }
    if (!canAccessCompany(user, companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await this.vlanService.ensureNativeVlan(companyId)
    const vlans = await Vlan.query()
      .where('company_id', companyId)
      .preload('networks')
      .orderBy('vlan_id', 'asc')
    return response.ok({ success: true, data: vlans })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(createVlanValidator)
    if (!canAccessCompany(user, data.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const vlan = await Vlan.create(data)
    return response.created({ success: true, data: vlan })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const vlan = await Vlan.query()
      .where('id', params.id)
      .preload('networks')
      .preload('ports')
      .firstOrFail()
    if (!canAccessCompany(user, vlan.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: vlan })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const vlan = await Vlan.findOrFail(params.id)
    if (!canAccessCompany(user, vlan.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateVlanValidator)
    if (data.companyId && !canAccessCompany(user, data.companyId)) {
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
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const vlan = await Vlan.findOrFail(params.id)
    if (!canAccessCompany(user, vlan.companyId)) {
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
