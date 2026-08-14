import { useEffect, useMemo, useState } from 'react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Input } from '../Input'
import { SearchableSelect, type SearchableSelectOption } from '../SearchableSelect'
import { diagramLinksService } from '../../services/diagram-links.service'
import { formatLinkCode } from '../../utils/diagram/linkLabel'
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

export function SimpleLinkModal({
  isOpen,
  onClose,
  projectId,
  sourceDeviceId,
  targetDeviceId,
  initialSourcePortId,
  initialSourcePortLabel,
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
  const pickSource = !isEdit && !sourceDeviceId
  const pickDestination = !isEdit && !targetDeviceId

  const [selectedSourceId, setSelectedSourceId] = useState(sourceDeviceId ?? '')
  const [selectedTargetId, setSelectedTargetId] = useState(targetDeviceId ?? '')
  const effectiveSourceId = isEdit
    ? (edge?.source ?? sourceDeviceId ?? '')
    : pickSource
      ? selectedSourceId
      : (sourceDeviceId ?? '')
  const effectiveTargetId = isEdit
    ? (edge?.target ?? targetDeviceId ?? '')
    : pickDestination
      ? selectedTargetId
      : (targetDeviceId ?? '')

  const sourceDevice = inventory.find((d) => d.id === effectiveSourceId)
  const targetDevice = inventory.find((d) => d.id === effectiveTargetId)

  const sourcePorts = sourceDevice?.data.ports ?? []
  const targetPorts = targetDevice?.data.ports ?? []

  const [sourcePortId, setSourcePortId] = useState('')
  const [targetPortId, setTargetPortId] = useState('')
  const [sourcePortLabel, setSourcePortLabel] = useState('')
  const [targetPortLabel, setTargetPortLabel] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const occupied = useMemo(
    () => buildOccupiedPortIndex(existingEdges, edge?.id),
    [existingEdges, edge?.id]
  )

  useEffect(() => {
    if (!isOpen) return
    setError(null)
    setSelectedSourceId(sourceDeviceId ?? '')
    setSelectedTargetId(targetDeviceId ?? '')
    if (edge?.id) {
      setSourcePortId(edge.sourcePortId ?? '')
      setTargetPortId(edge.targetPortId ?? '')
      setSourcePortLabel(edge.sourcePort ?? '')
      setTargetPortLabel(edge.targetPort ?? '')
      setDescription(edge.description ?? '')
      return
    }
    setSourcePortId(initialSourcePortId ?? '')
    setTargetPortId('')
    setSourcePortLabel(initialSourcePortLabel ?? '')
    setTargetPortLabel('')
    setDescription('')
  }, [
    isOpen,
    edge,
    sourceDeviceId,
    targetDeviceId,
    initialSourcePortId,
    initialSourcePortLabel,
  ])

  const sourceSelectOptions = useMemo(
    () =>
      toDeviceSelectOptions(
        destinationOptions,
        effectiveTargetId,
        inventory,
        containerByDeviceId
      ),
    [destinationOptions, effectiveTargetId, inventory, containerByDeviceId]
  )

  const destSelectOptions = useMemo(
    () =>
      toDeviceSelectOptions(
        destinationOptions,
        effectiveSourceId,
        inventory,
        containerByDeviceId
      ),
    [destinationOptions, effectiveSourceId, inventory, containerByDeviceId]
  )

  const sourcePortOptions = useMemo<SearchableSelectOption[]>(
    () =>
      sourcePorts.map((p) => {
        const taken = isPortOccupied(occupied, effectiveSourceId, p.id, p.name, p.name)
        return {
          value: p.id,
          label: `${p.name} (#${p.portNumber})${p.status !== 'up' ? ` · ${p.status}` : ''}`,
          disabled: taken,
          disabledReason: taken ? 'en uso' : undefined,
        }
      }),
    [sourcePorts, occupied, effectiveSourceId]
  )

  const targetPortOptions = useMemo<SearchableSelectOption[]>(
    () =>
      targetPorts.map((p) => {
        const taken = isPortOccupied(occupied, effectiveTargetId, p.id, p.name, p.name)
        return {
          value: p.id,
          label: `${p.name} (#${p.portNumber})${p.status !== 'up' ? ` · ${p.status}` : ''}`,
          disabled: taken,
          disabledReason: taken ? 'en uso' : undefined,
        }
      }),
    [targetPorts, occupied, effectiveTargetId]
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
    setSourcePortId(value)
    if (value) {
      const port = sourcePorts.find((p) => p.id === value)
      if (port) setSourcePortLabel(port.name)
    }
  }

  const handleTargetPortChange = (value: string) => {
    setTargetPortId(value)
    if (value) {
      const port = targetPorts.find((p) => p.id === value)
      if (port) setTargetPortLabel(port.name)
    }
  }

  const handleSourceDeviceChange = (value: string) => {
    setSelectedSourceId(value)
    setSourcePortId('')
    setSourcePortLabel('')
    setError(null)
    if (selectedTargetId === value) {
      setSelectedTargetId('')
      setTargetPortId('')
      setTargetPortLabel('')
    }
  }

  const handleDestinationChange = (value: string) => {
    setSelectedTargetId(value)
    setTargetPortId('')
    setTargetPortLabel('')
    setError(null)
  }

  const handleSave = async () => {
    if (!effectiveSourceId) {
      setError('Elegí el equipo origen.')
      return
    }
    if (!effectiveTargetId) {
      setError('Elegí el equipo destino.')
      return
    }
    const srcLabel = sourcePortLabel.trim()
    const tgtLabel = targetPortLabel.trim()
    if (!srcLabel || !tgtLabel) {
      setError('Indicá el puerto de origen y destino (lista o texto).')
      return
    }

    const sourcePort = sourcePortId
      ? sourcePorts.find((p) => p.id === sourcePortId)
      : undefined
    const targetPort = targetPortId
      ? targetPorts.find((p) => p.id === targetPortId)
      : undefined

    if (
      isPortOccupied(
        occupied,
        effectiveSourceId,
        sourcePortId || null,
        srcLabel,
        sourcePort?.name,
        sourcePorts
      ) ||
      isPortOccupied(
        occupied,
        effectiveTargetId,
        targetPortId || null,
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
        sourcePortId: sourcePortId || null,
        targetPortId: targetPortId || null,
        sourcePortLabel: srcLabel,
        targetPortLabel: tgtLabel,
        description: description.trim() || null,
      }
      if (isEdit && edge?.id) {
        await diagramLinksService.update(edge.id, payload)
      } else {
        await diagramLinksService.create({
          projectId,
          sourceDeviceId: effectiveSourceId,
          targetDeviceId: effectiveTargetId,
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
              value={selectedSourceId}
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
              value={sourcePortId}
              onChange={handleSourcePortChange}
              placeholder="Texto libre…"
              searchPlaceholder="Buscar puerto…"
              emptyOptionLabel="Texto libre…"
              disabled={pickSource && !selectedSourceId}
            />
            <Input
              label="Etiqueta"
              value={sourcePortLabel}
              onChange={(e) => setSourcePortLabel(e.target.value)}
              placeholder="LAN 1"
              disabled={pickSource && !selectedSourceId}
            />
          </div>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700" role="separator" />

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
              value={selectedTargetId}
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
              value={targetPortId}
              onChange={handleTargetPortChange}
              placeholder="Texto libre…"
              searchPlaceholder="Buscar puerto…"
              emptyOptionLabel="Texto libre…"
              disabled={pickDestination && !selectedTargetId}
            />
            <Input
              label="Etiqueta"
              value={targetPortLabel}
              onChange={(e) => setTargetPortLabel(e.target.value)}
              placeholder="P1"
              disabled={pickDestination && !selectedTargetId}
            />
          </div>
        </section>

        <div className="border-t border-gray-200 dark:border-gray-700" role="separator" />

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
