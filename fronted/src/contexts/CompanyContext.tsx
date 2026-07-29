import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useAuth } from './AuthContext'
import { companiesService } from '../services/companies.service'
import type { AccessibleCompany } from '../types'

const STORAGE_KEY = 'nm:active-company'

interface CompanyContextType {
  companies: AccessibleCompany[]
  activeCompanyId: string
  activeCompany: AccessibleCompany | null
  roleInActiveCompany: 'admin' | 'operator' | 'viewer'
  isLoading: boolean
  setActiveCompany: (companyId: string) => void
  refreshCompanies: () => Promise<void>
  needsCompanySelection: boolean
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined)

function pickInitialCompanyId(
  companies: AccessibleCompany[],
  userCompanyId?: string
): string {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && companies.some((c) => c.id === stored)) return stored
  const defaultOne = companies.find((c) => c.isDefault)
  if (defaultOne) return defaultOne.id
  if (userCompanyId && companies.some((c) => c.id === userCompanyId)) return userCompanyId
  return companies[0]?.id ?? ''
}

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [companies, setCompanies] = useState<AccessibleCompany[]>([])
  const [activeCompanyId, setActiveCompanyId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [needsCompanySelection, setNeedsCompanySelection] = useState(false)

  const refreshCompanies = useCallback(async () => {
    if (!isAuthenticated) {
      setCompanies([])
      setActiveCompanyId('')
      setIsLoading(false)
      setNeedsCompanySelection(false)
      return
    }
    setIsLoading(true)
    try {
      const list = await companiesService.getMine()
      setCompanies(list)
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored && list.length > 1) {
        setNeedsCompanySelection(true)
        setActiveCompanyId('')
      } else {
        const nextId = pickInitialCompanyId(list, user?.companyId)
        setActiveCompanyId(nextId)
        if (nextId) localStorage.setItem(STORAGE_KEY, nextId)
        setNeedsCompanySelection(false)
      }
    } catch {
      setCompanies([])
      setActiveCompanyId(user?.companyId ?? '')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.companyId])

  useEffect(() => {
    void refreshCompanies()
  }, [refreshCompanies])

  const setActiveCompany = useCallback((companyId: string) => {
    setActiveCompanyId(companyId)
    localStorage.setItem(STORAGE_KEY, companyId)
    setNeedsCompanySelection(false)
  }, [])

  const activeCompany = useMemo(
    () => companies.find((c) => c.id === activeCompanyId) ?? null,
    [companies, activeCompanyId]
  )

  const roleInActiveCompany = activeCompany?.role ?? user?.role ?? 'viewer'

  const value = useMemo(
    () => ({
      companies,
      activeCompanyId,
      activeCompany,
      roleInActiveCompany,
      isLoading,
      setActiveCompany,
      refreshCompanies,
      needsCompanySelection,
    }),
    [
      companies,
      activeCompanyId,
      activeCompany,
      roleInActiveCompany,
      isLoading,
      setActiveCompany,
      refreshCompanies,
      needsCompanySelection,
    ]
  )

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>
}

export function useCompany() {
  const context = useContext(CompanyContext)
  if (!context) throw new Error('useCompany must be used within CompanyProvider')
  return context
}
