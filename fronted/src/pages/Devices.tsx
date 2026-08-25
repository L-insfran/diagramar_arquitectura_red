import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, Trash2, Layers } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { DeviceInventoryPanel } from '../components/DeviceInventoryPanel'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../contexts/ToastContext'
import { devicesService } from '../services/devices.service'
import { deviceTypesService } from '../services/device-types.service'
import { containersService } from '../services/containers.service'
import { UNSET_TEMPLATE_ID } from '../utils/deviceInventory'
import type { Device } from '../types'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

export default function Devices() {
  const navigate = useNavigate()
  const { canMutate, isViewer } = usePermissions()
  const { user } = useAuth()
  const { activeProjectId, activeProject } = useProject()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [containerFilter, setContainerFilter] = useState('')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
  const [deviceTemplateFilter, setDeviceTemplateFilter] = useState('')
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: deviceTypes } = useApi(() => deviceTypesService.getAll(), [activeProjectId])

  const notebookTypeId = useMemo(
    () => deviceTypes?.find((t) => NOTEBOOK_NAMES.includes(t.name.toLowerCase()))?.id ?? null,
    [deviceTypes]
  )

  const { data: containers } = useApi(
    () => containersService.getAll({ areaId: areaFilter || undefined }),
    [activeProjectId, areaFilter]
  )

  const { data: devices, isLoading, refetch } = useApi(
    () =>
      devicesService.getAll({
        search,
        areaId: areaFilter || undefined,
        containerId: containerFilter || undefined,
        deviceTypeId: deviceTypeFilter || undefined,
        deviceTemplateId: deviceTemplateFilter || undefined,
      }),
    [search, areaFilter, containerFilter, deviceTypeFilter, deviceTemplateFilter, activeProjectId]
  )

  const knownTemplatesRef = useRef<{ projectId: string; map: Map<string, string> }>({
    projectId: '',
    map: new Map(),
  })

  const templateOptions = useMemo(() => {
    if (knownTemplatesRef.current.projectId !== activeProjectId) {
      knownTemplatesRef.current = { projectId: activeProjectId, map: new Map() }
    }
    const map = knownTemplatesRef.current.map
    for (const device of devices || []) {
      if (device.deviceTemplateId) {
        map.set(device.deviceTemplateId, device.deviceTemplate?.name || device.deviceTemplateId)
      }
    }
    if (deviceTemplateFilter && !map.has(deviceTemplateFilter)) {
      map.set(deviceTemplateFilter, 'Template seleccionado')
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es'))
      .map(([value, label]) => ({ value, label }))
  }, [devices, deviceTemplateFilter, activeProjectId])

  const areaOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const d of devices || []) {
      if (d.areaId && d.area) map.set(d.areaId, d.area.name)
    }
    return [...map.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], 'es'))
      .map(([value, label]) => ({ value, label }))
  }, [devices])

  const containerOptions = useMemo(() => {
    return (containers || [])
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((c) => ({ value: c.id, label: c.name }))
  }, [containers])

  const filtersActive = Boolean(search || areaFilter || containerFilter || deviceTypeFilter || deviceTemplateFilter)
  const authorName = user?.firstName ? `${user.firstName} ${user.lastName}` : undefined

  const isNotebook = (d: Device) =>
    d.deviceType?.name ? NOTEBOOK_NAMES.includes(d.deviceType.name.toLowerCase()) : false

  const canEditDevice = (d: Device) => canMutate || (isViewer && isNotebook(d))

  const handleDelete = async (d: Device) => {
    if (!canMutate) return
    if (deletingId) return

    const label = d.name ? `"${d.name}"` : 'este dispositivo'
    const ok = window.confirm(`¿Seguro que quieres borrar ${label}? Esta acción no se puede deshacer.`)
    if (!ok) return

    try {
      setDeletingId(d.id)
      await devicesService.delete(d.id)
      toast.success('Dispositivo borrado', `${d.name} se eliminó correctamente.`)
      refetch()
    } catch (err: any) {
      toast.error('No se pudo borrar el dispositivo', err?.response?.data?.message || err?.message)
    } finally {
      setDeletingId(null)
    }
  }

  const columns: Column<Device>[] = [
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: (d) => (
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{d.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{d.hostname || ''}</p>
        </div>
      ),
    },
    {
      key: 'ipAddress',
      header: 'Dirección IP',
      sortable: true,
      render: (d) => <span className="font-mono text-sm">{d.ipAddress || '—'}</span>,
    },
    {
      key: 'deviceType',
      header: 'Tipo',
      render: (d) => (
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
          {d.deviceType?.name || '—'}
        </span>
      ),
    },
    { key: 'status', header: 'Estado', render: (d) => <StatusBadge status={d.status} /> },
    {
      key: 'location',
      header: 'Ubicación',
      sortable: true,
      render: (d) => (
        <span className="text-gray-500 dark:text-gray-400">
          {[d.site?.name, d.area?.name, d.container?.name].filter(Boolean).join(' › ') ||
            d.location ||
            '—'}
        </span>
      ),
    },
    { key: 'manufacturer', header: 'Fabricante', render: (d) => d.manufacturer || '—' },
    {
      key: 'template',
      header: 'Plantilla',
      render: (d) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {d.deviceTemplate?.name || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (d) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Eye className="w-4 h-4" />}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/devices/${d.id}`)
            }}
            aria-label={`Ver ${d.name}`}
          >
            Ver
          </Button>
          {canEditDevice(d) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!p-2"
              icon={<Pencil className="w-4 h-4" />}
              onClick={(e) => {
                e.stopPropagation()
                navigate(`/devices/${d.id}/edit`)
              }}
              aria-label={`Editar ${d.name}`}
            >
              Editar
            </Button>
          )}
          {canMutate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              icon={<Trash2 className="w-4 h-4" />}
              disabled={deletingId === d.id}
              onClick={(e) => {
                e.stopPropagation()
                void handleDelete(d)
              }}
              aria-label={`Eliminar ${d.name}`}
            >
              Eliminar
            </Button>
          )}
        </div>
      ),
    },
  ]

  const addButtonTarget = isViewer && notebookTypeId
    ? `/devices/new?type=${notebookTypeId}`
    : '/devices/new'

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispositivos"
        subtitle={`${devices?.length || 0} equipos en el inventario`}
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              icon={<Layers className="w-4 h-4" />}
              onClick={() => setInventoryOpen(true)}
            >
              Inventario por modelo
            </Button>
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate(addButtonTarget)}>
              {isViewer ? 'Agregar notebook' : 'Agregar dispositivo'}
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar dispositivos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>
        <Select
          options={areaOptions}
          placeholder="Todas las áreas"
          value={areaFilter}
          onChange={(e) => {
            setAreaFilter(e.target.value)
            setContainerFilter('')
          }}
          className="w-full sm:w-48"
        />
        <Select
          options={containerOptions}
          placeholder="Todos los contenedores"
          value={containerFilter}
          onChange={(e) => setContainerFilter(e.target.value)}
          className="w-full sm:w-52"
        />
        <Select
          options={(deviceTypes || []).map((t) => ({ value: t.id, label: t.name }))}
          placeholder="Todos los tipos"
          value={deviceTypeFilter}
          onChange={(e) => setDeviceTypeFilter(e.target.value)}
          className="w-full sm:w-52"
        />
        <Select
          options={templateOptions}
          placeholder="Todas las plantillas"
          value={deviceTemplateFilter}
          onChange={(e) => setDeviceTemplateFilter(e.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      <DataTable
        columns={columns}
        data={devices || []}
        isLoading={isLoading}
        onRowClick={(device) => navigate(`/devices/${device.id}`)}
        emptyMessage="No se encontraron dispositivos. Agrega tu primer dispositivo para comenzar."
      />

      <Modal
        isOpen={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        title="Inventario por modelo"
        size="xl"
      >
        <DeviceInventoryPanel
          devices={devices || []}
          filtersActive={filtersActive}
          projectName={activeProject?.name}
          clientName={activeProject?.clientName ?? undefined}
          authorName={authorName}
          onSelectTemplate={(templateId) => {
            if (templateId !== UNSET_TEMPLATE_ID) {
              setDeviceTemplateFilter(templateId)
            }
            setInventoryOpen(false)
          }}
        />
      </Modal>
    </div>
  )
}
