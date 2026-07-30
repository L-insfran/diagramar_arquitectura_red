import type { HttpContext } from '@adonisjs/core/http'
import Project from '#models/project'
import ProjectMembership from '#models/project_membership'
import SystemUser from '#models/system_user'
import { isAdmin } from '#services/authorization_service'
import vine from '@vinejs/vine'

const updateMembershipsValidator = vine.compile(
  vine.object({
    memberships: vine.array(
      vine.object({
        projectId: vine.string().uuid(),
        role: vine.enum(['admin', 'operator', 'viewer'] as const),
        isDefault: vine.boolean().optional(),
      })
    ),
  })
)

function serializeMembership(m: ProjectMembership) {
  return {
    id: m.id,
    projectId: m.projectId,
    role: m.role,
    isDefault: m.isDefault,
    project: m.project
      ? {
          id: m.project.id,
          name: m.project.name,
          domain: m.project.domain,
          isActive: m.project.isActive,
        }
      : null,
  }
}

export default class UserMembershipsController {
  async index({ auth, params, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({
        success: false,
        message: 'Only administrators can manage memberships',
      })
    }
    const user = await SystemUser.findOrFail(params.id)
    const memberships = await ProjectMembership.query()
      .where('system_user_id', user.id)
      .preload('project')
      .orderBy('created_at', 'asc')

    return response.ok({
      success: true,
      data: memberships.map(serializeMembership),
    })
  }

  async update({ auth, params, request, response }: HttpContext) {
    const currentUser = auth.getUserOrFail() as SystemUser
    if (!isAdmin(currentUser)) {
      return response.forbidden({
        success: false,
        message: 'Only administrators can manage memberships',
      })
    }
    const user = await SystemUser.findOrFail(params.id)
    const data = await request.validateUsing(updateMembershipsValidator)

    if (!data.memberships.length) {
      return response.badRequest({
        success: false,
        message: 'El usuario debe pertenecer al menos a un proyecto',
      })
    }

    const projectIds = data.memberships.map((m) => m.projectId)
    const projects = await Project.query().whereIn('id', projectIds)
    if (projects.length !== projectIds.length) {
      return response.badRequest({ success: false, message: 'Uno o más proyectos no existen' })
    }

    const firstDefaultIdx = data.memberships.findIndex((m) => m.isDefault === true)
    const withSingleDefault = data.memberships.map((m, i) => ({
      ...m,
      isDefault: i === (firstDefaultIdx >= 0 ? firstDefaultIdx : 0),
    }))

    await ProjectMembership.query().where('system_user_id', user.id).delete()
    for (const m of withSingleDefault) {
      await ProjectMembership.create({
        systemUserId: user.id,
        projectId: m.projectId,
        role: m.role,
        isDefault: m.isDefault,
      })
    }

    const defaultMembership = withSingleDefault.find((m) => m.isDefault) ?? withSingleDefault[0]
    if (defaultMembership) {
      user.projectId = defaultMembership.projectId
      user.role = defaultMembership.role
      await user.save()
    }

    const memberships = await ProjectMembership.query()
      .where('system_user_id', user.id)
      .preload('project')

    return response.ok({
      success: true,
      data: memberships.map(serializeMembership),
    })
  }
}
