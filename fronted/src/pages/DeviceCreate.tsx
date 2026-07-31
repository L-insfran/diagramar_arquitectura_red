import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { Select } from '../components/Select'
import { RackUnitPicker } from '../components/racks/RackUnitPicker'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { devicesService } from '../services/devices.service'
import { deviceTemplatesService } from '../services/device-templates.service'
import { sitesService } from '../services/sites.service'
import { racksService } from '../services/racks.service'
import type { DeviceTemplate, Rack, RackFace, RackOccupancy, Site } from '../types'
import { canPlaceAt, occupiedRangesForFace } from '../utils/rackPlacement'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

const statusOptions = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unknown', label: 'Unknown' },
]

const faceOptions = [
  { value: 'front', label: 'Frontal' },
  { value: 'rear', label: 'Trasera' },
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
  rackId: string
  rackUnitStart: string
  rackFace: 'front' | 'rear' | ''
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
  rackId: '',
  rackUnitStart: '',
  rackFace: 'front',
  notes: '',
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
  const { data: racks } = useApi<Rack[]>(() => racksService.getAll(), [activeProjectId])

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
  const [occupancy, setOccupancy] = useState<RackOccupancy | null>(null)
  const [occupancyLoading, setOccupancyLoading] = useState(false)
  const [occupancyError, setOccupancyError] = useState<string | null>(null)

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

  const rackOptions = useMemo(() => {
    const list = (racks || []).filter((r) => {
      if (form.areaId) return r.areaId === form.areaId
      if (form.siteId) return r.area?.siteId === form.siteId || r.area?.site?.id === form.siteId
      return true
    })
    return list.map((r) => ({
      value: r.id,
      label: `${r.name} (${r.heightU}U)`,
    }))
  }, [racks, form.areaId, form.siteId])

  const selectedRack = useMemo(
    () => racks?.find((r) => r.id === form.rackId) ?? null,
    [racks, form.rackId]
  )

  const templateHeightU = Math.max(
    1,
    selectedTemplate?.rackUnits ?? existingDevice?.deviceTemplate?.rackUnits ?? 1
  )

  const activeFace: RackFace = form.rackFace === 'rear' ? 'rear' : 'front'
  const parsedUnit = form.rackUnitStart.trim()
    ? Number.parseInt(form.rackUnitStart, 10)
    : null

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
      rackId: existingDevice.rackId ?? '',
      rackUnitStart:
        existingDevice.rackUnitStart != null ? String(existingDevice.rackUnitStart) : '',
      rackFace: existingDevice.rackFace ?? 'front',
      notes: existingDevice.notes ?? '',
    })
  }, [existingDevice])

  useEffect(() => {
    if (!form.rackId) {
      setOccupancy(null)
      setOccupancyError(null)
      setOccupancyLoading(false)
      return
    }

    let cancelled = false
    setOccupancyLoading(true)
    setOccupancyError(null)

    racksService
      .getOccupancy(form.rackId)
      .then((data) => {
        if (!cancelled) setOccupancy(data)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setOccupancy(null)
          setOccupancyError(formatApiError(error, 'No se pudo cargar la ocupación del rack'))
        }
      })
      .finally(() => {
        if (!cancelled) setOccupancyLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [form.rackId])

  // Clear invalid U when face, height, or occupancy changes
  useEffect(() => {
    if (!form.rackId || !occupancy) return
    setForm((prev) => {
      if (!prev.rackId || !prev.rackUnitStart.trim()) return prev
      const unit = Number.parseInt(prev.rackUnitStart, 10)
      if (Number.isNaN(unit)) return { ...prev, rackUnitStart: '' }
      const face: RackFace = prev.rackFace === 'rear' ? 'rear' : 'front'
      const check = canPlaceAt({
        start: unit,
        heightU: templateHeightU,
        rackHeightU: occupancy.heightU,
        occupied: occupiedRangesForFace(occupancy, face, id),
      })
      return check.ok ? prev : { ...prev, rackUnitStart: '' }
    })
  }, [form.rackId, activeFace, occupancy, templateHeightU, id])

  const manufacturerModel = isEditMode
    ? [existingDevice?.manufacturer, existingDevice?.model].filter(Boolean).join(' ') || '—'
    : [selectedTemplate?.manufacturer, selectedTemplate?.model].filter(Boolean).join(' ') || '—'

  const typeLabel = isEditMode
    ? existingDevice?.deviceType?.name || '—'
    : selectedTemplate?.deviceType?.name || '—'

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

    if (form.rackId && !form.rackUnitStart.trim()) {
      setFormError('Seleccioná la U de inicio en el rack.')
      return
    }

    const unit = form.rackId ? Number.parseInt(form.rackUnitStart, 10) : null
    if (form.rackId && (unit == null || Number.isNaN(unit) || unit < 1)) {
      setFormError('La U de inicio debe ser un número ≥ 1.')
      return
    }

    if (form.rackId && occupancy && unit != null) {
      const check = canPlaceAt({
        start: unit,
        heightU: templateHeightU,
        rackHeightU: occupancy.heightU,
        occupied: occupiedRangesForFace(occupancy, activeFace, id),
      })
      if (!check.ok) {
        setFormError(check.reason)
        return
      }
    }

    try {
      setIsSubmitting(true)
      const payload = {
        name: form.name.trim(),
        hostname: form.hostname.trim() || undefined,
        ipAddress: form.ipAddress.trim() || undefined,
        macAddress: form.macAddress.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        firmwareVersion: form.firmwareVersion.trim() || undefined,
        siteId: form.siteId || null,
        areaId: form.areaId || null,
        rackId: form.rackId || null,
        rackUnitStart: form.rackId ? unit : null,
        rackFace: form.rackId ? activeFace : null,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }

      if (id) {
        await devicesService.update(id, payload)
      } else {
        await devicesService.create({
          projectId: activeProjectId || user!.projectId,
          deviceTemplateId: form.deviceTemplateId,
          ...payload,
        })
      }
      navigate('/devices')
    } catch (error: unknown) {
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
                      // U may become invalid if height changes
                      rackUnitStart: prev.rackId ? '' : prev.rackUnitStart,
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
            description="Sitio, área y montaje en rack (frontal o trasera)."
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Select
                label="Sitio"
                value={form.siteId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    siteId: event.target.value,
                    areaId: '',
                    rackId: '',
                    rackUnitStart: '',
                  }))
                }
                options={[
                  { value: '', label: 'Sin sitio' },
                  ...(sites || []).map((s) => ({ value: s.id, label: s.name })),
                ]}
                placeholder="Selecciona un sitio"
                disabled={Boolean(form.rackId)}
              />
              <Select
                label="Área"
                value={form.areaId}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    areaId: event.target.value,
                    rackId: '',
                    rackUnitStart: '',
                  }))
                }
                options={[{ value: '', label: 'Sin área' }, ...areaOptions]}
                placeholder={form.siteId ? 'Selecciona un área' : 'Primero elige un sitio'}
                disabled={!form.siteId || Boolean(form.rackId)}
              />
              <Select
                label="Rack"
                value={form.rackId}
                onChange={(event) => {
                  const rackId = event.target.value
                  const rack = racks?.find((r) => r.id === rackId)
                  setForm((prev) => ({
                    ...prev,
                    rackId,
                    rackUnitStart: '',
                    rackFace: rackId ? prev.rackFace || 'front' : '',
                    siteId: rack?.area?.siteId || rack?.area?.site?.id || prev.siteId,
                    areaId: rack?.areaId || prev.areaId,
                  }))
                }}
                options={[{ value: '', label: 'Sin rack' }, ...rackOptions]}
                placeholder="Opcional"
              />
              {form.rackId && (
                <>
                  <Select
                    label="Cara"
                    value={form.rackFace || 'front'}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        rackFace: event.target.value as 'front' | 'rear',
                        rackUnitStart: '',
                      }))
                    }
                    options={faceOptions}
                    hint="Frontal y trasera son caras independientes; un equipo no se pisa con otro de la cara opuesta."
                  />
                  {selectedRack && (
                    <Input
                      label="Capacidad rack"
                      value={`${selectedRack.heightU}U`}
                      disabled
                    />
                  )}
                </>
              )}
            </div>

            {form.rackId && (
              <div className="mt-2">
                {occupancyLoading && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Cargando ocupación del rack…
                  </p>
                )}
                {occupancyError && (
                  <p className="text-sm text-red-500" role="alert">
                    {occupancyError}
                  </p>
                )}
                {!occupancyLoading && occupancy && (
                  <RackUnitPicker
                    occupancy={occupancy}
                    face={activeFace}
                    heightU={templateHeightU}
                    value={
                      parsedUnit != null && !Number.isNaN(parsedUnit) ? parsedUnit : null
                    }
                    excludeDeviceId={id}
                    onChange={(unit) =>
                      setForm((prev) => ({ ...prev, rackUnitStart: String(unit) }))
                    }
                  />
                )}
              </div>
            )}
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
    </div>
  )
}
