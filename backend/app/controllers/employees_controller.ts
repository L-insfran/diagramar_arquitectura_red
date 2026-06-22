import type { HttpContext } from '@adonisjs/core/http'
import Employee from '#models/employee'
import SystemUser from '#models/system_user'
import { canAccessCompany, canMutate, isViewer, findLinkedEmployee } from '#services/authorization_service'
import { createEmployeeValidator, updateEmployeeValidator } from '#validators/employee_validator'

export default class EmployeesController {
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const companyId = (request.input('company_id') as string | undefined) ?? user.companyId
    if (!companyId) {
      return response.badRequest({ success: false, message: 'company_id query parameter is required' })
    }
    if (!canAccessCompany(user, companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }

    if (isViewer(user)) {
      const linked = await findLinkedEmployee(user)
      if (!linked) {
        return response.ok({ success: true, data: [] })
      }
      await linked.load('department')
      return response.ok({ success: true, data: [linked] })
    }

    const employees = await Employee.query()
      .where('company_id', companyId)
      .preload('department')
      .orderBy('last_name', 'asc')
    return response.ok({ success: true, data: employees })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(createEmployeeValidator)
    if (!canAccessCompany(user, data.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const employee = await Employee.create(data)
    await employee.load('department')
    return response.created({ success: true, data: employee })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const employee = await Employee.query()
      .where('id', params.id)
      .preload('devices')
      .preload('department')
      .firstOrFail()
    if (!canAccessCompany(user, employee.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    if (isViewer(user)) {
      const linked = await findLinkedEmployee(user)
      if (!linked || linked.id !== employee.id) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }
    return response.ok({ success: true, data: employee })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const employee = await Employee.findOrFail(params.id)
    if (!canAccessCompany(user, employee.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateEmployeeValidator)
    if (data.companyId && !canAccessCompany(user, data.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    employee.merge(data)
    await employee.save()
    await employee.load('devices')
    await employee.load('department')
    return response.ok({ success: true, data: employee })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (!canMutate(user)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const employee = await Employee.findOrFail(params.id)
    if (!canAccessCompany(user, employee.companyId)) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await employee.delete()
    return response.ok({ success: true, message: 'Employee deleted', data: null })
  }
}
