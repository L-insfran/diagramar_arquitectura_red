import type { HttpContext } from '@adonisjs/core/http'
import Project from '#models/project'
import ProjectMembership from '#models/project_membership'
import SystemUser from '#models/system_user'
import VlanService from '#services/vlan_service'
import { canAccessProject, getAccessibleProjectIds } from '#services/authorization_service'
import { createProjectValidator, updateProjectValidator } from '#validators/project_validator'

export default class ProjectsController {
  private vlanService = new VlanService()

  async index({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role === 'admin') {
      const projects = await Project.query().orderBy('name', 'asc')
      return response.ok({ success: true, data: projects })
    }
    const ids = await getAccessibleProjectIds(user)
    if (!ids.length) {
      return response.ok({ success: true, data: [] })
    }
    const projects = await Project.query().whereIn('id', ids).orderBy('name', 'asc')
    return response.ok({ success: true, data: projects })
  }

  async store({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const data = await request.validateUsing(createProjectValidator)
    const project = await Project.create({ ...data, isActive: true })
    await this.vlanService.ensureNativeVlan(project.id)

    const anyMembership = await ProjectMembership.query().where('system_user_id', user.id).first()
    await ProjectMembership.create({
      systemUserId: user.id,
      projectId: project.id,
      role: 'admin',
      isDefault: !anyMembership,
    })

    return response.created({ success: true, data: project })
  }

  async show({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    const project = await Project.findOrFail(params.id)
    if (!(await canAccessProject(user, project.id))) {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    return response.ok({ success: true, data: project })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const project = await Project.findOrFail(params.id)
    const data = await request.validateUsing(updateProjectValidator)
    project.merge(data)
    await project.save()
    return response.ok({ success: true, data: project })
  }

  async destroy({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser
    if (user.role !== 'admin') {
      return response.forbidden({ success: false, message: 'Insufficient permissions' })
    }
    const project = await Project.findOrFail(params.id)
    await project.delete()
    return response.ok({ success: true, message: 'Project deleted', data: null })
  }
}
