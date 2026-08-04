import { useEffect, useState, type LucideIcon } from 'react'
import {
  Server,
  Layers,
  Globe,
  Shield,
  Radio,
  Network,
  GitBranch,
  HardDrive,
  Cable,
  Link2,
  AlertTriangle,
  FileWarning,
  Building2,
  CircleOff,
} from 'lucide-react'
import { Card } from '../components/Card'
import { StatusBadge } from '../components/StatusBadge'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useApi } from '../hooks/useApi'
import { dashboardService } from '../services/dashboard.service'
import type { DashboardAlert, DashboardMetrics, DashboardRackSummary } from '../types'
import { useNavigate } from 'react-router-dom'

/** Vista de ocupación U en el widget de racks del dashboard. */
type RackOccupancyView = 'both' | 'front' | 'rear'

const RACK_OCCUPANCY_VIEW_OPTIONS: { value: RackOccupancyView; label: string }[] = [
  { value: 'both', label: 'Front+Back' },
  { value: 'front', label: 'Front' },
  { value: 'rear', label: 'Back' },
]

function rackOccupancyStorageKey(userId: string | undefined) {
  return `nm.dashboard.rackOccupancyView:${userId || 'anon'}`
}

function readRackOccupancyView(userId: string | undefined): RackOccupancyView {
  try {
    const raw = localStorage.getItem(rackOccupancyStorageKey(userId))
    if (raw === 'both' || raw === 'front' || raw === 'rear') return raw
  } catch {
    /* ignore */
  }
  return 'both'
}

function occupancyForView(rack: DashboardRackSummary, view: RackOccupancyView) {
  if (view === 'front') {
    const capacity = rack.heightU
    const usedU = rack.usedFrontU ?? 0
    const freeU = Math.max(0, capacity - usedU)
    const percentUsed = capacity === 0 ? 0 : Math.round((usedU / capacity) * 1000) / 10
    return { usedU, freeU, percentUsed, faceLabel: 'Front' }
  }
  if (view === 'rear') {
    const capacity = rack.heightU
    const usedU = rack.usedRearU ?? 0
    const freeU = Math.max(0, capacity - usedU)
    const percentUsed = capacity === 0 ? 0 : Math.round((usedU / capacity) * 1000) / 10
    return { usedU, freeU, percentUsed, faceLabel: 'Back' }
  }
  return {
    usedU: rack.usedU,
    freeU: rack.freeU,
    percentUsed: rack.percentUsed,
    faceLabel: 'Front+Back',
  }
}

function aggregateOccupancy(items: DashboardRackSummary[], view: RackOccupancyView) {
  let usedU = 0
  let totalCapacityU = 0
  for (const rack of items) {
    const o = occupancyForView(rack, view)
    usedU += o.usedU
    totalCapacityU += view === 'both' ? rack.heightU * 2 : rack.heightU
  }
  const freeU = Math.max(0, totalCapacityU - usedU)
  const percentUsed =
    totalCapacityU === 0 ? 0 : Math.round((usedU / totalCapacityU) * 1000) / 10
  return { usedU, freeU, totalCapacityU, percentUsed }
}

const deviceTypeIcons: Record<string, LucideIcon> = {
  Router: Globe,
  Switch: Server,
  Firewall: Shield,
  'Access Point': Radio,
  'Cableado Estructurado': Network,
}

function alertTone(severity: DashboardAlert['severity']) {
  if (severity === 'critical') {
    return 'border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300'
  }
  if (severity === 'warning') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300'
  }
  return 'border-blue-500/40 bg-blue-500/10 text-blue-800 dark:text-blue-300'
}

function alertPath(alert: DashboardAlert): string | null {
  if (alert.entityType === 'device' && alert.entityId) return `/devices/${alert.entityId}`
  if (alert.entityType === 'rack') return '/racks'
  return null
}

