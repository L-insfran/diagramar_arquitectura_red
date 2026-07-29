import type { LucideIcon } from 'lucide-react'
import { Server, Wifi, Layers, Globe, Shield, Radio, Network, GitBranch, Users } from 'lucide-react'
import { Card } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { useApi } from '../hooks/useApi'
import { devicesService } from '../services/devices.service'
import { vlansService } from '../services/vlans.service'
import { networksService } from '../services/networks.service'
import type { Device } from '../types'
import { useNavigate } from 'react-router-dom'

const deviceTypeIcons: Record<string, LucideIcon> = {
  Router: Globe,
  Switch: Server,
  Firewall: Shield,
  'Access Point': Radio,
  'Cableado Estructurado': Network,
}

export default function Dashboard() {
  const { user } = useAuth()
  const { activeCompanyId } = useCompany()
  const navigate = useNavigate()
  const { data: devices, isLoading: devicesLoading } = useApi(
    () => devicesService.getAll(),
    [activeCompanyId]
  )
  const { data: vlans } = useApi(() => vlansService.getAll(), [activeCompanyId])
  const { data: networks } = useApi(() => networksService.getAll(), [activeCompanyId])

  const onlineCount = devices?.filter((d: Device) => d.status === 'online').length || 0
  const offlineCount = devices?.filter((d: Device) => d.status === 'offline').length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bienvenido, {user?.firstName || 'Usuario'}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Resumen de la infraestructura de red
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Dispositivos" icon={<Server className="w-5 h-5" />} value={devices?.length || 0} />
        <Card title="En línea" icon={<Wifi className="w-5 h-5" />} value={onlineCount}>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status="online">{onlineCount} activos</StatusBadge>
            <StatusBadge status="offline">{offlineCount} caídos</StatusBadge>
          </div>
        </Card>
        <Card title="VLANs" icon={<Layers className="w-5 h-5" />} value={vlans?.length || 0} />
        <Card title="Redes" icon={<Globe className="w-5 h-5" />} value={networks?.length || 0} />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Acciones rápidas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            title="Dispositivos"
            subtitle="Inventario y estado"
            icon={<Server className="w-5 h-5" />}
            onClick={() => navigate('/devices')}
          />
          <Card
            title="VLANs"
            subtitle="Segmentación"
            icon={<Layers className="w-5 h-5" />}
            onClick={() => navigate('/vlans')}
          />
          <Card
            title="Redes"
            subtitle="Subredes y DHCP"
            icon={<Network className="w-5 h-5" />}
            onClick={() => navigate('/networks')}
          />
          <Card
            title="Topología"
            subtitle="Mapa de conexiones"
            icon={<GitBranch className="w-5 h-5" />}
            onClick={() => navigate('/topology')}
          />
          <Card
            title="Empleados"
            subtitle="Personas y asignaciones"
            icon={<Users className="w-5 h-5" />}
            onClick={() => navigate('/employees')}
          />
        </div>
      </div>

      {/* Recent Devices */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Dispositivos recientes</h2>
        </div>
        {devicesLoading ? (
          <div className="p-8 text-center text-gray-500">Cargando...</div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
            {(devices || []).slice(0, 5).map((device: Device) => {
              const Icon = deviceTypeIcons[device.deviceType?.name || ''] || Server
              return (
                <div
                  key={device.id}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/devices/${device.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      navigate(`/devices/${device.id}`)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                      <Icon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{device.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{device.ipAddress || 'Sin IP'}</p>
                    </div>
                  </div>
                  <StatusBadge status={device.status} />
                </div>
              )
            })}
            {(!devices || devices.length === 0) && (
              <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                Aún no hay dispositivos. Agrega el primero para comenzar.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
