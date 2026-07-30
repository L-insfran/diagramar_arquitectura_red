import { Sun, Moon, Users, ChevronRight, Tags, Cable, Box, Building2, HardDrive, Network } from 'lucide-react'
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
  const { isAdmin, canMutate } = usePermissions()
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

        {/* Sites & Areas — mutate roles */}
        {canMutate && (
          <Card title="Sitios y áreas">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Ubicación física
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Sedes y áreas de inventario (distinto de zonas del diagrama)
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/sites')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {/* Racks */}
        {canMutate && (
          <Card title="Racks">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-slate-500/10 flex items-center justify-center">
                  <HardDrive className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Gabinetes y ocupación U
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Visor de ocupación U y montaje de equipos
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/racks')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {/* Device templates — mutate roles */}
        {canMutate && (
          <Card title="Templates de dispositivo">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center">
                  <Box className="w-5 h-5 text-violet-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de templates
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Catálogo global: marca, modelo, U y puertos reutilizables en todos los proyectos
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/device-templates')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {/* Device types — admin only */}
        {isAdmin && (
          <Card title="Tipos de dispositivo">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Tags className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de tipos
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Agregar, editar y eliminar tipos para dispositivos
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/device-types')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {/* Port types — admin only */}
        {isAdmin && (
          <Card title="Tipos de puerto">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <Cable className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de puertos
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Velocidad, color, dirección e icono por tipo
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/port-types')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

        {/* Cable types — admin only */}
        {isAdmin && (
          <Card title="Tipos de cable">
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center">
                  <Network className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    Catálogo de cables
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    UTP, fibra, DAC y otros medios documentables
                  </p>
                </div>
              </div>
              <Button
                variant="secondary"
                icon={<ChevronRight className="w-4 h-4" />}
                onClick={() => navigate('/settings/cable-types')}
              >
                Administrar
              </Button>
            </div>
          </Card>
        )}

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