export default function Dashboard() {
  const { user } = useAuth()
  const { activeProjectId } = useProject()
  const navigate = useNavigate()
  const { data, isLoading, error } = useApi(
    () => dashboardService.getMetrics(),
    [activeProjectId]
  )

  const [rackOccupancyView, setRackOccupancyView] = useState<RackOccupancyView>(() =>
    readRackOccupancyView(user?.id)
  )

  useEffect(() => {
    setRackOccupancyView(readRackOccupancyView(user?.id))
  }, [user?.id])

  useEffect(() => {
    try {
      localStorage.setItem(rackOccupancyStorageKey(user?.id), rackOccupancyView)
    } catch {
      /* ignore */
    }
  }, [rackOccupancyView, user?.id])

  const metrics: DashboardMetrics | null = data ?? null
  const c = metrics?.counts
  const rackAgg = metrics
    ? aggregateOccupancy(metrics.racks.items, rackOccupancyView)
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Bienvenido, {user?.firstName || 'Usuario'}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Métricas reales del proyecto activo
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          No se pudieron cargar las métricas del dashboard.
        </div>
      )}

      {isLoading && !metrics ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              title="Equipos"
              icon={<Server className="w-5 h-5" />}
              value={c?.devices ?? 0}
              onClick={() => navigate('/devices')}
            >
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <StatusBadge status="online">{c?.devicesOnline ?? 0} online</StatusBadge>
                <StatusBadge status="offline">{c?.devicesOffline ?? 0} offline</StatusBadge>
              </div>
            </Card>
            <Card
              title="Racks"
              icon={<HardDrive className="w-5 h-5" />}
              value={c?.racks ?? 0}
              onClick={() => navigate('/racks')}
            >
              <p className="text-xs text-gray-500 mt-2">
                Ocupación U: {rackAgg?.percentUsed ?? 0}% ({rackAgg?.usedU ?? 0}/
                {rackAgg?.totalCapacityU ?? 0})
              </p>
            </Card>
            <Card title="Puertos" icon={<Cable className="w-5 h-5" />} value={c?.ports ?? 0}>
              <p className="text-xs text-gray-500 mt-2">
                {c?.portsOccupied ?? 0} ocupados · {c?.portsFree ?? 0} libres
              </p>
            </Card>
            <Card
              title="Conexiones"
              icon={<Link2 className="w-5 h-5" />}
              value={c?.connections ?? 0}
              onClick={() => navigate('/topology')}
            >
              <p className="text-xs text-gray-500 mt-2">
                {c?.connectionsPhysical ?? 0} físicas
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card
              title="VLANs"
              icon={<Layers className="w-5 h-5" />}
              value={c?.vlans ?? 0}
              onClick={() => navigate('/vlans')}
            />
            <Card
              title="Redes"
              icon={<Globe className="w-5 h-5" />}
              value={c?.networks ?? 0}
              onClick={() => navigate('/networks')}
            />
            <Card
              title="Sitios / áreas"
              icon={<Building2 className="w-5 h-5" />}
              value={`${c?.sites ?? 0} / ${c?.areas ?? 0}`}
              onClick={() => navigate('/settings/sites')}
            />
            <Card title="Docs / secretos" icon={<FileWarning className="w-5 h-5" />} value={`${c?.attachments ?? 0} / ${c?.secrets ?? 0}`}>
              <p className="text-xs text-gray-500 mt-2">
                {metrics?.documentation.devicesWithoutAttachments ?? 0} equipos sin adjuntos
              </p>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Alertas ({metrics?.alerts.length ?? 0})
                </h2>
              </div>
              <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
                {(metrics?.alerts.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 px-2 py-6 text-center">
                    Sin alertas derivadas en este momento
                  </p>
                ) : (
                  metrics!.alerts.map((alert, idx) => {
                    const path = alertPath(alert)
                    return (
                      <button
                        key={`${alert.code}-${alert.entityId ?? idx}`}
                        type="button"
                        disabled={!path}
                        onClick={() => path && navigate(path)}
                        className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${alertTone(alert.severity)} ${path ? 'hover:opacity-90 cursor-pointer' : 'cursor-default'}`}
                      >
                        {alert.message}
                      </button>
                    )
                  })
                )}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <HardDrive className="w-4 h-4 text-slate-400 shrink-0" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
                    Ocupación de racks
                  </h2>
                </div>
                <div
                  className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-gray-50 dark:bg-gray-800/80"
                  role="group"
                  aria-label="Vista de ocupación por cara"
                >
                  {RACK_OCCUPANCY_VIEW_OPTIONS.map((opt) => {
                    const active = rackOccupancyView === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setRackOccupancyView(opt.value)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                          active
                            ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                            : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
                {(metrics?.racks.items.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-500 dark:text-gray-400 px-2 py-6 text-center">
                    No hay racks en el proyecto
                  </p>
                ) : (
                  metrics!.racks.items.map((rack) => {
                    const occ = occupancyForView(rack, rackOccupancyView)
                    return (
                      <button
                        key={rack.id}
                        type="button"
                        className="w-full text-left"
                        onClick={() => navigate('/racks')}
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="font-medium text-gray-900 dark:text-white truncate">
                            {rack.name}
                            <span className="text-gray-500 font-normal"> · {rack.heightU}U</span>
                          </span>
                          <span className="tabular-nums text-gray-500">{occ.percentUsed}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              occ.percentUsed >= 95
                                ? 'bg-red-500'
                                : occ.percentUsed >= 80
                                  ? 'bg-amber-500'
                                  : 'bg-blue-500'
                            }`}
                            style={{ width: `${Math.min(100, occ.percentUsed)}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1">
                          {occ.usedU} usadas · {occ.freeU} libres ({occ.faceLabel})
                        </p>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Acciones rápidas
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <Card
                title="Dispositivos"
                subtitle="Inventario y estado"
                icon={<Server className="w-5 h-5" />}
                onClick={() => navigate('/devices')}
              />
              <Card
                title="Racks"
                subtitle="Ocupación U"
                icon={<HardDrive className="w-5 h-5" />}
                onClick={() => navigate('/racks')}
              />
              <Card
                title="Topología"
                subtitle="Mapa de conexiones"
                icon={<GitBranch className="w-5 h-5" />}
                onClick={() => navigate('/topology')}
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Dispositivos recientes
              </h2>
              {(metrics?.documentation.devicesWithoutPhysicalLink ?? 0) > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                  <CircleOff className="w-3.5 h-3.5" />
                  {metrics!.documentation.devicesWithoutPhysicalLink} sin enlace físico
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
              {(metrics?.recentDevices.length ?? 0) === 0 ? (
                <div className="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  Aún no hay dispositivos. Agrega el primero para comenzar.
                </div>
              ) : (
                metrics!.recentDevices.map((device) => {
                  const Icon = deviceTypeIcons[device.deviceTypeName || ''] || Server
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
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {device.ipAddress || 'Sin IP'}
                            {device.deviceTypeName ? ` · ${device.deviceTypeName}` : ''}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={device.status as 'online' | 'offline' | 'maintenance' | 'unknown'} />
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
