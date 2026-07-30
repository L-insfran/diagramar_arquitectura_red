import type { HttpContext } from '@adonisjs/core/http'
import Project from '#models/project'
import ProjectMembership from '#models/project_membership'
import Device from '#models/device'
import Connection from '#models/connection'
import SystemUser from '#models/system_user'

export default class MeController {
  /** Projects accessible by the current user, with role and inventory counts. */
  async projects({ auth, response }: HttpContext) {
    const user = auth.getUserOrFail() as SystemUser

    if (user.role === 'admin') {
      const projects = await Project.query().orderBy('name', 'asc')
      const existing = await ProjectMembership.query().where('system_user_id', user.id)
      const byProject = new Map(existing.map((m) => [m.projectId, m]))

      const payload = await Promise.all(
        projects.map(async (project) => {
          const membership = byProject.get(project.id)
          const deviceCount = await Device.query()
            .where('project_id', project.id)
            .whereNull('deleted_at')
            .count('* as total')
          const connectionCount = await Connection.query()
            .where('project_id', project.id)
            .whereNull('deleted_at')
            .count('* as total')
          return {
            id: project.id,
            name: project.name,
            domain: project.domain,
            address: project.address,
            phone: project.phone,
            isActive: project.isActive,
            role: (membership?.role ?? 'admin') as 'admin' | 'operator' | 'viewer',
            isDefault: membership?.isDefault ?? project.id === user.projectId,
            deviceCount: Number(deviceCount[0].$extras.total ?? 0),
            connectionCount: Number(connectionCount[0].$extras.total ?? 0),
          }
        })
      )
      return response.ok({ success: true, data: payload })
    }

    const memberships = await ProjectMembership.query()
      .where('system_user_id', user.id)
      .preload('project')
      .orderBy('created_at', 'asc')

    if (!memberships.length && user.projectId) {
      const project = await Project.find(user.projectId)
      if (project) {
        const deviceCount = await Device.query()
            .where('project_id', project.id)
            .whereNull('deleted_at')
            .count('* as total')
        const connectionCount = await Connection.query()
          .where('project_id', project.id)
          .whereNull('deleted_at')
          .count('* as total')
        return response.ok({
          success: true,
          data: [
            {
              id: project.id,
              name: project.name,
              domain: project.domain,
              address: project.address,
              phone: project.phone,
              isActive: project.isActive,
              role: user.role,
              isDefault: true,
              deviceCount: Number(deviceCount[0].$extras.total ?? 0),
              connectionCount: Number(connectionCount[0].$extras.total ?? 0),
            },
          ],
        })
      }
    }

    const payload = await Promise.all(
      memberships.map(async (m) => {
        const project = m.project
        const deviceCount = await Device.query()
            .where('project_id', project.id)
            .whereNull('deleted_at')
            .count('* as total')
        const connectionCount = await Connection.query()
          .where('project_id', project.id)
          .whereNull('deleted_at')
          .count('* as total')
        return {
          id: project.id,
          name: project.name,
          domain: project.domain,
          address: project.address,
          phone: project.phone,
          isActive: project.isActive,
          role: m.role,
          isDefault: m.isDefault,
          deviceCount: Number(deviceCount[0].$extras.total ?? 0),
          connectionCount: Number(connectionCount[0].$extras.total ?? 0),
        }
      })
    )

    return response.ok({ success: true, data: payload })
  }
}
