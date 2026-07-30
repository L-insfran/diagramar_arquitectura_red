import { Building2 } from 'lucide-react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useProject } from '../contexts/ProjectContext'
import { useAuth } from '../contexts/AuthContext'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  operator: 'Operador',
  viewer: 'Visualizador',
}

export default function SelectProject() {
  const { user } = useAuth()
  const { projects, setActiveProject, needsProjectSelection, isLoading, activeProjectId } =
    useProject()
  const navigate = useNavigate()

  if (!isLoading && !needsProjectSelection && activeProjectId) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
            <Building2 className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-bold text-white">Seleccionar proyecto</h1>
          <p className="text-sm text-slate-400">
            Hola {user?.firstName}, tenés acceso a varios proyectos. Elegí con cuál trabajar.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-2 space-y-1">
          {isLoading ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Cargando proyectos…</p>
          ) : projects.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">
              No tenés proyectos asignados. Pedile a un administrador que te dé acceso.
            </p>
          ) : (
            projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => {
                  setActiveProject(project.id)
                  navigate('/', { replace: true })
                }}
                className="flex w-full items-start gap-3 rounded-xl px-4 py-3 text-left hover:bg-slate-800/80 transition"
              >
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600/15 text-blue-400">
                  <Building2 className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-slate-100">{project.name}</span>
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {ROLE_LABELS[project.role] ?? project.role}
                    {project.domain ? ` · ${project.domain}` : ''}
                    {typeof project.deviceCount === 'number'
                      ? ` · ${project.deviceCount} dispositivos`
                      : ''}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
