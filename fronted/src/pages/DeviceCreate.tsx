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
import { rackAccessoriesService } from '../services/rackAccessories.service'
import type {
  DeviceTemplate,
  Rack,
  RackAccessory,
  RackFace,
  RackOccupancy,
  Site,
} from '../types'
import { canPlaceAt, canPlaceFullDepthAt, occupiedRangesForFace } from '../utils/rackPlacement'

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

const mountModeOptions = [
  { value: 'none', label: 'Sin montaje en rack' },
  { value: 'rail', label: 'Montaje en rieles (U)' },
  { value: 'shelf', label: 'Apoyado en bandeja' },
]

type MountMode = 'none' | 'rail' | 'shelf'

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
  mountMode: MountMode
  rackId: string
  rackUnitStart: string
  rackFace: 'front' | 'rear' | 'both' | ''
  supportedByAccessoryId: string
  shelfWidthSlots: '1' | '3'
  shelfSlotStart: string
  shelfHeightU: string
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
  mountMode: 'none',
  rackId: '',
  rackUnitStart: '',
  rackFace: 'front',
  supportedByAccessoryId: '',
  shelfWidthSlots: '1',
  shelfSlotStart: '0',
  shelfHeightU: '',
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
  const isFullDepth = !!(
    selectedTemplate?.isFullDepth ?? existingDevice?.deviceTemplate?.isFullDepth
  )

  const shelfHeightUValue = useMemo(() => {
    const parsed = Number.parseInt(form.shelfHeightU, 10)
    if (!Number.isNaN(parsed) && parsed >= 1) return Math.min(20, parsed)
    return templateHeightU
  }, [form.shelfHeightU, templateHeightU])

  const activeFace: RackFace = form.rackFace === 'rear' ? 'rear' : 'front'
  const mountFace = isFullDepth
    ? ('both' as const)
    : form.rackFace === 'rear'
      ? ('rear' as const)
      : ('front' as const)
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
      mountMode: existingDevice.supportedByAccessoryId
        ? 'shelf'
        : existingDevice.rackId
          ? 'rail'
          : 'none',
      rackId: existingDevice.rackId ?? '',
      rackUnitStart:
        existingDevice.rackUnitStart != null ? String(existingDevice.rackUnitStart) : '',
      rackFace: existingDevice.rackFace ?? 'front',
      supportedByAccessoryId: existingDevice.supportedByAccessoryId ?? '',
      shelfWidthSlots:
        existingDevice.shelfWidthSlots === 3 ? '3' : '1',
      shelfSlotStart:
        existingDevice.shelfSlotStart != null ? String(existingDevice.shelfSlotStart) : '0',
      shelfHeightU:
        existingDevice.shelfHeightU != null
          ? String(existingDevice.shelfHeightU)
          : existingDevice.deviceTemplate?.rackUnits != null
            ? String(existingDevice.deviceTemplate.rackUnits)
            : '',
      notes: existingDevice.notes ?? '',
    })
  }, [existingDevice])

  useEffect(() => {
    if ((form.mountMode !== 'rail' && form.mountMode !== 'shelf') || !form.rackId) {
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
  }, [form.rackId, form.mountMode])

  const shelfRackId = form.mountMode === 'shelf' ? form.rackId : ''
  const { data: shelves } = useApi<RackAccessory[]>(
    () =>
      shelfRackId
        ? rackAccessoriesService.getAll({ rackId: shelfRackId, kind: 'shelf' })
        : Promise.resolve([]),
    [shelfRackId, activeProjectId]
  )

  // Clear invalid U when face, height, or occupancy changes
  useEffect(() => {
    if (form.mountMode !== 'rail' || !form.rackId || !occupancy) return
    setForm((prev) => {
      if (prev.mountMode !== 'rail' || !prev.rackId || !prev.rackUnitStart.trim()) return prev
      const unit = Number.parseInt(prev.rackUnitStart, 10)
      if (Number.isNaN(unit)) return { ...prev, rackUnitStart: '' }
      const check = isFullDepth
        ? canPlaceFullDepthAt({
            start: unit,
            heightU: templateHeightU,
            rackHeightU: occupancy.heightU,
            occupancy,
            excludeDeviceId: id,
          })
        : canPlaceAt({
            start: unit,
            heightU: templateHeightU,
            rackHeightU: occupancy.heightU,
            occupied: occupiedRangesForFace(
              occupancy,
              prev.rackFace === 'rear' ? 'rear' : 'front',
              id
            ),
          })
      return check.ok ? prev : { ...prev, rackUnitStart: '' }
    })
  }, [form.mountMode, form.rackId, activeFace, occupancy, templateHeightU, id, isFullDepth])

  // Force both faces when template is full-depth
  useEffect(() => {
    if (!isFullDepth) return
    setForm((prev) => (prev.rackFace === 'both' ? prev : { ...prev, rackFace: 'both' }))
  }, [isFullDepth])

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

    if (form.mountMode === 'rail') {
      if (!form.rackId) {
        setFormError('Seleccioná un rack para el montaje en rieles.')
        return
      }
      if (!form.rackUnitStart.trim()) {
        setFormError('Seleccioná la U de inicio en el rack.')
        return
      }
      const unit = Number.parseInt(form.rackUnitStart, 10)
      if (Number.isNaN(unit) || unit < 1) {
        setFormError('La U de inicio debe ser un número ≥ 1.')
        return
      }
      if (occupancy) {
        const check = isFullDepth
          ? canPlaceFullDepthAt({
              start: unit,
              heightU: templateHeightU,
              rackHeightU: occupancy.heightU,
              occupancy,
              excludeDeviceId: id,
            })
          : canPlaceAt({
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
    }

    if (form.mountMode === 'shelf') {
      if (!form.rackId) {
        setFormError('Seleccioná el rack donde está la bandeja.')
        return
      }
      if (!form.supportedByAccessoryId) {
        setFormError('Seleccioná la bandeja.')
        return
      }
      if (form.shelfWidthSlots === '1') {
        const slot = Number.parseInt(form.shelfSlotStart, 10)
        if (Number.isNaN(slot) || slot < 0 || slot > 2) {
          setFormError('Elegí el tercio (izquierda, centro o derecha).')
          return
        }
      }
      if (shelfHeightUValue < 1 || shelfHeightUValue > 20) {
        setFormError('El alto ocupado debe estar entre 1 y 20 U.')
        return
      }
      const selectedShelf = (shelves || []).find((s) => s.id === form.supportedByAccessoryId)
      if (selectedShelf && occupancy) {
        const unitEnd = selectedShelf.unitStart + shelfHeightUValue - 1
        if (unitEnd > occupancy.heightU) {
          setFormError(
            `El equipo (${shelfHeightUValue}U desde U${selectedShelf.unitStart}) no cabe en el rack de ${occupancy.heightU}U`
          )
          return
        }
        const sameShelfDeviceIds = new Set(
          (occupancy.accessories ?? [])
            .find((a) => a.id === selectedShelf.id)
            ?.devices.map((d) => d.id) ?? []
        )
        const filterShelfSelf = (r: { kind?: string; deviceId: string }) => {
          if (r.kind === 'shelf' && r.deviceId === selectedShelf.id) return false
          if (r.kind === 'shelf_device' && sameShelfDeviceIds.has(r.deviceId)) return false
          return true
        }
        if (isFullDepth) {
          for (const face of ['front', 'rear'] as const) {
            const check = canPlaceAt({
              start: selectedShelf.unitStart,
              heightU: shelfHeightUValue,
              rackHeightU: occupancy.heightU,
              occupied: occupiedRangesForFace(occupancy, face, id).filter(filterShelfSelf),
            })
            if (!check.ok) {
              setFormError(check.reason)
              return
            }
          }
        } else {
          const shelfFace: RackFace =
            selectedShelf.mountType === 'four_post' && form.rackFace === 'rear'
              ? 'rear'
              : 'front'
          const check = canPlaceAt({
            start: selectedShelf.unitStart,
            heightU: shelfHeightUValue,
            rackHeightU: occupancy.heightU,
            occupied: occupiedRangesForFace(occupancy, shelfFace, id).filter(filterShelfSelf),
          })
          if (!check.ok) {
            setFormError(check.reason)
            return
          }
        }
      }
    }

    try {
      setIsSubmitting(true)
      const unit =
        form.mountMode === 'rail' ? Number.parseInt(form.rackUnitStart, 10) : null

      const payload =
        form.mountMode === 'shelf'
          ? {
              name: form.name.trim(),
              hostname: form.hostname.trim() || undefined,
              ipAddress: form.ipAddress.trim() || undefined,
              macAddress: form.macAddress.trim() || undefined,
              serialNumber: form.serialNumber.trim() || undefined,
              firmwareVersion: form.firmwareVersion.trim() || undefined,
              siteId: form.siteId || null,
              areaId: form.areaId || null,
              supportedByAccessoryId: form.supportedByAccessoryId,
              shelfWidthSlots: Number.parseInt(form.shelfWidthSlots, 10) as 1 | 3,
              shelfSlotStart:
                form.shelfWidthSlots === '3' ? 0 : Number.parseInt(form.shelfSlotStart, 10),
              shelfHeightU: shelfHeightUValue,
              // rackId lo resuelve el backend desde la bandeja; no enviar null (limpia el montaje).
              rackUnitStart: null,
              rackFace: isFullDepth
                ? 'both'
                : (shelves || []).find((s) => s.id === form.supportedByAccessoryId)
                      ?.mountType === 'four_post' && form.rackFace === 'rear'
                  ? 'rear'
                  : 'front',
              status: form.status,
              notes: form.notes.trim() || undefined,
            }
          : form.mountMode === 'rail'
            ? {
                name: form.name.trim(),
                hostname: form.hostname.trim() || undefined,
                ipAddress: form.ipAddress.trim() || undefined,
                macAddress: form.macAddress.trim() || undefined,
                serialNumber: form.serialNumber.trim() || undefined,
                firmwareVersion: form.firmwareVersion.trim() || undefined,
                siteId: form.siteId || null,
                areaId: form.areaId || null,
                rackId: form.rackId,
                rackUnitStart: unit,
                rackFace: mountFace,
                supportedByAccessoryId: null,
                shelfSlotStart: null,
                shelfWidthSlots: null,
                shelfHeightU: null,
                status: form.status,
                notes: form.notes.trim() || undefined,
              }
            : {
                name: form.name.trim(),
                hostname: form.hostname.trim() || undefined,
                ipAddress: form.ipAddress.trim() || undefined,
                macAddress: form.macAddress.trim() || undefined,
                serialNumber: form.serialNumber.trim() || undefined,
                firmwareVersion: form.firmwareVersion.trim() || undefined,
                siteId: form.siteId || null,
                areaId: form.areaId || null,
                rackId: null,
                rackUnitStart: null,
                rackFace: null,
                supportedByAccessoryId: null,
                shelfSlotStart: null,
                shelfWidthSlots: null,
                shelfHeightU: null,
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
            description="Sitio, área y montaje: rieles del rack o apoyado en bandeja."
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
                    supportedByAccessoryId: '',
                  }))
                }
                options={[
                  { value: '', label: 'Sin sitio' },
                  ...(sites || []).map((s) => ({ value: s.id, label: s.name })),
                ]}
                placeholder="Selecciona un sitio"
                disabled={form.mountMode !== 'none'}
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
                    supportedByAccessoryId: '',
                  }))
                }
                options={[{ value: '', label: 'Sin área' }, ...areaOptions]}
                placeholder={form.siteId ? 'Selecciona un área' : 'Primero elige un sitio'}
                disabled={!form.siteId || form.mountMode !== 'none'}
              />
              <Select
                label="Modo de montaje"
                value={form.mountMode}
                onChange={(event) => {
                  const mountMode = event.target.value as MountMode
                  setForm((prev) => ({
                    ...prev,
                    mountMode,
                    rackId: mountMode === 'none' ? '' : prev.rackId,
                    rackUnitStart: '',
                    supportedByAccessoryId: '',
                    shelfSlotStart: '0',
                    shelfWidthSlots: '1',
                    shelfHeightU:
                      mountMode === 'shelf'
                        ? prev.shelfHeightU || String(templateHeightU)
                        : '',
                  }))
                }}
                options={mountModeOptions}
              />
              {(form.mountMode === 'rail' || form.mountMode === 'shelf') && (
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
                      supportedByAccessoryId: '',
                      rackFace: rackId ? prev.rackFace || 'front' : '',
                      siteId: rack?.area?.siteId || rack?.area?.site?.id || prev.siteId,
                      areaId: rack?.areaId || prev.areaId,
                    }))
                  }}
                  options={[{ value: '', label: 'Seleccionar rack' }, ...rackOptions]}
                  placeholder="Obligatorio"
                />
              )}
              {form.mountMode === 'rail' && form.rackId && (
                <>
                  {isFullDepth ? (
                    <div className="rounded-lg border border-violet-200 dark:border-violet-900/50 bg-violet-50/80 dark:bg-violet-950/30 px-3 py-2.5">
                      <p className="text-sm font-medium text-violet-800 dark:text-violet-200">
                        Ambas caras (profundidad completa)
                      </p>
                      <p className="text-xs text-violet-700/80 dark:text-violet-300/80 mt-0.5">
                        Este template ocupa las mismas U en frente y dorso del rack.
                      </p>
                    </div>
                  ) : (
                    <Select
                      label="Cara"
                      value={form.rackFace === 'both' ? 'front' : form.rackFace || 'front'}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          rackFace: event.target.value as 'front' | 'rear',
                          rackUnitStart: '',
                        }))
                      }
                      options={faceOptions}
                      hint="Frontal y trasera son caras independientes. Las bandejas integrales bloquean ambas."
                    />
                  )}
                  {selectedRack && (
                    <Input
                      label="Capacidad rack"
                      value={`${selectedRack.heightU}U`}
                      disabled
                    />
                  )}
                </>
              )}
              {form.mountMode === 'shelf' && form.rackId && (
                <>
                  <Select
                    label="Bandeja"
                    value={form.supportedByAccessoryId}
                    onChange={(event) => {
                      const shelfId = event.target.value
                      const shelf = (shelves || []).find((s) => s.id === shelfId)
                      setForm((prev) => ({
                        ...prev,
                        supportedByAccessoryId: shelfId,
                        rackFace: isFullDepth
                          ? 'both'
                          : shelf?.mountType === 'four_post'
                            ? prev.rackFace === 'rear'
                              ? 'rear'
                              : 'front'
                            : 'front',
                      }))
                    }}
                    options={[
                      { value: '', label: 'Seleccionar bandeja' },
                      ...(shelves || []).map((s) => ({
                        value: s.id,
                        label: `${s.name} · U${s.unitStart}–U${s.unitStart + s.heightU - 1} (${s.mountType === 'four_post' ? 'integral' : 'frontal'})`,
                      })),
                    ]}
                    hint={
                      (shelves || []).length === 0
                        ? 'No hay bandejas en este rack. Crealas desde el visor de racks.'
                        : undefined
                    }
                  />
                  {isFullDepth ? (
                    <p className="text-xs text-violet-600 dark:text-violet-400 col-span-full">
                      Profundidad completa: el equipo reserva frente y dorso sobre la bandeja.
                    </p>
                  ) : (
                    (() => {
                      const selectedShelf = (shelves || []).find(
                        (s) => s.id === form.supportedByAccessoryId
                      )
                      if (!selectedShelf || selectedShelf.mountType !== 'four_post') {
                        return selectedShelf ? (
                          <p className="text-xs text-gray-500 dark:text-gray-400 col-span-full">
                            Bandeja solo frontal: el equipo queda del lado delantero.
                          </p>
                        ) : null
                      }
                      return (
                        <Select
                          label="Lado de la bandeja"
                          value={form.rackFace === 'both' ? 'front' : form.rackFace || 'front'}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              rackFace: event.target.value as 'front' | 'rear',
                            }))
                          }
                          options={faceOptions}
                          hint="La bandeja integral permite equipos independientes en frente y dorso."
                        />
                      )
                    })()
                  )}
                  <Select
                    label="Ancho en bandeja"
                    value={form.shelfWidthSlots}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        shelfWidthSlots: event.target.value as '1' | '3',
                        shelfSlotStart: event.target.value === '3' ? '0' : prev.shelfSlotStart,
                      }))
                    }
                    options={[
                      { value: '1', label: '1/3 del ancho (1 tercio)' },
                      { value: '3', label: 'Ancho completo' },
                    ]}
                  />
                  {form.shelfWidthSlots === '1' && (
                    <Select
                      label="Posición horizontal"
                      value={form.shelfSlotStart}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          shelfSlotStart: event.target.value,
                        }))
                      }
                      options={[
                        { value: '0', label: 'Izquierda' },
                        { value: '1', label: 'Centro' },
                        { value: '2', label: 'Derecha' },
                      ]}
                    />
                  )}
                  <Input
                    label="Alto ocupado (U)"
                    type="number"
                    min={1}
                    max={20}
                    value={form.shelfHeightU || String(templateHeightU)}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        shelfHeightU: event.target.value,
                      }))
                    }
                    hint={`Crece hacia arriba desde la bandeja. Por defecto ${templateHeightU}U del template.`}
                  />
                  {form.supportedByAccessoryId &&
                    (() => {
                      const selectedShelf = (shelves || []).find(
                        (s) => s.id === form.supportedByAccessoryId
                      )
                      if (!selectedShelf) return null
                      const end = selectedShelf.unitStart + shelfHeightUValue - 1
                      return (
                        <p className="text-xs text-gray-500 dark:text-gray-400 col-span-full">
                          Huella vertical: U{selectedShelf.unitStart}–U{end} (
                          {shelfHeightUValue}U)
                          {occupancyLoading ? ' · cargando ocupación…' : ''}
                          {occupancyError ? ` · ${occupancyError}` : ''}
                        </p>
                      )
                    })()}
                </>
              )}
            </div>

            {form.mountMode === 'rail' && form.rackId && (
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
                    fullDepth={isFullDepth}
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
