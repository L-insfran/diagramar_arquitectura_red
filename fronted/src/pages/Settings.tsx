import { Sun, Moon, Users, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { usePermissions } from '../hooks/usePermissions'
import { Button } from '../components/Button'

export default function SettingsPage() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { isAdmin } = usePermissions()
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <PageHeader title="Configuración" subtitle="Gestiona tu cuenta y preferencias" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile */}
        <Card title="Perfil">
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-semibold">
                {user?.firstName?.charAt(0) || 'U'}
                {user?.lastName?.charAt(0) || ''}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {user ? `${user.firstName} ${user.lastName}` : 'User'}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium capitalize">
                  {user?.role}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Appearance */}
        <Card title="Apariencia">
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Tema</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Usando modo {theme === 'dark' ? 'oscuro' : 'claro'}
              </p>
            </div>
            <Button
              variant="secondary"
              onClick={toggleTheme}
              icon={theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            >
              {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            </Button>
          </div>
        </Card>

        {/* User management — admin only */}
        {isAdmin && (
          <Card title="Usuarios del sistema">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                  <Users className="w-5 h-5 text-indigo-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Gestión de usuarios
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Crear, editar y eliminar usuarios del sistema
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/users')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
