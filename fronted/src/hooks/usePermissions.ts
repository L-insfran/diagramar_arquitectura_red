import { useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'

export interface Permissions {
  role: 'admin' | 'operator' | 'viewer'
  isAdmin: boolean
  isOperator: boolean
  isViewer: boolean
  /** Admin and operator can mutate most resources. */
  canMutate: boolean
}

export function usePermissions(): Permissions {
  const { user } = useAuth()
  return useMemo(() => {
    const role = user?.role ?? 'viewer'
    return {
      role,
      isAdmin: role === 'admin',
      isOperator: role === 'operator',
      isViewer: role === 'viewer',
      canMutate: role === 'admin' || role === 'operator',
    }
  }, [user?.role])
}
