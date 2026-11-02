import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Select } from '../components/Select'
import { DeviceInventoryPanel } from '../components/DeviceInventoryPanel'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { devicesService } from '../services/devices.service'
import { deviceTypesService } from '../services/device-types.service'
import { containersService } from '../services/containers.service'
import { UNSET_TEMPLATE_ID } from '../utils/deviceInventory'

export default function ExportDeviceInventory() {
  const { user } = useAuth()
  const { activeProjectId, activeProject } = useProject()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [containerFilter, setContainerFilter] = useState('')
  const [deviceTypeFilter, setDeviceTypeFilter] = useState('')
  const [deviceTemplateFilter, setDeviceTemplateFilter] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    setSearch('')
    setDebouncedSearch('')
    setAreaFilter('')
    setContainerFilter('')
    setDeviceTypeFilter('')
    setDeviceTemplateFilter('')
  }, [activeProjectId])

  const { data: deviceTypes } = useApi(() => deviceTypesService.getAll(), [activeProjectId])
  const { data: filterOptions } = useApi(() => devicesService.getFilterOptions(), [activeProjectId])
  const { data: containers } = useApi(
    () => containersService.getAll({ areaId: areaFilter || undefined }),
    [activeProjectId, areaFilter]
  )

  const {
    data: inventoryDevices,
    isLoading,
    error,
  } = useApi(
    () =>
      devicesService.getAll({
        search: debouncedSearch,
        summary: true,
        areaId: areaFilter || undefined,
        containerId: containerFilter || undefined,
        deviceTypeId: deviceTypeFilter || undefined,
        deviceTemplateId: deviceTemplateFilter || undefined,
      }),
    [
      activeProjectId,
      debouncedSearch,
      areaFilter,
      containerFilter,
      deviceTypeFilter,
      deviceTemplateFilter,
    ]
  )

  const areaOptions = useMemo(
    () => (filterOptions?.areas ?? []).map((area) => ({ value: area.id, label: area.name })),
    [filterOptions]
  )
  const containerOptions = useMemo(
    () =>
      (containers ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((c) => ({ value: c.id, label: c.name })),
    [containers]
  )
  const typeOptions = useMemo(
    () => (deviceTypes ?? []).map((t) => ({ value: t.id, label: t.name })),
    [deviceTypes]
  )
  const templateOptions = useMemo(
    () => (filterOptions?.templates ?? []).map((t) => ({ value: t.id, label: t.name })),
    [filterOptions]
  )

  const filtersActive = Boolean(
    search || areaFilter || containerFilter || deviceTypeFilter || deviceTemplateFilter
  )
  const authorName = user?.firstName ? `${user.firstName} ${user.lastName}` : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventario por modelo"
        subtitle="Resumen de equipos agrupados por plantilla, con exportación CSV y PDF"
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
          options={typeOptions}
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

      {error ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No se pudo cargar el inventario.
        </p>
      ) : isLoading || !inventoryDevices ? (
        <div className="py-12 text-center">
          <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">Cargando inventario…</p>
        </div>
      ) : (
        <DeviceInventoryPanel
          devices={inventoryDevices}
          filtersActive={filtersActive}
          projectName={activeProject?.name}
          clientName={activeProject?.clientName ?? undefined}
          authorName={authorName}
          onSelectTemplate={(templateId) => {
            if (templateId !== UNSET_TEMPLATE_ID) {
              setDeviceTemplateFilter(templateId)
            }
          }}
        />
      )}
    </div>
  )
}
