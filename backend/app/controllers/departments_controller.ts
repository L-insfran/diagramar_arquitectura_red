import type { HttpContext } from '@adonisjs/core/http'
import Department from '#models/department'
import SystemUser from '#models/system_user'
import { canAccessProject, canMutateInProject } from '#services/authorization_service'
import {
  requireProjectContext,
  requireMutateProjectContext,
} from '#services/project_context_service'
import { createDepartmentValidator, updateDepartmentValidator } from '#validators/department_validator'

export default class DepartmentsController {
  async index(ctx: HttpContext) {
    const context = await requireProjectContext(ctx)
    if (!context) return

    const departments = await Department.query()
      .where('project_id', context.projectId)
      .orderBy('name', 'asc')
    return ctx.response.ok({ success: true, data: departments })
  }

  async store(ctx: HttpContext) {
    if (!(await requireMutateProjectContext(ctx))) return

    const data = await ctx.request.validateUsing(createDepartmentValidator)
    if (!(await canAccessProject(ctx.auth.getUserOrFail() as SystemUser, data.projectId))) {
      return ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const department = await Department.create(data)
    return ctx.response.created({ success: true, data: department })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const department = await Department.query()
      .where('id', params.id)
      .withCount('employees')
      .firstOrFail()
    if (!(await canAccessProject(user, department.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: department })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const department = await Department.findOrFail(params.id)
    if (!(await canMutateInProject(user, department.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(updateDepartmentValidator)
    if (data.projectId && !(await canAccessProject(user, data.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    department.merge(data)
    await department.save()
    await department.loadCount('employees')
    return response.ok({ success: true, data: department })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const department = await Department.findOrFail(params.id)
    if (!(await canMutateInProject(user, department.projectId))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    await department.delete()
    return response.ok({ success: true, message: 'Department deleted', data: null })
  }
}
