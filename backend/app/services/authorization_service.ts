import SystemUser from '#models/system_user'
import ProjectMembership from '#models/project_membership'
import Employee from '#models/employee'
import DeviceType from '#models/device_type'

export type MembershipRole = 'admin' | 'operator' | 'viewer'

export function isAdmin(user: SystemUser): boolean {
  return user.role === 'admin'
}

export function isViewer(user: SystemUser): boolean {
  return user.role === 'viewer'
}

/** Global mutate check (legacy). Prefer canMutateInProject when project context is known. */
export function canMutate(user: SystemUser): boolean {
  return user.role === 'admin' || user.role === 'operator'
}

export async function getAccessibleProjectIds(user: SystemUser): Promise<string[]> {
  if (user.role === 'admin') {
    const memberships = await ProjectMembership.query().where('system_user_id', user.id)
    const ids = new Set(memberships.map((m) => m.projectId))
    if (user.projectId) ids.add(user.projectId)
    return Array.from(ids)
  }
  const memberships = await ProjectMembership.query().where('system_user_id', user.id)
  const ids = memberships.map((m) => m.projectId)
  if (!ids.length && user.projectId) return [user.projectId]
  return ids
}

export async function resolveRoleForProject(
  user: SystemUser,
  projectId: string
): Promise<MembershipRole | null> {
  if (user.role === 'admin') return 'admin'
  const membership = await ProjectMembership.query()
    .where('system_user_id', user.id)
    .where('project_id', projectId)
    .first()
  if (membership) return membership.role
  if (user.projectId === projectId) return user.role
  return null
}

export async function canAccessProject(user: SystemUser, projectId: string): Promise<boolean> {
  if (user.role === 'admin') return true
  const role = await resolveRoleForProject(user, projectId)
  return role !== null
}

export async function canMutateInProject(user: SystemUser, projectId: string): Promise<boolean> {
  const role = await resolveRoleForProject(user, projectId)
  return role === 'admin' || role === 'operator'
}

/** Find the Employee linked to this SystemUser by matching email + project. */
export async function findLinkedEmployee(
  user: SystemUser,
  projectId?: string
): Promise<Employee | null> {
  const pid = projectId ?? user.projectId
  if (!user.email || !pid) return null
  return Employee.query().where('project_id', pid).whereILike('email', user.email).first()
}

const NOTEBOOK_NAMES = ['notebook', 'notebock']

/** Check whether a given device type id maps to a Notebook-like type. */
export async function isNotebookType(deviceTypeId: string): Promise<boolean> {
  const dt = await DeviceType.find(deviceTypeId)
  if (!dt) return false
  return NOTEBOOK_NAMES.includes(dt.name.toLowerCase())
}
