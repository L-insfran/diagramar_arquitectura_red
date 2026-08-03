import { useEffect, useMemo, useState } from 'react'
import type { DragEvent, FormEvent } from 'react'
import { Plus, Pencil, Trash2, Server, Eye, Unplug, FileText } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { ObjectDocsPanel } from '../components/ObjectDocsPanel'
import { useApi } from '../hooks/useApi'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { racksService } from '../services/racks.service'
import { sitesService } from '../services/sites.service'
import { devicesService } from '../services/devices.service'
import {
  rackAccessoriesService,
  rackAccessoryTemplatesService,
} from '../services/rackAccessories.service'
import type {
  Device,
  Rack,
  RackAccessoryTemplate,
  RackFace,
  RackOccupancy,
  ShelfMountType,
  Site,
} from '../types'
import { canPlaceAt, occupiedRangesForFace, mountTypeLabel } from '../utils/rackPlacement'

/** Alturas habituales de gabinete (pared → full rack). Backend acepta 1–60. */
const COMMON_RACK_HEIGHTS_U = [
  4, 6, 8, 9, 12, 15, 16, 18, 21, 22, 24, 27, 30, 32, 36, 37, 40, 42, 44, 45, 47, 48, 50, 52, 58, 60,
] as const

const HEIGHT_OPTIONS = COMMON_RACK_HEIGHTS_U.map((u) => ({
  value: String(u),
  label: `${u}U`,
}))

const initialForm = {
  name: '',
  code: '',
  siteId: '',
  areaId: '',
  heightU: '42',
  manufacturer: '',
  model: '',
  notes: '',
}

function formatError(err: unknown): string {
  const ax = err as {
    message?: string
    response?: {
      status?: number
      data?: {
        message?: string
        errors?: Array<{ message?: string; field?: string }>
      }
    }
  }
  const data = ax?.response?.data
  if (data?.message) return data.message
  const first = data?.errors?.[0]
  if (first?.message) {
    return first.field ? `${first.field}: ${first.message}` : first.message
  }
  if (ax?.response?.status === 404) {
    return 'Endpoint no encontrado. Reiniciá el backend para cargar las rutas de bandejas.'
  }
  if (ax?.message) return ax.message
  return 'Ocurrió un error inesperado.'
}

const DND_MIME = 'application/x-rack-device'

