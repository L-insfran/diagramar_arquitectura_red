import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'

export interface Permissions {
  role: 'admin' | 'operator' | 'viewer'
  isAdmin: boolean
  isOperator: boolean
  isViewer: boolean
  /** Admin and operator can mutate most resources in the active company. */
  canMutate: boolean
  /** Global platform admin (can manage all clients). */
  isGlobalAdmin: boolean
}

export function usePermissions(): Permissions {
  const { user } = useAuth()
  const { roleInActiveCompany } = useCompany()
  return useMemo(() => {
    const globalRole = user?.role ?? 'viewer'
    const role = roleInActiveCompany || globalRole
    return {
      role,
      isAdmin: role === 'admin',
      isOperator: role === 'operator',
      isViewer: role === 'viewer',
      canMutate: role === 'admin' || role === 'operator',
      isGlobalAdmin: globalRole === 'admin',
    }
  }, [user?.role, roleInActiveCompany])
}
