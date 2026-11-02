import { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../contexts/ToastContext'
import { devicesService } from '../services/devices.service'
import { deviceTypesService } from '../services/device-types.service'
import { containersService } from '../services/containers.service'
import type { Device } from '../types'

const NOTEBOOK_NAMES = ['notebook', 'notebock']
const PAGE_SIZE = 50

function DevicePagination({
  page,
  total,
  perPage,
  disabled,
  onPageChange,
}: {
  page: number
  total: number
  perPage: number
  disabled: boolean
  onPageChange: (page: number) => void
}) {
  const pageCount = Math.max(1, Math.ceil(total / perPage))
  const from = total === 0 ? 0 : (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm text-gray-500 dark:text-gray-400">
      <span>{total === 0 ? '0 equipos' : `${from}–${to} de ${total}`}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Anterior
        </Button>
        <span>
          Página {page} de {pageCount}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}

export default function Devices() {
  const navigate = useNavigate()
  const { canMutate, isViewer } = usePermissions()
  const { activeProjectId } = useProject()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [containerFilter, setContainerFilter] = useState('')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
  const [deviceTemplateFilter, setDeviceTemplateFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  const { data: deviceTypes } = useApi(() => deviceTypesService.getAll(), [activeProjectId])

  const notebookTypeId = useMemo(
    () => deviceTypes?.find((t) => NOTEBOOK_NAMES.includes(t.name.toLowerCase()))?.id ?? null,
    [deviceTypes]
  )

  const { data: containers } = useApi(
    () => containersService.getAll({ areaId: areaFilter || undefined }),
    [activeProjectId, areaFilter]
  )

  const filterKey = [
    activeProjectId,
    debouncedSearch,
    areaFilter,
    containerFilter,
    deviceTypeFilter,
    deviceTemplateFilter,
  ].join('\0')
  const filterKeyRef = useRef(filterKey)
  let pageForRequest = page
  if (filterKeyRef.current !== filterKey) {
    filterKeyRef.current = filterKey
    pageForRequest = 1
    if (page !== 1) setPage(1)
  }

  const { data: filterOptions, refetch: refetchFilters } = useApi(
    () => devicesService.getFilterOptions(),
    [activeProjectId]
  )

  const { data: devicePage, isLoading, refetch } = useApi(
    () =>
      devicesService.getPage({
        search: debouncedSearch,
        summary: true,
        areaId: areaFilter || undefined,
        containerId: containerFilter || undefined,
        deviceTypeId: deviceTypeFilter || undefined,
        deviceTemplateId: deviceTemplateFilter || undefined,
        page: pageForRequest,
        perPage: PAGE_SIZE,
      }),
    [debouncedSearch, areaFilter, containerFilter, deviceTypeFilter, deviceTemplateFilter, activeProjectId, pageForRequest]
  )

  const devices = devicePage?.items
  const total = devicePage?.total ?? 0

  useEffect(() => {
    if (!devicePage) return
    const last = Math.max(1, Math.ceil(devicePage.total / PAGE_SIZE))
    if (page > last) setPage(last)
  }, [devicePage, page])

  const templateOptions = useMemo(
    () => (filterOptions?.templates ?? []).map((template) => ({ value: template.id, label: template.name })),
    [filterOptions]
  )

  const areaOptions = useMemo(
    () => (filterOptions?.areas ?? []).map((area) => ({ value: area.id, label: area.name })),
    [filterOptions]
  )

  const containerOptions = useMemo(() => {
    return (containers || [])
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((c) => ({ value: c.id, label: c.name }))
  }, [containers])

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
      refetchFilters()
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
        subtitle={`${total} equipos en el inventario`}
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate(addButtonTarget)}>
            {isViewer ? 'Agregar notebook' : 'Agregar dispositivo'}
          </Button>
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

      {devicePage && (
        <DevicePagination
          page={pageForRequest}
          total={total}
          perPage={PAGE_SIZE}
          disabled={isLoading}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
