import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Eye, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { StatusBadge } from '../components/StatusBadge'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { useCompany } from '../contexts/CompanyContext'
import { useToast } from '../contexts/ToastContext'
import { devicesService } from '../services/devices.service'
import { deviceTypesService } from '../services/device-types.service'
import type { Device } from '../types'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

export default function Devices() {
  const navigate = useNavigate()
  const { canMutate, isViewer } = usePermissions()
  const { activeCompanyId } = useCompany()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: deviceTypes } = useApi(() => deviceTypesService.getAll(), [activeCompanyId])

  const notebookTypeId = useMemo(
    () => deviceTypes?.find((t) => NOTEBOOK_NAMES.includes(t.name.toLowerCase()))?.id ?? null,
    [deviceTypes]
  )

  const { data: devices, isLoading, refetch } = useApi(
    () =>
      devicesService.getAll({
        search,
        status: statusFilter || undefined,
        deviceTypeId: deviceTypeFilter || undefined,
      }),
    [search, statusFilter, deviceTypeFilter, activeCompanyId]
  )

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
      header: 'Name',
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
      header: 'IP Address',
      sortable: true,
      render: (d) => <span className="font-mono text-sm">{d.ipAddress || '—'}</span>,
    },
    {
      key: 'deviceType',
      header: 'Type',
      render: (d) => (
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
          {d.deviceType?.name || '—'}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (d) => <StatusBadge status={d.status} /> },
    {
      key: 'location',
      header: 'Location',
      sortable: true,
      render: (d) => (
        <span className="text-gray-500 dark:text-gray-400">{d.location || '—'}</span>
      ),
    },
    { key: 'manufacturer', header: 'Manufacturer', render: (d) => d.manufacturer || '—' },
    {
      key: 'actions',
      header: 'Actions',
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
            aria-label={`View ${d.name}`}
          >
            View
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
              aria-label={`Edit ${d.name}`}
            >
              Edit
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
              aria-label={`Delete ${d.name}`}
            >
              Delete
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
        title="Devices"
        subtitle={`${devices?.length || 0} devices in your network`}
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate(addButtonTarget)}>
            {isViewer ? 'Add Notebook' : 'Add Device'}
          </Button>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search devices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
          />
        </div>
        <Select
          options={[
            { value: 'online', label: 'Online' },
            { value: 'offline', label: 'Offline' },
            { value: 'maintenance', label: 'Maintenance' },
            { value: 'unknown', label: 'Unknown' },
          ]}
          placeholder="All Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full sm:w-48"
        />
        <Select
          options={(deviceTypes || []).map((t) => ({ value: t.id, label: t.name }))}
          placeholder="All Types"
          value={deviceTypeFilter}
          onChange={(e) => setDeviceTypeFilter(e.target.value)}
          className="w-full sm:w-52"
        />
      </div>

      <DataTable
        columns={columns}
        data={devices || []}
        isLoading={isLoading}
        onRowClick={(device) => navigate(`/devices/${device.id}`)}
        emptyMessage="No devices found. Add your first device to get started."
      />
    </div>
  )
}
