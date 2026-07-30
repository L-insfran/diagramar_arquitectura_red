import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'

export interface Permissions {
  role: 'admin' | 'operator' | 'viewer'
  isAdmin: boolean
  isOperator: boolean
  isViewer: boolean
  /** Admin and operator can mutate most resources in the active project. */
  canMutate: boolean
  /** Global platform admin (can manage all projects). */
  isGlobalAdmin: boolean
}

export function usePermissions(): Permissions {
  const { user } = useAuth()
  const { roleInActiveProject } = useProject()
  return useMemo(() => {
    const globalRole = user?.role ?? 'viewer'
    const role = roleInActiveProject || globalRole
    return {
      role,
      isAdmin: role === 'admin',
      isOperator: role === 'operator',
      isViewer: role === 'viewer',
      canMutate: role === 'admin' || role === 'operator',
      isGlobalAdmin: globalRole === 'admin',
    }
  }, [user?.role, roleInActiveProject])
}
