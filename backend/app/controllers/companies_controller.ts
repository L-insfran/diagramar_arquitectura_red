import type { HttpContext } from '@adonisjs/core/http'
import Company from '#models/company'
import SystemUser from '#models/system_user'
import VlanService from '#services/vlan_service'
import { createCompanyValidator, updateCompanyValidator } from '#validators/company_validator'

function canAccessCompany(user: SystemUser, companyId: string) {
  return user.role === 'admin' || user.companyId === companyId
}

export default class CompaniesController {
  private vlanService = new VlanService()

  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const query =
      user.role === 'admin'
        ? Company.query().orderBy('name', 'asc')
        : Company.query().where('id', user.companyId).orderBy('name', 'asc')
    const companies = await query
    return response.ok({ success: true, data: companies})
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const data = await request.validateUsing(createCompanyValidator)
    const company = await Company.create({ ...data, isActive: true })
    await this.vlanService.ensureNativeVlan(company.id)
    return response.created({ success: true, data: company})
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const company = await Company.findOrFail(params.id)
    if (!canAccessCompany(user, company.id)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    return response.ok({ success: true, data: company})
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const company = await Company.findOrFail(params.id)
    const data = await request.validateUsing(updateCompanyValidator)
    company.merge(data)
    await company.save()
    return response.ok({ success: true, data: company})
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const company = await Company.findOrFail(params.id)
    await company.delete()
    return response.ok({ success: true, message: 'Company deleted', data: null})
  }
}

