import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import { Button } from '../components/Button'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { Input } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { devicesService, type UpdateDevicePayload } from '../services/devices.service'
import { deviceTemplatesService } from '../services/device-templates.service'
import { sitesService } from '../services/sites.service'
import { containersService } from '../services/containers.service'
import type { Container, Device, DeviceRelocationImpact, DeviceTemplate, Site } from '../types'
import { formatLinkCode } from '../utils/diagram/linkLabel'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

interface DeviceFormState {
  name: string
  deviceTemplateId: string
  hostname: string
  ipAddress: string
  macAddress: string
  serialNumber: string
  firmwareVersion: string
  siteId: string
  areaId: string
  containerId: string
  notes: string
}

const initialFormState: DeviceFormState = {
  name: '',
  deviceTemplateId: '',
  hostname: '',
  ipAddress: '',
  macAddress: '',
  serialNumber: '',
  firmwareVersion: '',
  siteId: '',
  areaId: '',
  containerId: '',
  notes: '',
}

function templateSearchText(template: DeviceTemplate): string {
  return [template.name, template.manufacturer, template.model, template.deviceType?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function templateMeta(template: DeviceTemplate): string {
  return [template.deviceType?.name, template.manufacturer, template.model].filter(Boolean).join(' · ')
}

function TemplatePicker({
  templates,
  loading,
  value,
  onChange,
}: {
  templates: DeviceTemplate[] | null
  loading: boolean
  value: string
  onChange: (templateId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [typeId, setTypeId] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const selected = useMemo(
    () => templates?.find((template) => template.id === value) ?? null,
    [templates, value],
  )

  const typeOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const template of templates ?? []) {
      const id = template.deviceTypeId
      const name = template.deviceType?.name?.trim()
      if (id && name) byId.set(id, name)
    }
    return [...byId.entries()]
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [templates])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (templates ?? [])
      .filter((template) => !typeId || template.deviceTypeId === typeId)
      .filter((template) => !q || templateSearchText(template).includes(q))
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
  }, [templates, query, typeId])

  useEffect(() => {
    if (!open) return
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus())
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const catalogEmpty = !loading && (!templates || templates.length === 0)
  const closedLabel = loading
    ? 'Cargando templates...'
    : catalogEmpty
      ? 'No hay templates. Créalos en Configuración.'
      : selected?.name || 'Selecciona un template'

  return (
    <div ref={rootRef} className="relative space-y-1.5">
      <label id="template-picker-label" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Template
      </label>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-labelledby="template-picker-label"
        disabled={loading || catalogEmpty}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-left focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 disabled:opacity-60"
      >
        <span className={selected ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}>
          {closedLabel}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {selected
          ? 'Listo. Abajo completá el nombre y los datos de este equipo.'
          : 'Abrí la lista, buscá el modelo y hacé clic para elegirlo.'}
      </p>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl">
          <div className="space-y-3 border-b border-gray-200 dark:border-gray-800 p-3">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              Buscá y elegí un modelo del catálogo
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nombre, fabricante o modelo"
                aria-label="Buscar template"
                className="w-full pl-10 pr-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500"
              />
            </div>
            <Select
              label="Filtrar por tipo"
              value={typeId}
              onChange={(event) => setTypeId(event.target.value)}
              options={typeOptions}
              placeholder="Todos los tipos"
            />
          </div>
          <div className="max-h-64 overflow-y-auto" role="listbox" aria-label="Templates">
            {filtered.length === 0 ? (
              <p className="px-3.5 py-6 text-sm text-center text-gray-500 dark:text-gray-400">
                Ningún template coincide. Probá con otro nombre o tipo.
              </p>
            ) : (
              filtered.map((template) => {
                const isSelected = template.id === value
                const meta = templateMeta(template)
                return (
                  <button
                    key={template.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(template.id)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-sm border-b border-gray-100 dark:border-gray-800 last:border-b-0 ${
                      isSelected
                        ? 'bg-blue-50 text-blue-800 dark:bg-blue-500/15 dark:text-blue-100'
                        : 'text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block font-medium truncate">{template.name}</span>
                      {meta && (
                        <span className="block text-xs text-gray-500 dark:text-gray-400 truncate">{meta}</span>
                      )}
                    </span>
                    {isSelected && <Check className="h-4 w-4 shrink-0" />}
                  </button>
                )
              })
            )}
          </div>
          <p className="border-t border-gray-200 dark:border-gray-800 px-3.5 py-2 text-xs text-gray-500 dark:text-gray-400">
            {filtered.length} de {templates?.length ?? 0}
          </p>
        </div>
      )}
    </div>
  )
}

function containerSelectLabel(c: Container): string {
  if (c.kind === 'rack') return `${c.name} (Rack)`
  if (c.kind === 'board') return `${c.name} (Tablero)`
  return c.name
}

function normalizeDeviceName(name: string): string {
  return name.trim().toLowerCase()
}

function formatApiError(error: unknown, fallback: string): string {
  const err = error as { response?: { data?: { message?: string } }; message?: string }
  return err?.response?.data?.message || err?.message || fallback
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default function DeviceCreate() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { activeProjectId } = useProject()
  const { isViewer } = usePermissions()
  const isEditMode = Boolean(id)
  const { data: existingDevice, isLoading: isLoadingDevice } = useApi(
    () => (id ? devicesService.getById(id) : Promise.resolve(null)),
    [id]
  )
  const { data: allTemplates, isLoading: templatesLoading } = useApi<DeviceTemplate[]>(
    () => deviceTemplatesService.getAll(),
    []
  )
  const { data: sites } = useApi<Site[]>(() => sitesService.getAll(), [activeProjectId])
  const { data: projectDevices } = useApi<Device[]>(
    () => devicesService.getAll({ summary: true }),
    [activeProjectId]
  )

  const templates = useMemo(() => {
    if (!allTemplates) return null
    if (isViewer) {
      return allTemplates.filter((t) =>
        NOTEBOOK_NAMES.includes((t.deviceType?.name ?? '').toLowerCase())
      )
    }
    return allTemplates
  }, [allTemplates, isViewer])

  const preselectedTemplate = searchParams.get('template')
  const [form, setForm] = useState(() => ({
    ...initialFormState,
    ...(preselectedTemplate ? { deviceTemplateId: preselectedTemplate } : {}),
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [relocateConfirm, setRelocateConfirm] = useState<{
    impact: DeviceRelocationImpact
    payload: UpdateDevicePayload
  } | null>(null)

  const isLocationLocked = Boolean(
    existingDevice?.rackUnitStart != null ||
      existingDevice?.boardRow != null ||
      existingDevice?.supportedByAccessoryId
  )

  const selectedTemplate = useMemo(
    () => templates?.find((t) => t.id === form.deviceTemplateId) ?? null,
    [templates, form.deviceTemplateId]
  )

  const selectedSite = useMemo(
    () => sites?.find((s) => s.id === form.siteId) ?? null,
    [sites, form.siteId]
  )

  const areaOptions = useMemo(() => {
    const list = selectedSite?.areas ?? []
    return list.map((a) => ({ value: a.id, label: a.name }))
  }, [selectedSite])

  const { data: containers } = useApi<Container[]>(
    () =>
      form.areaId
        ? containersService.getAll({ areaId: form.areaId })
        : Promise.resolve([]),
    [activeProjectId, form.areaId]
  )

  const containerOptions = useMemo(() => {
    return (containers || [])
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map((c) => ({ value: c.id, label: containerSelectLabel(c) }))
  }, [containers])

  const templateHeightU = Math.max(
    1,
    selectedTemplate?.rackUnits ?? existingDevice?.deviceTemplate?.rackUnits ?? 1
  )

  useEffect(() => {
    if (!existingDevice) {
      return
    }

    setForm({
      name: existingDevice.name ?? '',
      deviceTemplateId: existingDevice.deviceTemplateId ?? '',
      hostname: existingDevice.hostname ?? '',
      ipAddress: existingDevice.ipAddress ?? '',
      macAddress: existingDevice.macAddress ?? '',
      serialNumber: existingDevice.serialNumber ?? '',
      firmwareVersion: existingDevice.firmwareVersion ?? '',
      siteId: existingDevice.siteId ?? '',
      areaId: existingDevice.areaId ?? '',
      containerId: existingDevice.containerId ?? '',
      notes: existingDevice.notes ?? '',
    })
  }, [existingDevice])

  const manufacturerModel = isEditMode
    ? [existingDevice?.manufacturer, existingDevice?.model].filter(Boolean).join(' ') || '—'
    : [selectedTemplate?.manufacturer, selectedTemplate?.model].filter(Boolean).join(' ') || '—'

  const typeLabel = isEditMode
    ? existingDevice?.deviceType?.name || '—'
    : selectedTemplate?.deviceType?.name || '—'

  const deviceTypeId = isEditMode
    ? existingDevice?.deviceTypeId
    : selectedTemplate?.deviceTypeId

  const duplicateNameWarning = useMemo(() => {
    const typed = form.name.trim()
    if (!typed || !deviceTypeId || !projectDevices) return null
    if (isEditMode && normalizeDeviceName(typed) === normalizeDeviceName(existingDevice?.name ?? '')) {
      return null
    }
    const clash = projectDevices.find(
      (device) =>
        device.id !== id &&
        device.deviceTypeId === deviceTypeId &&
        normalizeDeviceName(device.name) === normalizeDeviceName(typed)
    )
    if (!clash) return null
    const label = typeLabel !== '—' ? typeLabel : 'este tipo'
    return `Ya existe un dispositivo de tipo "${label}" con el nombre "${clash.name}". Elegí otro nombre.`
  }, [form.name, deviceTypeId, projectDevices, isEditMode, existingDevice?.name, id, typeLabel])

  const buildDevicePayload = (): UpdateDevicePayload => {
    const identityFields = {
      name: form.name.trim(),
      hostname: form.hostname.trim() || undefined,
      ipAddress: form.ipAddress.trim() || undefined,
      macAddress: form.macAddress.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      firmwareVersion: form.firmwareVersion.trim() || undefined,
      notes: form.notes.trim() || undefined,
    }

    if (isEditMode && isLocationLocked) {
      return identityFields
    }

    const locationFields = {
      siteId: form.siteId || null,
      areaId: form.areaId || null,
      containerId: form.containerId || null,
    }

    if (isEditMode) {
      return { ...identityFields, ...locationFields }
    }

    return {
      ...identityFields,
      ...locationFields,
      rackUnitStart: null,
      rackFace: null,
      supportedByAccessoryId: null,
      shelfSlotStart: null,
      shelfWidthSlots: null,
      shelfHeightU: null,
      boardRow: null,
      boardCol: null,
      boardRowSpan: null,
      boardColSpan: null,
    }
  }

  const persistDevice = async (payload: UpdateDevicePayload, confirmDiagramRelocate = false) => {
    const body = confirmDiagramRelocate
      ? { ...payload, confirmDiagramRelocate: true }
      : payload

    if (id) {
      await devicesService.update(id, body)
    } else {
      await devicesService.create({
        projectId: activeProjectId || user!.projectId,
        deviceTemplateId: form.deviceTemplateId,
        ...body,
      })
    }
    navigate('/devices')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!user) {
      setFormError('Tu sesión ha caducado. Vuelve a iniciar sesión.')
      return
    }

    if (!form.name.trim()) {
      setFormError('El nombre del dispositivo es obligatorio.')
      return
    }

    if (duplicateNameWarning) {
      setFormError(duplicateNameWarning)
      return
    }

    if (!isEditMode && !form.deviceTemplateId) {
      setFormError('Debes seleccionar un template.')
      return
    }

    if (form.areaId && !form.siteId) {
      setFormError('Selecciona un sitio cuando asignas un área.')
      return
    }

    if (form.containerId && !form.areaId) {
      setFormError('Selecciona un área cuando asignas un contenedor.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = buildDevicePayload()

      const locationPathChanged =
        isEditMode &&
        !isLocationLocked &&
        existingDevice &&
        (form.siteId !== (existingDevice.siteId ?? '') ||
          form.areaId !== (existingDevice.areaId ?? '') ||
          form.containerId !== (existingDevice.containerId ?? ''))

      if (locationPathChanged && id) {
        const impact = await devicesService.getRelocationImpact(
          id,
          form.areaId || null,
          form.containerId || null,
        )
        if (impact.requiresConfirmation) {
          setRelocateConfirm({ impact, payload })
          return
        }
      }

      await persistDevice(payload)
    } catch (error: unknown) {
      const err = error as {
        response?: {
          status?: number
          data?: { code?: string; impact?: DeviceRelocationImpact; message?: string }
        }
        message?: string
      }
      if (
        err.response?.status === 409 &&
        err.response.data?.code === 'DIAGRAM_RELOCATION_REQUIRED' &&
        err.response.data.impact
      ) {
        setRelocateConfirm({
          impact: err.response.data.impact,
          payload: buildDevicePayload(),
        })
        return
      }
      setFormError(
        formatApiError(
          error,
          `No se pudo ${isEditMode ? 'actualizar' : 'crear'} el dispositivo`
        )
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmRelocate = async () => {
    if (!relocateConfirm) return
    setIsSubmitting(true)
    try {
      await persistDevice(relocateConfirm.payload, true)
      setRelocateConfirm(null)
    } catch (error: unknown) {
      setFormError(
        formatApiError(error, 'No se pudo mover el dispositivo')
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const relocateDescription = useMemo(() => {
    if (!relocateConfirm) return null
    const { impact } = relocateConfirm
    const deviceLabel = form.name.trim() || existingDevice?.name || 'Equipo'
    const mode = impact.mode ?? 'purge'
    const fromPath = [impact.fromAreaName, impact.fromContainerName].filter(Boolean).join(' › ')
    const toPath = [impact.toAreaName, impact.toContainerName].filter(Boolean).join(' › ')
    const fromLabel = fromPath || impact.fromAreaName || 'sin ubicación'
    const toLabel = toPath || impact.toAreaName || 'sin ubicación'
    const placementLines = impact.placements.map(
      (p) =>
        `«${p.diagramName}» (${p.areaName ?? 'sin área'} · ${p.containerLabel})`,
    )
    const hasLinks = impact.linkCodes.length > 0
    const codesStr =
      impact.linkCodes.length <= 8
        ? impact.linkCodes.map((c) => formatLinkCode(c)).join(', ')
        : impact.linkCodes
            .slice(0, 8)
            .map((c) => formatLinkCode(c))
            .join(', ') + ` y ${impact.linkCodes.length - 8} más`

    if (mode === 'reparent') {
      return (
        <span className="block space-y-2">
          <span className="block">
            Se modificará la ruta de «{deviceLabel}»: <strong>{fromLabel}</strong> →{' '}
            <strong>{toLabel}</strong>.
          </span>
          <span className="block">
            El diagrama se actualizará para coincidir con la nueva ubicación
            {placementLines.length > 0
              ? ` (${placementLines.length === 1 ? placementLines[0] : `${placementLines.length} diagramas`})`
              : ''}
            . Los enlaces se conservan.
          </span>
          <span className="block">¿Deseás continuar?</span>
        </span>
      )
    }

    return (
      <span className="block space-y-2">
        <span className="block">
          «{deviceLabel}» está colocado en{' '}
          {placementLines.length === 1
            ? placementLines[0]
            : `${placementLines.length} diagramas (${placementLines.join('; ')})`}
          .
        </span>
        <span className="block">
          Al moverlo a <strong>{toLabel}</strong> se sacará del diagrama (cambio de área).
        </span>
        {hasLinks ? (
          <span className="block font-medium text-red-600 dark:text-red-400">
            Se eliminarán {impact.linkCodes.length} enlace(s) ({codesStr}) del{' '}
            <strong>proyecto completo</strong>.
          </span>
        ) : null}
        <span className="block">¿Deseás continuar?</span>
      </span>
    )
  }, [relocateConfirm, form.name, existingDevice?.name])

  const backToList = () => navigate('/devices')

  if (isEditMode && isLoadingDevice && !existingDevice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const templateLabel =
    existingDevice?.deviceTemplate?.name ||
    selectedTemplate?.name ||
    [existingDevice?.manufacturer, existingDevice?.model].filter(Boolean).join(' ') ||
    existingDevice?.deviceType?.name ||
    '—'

  const showTemplateDetails = isEditMode || Boolean(selectedTemplate)

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? 'Editar dispositivo' : 'Agregar dispositivo'}
        subtitle={
          isEditMode
            ? 'Actualiza la identidad operativa y la ubicación del equipo'
            : 'Instancia un equipo desde un template e identifica su ubicación operativa'
        }
        actions={
          <Button variant="ghost" onClick={backToList} size="sm">
            Cancelar
          </Button>
        }
      />

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <form className="space-y-8" onSubmit={handleSubmit}>
          <FormSection
            title="1. Elegí el modelo"
            description="Es el único dato que sale del catálogo. El resto lo completás vos para este equipo."
          >
            <div className="max-w-xl space-y-3">
              {isEditMode ? (
                <Input label="Template" value={templateLabel} disabled />
              ) : (
                <TemplatePicker
                  templates={templates}
                  loading={templatesLoading}
                  value={form.deviceTemplateId}
                  onChange={(deviceTemplateId) => {
                    setFormError(null)
                    setForm((prev) => ({ ...prev, deviceTemplateId }))
                  }}
                />
              )}
              {showTemplateDetails && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40 px-3.5 py-3 text-sm">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Viene del catálogo
                  </p>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">
                    {typeLabel}
                    {manufacturerModel !== '—' ? ` · ${manufacturerModel}` : ''}
                    {` · ${templateHeightU}U`}
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Tipo, marca y altura no se editan acá. La altura define cuántas U ocupa al montarlo.
                  </p>
                </div>
              )}
            </div>
          </FormSection>

          <FormSection
            title="2. Datos de este equipo"
            description="Nombre y datos de red de esta instancia. El nombre es obligatorio."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Nombre"
                  value={form.name}
                  onChange={(event) => {
                    setFormError(null)
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }}
                  required
                  error={duplicateNameWarning ?? undefined}
                />
              </div>
              <Input
                label="Dirección IP"
                value={form.ipAddress}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, ipAddress: event.target.value }))
                }
                placeholder="ej. 192.168.1.10"
                hint="Opcional. IP de gestión de esta instancia."
              />
              <Input
                label="Hostname"
                value={form.hostname}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, hostname: event.target.value }))
                }
                placeholder="ej. sw-oficina-01"
                hint="Nombre DNS/red de este equipo (opcional). No viene del template."
              />
              <Input
                label="MAC Address"
                value={form.macAddress}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, macAddress: event.target.value }))
                }
              />
              <Input
                label="Número de serie"
                value={form.serialNumber}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, serialNumber: event.target.value }))
                }
              />
              <Input
                label="Versión de firmware"
                value={form.firmwareVersion}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, firmwareVersion: event.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notas
              </label>
              <textarea
                className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-vertical min-h-[120px]"
                value={form.notes}
                onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                rows={4}
              />
            </div>
          </FormSection>

          <FormSection
            title="3. Dónde está"
            description="Opcional. Sitio, área y contenedor donde se documenta el equipo."
          >
            {isLocationLocked && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                El montaje físico (U / celda / bandeja) se gestiona desde el diagrama o Racks.
              </p>
            )}
            {!isLocationLocked && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Elegí el contenedor como ubicación documentada. El montaje preciso en U o celda se
                hace desde el diagrama.
              </p>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Select
                label="Sitio"
                value={form.siteId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    siteId: event.target.value,
                    areaId: '',
                    containerId: '',
                  }))
                }
                options={[
                  { value: '', label: 'Sin sitio' },
                  ...(sites || []).map((s) => ({ value: s.id, label: s.name })),
                ]}
                placeholder="Selecciona un sitio"
                disabled={isLocationLocked}
              />
              <Select
                label="Área"
                value={form.areaId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    areaId: event.target.value,
                    containerId: '',
                  }))
                }
                options={[{ value: '', label: 'Sin área' }, ...areaOptions]}
                placeholder={form.siteId ? 'Selecciona un área' : 'Primero elige un sitio'}
                disabled={isLocationLocked || !form.siteId}
              />
              <Select
                label="Contenedor"
                value={form.containerId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    containerId: event.target.value,
                  }))
                }
                options={[{ value: '', label: 'Sin contenedor' }, ...containerOptions]}
                placeholder={
                  form.areaId ? 'Selecciona un contenedor' : 'Primero elige un área'
                }
                disabled={isLocationLocked || !form.areaId}
              />
            </div>
          </FormSection>

          {duplicateNameWarning && (
            <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
              {duplicateNameWarning}
            </p>
          )}
          {formError && formError !== duplicateNameWarning && (
            <p className="text-sm text-red-500" role="alert">
              {formError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="md" onClick={backToList} type="button">
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={
                isSubmitting ||
                !form.name.trim() ||
                (!isEditMode && !form.deviceTemplateId) ||
                Boolean(duplicateNameWarning)
              }
            >
              {isEditMode ? 'Actualizar dispositivo' : 'Guardar dispositivo'}
            </Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        isOpen={Boolean(relocateConfirm)}
        onClose={() => {
          if (!isSubmitting) setRelocateConfirm(null)
        }}
        onConfirm={handleConfirmRelocate}
        title={`Mover «${form.name.trim() || existingDevice?.name || 'Equipo'}»`}
        description={relocateDescription}
        confirmLabel={
          relocateConfirm?.impact.mode === 'purge' && relocateConfirm.impact.linkCodes.length
            ? 'Mover y eliminar enlaces'
            : relocateConfirm?.impact.mode === 'reparent'
              ? 'Actualizar ruta'
              : 'Mover igualmente'
        }
        variant={relocateConfirm?.impact.mode === 'purge' ? 'danger' : 'primary'}
        isLoading={isSubmitting}
      />
    </div>
  )
}
