import type { HttpContext } from '@adonisjs/core/http'
import Department from '#models/department'
import SystemUser from '#models/system_user'
import { createDepartmentValidator, updateDepartmentValidator } from '#validators/department_validator'

function canAccessCompany(user: SystemUser, companyId: string) {
  return user.role === 'admin' || user.companyId === companyId
}

export default class DepartmentsController {
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const companyId = (request.input('company_id') as string | undefined) ?? user.companyId
    if (!companyId) {
      return response.badRequest({ success: false, message: 'company_id query parameter is required'})
    }
    if (!canAccessCompany(user, companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const departments = await Department.query().where('company_id', companyId).orderBy('name', 'asc')
    return response.ok({ success: true, data: departments})
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const data = await request.validateUsing(createDepartmentValidator)
    if (!canAccessCompany(user, data.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const department = await Department.create(data)
    return response.created({ success: true, data: department})
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const department = await Department.query()
      .where('id', params.id)
      .withCount('employees')
      .firstOrFail()
    if (!canAccessCompany(user, department.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    return response.ok({ success: true, data: department})
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const department = await Department.findOrFail(params.id)
    if (!canAccessCompany(user, department.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    const data = await request.validateUsing(updateDepartmentValidator)
    if (data.companyId && !canAccessCompany(user, data.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    department.merge(data)
    await department.save()
    await department.loadCount('employees')
    return response.ok({ success: true, data: department})
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const department = await Department.findOrFail(params.id)
    if (!canAccessCompany(user, department.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions'})
    }
    await department.delete()
    return response.ok({ success: true, message: 'Department deleted', data: null})
  }
}

