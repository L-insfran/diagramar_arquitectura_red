import type { HttpContext } from '@adonisjs/core/http'
import Employee from '#models/employee'
import SystemUser from '#models/system_user'
import {
  canAccessProject,
  canMutateInProject,
  findLinkedEmployee,
  resolveRoleForProject,
} from '#services/authorization_service'
import {
  requireProjectContext,
  requireMutateProjectContext,
} from '#services/project_context_service'
import { createEmployeeValidator, updateEmployeeValidator } from '#validators/employee_validator'

export default class EmployeesController {
  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const user = ctx.auth.getUserOrFail() as SystemUser
    if (context.role === 'viewer') {
      const linked = await findLinkedEmployee(user, context.projectId)
      if (!linked) {
        return ctx.response.ok({ success: true, data: [] })
      }
      await linked.load('department')
      return ctx.response.ok({ success: true, data: [linked] })
    }

    const employees = await Employee.query()
      .where('project_id', context.projectId)
      .preload('department')
      .orderBy('last_name', 'asc')
    return ctx.response.ok({ success: true, data: employees })
  }

  async store(ctx: HttpContext) {
    if (!(await requireMutateProjectContext(ctx))) return

    const data = await ctx.request.validateUsing(createEmployeeValidator)
    if (!(await canAccessProject(ctx.auth.getUserOrFail() as SystemUser, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const employee = await Employee.create(data)
    await employee.load('department')
    return ctx.response.created({ success: true, data: employee })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const employee = await Employee.query()
      .where('id', params.id)
      .preload('devices')
      .preload('department')
      .firstOrFail()
    if (!(await canAccessProject(user, employee.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const role = await resolveRoleForProject(user, employee.projectId)
    if (role === 'viewer') {
      const linked = await findLinkedEmployee(user, employee.projectId)
      if (!linked || linked.id !== employee.id) {
        return response.forbidden({ success: false, message: 'Insufficient permissions' })
      }
    }
    return response.ok({ success: true, data: employee })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const employee = await Employee.findOrFail(params.id)
    if (!(await canMutateInProject(user, employee.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateEmployeeValidator)
    if (data.projectId && !(await canAccessProject(user, data.projectId))) {
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
    const employee = await Employee.findOrFail(params.id)
    if (!(await canMutateInProject(user, employee.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await employee.delete()
    return response.ok({ success: true, message: 'Employee deleted', data: null })
  }
}
