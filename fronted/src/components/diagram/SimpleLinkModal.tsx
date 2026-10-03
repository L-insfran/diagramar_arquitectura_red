import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Input } from '../Input'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { diagramLinksService } from '../../services/diagram-links.service'
import { cableTypesService } from '../../services/cable-types.service'
import { formatLinkCode } from '../../utils/diagram/linkLabel'
import {
  swapLinkEndpoints,
  type LinkEndpointDraft,
} from '../../utils/diagram/linkEndpoints'
import type {
  DiagramLinkEdge,
  TopologyBoardSummary,
  TopologyNode,
  TopologyRackSummary,
} from '../../types'

type Props = {
  isOpen: boolean
  onClose: () => void
  projectId: string
  /** Required when editing / drag-connect; optional when creating from the list button. */
  sourceDeviceId?: string
  /** Required when editing / drag-connect; optional when picking destino in-modal. */
  targetDeviceId?: string
  /** Pre-fill source port when opening from a port click. */
  initialSourcePortId?: string | null
  initialSourcePortLabel?: string
  /** Pre-fill target port when drag-connecting to a specific handle. */
  initialTargetPortId?: string | null
  initialTargetPortLabel?: string
  /** Contenedor visual del diagrama por device id (preferido sobre inventario). */
  containerByDeviceId?: Record<string, string>
  /**
   * Equipos del diagrama para elegir origen/destino cuando no vienen fijos
   * (botón Nuevo enlace o doble clic en un equipo).
   */
  destinationOptions?: Array<{ value: string; label: string }>
  /** When editing an existing link */
  edge?: DiagramLinkEdge | null
  /** All diagram_links of the project (to mark occupied ports). */
  existingEdges?: DiagramLinkEdge[]
  inventory: TopologyNode[]
  racks: TopologyRackSummary[]
  boards: TopologyBoardSummary[]
  onSaved: () => void | Promise<void>
  onDeleted?: () => void | Promise<void>
}

function normalizePortLabel(label: string): string {
  return label.trim().toLowerCase()
}

function deviceDisplayParts(
  device: TopologyNode | undefined,
  racks: TopologyRackSummary[],
  boards: TopologyBoardSummary[],
  containerByDeviceId?: Record<string, string>
): { name: string; location?: string } {
  if (!device) return { name: 'Equipo' }
  const diagramContainer = containerByDeviceId?.[device.id]
  if (diagramContainer) {
    return { name: device.label, location: diagramContainer }
  }
  const board = device.data.boardId
    ? boards.find((b) => b.id === device.data.boardId)
    : null
  const rack =
    !board && device.data.rackId
      ? racks.find((r) => r.id === device.data.rackId)
      : null
  const location = board?.name ?? rack?.name ?? undefined
  return { name: device.label, location }
}

