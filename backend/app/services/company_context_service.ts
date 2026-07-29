import type { HttpContext } from '@adonisjs/core/http'
import SystemUser from '#models/system_user'
import CompanyMembership from '#models/company_membership'
import {
  canAccessCompany,
  canMutateInCompany,
  resolveRoleForCompany,
  type MembershipRole,
} from '#services/authorization_service'

export type CompanyContext = {
  companyId: string
  role: MembershipRole
  canMutate: boolean
}

function pickCompanyIdFromRequest(ctx: HttpContext): string | undefined {
  const header = ctx.request.header('x-company-id')?.trim()
  const fromQuery =
    (ctx.request.input('company_id') as string | undefined) ??
    (ctx.request.input('companyId') as string | undefined)
  const body = ctx.request.body() as Record<string, unknown> | undefined
  const fromBody =
    (typeof body?.companyId === 'string' ? body.companyId : undefined) ??
    (typeof body?.company_id === 'string' ? body.company_id : undefined)

  return header || fromQuery || fromBody || undefined
}

async function resolveDefaultCompanyId(user: SystemUser): Promise<string | undefined> {
  const defaultMembership = await CompanyMembership.query()
    .where('system_user_id', user.id)
    .where('is_default', true)
    .first()
  if (defaultMembership) return defaultMembership.companyId

  const anyMembership = await CompanyMembership.query().where('system_user_id', user.id).first()
  if (anyMembership) return anyMembership.companyId

  return user.companyId || undefined
}

/**
 * Resolves the active company for the request.
 * Order: X-Company-Id header → company_id / companyId query/body → default membership → user.companyId
 */
export async function resolveCompanyContext(ctx: HttpContext): Promise<CompanyContext | null> {
  const user = ctx.auth.getUserOrFail() as SystemUser
  const requested = pickCompanyIdFromRequest(ctx)
  const companyId = requested || (await resolveDefaultCompanyId(user))
  if (!companyId) return null

  const allowed = await canAccessCompany(user, companyId)
  if (!allowed) return null

  const role = (await resolveRoleForCompany(user, companyId)) ?? 'viewer'
  const canMutate = await canMutateInCompany(user, companyId)
  return { companyId, role, canMutate }
}

export async function requireCompanyContext(ctx: HttpContext): Promise<CompanyContext | null> {
  const context = await resolveCompanyContext(ctx)
  if (!context) {
    ctx.response.forbidden({ success: false, message: 'Insufficient permissions for company context' })
    return null
  }
  return context
}

export async function requireMutateCompanyContext(ctx: HttpContext): Promise<CompanyContext | null> {
  const context = await requireCompanyContext(ctx)
  if (!context) return null
  if (!context.canMutate) {
    ctx.response.forbidden({ success: false, message: 'Insufficient permissions' })
    return null
  }
  return context
}
