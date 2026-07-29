import type { HttpContext } from '@adonisjs/core/http'
import Network from '#models/network'
import SystemUser from '#models/system_user'
import NetworkService from '#services/network_service'
import { canAccessCompany, canMutateInCompany } from '#services/authorization_service'
import {
  requireCompanyContext,
  requireMutateCompanyContext,
} from '#services/company_context_service'
import { createNetworkValidator, updateNetworkValidator } from '#validators/network_validator'

function serializeNetworkWithUsage(
  network: Network,
  vlanIdsOnPorts: Set<string>
): Record<string, unknown> {
  const inUse = Boolean(network.vlanId && vlanIdsOnPorts.has(network.vlanId))
  return { ...network.serialize(), inUse }
}

export default class NetworksController {
  private networkService = new NetworkService()

  async index(ctx: HttpContext) {
    const context = await requireCompanyContext(ctx)
    if (!context) return

    const networks = await Network.query()
      .where('company_id', context.companyId)
      .preload('vlan')
      .orderBy('name', 'asc')
    const vlanIds = networks.map((n) => n.vlanId).filter((id): id is string => Boolean(id))
    const vlanIdsOnPorts = await this.networkService.getVlanIdsAssignedToPorts(vlanIds)
    const data = networks.map((n) => serializeNetworkWithUsage(n, vlanIdsOnPorts))
    return ctx.response.ok({ success: true, data })
  }

  async store(ctx: HttpContext) {
    if (!(await requireMutateCompanyContext(ctx))) return

    const data = await ctx.request.validateUsing(createNetworkValidator)
    if (!(await canAccessCompany(ctx.auth.getUserOrFail() as SystemUser, data.companyId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const network = await Network.create(data)
    await network.load('vlan')
    const vlanIdsOnPorts = await this.networkService.getVlanIdsAssignedToPorts(
      network.vlanId ? [network.vlanId] : []
    )
    return ctx.response.created({
      success: true,
      data: serializeNetworkWithUsage(network, vlanIdsOnPorts),
    })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const network = await Network.query().where('id', params.id).preload('vlan').firstOrFail()
    if (!(await canAccessCompany(user, network.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const vlanIdsOnPorts = await this.networkService.getVlanIdsAssignedToPorts(
      network.vlanId ? [network.vlanId] : []
    )
    return response.ok({
      success: true,
      data: serializeNetworkWithUsage(network, vlanIdsOnPorts),
    })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const network = await Network.findOrFail(params.id)
    if (!(await canMutateInCompany(user, network.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateNetworkValidator)
    if (data.companyId && !(await canAccessCompany(user, data.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    network.merge(data)
    await network.save()
    await network.load('vlan')
    const vlanIdsOnPorts = await this.networkService.getVlanIdsAssignedToPorts(
      network.vlanId ? [network.vlanId] : []
    )
    return response.ok({
      success: true,
      data: serializeNetworkWithUsage(network, vlanIdsOnPorts),
    })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const network = await Network.findOrFail(params.id)
    if (!(await canMutateInCompany(user, network.companyId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (network.vlanId) {
      const vlanIdsOnPorts = await this.networkService.getVlanIdsAssignedToPorts([network.vlanId])
      if (vlanIdsOnPorts.has(network.vlanId)) {
        return response.conflict({
          success: false,
          message:
            'Network is in use: its VLAN is assigned to one or more ports. Remove those assignments first.',
        })
      }
    }
    await network.delete()
    return response.ok({ success: true, message: 'Network deleted', data: null })
  }
}
