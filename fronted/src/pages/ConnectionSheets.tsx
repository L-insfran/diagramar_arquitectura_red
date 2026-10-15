import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Search, X } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../contexts/ToastContext'
import { devicesService, type ConnectionSheetLayout } from '../services/devices.service'
import { containersService } from '../services/containers.service'
import type { Device } from '../types'

const PAGE_SIZE = 50
const MAX_DEVICES = 60

const LAYOUTS: Array<{ id: ConnectionSheetLayout; title: string; text: string }> = [
  {
    id: 'tabs',
    title: 'Una hoja por equipo',
    text: 'El archivo trae un índice y una pestaña igual a la planilla de hoy por cada equipo.',
  },
  {
    id: 'combined',
    title: 'Todo en una hoja',
    text: 'Un solo listado, con un bloque por equipo, para filtrar o imprimir junto.',
  },
]

function placeOf(device: Device): string {
  return (
    [device.site?.name, device.area?.name, device.container?.name].filter(Boolean).join(' › ') ||
    device.location ||
    '—'
  )
}

function SheetPagination({
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

export default function ConnectionSheets() {
  const { activeProjectId } = useProject()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [containerFilter, setContainerFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Map<string, string>>(() => new Map())
  const [layout, setLayout] = useState<ConnectionSheetLayout>('tabs')
  const [selectingAll, setSelectingAll] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const projectRef = useRef(activeProjectId)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    if (projectRef.current === activeProjectId) return
    projectRef.current = activeProjectId
    setSelected(new Map())
    setPage(1)
    setAreaFilter('')
    setContainerFilter('')
    setSearch('')
  }, [activeProjectId])

  const filterKey = [activeProjectId, debouncedSearch, areaFilter, containerFilter].join('\0')
  const filterKeyRef = useRef(filterKey)
  let pageForRequest = page
  if (filterKeyRef.current !== filterKey) {
    filterKeyRef.current = filterKey
    pageForRequest = 1
    if (page !== 1) setPage(1)
  }

  const { data: filterOptions } = useApi(() => devicesService.getFilterOptions(), [activeProjectId])
  const { data: containers } = useApi(
    () => containersService.getAll({ areaId: areaFilter || undefined }),
    [activeProjectId, areaFilter],
  )
  const { data: devicePage, isLoading } = useApi(
    () =>
      devicesService.getPage({
        search: debouncedSearch,
        summary: true,
        areaId: areaFilter || undefined,
        containerId: containerFilter || undefined,
        page: pageForRequest,
        perPage: PAGE_SIZE,
      }),
    [debouncedSearch, areaFilter, containerFilter, activeProjectId, pageForRequest],
  )

  const devices = devicePage?.items ?? []
  const total = devicePage?.total ?? 0

  useEffect(() => {
    if (!devicePage) return
    const last = Math.max(1, Math.ceil(devicePage.total / PAGE_SIZE))
    if (page > last) setPage(last)
  }, [devicePage, page])

  const areaOptions = useMemo(
    () => (filterOptions?.areas ?? []).map((area) => ({ value: area.id, label: area.name })),
    [filterOptions],
  )
  const containerOptions = useMemo(
    () =>
      (containers ?? [])
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name, 'es'))
        .map((container) => ({ value: container.id, label: container.name })),
    [containers],
  )

  const selectedList = useMemo(
    () =>
      [...selected.entries()]
        .map(([id, name]) => ({ id, name }))
        .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    [selected],
  )
  const pageIds = devices.map((device) => device.id)
  const pageFullySelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const overLimit = selected.size > MAX_DEVICES
  const layoutLabel = LAYOUTS.find((item) => item.id === layout)?.title ?? ''

  function toggle(device: Device) {
    setSelected((current) => {
      const next = new Map(current)
      if (next.has(device.id)) next.delete(device.id)
      else next.set(device.id, device.name)
      return next
    })
  }

  function togglePage() {
    setSelected((current) => {
      const next = new Map(current)
      if (pageFullySelected) {
        for (const id of pageIds) next.delete(id)
      } else {
        for (const device of devices) next.set(device.id, device.name)
      }
      return next
    })
  }

  async function selectFiltered() {
    setSelectingAll(true)
    try {
      const rows = await devicesService.getAll({
        search: debouncedSearch,
        summary: true,
        areaId: areaFilter || undefined,
        containerId: containerFilter || undefined,
      })
      const next = new Map(selected)
      for (const device of rows) next.set(device.id, device.name)
      if (next.size > MAX_DEVICES) {
        toast.error(
          'Demasiados equipos',
          'La planilla admite hasta 60 equipos. Afiná los filtros y volvé a seleccionar.',
        )
        return
      }
      setSelected(next)
    } catch {
      toast.error('No se pudo cargar los equipos')
    } finally {
      setSelectingAll(false)
    }
  }

  async function download() {
    if (selected.size === 0 || downloading) return
    if (selected.size > MAX_DEVICES) {
      toast.error(
        'Demasiados equipos',
        'La planilla admite hasta 60 equipos. Quitá algunos antes de descargar.',
      )
      return
    }
    setDownloading(true)
    try {
      await devicesService.downloadConnectionSheets([...selected.keys()], layout)
      toast.success('Planilla descargada', 'Se descargó conexiones-grupo.xlsx')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo descargar la planilla'
      toast.error('No se pudo descargar', message)
    } finally {
      setDownloading(false)
    }
  }

  const columns: Column<Device>[] = [
    {
      key: 'select',
      header: '',
      render: (device) => (
        <input
          type="checkbox"
          checked={selected.has(device.id)}
          onClick={(event) => event.stopPropagation()}
          onChange={() => toggle(device)}
          aria-label={`Incluir ${device.name}`}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
        />
      ),
    },
    {
      key: 'name',
      header: 'Equipo',
      render: (device) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{device.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">
            {[device.hostname, device.ipAddress].filter(Boolean).join(' · ') || 'Sin hostname ni IP'}
          </div>
        </div>
      ),
    },
    {
      key: 'location',
      header: 'Ubicación',
      render: (device) => (
        <span className="text-gray-500 dark:text-gray-400">{placeOf(device)}</span>
      ),
    },
    {
      key: 'deviceType',
      header: 'Tipo',
      render: (device) => (
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
          {device.deviceType?.name || '—'}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Planillas de conexión"
        subtitle="Elegí los equipos y descargá una planilla con todos."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {LAYOUTS.map((item) => {
          const active = layout === item.id
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => setLayout(item.id)}
              className={`rounded-xl border p-3 text-left transition-colors sm:p-4 ${
                active
                  ? 'border-blue-500 bg-blue-500/15 ring-1 ring-blue-500'
                  : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet
                  className={`h-4 w-4 ${active ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}
                />
                <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  {item.title}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{item.text}</p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, hostname o IP"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
        </div>
        <Select
          options={areaOptions}
          placeholder="Todas las áreas"
          value={areaFilter}
          onChange={(event) => {
            setAreaFilter(event.target.value)
            setContainerFilter('')
          }}
          className="w-full sm:w-52"
        />
        <Select
          options={containerOptions}
          placeholder="Todos los contenedores"
          value={containerFilter}
          onChange={(event) => setContainerFilter(event.target.value)}
          className="w-full sm:w-56"
        />
      </div>

      <DataTable
        columns={columns}
        data={devices}
        isLoading={isLoading}
        onRowClick={toggle}
        emptyMessage="No hay equipos con estos filtros."
      />

      <SheetPagination
        page={pageForRequest}
        total={total}
        perPage={PAGE_SIZE}
        disabled={isLoading}
        onPageChange={setPage}
      />

      <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-4 backdrop-blur dark:border-gray-800 dark:bg-gray-950/95 lg:-mx-6 lg:px-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {selected.size === 0
                  ? 'Ningún equipo seleccionado'
                  : `${selected.size} ${selected.size === 1 ? 'equipo' : 'equipos'}`}
                <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                  · {layoutLabel}
                </span>
              </p>
              {overLimit && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                  El máximo es {MAX_DEVICES} equipos.
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isLoading || devices.length === 0}
                onClick={togglePage}
              >
                {pageFullySelected ? 'Quitar esta página' : 'Agregar esta página'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                isLoading={selectingAll}
                disabled={isLoading}
                onClick={() => void selectFiltered()}
              >
                Seleccionar todos los filtrados
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={selected.size === 0}
                onClick={() => setSelected(new Map())}
              >
                Quitar selección
              </Button>
              <Button
                type="button"
                size="sm"
                icon={<Download className="h-4 w-4" />}
                isLoading={downloading}
                disabled={selected.size === 0 || overLimit}
                onClick={() => void download()}
              >
                Descargar
              </Button>
            </div>
          </div>
          {selectedList.length > 0 && (
            <div
              className="flex min-h-0 flex-wrap content-start gap-2 overflow-y-auto overscroll-contain"
              style={{ maxHeight: '6rem' }}
            >
              {selectedList.map((device) => (
                <button
                  key={device.id}
                  type="button"
                  onClick={() =>
                    setSelected((current) => {
                      const next = new Map(current)
                      next.delete(device.id)
                      return next
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  aria-label={`Quitar ${device.name}`}
                >
                  {device.name}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
