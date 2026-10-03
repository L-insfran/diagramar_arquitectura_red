import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import ProjectMembership from '#models/project_membership'
import type { MembershipRole } from '#services/authorization_service'

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

function roleCanMutate(role: MembershipRole): boolean {
  return role === 'admin' || role === 'operator'
}

async function findMembership(userId: string, projectId: string) {
  return ProjectMembership.query()
    .where('system_user_id', userId)
    .where('project_id', projectId)
    .first()
}

async function resolveDefaultMembership(user: SystemUser) {
  const defaultMembership = await ProjectMembership.query()
    .where('system_user_id', user.id)
    .where('is_default', true)
    .first()
  if (defaultMembership) return defaultMembership
  return ProjectMembership.query().where('system_user_id', user.id).first()
}

/**
 * Resolves the active project for the request.
 * Order: X-Project-Id header → project_id / projectId query/body → default membership → user.projectId.
 * Membership is read once and reused for role and mutate permission.
 */
export async function resolveProjectContext(ctx: HttpContext): Promise<ProjectContext | null> {
  const user = ctx.auth.getUserOrFail() as SystemUser
  const requested = pickProjectIdFromRequest(ctx)

  let membership: ProjectMembership | null = null
  let projectId = requested

  if (!projectId) {
    membership = await resolveDefaultMembership(user)
    projectId = membership?.projectId || user.projectId || undefined
  }
  if (!projectId) return null

  if (user.role === 'admin') {
    return { projectId, role: 'admin', canMutate: true }
  }

  if (!membership || membership.projectId !== projectId) {
    membership = await findMembership(user.id, projectId)
  }

  const role: MembershipRole | null =
    membership?.role ?? (user.projectId === projectId ? user.role : null)
  if (!role) return null

  return { projectId, role, canMutate: roleCanMutate(role) }
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