function RackElevation({
  occupancy,
  face,
  canMutate,
  devices,
  onAssign,
  onUnmount,
  onRemoveShelf,
}: {
  occupancy: RackOccupancy
  face: RackFace
  canMutate: boolean
  devices: Device[]
  onAssign: (unit: number, face: RackFace, deviceId: string) => Promise<void>
  onUnmount: (deviceId: string, deviceName: string) => Promise<void>
  onRemoveShelf?: (accessoryId: string, name: string) => Promise<void>
}) {
  const slots = face === 'front' ? occupancy.slotsFront : occupancy.slotsRear
  const [pickingUnit, setPickingUnit] = useState<number | null>(null)
  const [deviceId, setDeviceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [unmountingId, setUnmountingId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [dragOverUnit, setDragOverUnit] = useState<number | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const unmounted = useMemo(
    () => devices.filter((d) => !d.rackId && !d.supportedByAccessoryId),
    [devices]
  )

  const mountedHere = useMemo(
    () =>
      devices.filter(
        (d) => d.rackId === occupancy.rackId && !d.supportedByAccessoryId && d.rackUnitStart != null
      ),
    [devices, occupancy.rackId]
  )

  const assignOptions = useMemo(
    () => [
      ...unmounted.map((d) => ({
        value: d.id,
        label: `${d.name} (${d.deviceTemplate?.rackUnits ?? 1}U)`,
      })),
      ...mountedHere.map((d) => ({
        value: d.id,
        label: `${d.name} — mover desde U${d.rackUnitStart ?? '?'}/${d.rackFace === 'both' ? 'ambas' : d.rackFace === 'rear' ? 'trasera' : 'frontal'}`,
      })),
    ],
    [unmounted, mountedHere]
  )

  const handlePick = (unit: number, free: boolean) => {
    if (!canMutate || !free) return
    setPickingUnit(unit)
    setDeviceId('')
    setErr(null)
  }

  const submitAssign = async () => {
    if (pickingUnit == null || !deviceId) return
    setBusy(true)
    setErr(null)
    try {
      await onAssign(pickingUnit, face, deviceId)
      setPickingUnit(null)
    } catch (e) {
      setErr(formatError(e))
    } finally {
      setBusy(false)
    }
  }

  const submitUnmount = async (id: string, name: string) => {
    const ok = window.confirm(
      `¿Desmontar "${name}" del rack? El equipo quedará sin posición U (sigue en el mismo sitio/área).`
    )
    if (!ok) return
    setUnmountingId(id)
    setErr(null)
    try {
      await onUnmount(id, name)
      setPickingUnit(null)
    } catch (e) {
      setErr(formatError(e))
    } finally {
      setUnmountingId(null)
    }
  }

  const startDrag = (event: DragEvent, id: string) => {
    if (!canMutate) return
    event.dataTransfer.setData(DND_MIME, id)
    event.dataTransfer.setData('text/plain', id)
    event.dataTransfer.effectAllowed = 'move'
    setDraggingId(id)
    setErr(null)
  }

  const endDrag = () => {
    setDraggingId(null)
    setDragOverUnit(null)
  }

  /** U libre, o ya ocupada por el equipo que se está moviendo (reubicación). */
  const canDropOnSlot = (slotDeviceId: string | null | undefined) => {
    if (!canMutate) return false
    if (!slotDeviceId) return true
    return Boolean(draggingId && slotDeviceId === draggingId)
  }

  const allowDrop = (event: DragEvent, unit: number, slotDeviceId: string | null) => {
    if (!canDropOnSlot(slotDeviceId)) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDragOverUnit(unit)
  }

  const dropOnUnit = async (event: DragEvent, unit: number, slotDeviceId: string | null) => {
    event.preventDefault()
    setDragOverUnit(null)
    if (!canDropOnSlot(slotDeviceId)) return
    const id =
      event.dataTransfer.getData(DND_MIME) || event.dataTransfer.getData('text/plain')
    setDraggingId(null)
    if (!id) return
    // Misma U de inicio: no-op
    if (slotDeviceId === id) return
    setBusy(true)
    setErr(null)
    try {
      await onAssign(unit, face, id)
      setPickingUnit(null)
    } catch (e) {
      setErr(formatError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      {canMutate && (
        <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Arrastrar equipos sin rack
          </p>
          {unmounted.length === 0 ? (
            <p className="text-xs text-gray-400">No hay equipos libres para montar.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unmounted.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={(e) => startDrag(e, d.id)}
                  onDragEnd={endDrag}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium border cursor-grab active:cursor-grabbing select-none ${
                    draggingId === d.id
                      ? 'opacity-50 border-blue-400 bg-blue-500/20'
                      : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100'
                  }`}
                  title="Arrastrá a una U libre"
                >
                  {d.name}{' '}
                  <span className="text-gray-500">({d.deviceTemplate?.rackUnits ?? 1}U)</span>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-500">
            También podés arrastrar un equipo ya montado a otra U, o hacer click en una U libre
            y elegir el equipo (incluso uno ya montado) para moverlo.
          </p>
        </div>
      )}

      <div className="border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-950">
        <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 border-b border-gray-300 dark:border-gray-700">
          Cara {face === 'front' ? 'frontal' : 'trasera'}
        </div>
        <div className="max-h-[28rem] overflow-y-auto">
          {slots.map((slot) => {
            const isShelf = slot.occupantKind === 'shelf' || Boolean(slot.accessoryId)
            const isShelfDevice = slot.occupantKind === 'shelf_device'
            const occupied = Boolean(slot.deviceId) || isShelf
            const isBlockStart = occupied && slot.isStart
            if (occupied && !isBlockStart) return null
            const span = occupied ? Math.max(1, slot.heightU) : 1
            const droppable = !isShelf && !isShelfDevice && canDropOnSlot(slot.deviceId)
            const isDropTarget = droppable && dragOverUnit === slot.unit
            const isDraggingThis = Boolean(draggingId && slot.deviceId === draggingId)
            const shelfDevices =
              isShelf && slot.accessoryId
                ? (
                    (occupancy.accessories ?? []).find((a) => a.id === slot.accessoryId)
                      ?.devices ?? []
                  ).filter(
                    (d) => d.rackFace === 'both' || (d.rackFace === 'rear' ? 'rear' : 'front') === face
                  )
                : []
            return (
              <div
                key={`${face}-${slot.unit}`}
                onDragOver={(e) => {
                  if (!isShelf && !isShelfDevice) allowDrop(e, slot.unit, slot.deviceId)
                }}
                onDragLeave={() => {
                  if (dragOverUnit === slot.unit) setDragOverUnit(null)
                }}
                onDrop={(e) => {
                  if (!isShelf && !isShelfDevice) void dropOnUnit(e, slot.unit, slot.deviceId)
                }}
                className={`w-full flex items-stretch border-b border-gray-300/80 dark:border-gray-800 ${
                  isShelf
                    ? 'bg-amber-700/85 text-white'
                    : isShelfDevice
                      ? 'bg-violet-700/85 text-white'
                      : occupied
                        ? isDraggingThis
                          ? 'bg-blue-600/50 text-white opacity-60'
                          : 'bg-blue-600/90 text-white'
                        : isDropTarget
                          ? 'bg-emerald-500/25 ring-1 ring-inset ring-emerald-500'
                          : 'bg-white dark:bg-gray-900 hover:bg-emerald-500/10'
                }`}
                style={{ minHeight: `${Math.max(22, span * 18)}px` }}
              >
                <span className="w-10 shrink-0 flex items-center justify-center text-[10px] font-mono border-r border-gray-300/60 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  {slot.unit}
                </span>
                {isShelf && slot.accessoryId ? (
                  <div className="flex flex-1 flex-col justify-center min-w-0 px-2 py-1 text-xs">
                    <span className="font-medium truncate">
                      Bandeja · {slot.accessoryName}{' '}
                      <span className="opacity-80 font-normal">
                        ({span}U
                        {slot.mountType === 'four_post' ? ' · integral' : ' · frontal'})
                      </span>
                    </span>
                    {shelfDevices.length > 0 && (
                      <span className="opacity-90 text-[10px] truncate">
                        Apoyados:{' '}
                        {shelfDevices
                          .map((d) => {
                            const end = d.unitEnd ?? slot.unit + Math.max(1, d.heightU) - 1
                            const width =
                              d.shelfWidthSlots === 3
                                ? 'ancho'
                                : `⅓ #${d.shelfSlotStart + 1}`
                            return `${d.name} (U${slot.unit}–U${end} · ${d.heightU}U · ${width})`
                          })
                          .join(', ')}
                      </span>
                    )}
                  </div>
                ) : isShelfDevice && slot.deviceId ? (
                  <div className="flex flex-1 flex-col justify-center min-w-0 px-2 py-1 text-xs">
                    <span className="font-medium truncate">
                      {slot.deviceName}{' '}
                      <span className="opacity-80 font-normal">
                        (apoyado · U{slot.unit}–U{slot.unit + span - 1} · {span}U
                        {slot.slotStart != null && slot.slotEnd != null
                          ? slot.slotStart === 0 && slot.slotEnd === 2
                            ? ' · ancho'
                            : ` · ⅓ #${slot.slotStart + 1}`
                          : ''}
                        )
                      </span>
                    </span>
                  </div>
                ) : occupied && slot.deviceId ? (
                  <div
                    draggable={canMutate}
                    onDragStart={(e) => startDrag(e, slot.deviceId!)}
                    onDragEnd={endDrag}
                    className={`flex flex-1 items-center min-w-0 px-2 py-1 text-xs font-medium select-none ${
                      canMutate ? 'cursor-grab active:cursor-grabbing' : ''
                    }`}
                    title={
                      canMutate
                        ? `${slot.deviceName} · U${slot.unit}–U${slot.unit + span - 1} — arrastrá a otra U`
                        : `${slot.deviceName} · U${slot.unit}–U${slot.unit + span - 1}`
                    }
                  >
                    <span className="truncate">
                      {slot.deviceName}{' '}
                      <span className="opacity-80 font-normal">({span}U)</span>
                    </span>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!canMutate}
                    onClick={() => handlePick(slot.unit, true)}
                    className={`flex flex-1 items-center min-w-0 px-2 py-1 text-xs text-left ${
                      canMutate ? 'cursor-pointer' : 'cursor-default'
                    }`}
                    title={`U${slot.unit} libre — click o soltá aquí`}
                  >
                    <span className="text-gray-400">
                      {isDropTarget ? 'soltar aquí' : 'libre'}
                    </span>
                  </button>
                )}
                {occupied && canMutate && slot.deviceId && !isShelf && (
                  <button
                    type="button"
                    className="shrink-0 px-2 text-[10px] font-medium uppercase tracking-wide hover:bg-black/20 disabled:opacity-50"
                    disabled={unmountingId === slot.deviceId || busy}
                    title={`Desmontar ${slot.deviceName}`}
                    aria-label={`Desmontar ${slot.deviceName}`}
                    onClick={() =>
                      void submitUnmount(slot.deviceId!, slot.deviceName || 'equipo')
                    }
                  >
                    <span className="inline-flex items-center gap-1">
                      <Unplug className="w-3.5 h-3.5" />
                      {unmountingId === slot.deviceId ? '…' : 'Quitar'}
                    </span>
                  </button>
                )}
                {isShelf && canMutate && slot.accessoryId && onRemoveShelf && (
                  <button
                    type="button"
                    className="shrink-0 px-2 text-[10px] font-medium uppercase tracking-wide hover:bg-black/20 disabled:opacity-50"
                    disabled={busy}
                    title={`Quitar bandeja ${slot.accessoryName}`}
                    onClick={() =>
                      void onRemoveShelf(slot.accessoryId!, slot.accessoryName || 'bandeja')
                    }
                  >
                    Quitar
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {err && !pickingUnit && (
        <p className="text-sm text-red-500" role="alert">
          {err}
        </p>
      )}

      {pickingUnit != null && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3 space-y-2">
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            Montar en U{pickingUnit} ({face === 'front' ? 'frontal' : 'trasera'})
          </p>
          <Select
            label="Dispositivo"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            options={[{ value: '', label: 'Selecciona…' }, ...assignOptions]}
          />
          {assignOptions.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No hay equipos disponibles. Creá un device o usá uno de otro rack (desmontalo antes).
            </p>
          )}
          {err && <p className="text-sm text-red-500">{err}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setPickingUnit(null)}>
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              isLoading={busy}
              disabled={!deviceId || busy}
              onClick={() => void submitAssign()}
            >
              Montar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RacksPage() {
  const { activeProjectId } = useProject()
  const { canMutate } = usePermissions()
  const {
    data: racks,
    isLoading,
    error,
    refetch,
  } = useApi(() => racksService.getAll(), [activeProjectId])
  const { data: sites } = useApi<Site[]>(() => sitesService.getAll(), [activeProjectId])
  const { data: devices, refetch: refetchDevices } = useApi(
    () => devicesService.getAll(),
    [activeProjectId]
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [viewerRack, setViewerRack] = useState<Rack | null>(null)
  const [occupancy, setOccupancy] = useState<RackOccupancy | null>(null)
  const [viewerLoading, setViewerLoading] = useState(false)
  const [viewerFace, setViewerFace] = useState<RackFace>('front')
  const [docsRack, setDocsRack] = useState<Rack | null>(null)
  const [shelfForm, setShelfForm] = useState({
    templateId: '',
    name: '',
    unitStart: '',
    heightU: '1' as '1' | '2',
    mountType: 'front_only' as ShelfMountType,
  })
  const [shelfError, setShelfError] = useState<string | null>(null)
  const [shelfBusy, setShelfBusy] = useState(false)

  const { data: shelfTemplates } = useApi<RackAccessoryTemplate[]>(
    () => rackAccessoryTemplatesService.getAll(),
    []
  )

  const areaOptions = useMemo(() => {
    const site = sites?.find((s) => s.id === form.siteId)
    return (site?.areas ?? []).map((a) => ({ value: a.id, label: a.name }))
  }, [sites, form.siteId])

  const openCreate = () => {
    setEditingId(null)
    setForm(initialForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (rack: Rack) => {
    setEditingId(rack.id)
    setForm({
      name: rack.name,
      code: rack.code || '',
      siteId: rack.area?.siteId || rack.area?.site?.id || '',
      areaId: rack.areaId,
      heightU: String(rack.heightU),
      manufacturer: rack.manufacturer || '',
      model: rack.model || '',
      notes: rack.notes || '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalOpen(false)
    setEditingId(null)
    setForm(initialForm)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!form.name.trim() || !form.areaId) {
      setFormError('Nombre y área son obligatorios.')
      return
    }
    if (!activeProjectId) {
      setFormError('Selecciona un proyecto activo.')
      return
    }
    try {
      setIsSubmitting(true)
      const payload = {
        areaId: form.areaId,
        name: form.name.trim(),
        code: form.code.trim() || null,
        heightU: Number.parseInt(form.heightU, 10) || 42,
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (editingId) {
        await racksService.update(editingId, payload)
      } else {
        await racksService.create({ projectId: activeProjectId, ...payload })
      }
      refetch()
      closeModal()
    } catch (e) {
      setFormError(formatError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (rack: Rack) => {
    const ok = window.confirm(`¿Eliminar el rack "${rack.name}"? Debe estar vacío.`)
    if (!ok) return
    try {
      await racksService.delete(rack.id)
      refetch()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const openViewer = async (rack: Rack) => {
    setViewerRack(rack)
    setOccupancy(null)
    setViewerFace('front')
    setViewerLoading(true)
    try {
      const occ = await racksService.getOccupancy(rack.id)
      setOccupancy(occ)
    } catch (e) {
      window.alert(formatError(e))
      setViewerRack(null)
    } finally {
      setViewerLoading(false)
    }
  }

  const refreshOccupancy = async () => {
    if (!viewerRack) return
    const occ = await racksService.getOccupancy(viewerRack.id)
    setOccupancy(occ)
    refetchDevices()
  }

  const handleAssign = async (unit: number, face: RackFace, deviceId: string) => {
    await devicesService.update(deviceId, {
      rackId: viewerRack!.id,
      rackUnitStart: unit,
      rackFace: face,
      supportedByAccessoryId: null,
      shelfSlotStart: null,
      shelfWidthSlots: null,
      shelfHeightU: null,
    })
    await refreshOccupancy()
    refetch()
  }

  const handleUnmount = async (deviceId: string) => {
    await devicesService.update(deviceId, {
      rackId: null,
      rackUnitStart: null,
      rackFace: null,
      supportedByAccessoryId: null,
      shelfSlotStart: null,
      shelfWidthSlots: null,
      shelfHeightU: null,
    })
    await refreshOccupancy()
    refetch()
  }

  const handleRemoveShelf = async (accessoryId: string, name: string) => {
    const ok = window.confirm(
      `¿Quitar la bandeja "${name}"? No debe tener equipos apoyados.`
    )
    if (!ok) return
    await rackAccessoriesService.delete(accessoryId)
    await refreshOccupancy()
    refetch()
  }

  const handleCreateShelf = async () => {
    if (!viewerRack || !activeProjectId || !occupancy) return
    setShelfError(null)
    const unit = Number.parseInt(shelfForm.unitStart, 10)
    const heightU = Number.parseInt(shelfForm.heightU, 10) as 1 | 2
    if (!shelfForm.name.trim()) {
      setShelfError('El nombre es obligatorio.')
      return
    }
    if (!Number.isFinite(unit) || unit < 1) {
      setShelfError('Indicá la U de inicio (≥ 1).')
      return
    }
    const faces: RackFace[] =
      shelfForm.mountType === 'four_post' ? ['front', 'rear'] : ['front']
    for (const face of faces) {
      const occupied = occupiedRangesForFace(occupancy, face)
      const check = canPlaceAt({
        start: unit,
        heightU,
        rackHeightU: occupancy.heightU,
        occupied,
      })
      if (!check.ok) {
        setShelfError(`${face === 'front' ? 'Frontal' : 'Trasera'}: ${check.reason}`)
        return
      }
    }
    setShelfBusy(true)
    try {
      const payload: Parameters<typeof rackAccessoriesService.create>[0] = {
        projectId: activeProjectId,
        rackId: viewerRack.id,
        name: shelfForm.name.trim(),
        unitStart: unit,
        heightU,
        mountType: shelfForm.mountType,
      }
      if (shelfForm.templateId) {
        payload.accessoryTemplateId = shelfForm.templateId
      }
      await rackAccessoriesService.create(payload)
      setShelfForm({
        templateId: '',
        name: '',
        unitStart: '',
        heightU: '1',
        mountType: 'front_only',
      })
      await refreshOccupancy()
      refetch()
    } catch (e) {
      setShelfError(formatError(e))
    } finally {
      setShelfBusy(false)
    }
  }

  useEffect(() => {
    if (!editingId || form.siteId || !form.areaId || !sites) return
    for (const site of sites) {
      if (site.areas?.some((a) => a.id === form.areaId)) {
        setForm((prev) => ({ ...prev, siteId: site.id }))
        break
      }
    }
  }, [editingId, form.areaId, form.siteId, sites])

  const columns: Column<Rack>[] = [
    {
      key: 'name',
      header: 'Rack',
      sortable: true,
      render: (rack) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{rack.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {[rack.area?.site?.name, rack.area?.name].filter(Boolean).join(' › ') || '—'}
              {rack.code ? ` · ${rack.code}` : ''}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'heightU',
      header: 'Altura',
      render: (rack) => <span className="text-sm">{rack.heightU}U</span>,
    },
    {
      key: 'model',
      header: 'Modelo',
      render: (rack) => (
        <span className="text-sm text-gray-500">
          {[rack.manufacturer, rack.model].filter(Boolean).join(' ') || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (rack) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Eye className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              void openViewer(rack)
            }}
          >
            Visor
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<FileText className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              setDocsRack(rack)
            }}
          >
            Docs
          </Button>
          {canMutate && (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!p-2"
                icon={<Pencil className="w-4 h-4" />}
                onClick={(ev) => {
                  ev.stopPropagation()
                  openEdit(rack)
                }}
              >
                Editar
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="!p-2 text-red-500"
                icon={<Trash2 className="w-4 h-4" />}
                onClick={(ev) => {
                  ev.stopPropagation()
                  void handleDelete(rack)
                }}
              >
                Eliminar
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Racks"
        subtitle={`${racks?.length || 0} racks · ocupación por U (sin solapes)`}
        actions={
          canMutate ? (
            <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
              Nuevo rack
            </Button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-red-500">No se pudieron cargar los racks.</p>}

      <DataTable
        columns={columns}
        data={racks || []}
        isLoading={isLoading}
        emptyMessage="No hay racks. Creá uno bajo un sitio/área."
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar rack' : 'Nuevo rack'}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            required
          />
          <Input
            label="Código"
            value={form.code}
            onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
            placeholder="RACK-01"
          />
          <Select
            label="Sitio"
            value={form.siteId}
            onChange={(e) => setForm((p) => ({ ...p, siteId: e.target.value, areaId: '' }))}
            options={[
              { value: '', label: 'Selecciona…' },
              ...(sites || []).map((s) => ({ value: s.id, label: s.name })),
            ]}
            required
          />
          <Select
            label="Área"
            value={form.areaId}
            onChange={(e) => setForm((p) => ({ ...p, areaId: e.target.value }))}
            options={[{ value: '', label: 'Selecciona…' }, ...areaOptions]}
            disabled={!form.siteId}
            required
          />
          <Select
            label="Altura"
            value={form.heightU}
            onChange={(e) => setForm((p) => ({ ...p, heightU: e.target.value }))}
            options={
              HEIGHT_OPTIONS.some((o) => o.value === form.heightU)
                ? HEIGHT_OPTIONS
                : [...HEIGHT_OPTIONS, { value: form.heightU, label: `${form.heightU}U` }].sort(
                    (a, b) => Number(a.value) - Number(b.value)
                  )
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Fabricante"
              value={form.manufacturer}
              onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))}
            />
            <Input
              label="Modelo"
              value={form.model}
              onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
            />
          </div>
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(viewerRack)}
        onClose={() => {
          setViewerRack(null)
          setOccupancy(null)
        }}
        title={viewerRack ? `Visor — ${viewerRack.name}` : 'Visor'}
        size="lg"
      >
        {viewerLoading || !occupancy ? (
          <p className="text-sm text-gray-500">Cargando ocupación…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                {occupancy.heightU}U
              </span>
              <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400">
                {occupancy.percentUsed}% ocupado (front+rear)
              </span>
              <span className="text-gray-500">
                {occupancy.usedU} U usadas · {occupancy.freeU} libres
              </span>
              <div className="ml-auto flex gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={viewerFace === 'front' ? 'primary' : 'secondary'}
                  onClick={() => setViewerFace('front')}
                >
                  Frontal
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewerFace === 'rear' ? 'primary' : 'secondary'}
                  onClick={() => setViewerFace('rear')}
                >
                  Trasera
                </Button>
              </div>
            </div>
            <RackElevation
              occupancy={occupancy}
              face={viewerFace}
              canMutate={canMutate}
              devices={devices || []}
              onAssign={handleAssign}
              onUnmount={(deviceId) => handleUnmount(deviceId)}
              onRemoveShelf={handleRemoveShelf}
            />
            {canMutate && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-3">
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Añadir bandeja fija
                </p>
                <p className="text-xs text-gray-500">
                  Solo frontal: bloquea U en la cara delantera. Integral (4 postes): bloquea
                  frente y dorso — evita solapes al ver el rack por atrás.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select
                    label="Plantilla"
                    value={shelfForm.templateId}
                    onChange={(e) => {
                      const id = e.target.value
                      const tpl = shelfTemplates?.find((t) => t.id === id)
                      setShelfForm((prev) => ({
                        ...prev,
                        templateId: id,
                        name: tpl ? tpl.name : prev.name,
                        heightU: tpl ? (String(tpl.heightU) as '1' | '2') : prev.heightU,
                        mountType: tpl ? tpl.defaultMountType : prev.mountType,
                      }))
                    }}
                    options={[
                      { value: '', label: 'Sin plantilla / personalizada' },
                      ...(shelfTemplates || []).map((t) => ({
                        value: t.id,
                        label: `${t.name} (${t.heightU}U · ${mountTypeLabel(t.defaultMountType)})`,
                      })),
                    ]}
                  />
                  <Input
                    label="Nombre"
                    value={shelfForm.name}
                    onChange={(e) => setShelfForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Bandeja UPS"
                  />
                  <Select
                    label="Altura"
                    value={shelfForm.heightU}
                    onChange={(e) =>
                      setShelfForm((p) => ({
                        ...p,
                        heightU: e.target.value as '1' | '2',
                      }))
                    }
                    options={[
                      { value: '1', label: '1U' },
                      { value: '2', label: '2U' },
                    ]}
                  />
                  <Select
                    label="Fijación"
                    value={shelfForm.mountType}
                    onChange={(e) =>
                      setShelfForm((p) => ({
                        ...p,
                        mountType: e.target.value as ShelfMountType,
                      }))
                    }
                    options={[
                      { value: 'front_only', label: 'Solo frontal (2 postes)' },
                      { value: 'four_post', label: 'Integral (delantera + trasera)' },
                    ]}
                    hint={
                      shelfForm.mountType === 'four_post'
                        ? 'Obligatoria en racks de piso profundos y cargas pesadas.'
                        : 'Típica en racks murales o abiertos poco profundos.'
                    }
                  />
                  <Input
                    label="U de inicio"
                    type="number"
                    min={1}
                    max={occupancy.heightU}
                    value={shelfForm.unitStart}
                    onChange={(e) =>
                      setShelfForm((p) => ({ ...p, unitStart: e.target.value }))
                    }
                  />
                </div>
                {shelfError && (
                  <p className="text-sm text-red-500" role="alert">
                    {shelfError}
                  </p>
                )}
                <Button
                  type="button"
                  size="sm"
                  isLoading={shelfBusy}
                  onClick={() => void handleCreateShelf()}
                >
                  Crear bandeja
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(docsRack)}
        onClose={() => setDocsRack(null)}
        title={docsRack ? `Documentación — ${docsRack.name}` : 'Documentación'}
        size="lg"
      >
        {docsRack && (
          <ObjectDocsPanel
            attachableType="rack"
            attachableId={docsRack.id}
            title="Rack"
          />
        )}
      </Modal>
    </div>
  )
}
