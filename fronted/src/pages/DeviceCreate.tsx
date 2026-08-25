import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
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
import type { Container, DeviceRelocationImpact, DeviceTemplate, Site } from '../types'
import { formatLinkCode } from '../utils/diagram/linkLabel'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

const statusOptions = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unknown', label: 'Unknown' },
]

interface DeviceFormState {
  name: string
  deviceTemplateId: string
  status: 'online' | 'offline' | 'maintenance' | 'unknown'
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
  status: 'unknown',
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

function containerSelectLabel(c: Container): string {
  if (c.kind === 'rack') return `${c.name} (Rack)`
  if (c.kind === 'board') return `${c.name} (Tablero)`
  return c.name
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
      status: existingDevice.status ?? 'unknown',
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

  const buildDevicePayload = (): UpdateDevicePayload => {
    const identityFields = {
      name: form.name.trim(),
      hostname: form.hostname.trim() || undefined,
      ipAddress: form.ipAddress.trim() || undefined,
      macAddress: form.macAddress.trim() || undefined,
      serialNumber: form.serialNumber.trim() || undefined,
      firmwareVersion: form.firmwareVersion.trim() || undefined,
      status: form.status,
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
            title="Del template"
            description="Datos del catálogo; no se editan en la instancia."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {isEditMode ? (
                <Input label="Template" value={templateLabel} disabled />
              ) : (
                <Select
                  label="Template"
                  value={form.deviceTemplateId}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      deviceTemplateId: event.target.value,
                    }))
                  }
                  options={(templates || []).map((tpl) => ({
                    value: tpl.id,
                    label: `${tpl.name}${tpl.deviceType?.name ? ` (${tpl.deviceType.name})` : ''}`,
                  }))}
                  placeholder={
                    templatesLoading
                      ? 'Cargando templates...'
                      : templates && templates.length === 0
                        ? 'No hay templates — créalos en Configuración'
                        : 'Selecciona un template'
                  }
                  disabled={templatesLoading || !(templates && templates.length > 0)}
                  required
                />
              )}
              {showTemplateDetails && (
                <>
                  <Input label="Tipo (del template)" value={typeLabel} disabled />
                  <Input label="Fabricante / Modelo" value={manufacturerModel} disabled />
                  <Input
                    label="Altura en rack"
                    value={`${templateHeightU}U`}
                    disabled
                    hint="Definida por el template; determina cuántas U ocupa al montar."
                  />
                </>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Identidad operativa"
            description="Datos de este equipo concreto (no vienen del template)."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                required
              />
              <Select
                label="Estado"
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    status: event.target.value as DeviceFormState['status'],
                  }))
                }
                options={statusOptions}
              />
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
            title="Ubicación"
            description="Sitio, área y contenedor donde se documenta el equipo."
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

          {formError && (
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
                (!isEditMode && !form.deviceTemplateId)
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
