import SystemUser from '#models/system_user'
import Employee from '#models/employee'
import DeviceType from '#models/device_type'

export function isAdmin(user: SystemUser): boolean {
  return user.role === 'admin'
}

export function isViewer(user: SystemUser): boolean {
  return user.role === 'viewer'
}

/** Admin and operator can mutate most resources. Viewers cannot. */
export function canMutate(user: SystemUser): boolean {
  return user.role === 'admin' || user.role === 'operator'
}

export function canAccessCompany(user: SystemUser, companyId: string): boolean {
  return user.role === 'admin' || user.companyId === companyId
}

/** Find the Employee linked to this SystemUser by matching email + company. */
export async function findLinkedEmployee(user: SystemUser): Promise<Employee | null> {
  if (!user.email || !user.companyId) return null
  return Employee.query()
    .where('company_id', user.companyId)
    .whereILike('email', user.email)
    .first()
}

const NOTEBOOK_NAMES = ['notebook', 'notebock']

/** Check whether a given device type id maps to a Notebook-like type. */
export async function isNotebookType(deviceTypeId: string): Promise<boolean> {
  const dt = await DeviceType.find(deviceTypeId)
  if (!dt) return false
  return NOTEBOOK_NAMES.includes(dt.name.toLowerCase())
}
