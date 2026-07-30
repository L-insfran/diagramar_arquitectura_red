import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import ProjectMembership from '#models/project_membership'
import {
  canAccessProject,
  canMutateInProject,
  resolveRoleForProject,
  type MembershipRole,
} from '#services/authorization_service'

export type ProjectContext = {
  projectId: string
  role: MembershipRole
  canMutate: boolean
}

function pickProjectIdFromRequest(ctx: HttpContext): string | undefined {
  const header = ctx.request.header('x-project-id')?.trim()
  const fromQuery =
    (ctx.request.input('project_id') as string | undefined) ??
    (ctx.request.input('projectId') as string | undefined)
  const body = ctx.request.body() as Record<string, unknown> | undefined
  const fromBody =
    (typeof body?.projectId === 'string' ? body.projectId : undefined) ??
    (typeof body?.project_id === 'string' ? body.project_id : undefined)

  return header || fromQuery || fromBody || undefined
}

async function resolveDefaultProjectId(user: SystemUser): Promise<string | undefined> {
  const defaultMembership = await ProjectMembership.query()
    .where('system_user_id', user.id)
    .where('is_default', true)
    .first()
  if (defaultMembership) return defaultMembership.projectId

  const anyMembership = await ProjectMembership.query().where('system_user_id', user.id).first()
  if (anyMembership) return anyMembership.projectId

  return user.projectId || undefined
}

/**
 * Resolves the active project for the request.
 * Order: X-Project-Id header → project_id / projectId query/body → default membership → user.projectId
 */
export async function resolveProjectContext(ctx: HttpContext): Promise<ProjectContext | null> {
  const user = ctx.auth.getUserOrFail() as SystemUser
  const requested = pickProjectIdFromRequest(ctx)
  const projectId = requested || (await resolveDefaultProjectId(user))
  if (!projectId) return null

  const allowed = await canAccessProject(user, projectId)
  if (!allowed) return null

  const role = (await resolveRoleForProject(user, projectId)) ?? 'viewer'
  const canMutate = await canMutateInProject(user, projectId)
  return { projectId, role, canMutate }
}

export async function requireProjectContext(ctx: HttpContext): Promise<ProjectContext | null> {
  const context = await resolveProjectContext(ctx)
  if (!context) {
    ctx.response.forbidden({
      success: false,
      message: 'Insufficient permissions for project context',
    })
    return null
  }
  return context
}

export async function requireMutateProjectContext(ctx: HttpContext): Promise<ProjectContext | null> {
  const context = await requireProjectContext(ctx)
  if (!context) return null
  if (!context.canMutate) {
    ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    return null
  }
  return context
}
