import type { HttpContext } from '@adonisjs/core/http'
import Company from '#models/company'
import CompanyMembership from '#models/company_membership'
import SystemUser from '#models/system_user'
import VlanService from '#services/vlan_service'
import { canAccessCompany, getAccessibleCompanyIds } from '#services/authorization_service'
import { createCompanyValidator, updateCompanyValidator } from '#validators/company_validator'

export default class CompaniesController {
  private vlanService = new VlanService()

  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role === 'admin') {
      const companies = await Company.query().orderBy('name', 'asc')
      return response.ok({ success: true, data: companies })
    }
    const ids = await getAccessibleCompanyIds(user)
    if (!ids.length) {
      return response.ok({ success: true, data: [] })
    }
    const companies = await Company.query().whereIn('id', ids).orderBy('name', 'asc')
    return response.ok({ success: true, data: companies })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(createCompanyValidator)
    const company = await Company.create({ ...data, isActive: true })
    await this.vlanService.ensureNativeVlan(company.id)

    const anyMembership = await CompanyMembership.query().where('system_user_id', user.id).first()
    await CompanyMembership.create({
      systemUserId: user.id,
      companyId: company.id,
      role: 'admin',
      isDefault: !anyMembership,
    })

    return response.created({ success: true, data: company })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const company = await Company.findOrFail(params.id)
    if (!(await canAccessCompany(user, company.id))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: company })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const company = await Company.findOrFail(params.id)
    const data = await request.validateUsing(updateCompanyValidator)
    company.merge(data)
    await company.save()
    return response.ok({ success: true, data: company })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const company = await Company.findOrFail(params.id)
    await company.delete()
    return response.ok({ success: true, message: 'Company deleted', data: null })
  }
}
