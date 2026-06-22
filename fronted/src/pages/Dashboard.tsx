import type { LucideIcon } from 'lucide-react'
import { Server, Wifi, Layers, Globe, Shield, Radio, Network, GitBranch, Users } from 'lucide-react'
import { Card } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
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
  const navigate = useNavigate()
  const { data: devices, isLoading: devicesLoading } = useApi(() => devicesService.getAll())
  const { data: vlans } = useApi(() => vlansService.getAll())
  const { data: networks } = useApi(() => networksService.getAll())

  const onlineCount = devices?.filter((d: Device) => d.status === 'online').length || 0
  const offlineCount = devices?.filter((d: Device) => d.status === 'offline').length || 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome back, {user?.firstName || 'User'}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Here&apos;s an overview of your network infrastructure
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card title="Total Devices" icon={<Server className="w-5 h-5" />} value={devices?.length || 0} />
        <Card title="Online" icon={<Wifi className="w-5 h-5" />} value={onlineCount}>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status="online">{onlineCount} active</StatusBadge>
            <StatusBadge status="offline">{offlineCount} down</StatusBadge>
          </div>
        </Card>
        <Card title="VLANs" icon={<Layers className="w-5 h-5" />} value={vlans?.length || 0} />
        <Card title="Networks" icon={<Globe className="w-5 h-5" />} value={networks?.length || 0} />
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card
            title="Devices"
            subtitle="Inventory & status"
            icon={<Server className="w-5 h-5" />}
            onClick={() => navigate('/devices')}
          />
          <Card
            title="VLANs"
            subtitle="Segmentation"
            icon={<Layers className="w-5 h-5" />}
            onClick={() => navigate('/vlans')}
          />
          <Card
            title="Networks"
            subtitle="Subnets & DHCP"
            icon={<Network className="w-5 h-5" />}
            onClick={() => navigate('/networks')}
          />
          <Card
            title="Topology"
            subtitle="Connections map"
            icon={<GitBranch className="w-5 h-5" />}
            onClick={() => navigate('/topology')}
          />
          <Card
            title="Employees"
            subtitle="People & assignments"
            icon={<Users className="w-5 h-5" />}
            onClick={() => navigate('/employees')}
          />
        </div>
      </div>

      {/* Recent Devices */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Devices</h2>
        </div>
        {devicesLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
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
                      <p className="text-sm text-gray-500 dark:text-gray-400">{device.ipAddress || 'No IP'}</p>
                    </div>
                  </div>
                  <StatusBadge status={device.status} />
                </div>
              )
            })}
            {(!devices || devices.length === 0) && (
              <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                No devices yet. Add your first device to get started.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
