import SystemUser from '#models/system_user'
import CompanyMembership from '#models/company_membership'
import Employee from '#models/employee'
import DeviceType from '#models/device_type'

export type MembershipRole = 'admin' | 'operator' | 'viewer'

export function isAdmin(user: SystemUser): boolean {
  return user.role === 'admin'
}

export function isViewer(user: SystemUser): boolean {
  return user.role === 'viewer'
}

/** Global mutate check (legacy). Prefer canMutateInCompany when company context is known. */
export function canMutate(user: SystemUser): boolean {
  return user.role === 'admin' || user.role === 'operator'
}

export async function getAccessibleCompanyIds(user: SystemUser): Promise<string[]> {
  if (user.role === 'admin') {
    // Super-admin can access all companies; callers that need the full list should query companies.
    const memberships = await CompanyMembership.query().where('system_user_id', user.id)
    const ids = new Set(memberships.map((m) => m.companyId))
    if (user.companyId) ids.add(user.companyId)
    return Array.from(ids)
  }
  const memberships = await CompanyMembership.query().where('system_user_id', user.id)
  const ids = memberships.map((m) => m.companyId)
  if (!ids.length && user.companyId) return [user.companyId]
  return ids
}

export async function resolveRoleForCompany(
  user: SystemUser,
  companyId: string
): Promise<MembershipRole | null> {
  if (user.role === 'admin') return 'admin'
  const membership = await CompanyMembership.query()
    .where('system_user_id', user.id)
    .where('company_id', companyId)
    .first()
  if (membership) return membership.role
  if (user.companyId === companyId) return user.role
  return null
}

export async function canAccessCompany(user: SystemUser, companyId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  const role = await resolveRoleForCompany(user, companyId)
  return role !== null
}

export async function canMutateInCompany(user: SystemUser, companyId: string): Promise<boolean> {
  const role = await resolveRoleForCompany(user, companyId)
  return role === 'admin' || role === 'operator'
}

/** Find the Employee linked to this SystemUser by matching email + company. */
export async function findLinkedEmployee(
  user: SystemUser,
  companyId?: string
): Promise<Employee | null> {
  const cid = companyId ?? user.companyId
  if (!user.email || !cid) return null
  return Employee.query().where('company_id', cid).whereILike('email', user.email).first()
}

const NOTEBOOK_NAMES = ['notebook', 'notebock']

/** Check whether a given device type id maps to a Notebook-like type. */
export async function isNotebookType(deviceTypeId: string): Promise<boolean> {
  const dt = await DeviceType.find(deviceTypeId)
  if (!dt) return false
  return NOTEBOOK_NAMES.includes(dt.name.toLowerCase())
}