function DeviceReadout({
  label,
  name,
  location,
}: {
  label: string
  name: string
  location?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</div>
      <div
        className="min-h-[2.625rem] rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 dark:border-gray-700 dark:bg-gray-800"
        title={location ? `${name} · ${location}` : name}
      >
        <div className="break-words text-sm font-medium leading-snug text-gray-900 dark:text-gray-100">
          {name}
        </div>
        {location ? (
          <div className="mt-0.5 break-words text-xs leading-snug text-gray-500 dark:text-gray-400">
            {location}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Ports already claimed by other diagram_links (not the edge being edited). */
function buildOccupiedPortIndex(edges: DiagramLinkEdge[], excludeEdgeId?: string) {
  const portIds = new Set<string>()
  const labelsByDevice = new Map<string, Set<string>>()

  const addLabel = (deviceId: string, label: string) => {
    const key = normalizePortLabel(label)
    if (!key) return
    let set = labelsByDevice.get(deviceId)
    if (!set) {
      set = new Set()
      labelsByDevice.set(deviceId, set)
    }
    set.add(key)
  }

  for (const e of edges) {
    if (excludeEdgeId && e.id === excludeEdgeId) continue
    if (e.sourcePortId) portIds.add(e.sourcePortId)
    if (e.targetPortId) portIds.add(e.targetPortId)
    addLabel(e.source, e.sourcePort)
    addLabel(e.target, e.targetPort)
  }

  return { portIds, labelsByDevice }
}

function toDeviceSelectOptions(
  destinationOptions: Array<{ value: string; label: string }>,
  excludeDeviceId: string,
  inventory: TopologyNode[],
  containerByDeviceId?: Record<string, string>
): SearchableSelectOption[] {
  return destinationOptions
    .filter((o) => o.value && o.value !== excludeDeviceId)
    .map((o) => {
      const device = inventory.find((d) => d.id === o.value)
      const location = containerByDeviceId?.[o.value]
      const deviceType = device?.data.deviceType ?? null
      const ipAddress = device?.data.ipAddress ?? null
      return {
        value: o.value,
        label: device?.label ?? o.label,
        description: [location, deviceType, ipAddress].filter(Boolean).join(' · ') || undefined,
        group: location,
      }
    })
}

function isPortOccupied(
  occupied: ReturnType<typeof buildOccupiedPortIndex>,
  deviceId: string,
  portId: string | null | undefined,
  portLabel: string,
  portNameIfKnown?: string,
  devicePorts?: Array<{ id: string; name: string }>
): boolean {
  if (portId && occupied.portIds.has(portId)) return true
  const labels = occupied.labelsByDevice.get(deviceId)
  const normalizedLabel = normalizePortLabel(portLabel)
  if (labels) {
    if (normalizedLabel && labels.has(normalizedLabel)) return true
    if (portNameIfKnown && labels.has(normalizePortLabel(portNameIfKnown))) return true
  }
  // Free-text that matches a real port name already claimed by port_id
  if (!portId && devicePorts && normalizedLabel) {
    for (const p of devicePorts) {
      if (normalizePortLabel(p.name) === normalizedLabel && occupied.portIds.has(p.id)) {
        return true
      }
    }
  }
  return false
}

type ModalLinkEnd = LinkEndpointDraft & {
  /** Equipo fijo (solo lectura). Viaja con el extremo al invertir. */
  deviceLocked: boolean
}

function emptyLinkEnd(deviceLocked = false): ModalLinkEnd {
  return { deviceId: '', portId: '', portLabel: '', deviceLocked }
}

export function SimpleLinkModal({
  isOpen,
  onClose,
  projectId,
  sourceDeviceId,
  targetDeviceId,
  initialSourcePortId,
  initialSourcePortLabel,
  initialTargetPortId,
  initialTargetPortLabel,
  containerByDeviceId,
  destinationOptions = [],
  edge,
  existingEdges = [],
  inventory,
  racks,
  boards,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = Boolean(edge?.id)

  const [sourceEnd, setSourceEnd] = useState<ModalLinkEnd>(() => emptyLinkEnd())
  const [targetEnd, setTargetEnd] = useState<ModalLinkEnd>(() => emptyLinkEnd())
  const [endsSwapped, setEndsSwapped] = useState(false)
  const pickSource = !sourceEnd.deviceLocked
  const pickDestination = !targetEnd.deviceLocked

  const sourceDevice = inventory.find((d) => d.id === sourceEnd.deviceId)
  const targetDevice = inventory.find((d) => d.id === targetEnd.deviceId)

  const sourcePorts = sourceDevice?.data.ports ?? []
  const targetPorts = targetDevice?.data.ports ?? []

  const [description, setDescription] = useState('')
  const [cableTypeId, setCableTypeId] = useState('')
  const [cableTypeOptions, setCableTypeOptions] = useState<SearchableSelectOption[]>([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const occupied = useMemo(
    () => buildOccupiedPortIndex(existingEdges, edge?.id),
    [existingEdges, edge?.id]
  )

  const resolvePortName = (
    ports: Array<{ id: string; name: string }>,
    portId: string | null | undefined
  ): string | null => {
    if (!portId) return null
    return ports.find((p) => p.id === portId)?.name ?? null
  }

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setEndsSwapped(false)
    if (edge?.id) {
      setSourceEnd({
        deviceId: edge.source,
        portId: edge.sourcePortId ?? '',
        portLabel: edge.sourcePort ?? '',
        deviceLocked: true,
      })
      setTargetEnd({
        deviceId: edge.target,
        portId: edge.targetPortId ?? '',
        portLabel: edge.targetPort ?? '',
        deviceLocked: true,
      })
      setDescription(edge.description ?? '')
      setCableTypeId(edge.cableTypeId ?? '')
      return
    }
    const srcId = initialSourcePortId ?? ''
    const tgtId = initialTargetPortId ?? ''
    const srcDevice = inventory.find((d) => d.id === (sourceDeviceId ?? ''))
    const tgtDevice = inventory.find((d) => d.id === (targetDeviceId ?? ''))
    // Prefer inventory port name so Etiqueta matches Puerto without typing.
    setSourceEnd({
      deviceId: sourceDeviceId ?? '',
      portId: srcId,
      portLabel:
        resolvePortName(srcDevice?.data.ports ?? [], srcId) ??
        initialSourcePortLabel ??
        '',
      deviceLocked: Boolean(sourceDeviceId),
    })
    setTargetEnd({
      deviceId: targetDeviceId ?? '',
      portId: tgtId,
      portLabel:
        resolvePortName(tgtDevice?.data.ports ?? [], tgtId) ??
        initialTargetPortLabel ??
        '',
      deviceLocked: Boolean(targetDeviceId),
    })
    setDescription('')
    setCableTypeId('')
  }, [
    isOpen,
    edge,
    sourceDeviceId,
    targetDeviceId,
    initialSourcePortId,
    initialSourcePortLabel,
    initialTargetPortId,
    initialTargetPortLabel,
    inventory,
  ])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    void cableTypesService
      .getAll()
      .then((types) => {
        if (cancelled) return
        setCableTypeOptions(
          types.map((ct) => ({
            value: ct.id,
            label: ct.name,
            description: ct.code,
            group: ct.mediumFamily,
          }))
        )
      })
      .catch(() => {
        if (!cancelled) setCableTypeOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [isOpen])

  const sourceSelectOptions = useMemo(
    () =>
      toDeviceSelectOptions(
        destinationOptions,
        targetEnd.deviceId,
        inventory,
        containerByDeviceId
      ),
    [destinationOptions, targetEnd.deviceId, inventory, containerByDeviceId]
  )

  const destSelectOptions = useMemo(
    () =>
      toDeviceSelectOptions(
        destinationOptions,
        sourceEnd.deviceId,
        inventory,
        containerByDeviceId
      ),
    [destinationOptions, sourceEnd.deviceId, inventory, containerByDeviceId]
  )

  const sourcePortOptions = useMemo<SearchableSelectOption[]>(
    () =>
      sourcePorts.map((p) => {
        const taken = isPortOccupied(occupied, sourceEnd.deviceId, p.id, p.name, p.name)
        return {
          value: p.id,
          label: `${p.name} (#${p.portNumber})`,
          disabled: taken,
          disabledReason: taken ? 'en uso' : undefined,
        }
      }),
    [sourcePorts, occupied, sourceEnd.deviceId]
  )

  const targetPortOptions = useMemo<SearchableSelectOption[]>(
    () =>
      targetPorts.map((p) => {
        const taken = isPortOccupied(occupied, targetEnd.deviceId, p.id, p.name, p.name)
        return {
          value: p.id,
          label: `${p.name} (#${p.portNumber})`,
          disabled: taken,
          disabledReason: taken ? 'en uso' : undefined,
        }
      }),
    [targetPorts, occupied, targetEnd.deviceId]
  )

  const sourceDisplay = deviceDisplayParts(
    sourceDevice,
    racks,
    boards,
    containerByDeviceId
  )
  const targetDisplay = deviceDisplayParts(
    targetDevice,
    racks,
    boards,
    containerByDeviceId
  )

  const handleSourcePortChange = (value: string) => {
    const port = value ? sourcePorts.find((p) => p.id === value) : undefined
    setSourceEnd((prev) => ({
      ...prev,
      portId: value,
      portLabel: port?.name ?? prev.portLabel,
    }))
  }

  const handleTargetPortChange = (value: string) => {
    const port = value ? targetPorts.find((p) => p.id === value) : undefined
    setTargetEnd((prev) => ({
      ...prev,
      portId: value,
      portLabel: port?.name ?? prev.portLabel,
    }))
  }

  const handleSourceDeviceChange = (value: string) => {
    setSourceEnd((prev) => ({ ...prev, deviceId: value, portId: '', portLabel: '' }))
    setError(null)
    setTargetEnd((prev) => {
      if (prev.deviceLocked || prev.deviceId !== value) return prev
      return { ...prev, deviceId: '', portId: '', portLabel: '' }
    })
  }

  const handleDestinationChange = (value: string) => {
    setTargetEnd((prev) => ({ ...prev, deviceId: value, portId: '', portLabel: '' }))
    setError(null)
  }

  const handleInvertEnds = (checked: boolean) => {
    const next = swapLinkEndpoints(sourceEnd, targetEnd)
    setSourceEnd(next.source)
    setTargetEnd(next.target)
    setEndsSwapped(checked)
    setError(null)
  }

  const handleSave = async () => {
    if (!sourceEnd.deviceId) {
      setError('Elegí el equipo origen.')
      return
    }
    if (!targetEnd.deviceId) {
      setError('Elegí el equipo destino.')
      return
    }
    const srcLabel = sourceEnd.portLabel.trim()
    const tgtLabel = targetEnd.portLabel.trim()
    if (!srcLabel || !tgtLabel) {
      setError('Indicá el puerto de origen y destino (lista o texto).')
      return
    }

    const sourcePort = sourceEnd.portId
      ? sourcePorts.find((p) => p.id === sourceEnd.portId)
      : undefined
    const targetPort = targetEnd.portId
      ? targetPorts.find((p) => p.id === targetEnd.portId)
      : undefined

    if (
      isPortOccupied(
        occupied,
        sourceEnd.deviceId,
        sourceEnd.portId || null,
        srcLabel,
        sourcePort?.name,
        sourcePorts
      ) ||
      isPortOccupied(
        occupied,
        targetEnd.deviceId,
        targetEnd.portId || null,
        tgtLabel,
        targetPort?.name,
        targetPorts
      )
    ) {
      setError(
        'Ese puerto ya está usado en otro enlace del diagrama. Elegí un puerto libre.'
      )
      return
    }

    setSaving(true)
    setError(null)
    try {
      const payload = {
        sourceDeviceId: sourceEnd.deviceId,
        targetDeviceId: targetEnd.deviceId,
        sourcePortId: sourceEnd.portId || null,
        targetPortId: targetEnd.portId || null,
        sourcePortLabel: srcLabel,
        targetPortLabel: tgtLabel,
        description: description.trim() || null,
        cableTypeId: cableTypeId || null,
      }
      if (isEdit && edge?.id) {
        await diagramLinksService.update(edge.id, payload)
      } else {
        await diagramLinksService.create({
          projectId,
          ...payload,
        })
      }
      await onSaved()
      onClose()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo guardar el enlace'
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!edge?.id || !onDeleted) return
    setDeleting(true)
    setError(null)
    try {
      await diagramLinksService.delete(edge.id)
      await onDeleted()
      onClose()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'No se pudo eliminar el enlace'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        isEdit
          ? edge?.code != null
            ? `Editar enlace ${formatLinkCode(edge.code)}`
            : 'Editar enlace'
          : 'Nuevo enlace'
      }
      size="lg"
    >
      <div className="space-y-5">
        {pickSource && pickDestination ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Elegí origen y destino entre los equipos del diagrama, y el puerto de cada extremo.
          </p>
        ) : null}

        <section className="space-y-3" aria-labelledby="link-source-heading">
          <h3
            id="link-source-heading"
            className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300"
          >
            Origen
          </h3>
          {pickSource ? (
            <SearchableSelect
              label="Equipo"
              options={sourceSelectOptions}
              value={sourceEnd.deviceId}
              onChange={handleSourceDeviceChange}
              placeholder="Seleccionar equipo…"
              searchPlaceholder="Buscar por nombre, rack, tablero o IP…"
              emptyOptionLabel="Seleccionar equipo…"
              groupFilterLabel="Ubicación"
              wrapLabel
            />
          ) : (
            <DeviceReadout label="Equipo" name={sourceDisplay.name} location={sourceDisplay.location} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableSelect
              label="Puerto"
              options={sourcePortOptions}
              value={sourceEnd.portId}
              onChange={handleSourcePortChange}
              placeholder="Texto libre…"
              searchPlaceholder="Buscar puerto…"
              emptyOptionLabel="Texto libre…"
              disabled={pickSource && !sourceEnd.deviceId}
            />
            <Input
              label="Etiqueta"
              value={sourceEnd.portLabel}
              onChange={(e) =>
                setSourceEnd((prev) => ({ ...prev, portLabel: e.target.value }))
              }
              placeholder={
                resolvePortName(sourcePorts, sourceEnd.portId) ?? 'Se completa al elegir el puerto'
              }
              disabled={pickSource && !sourceEnd.deviceId}
              title="Se completa con el nombre del puerto; podés editarla si hace falta"
            />
          </div>
        </section>

        <label className="flex cursor-pointer items-center justify-between gap-3 border-y border-gray-200 py-3 text-sm text-gray-700 dark:border-gray-700 dark:text-gray-200">
          <span>Invertir origen / destino</span>
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            checked={endsSwapped}
            disabled={saving || deleting}
            onChange={(e) => handleInvertEnds(e.target.checked)}
          />
        </label>

        <section className="space-y-3" aria-labelledby="link-target-heading">
          <h3
            id="link-target-heading"
            className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300"
          >
            Destino
          </h3>
          {pickDestination ? (
            <SearchableSelect
              label="Equipo"
              options={destSelectOptions}
              value={targetEnd.deviceId}
              onChange={handleDestinationChange}
              placeholder="Seleccionar equipo…"
              searchPlaceholder="Buscar por nombre, rack, tablero o IP…"
              emptyOptionLabel="Seleccionar equipo…"
              groupFilterLabel="Ubicación"
              wrapLabel
            />
          ) : (
            <DeviceReadout label="Equipo" name={targetDisplay.name} location={targetDisplay.location} />
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <SearchableSelect
              label="Puerto"
              options={targetPortOptions}
              value={targetEnd.portId}
              onChange={handleTargetPortChange}
              placeholder="Texto libre…"
              searchPlaceholder="Buscar puerto…"
              emptyOptionLabel="Texto libre…"
              disabled={pickDestination && !targetEnd.deviceId}
            />
            <Input
              label="Etiqueta"
              value={targetEnd.portLabel}
              onChange={(e) =>
                setTargetEnd((prev) => ({ ...prev, portLabel: e.target.value }))
              }
              placeholder={
                resolvePortName(targetPorts, targetEnd.portId) ?? 'Se completa al elegir el puerto'
              }
              disabled={pickDestination && !targetEnd.deviceId}
              title="Se completa con el nombre del puerto; podés editarla si hace falta"
            />
          </div>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700" role="separator" />

        <SearchableSelect
          label="Tipo de enlace (opcional)"
          options={cableTypeOptions}
          value={cableTypeId}
          onChange={setCableTypeId}
          placeholder="Sin tipo…"
          searchPlaceholder="Buscar tipo de cable…"
          emptyOptionLabel="Sin tipo…"
        />

        <Input
          label="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Notas del enlace"
        />

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {isEdit && onDeleted ? (
            <Button
              variant="danger"
              onClick={() => void handleDelete()}
              isLoading={deleting}
              disabled={saving}
            >
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} disabled={saving || deleting}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSave()} isLoading={saving} disabled={deleting}>
              Guardar
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
