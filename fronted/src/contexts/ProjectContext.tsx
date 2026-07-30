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
import { projectsService } from '../services/projects.service'
import type { AccessibleProject } from '../types'

const STORAGE_KEY = 'nm:active-project'
const LEGACY_STORAGE_KEY = 'nm:active-company'

function readStoredProjectId(): string | null {
  const current = localStorage.getItem(STORAGE_KEY)
  if (current) return current
  const legacy = localStorage.getItem(LEGACY_STORAGE_KEY)
  if (legacy) {
    localStorage.setItem(STORAGE_KEY, legacy)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    return legacy
  }
  return null
}

interface ProjectContextType {
  projects: AccessibleProject[]
  activeProjectId: string
  activeProject: AccessibleProject | null
  roleInActiveProject: 'admin' | 'operator' | 'viewer'
  isLoading: boolean
  setActiveProject: (projectId: string) => void
  refreshProjects: () => Promise<void>
  needsProjectSelection: boolean
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined)

function pickInitialProjectId(projects: AccessibleProject[], userProjectId?: string): string {
  const stored = readStoredProjectId()
  if (stored && projects.some((p) => p.id === stored)) return stored
  const defaultOne = projects.find((p) => p.isDefault)
  if (defaultOne) return defaultOne.id
  if (userProjectId && projects.some((p) => p.id === userProjectId)) return userProjectId
  return projects[0]?.id ?? ''
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [projects, setProjects] = useState<AccessibleProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [needsProjectSelection, setNeedsProjectSelection] = useState(false)

  const refreshProjects = useCallback(async () => {
    if (!isAuthenticated) {
      setProjects([])
      setActiveProjectId('')
      setIsLoading(false)
      setNeedsProjectSelection(false)
      return
    }
    setIsLoading(true)
    try {
      const list = await projectsService.getMine()
      setProjects(list)
      const stored = readStoredProjectId()
      if (!stored && list.length > 1) {
        setNeedsProjectSelection(true)
        setActiveProjectId('')
      } else {
        const nextId = pickInitialProjectId(list, user?.projectId)
        setActiveProjectId(nextId)
        if (nextId) localStorage.setItem(STORAGE_KEY, nextId)
        setNeedsProjectSelection(false)
      }
    } catch {
      setProjects([])
      setActiveProjectId(user?.projectId ?? '')
    } finally {
      setIsLoading(false)
    }
  }, [isAuthenticated, user?.projectId])

  useEffect(() => {
    void refreshProjects()
  }, [refreshProjects])

  const setActiveProject = useCallback((projectId: string) => {
    setActiveProjectId(projectId)
    localStorage.setItem(STORAGE_KEY, projectId)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
    setNeedsProjectSelection(false)
  }, [])

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId]
  )

  const roleInActiveProject = activeProject?.role ?? user?.role ?? 'viewer'

  const value = useMemo(
    () => ({
      projects,
      activeProjectId,
      activeProject,
      roleInActiveProject,
      isLoading,
      setActiveProject,
      refreshProjects,
      needsProjectSelection,
    }),
    [
      projects,
      activeProjectId,
      activeProject,
      roleInActiveProject,
      isLoading,
      setActiveProject,
      refreshProjects,
      needsProjectSelection,
    ]
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) throw new Error('useProject must be used within ProjectProvider')
  return context
}
