import { useCallback, useEffect, useMemo, useState } from 'react'
import { Lock } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { Select } from '../Select'
import type { SelectOption } from '../Select'
import { Input } from '../Input'
import { devicesService } from '../../services/devices.service'
import { networksService } from '../../services/networks.service'
import { portsService } from '../../services/ports.service'
import { topologyService } from '../../services/topology.service'
import { vlansService } from '../../services/vlans.service'
import { cableTypesService } from '../../services/cable-types.service'
import { ObjectDocsPanel } from '../ObjectDocsPanel'
import { isInternetCloudDeviceType } from '../../utils/topologyPortPanel'
import type {
  ConnectionMetadata,
  Device,
  Network,
  Port,
  PortFace,
  TopologyEdge,
  Vlan,
  MediumType,
  CableCategory,
  CableType,
  FiberType,
  FiberConnector,
  WifiStandard,
  WifiBand,
  WifiSecurity,
  ConnectionStatusType,
} from '../../types'

/** Cara física del chasis para puertos no-passthrough (ADR 0007). */
function portChassisFace(p: Port): PortFace {
  return p.chassisFace === 'rear' ? 'rear' : 'front'
}

function portOptionLabel(
  p: Port,
  opts?: { frontOccupied?: boolean; rearOccupied?: boolean },
) {
  const base = `${p.name} (#${p.portNumber}) — ${p.portType}`
  if (!p.isPassthrough) {
    const chassis = portChassisFace(p)
    return chassis === 'rear' ? `${base} — Dorso` : base
  }
  const front = opts?.frontOccupied
  const rear = opts?.rearOccupied
  if (front && rear) return `${base} — Ambas caras en uso`
  if (front) return `${base} — Front en uso`
  if (rear) return `${base} — Rear en uso`
  return `${base} — Puente`
}

function deviceOptionLabel(d: Device) {
  const host = d.hostname?.trim()
  const base = !host || host === d.name.trim() ? d.name : `${d.name} — ${host}`
  if (isInternetCloudDeviceType(d.deviceType?.name)) return `${base} · ☁️ Internet`
  return base
}

function formatPortHint(stats: { inUse: number; down: number }): string {
  const parts: string[] = []
  if (stats.down > 0) parts.push(`${stats.down} down`)
  if (stats.inUse > 0) parts.push(`${stats.inUse} en uso`)
  return parts.join(' · ')
}

function isCloudDeviceId(devices: Device[], deviceId: string): boolean {
  const device = devices.find((d) => d.id === deviceId)
  return isInternetCloudDeviceType(device?.deviceType?.name)
}

async function ensureInternetGeneralPort(deviceId: string, ports: Port[]): Promise<Port[]> {
  if (ports.length > 0) return ports
  const created = await portsService.create({
    deviceId,
    name: 'Internet',
    portNumber: 1,
    portType: 'wan',
    status: 'up',
    description: 'Puerto general de enlace a Internet (invisible en el diagrama)',
  })
  return [created]
}

interface PhysicalEdgeRef {
  id: string
  sourcePortId: string
  targetPortId: string
  sourceFace?: PortFace
  targetFace?: PortFace
}

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  edge: TopologyEdge | null
  onSaved: () => void
  /** @deprecated Layer mode removed; kept for call-site compatibility */
  mode?: 'physical' | 'logical'
  physicalEdges?: PhysicalEdgeRef[]
}

const MEDIUM_OPTIONS: SelectOption[] = [
  { value: 'utp', label: 'Cable UTP' },
  { value: 'fiber', label: 'Fibra óptica' },
  { value: 'wifi', label: 'WiFi' },
  { value: 'internet', label: 'Internet / WAN' },
]

const CABLE_CATEGORY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin especificar' },
  { value: '5e', label: 'Cat 5e' },
  { value: '6', label: 'Cat 6' },
  { value: '6a', label: 'Cat 6A' },
  { value: '7', label: 'Cat 7' },
  { value: '7a', label: 'Cat 7A' },
  { value: '8', label: 'Cat 8' },
]

const FIBER_TYPE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin especificar' },
  { value: 'singlemode', label: 'Monomodo (SM)' },
  { value: 'multimode', label: 'Multimodo (MM)' },
]

const FIBER_CONNECTOR_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin especificar' },
  { value: 'LC', label: 'LC' },
  { value: 'SC', label: 'SC' },
  { value: 'ST', label: 'ST' },
  { value: 'FC', label: 'FC' },
  { value: 'MPO', label: 'MPO' },
  { value: 'MTRJ', label: 'MTRJ' },
]

const WIFI_STANDARD_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin especificar' },
  { value: '802.11n', label: '802.11n (WiFi 4)' },
  { value: '802.11ac', label: '802.11ac (WiFi 5)' },
  { value: '802.11ax', label: '802.11ax (WiFi 6/6E)' },
  { value: '802.11be', label: '802.11be (WiFi 7)' },
]

const WIFI_BAND_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin especificar' },
  { value: '2.4GHz', label: '2.4 GHz' },
  { value: '5GHz', label: '5 GHz' },
  { value: '6GHz', label: '6 GHz' },
]

const WIFI_SECURITY_OPTIONS: SelectOption[] = [
  { value: '', label: 'Sin especificar' },
  { value: 'WPA2', label: 'WPA2' },
  { value: 'WPA3', label: 'WPA3' },
  { value: 'WPA2/WPA3', label: 'WPA2/WPA3' },
  { value: 'Open', label: 'Abierta' },
]

const CONNECTION_STATUS_OPTIONS: SelectOption[] = [
  { value: 'planned', label: 'Planificada' },
  { value: 'implemented', label: 'Implementada' },
  { value: 'verified', label: 'Verificada' },
]

export function ConnectionModal({ isOpen, onClose, projectId, edge, onSaved, mode: _mode, physicalEdges = [] }: ConnectionModalProps) {
  const isEdit = !!edge

  const [devices, setDevices] = useState<Device[]>([])
  const [sourcePorts, setSourcePorts] = useState<Port[]>([])
  const [targetPorts, setTargetPorts] = useState<Port[]>([])
  const [vlans, setVlans] = useState<Vlan[]>([])
  const [networks, setNetworks] = useState<Network[]>([])
  const [selectedLogicalVlanId, setSelectedLogicalVlanId] = useState('')
  const [selectedLogicalNetworkId, setSelectedLogicalNetworkId] = useState('')

  const [sourceDeviceId, setSourceDeviceId] = useState('')
  const [targetDeviceId, setTargetDeviceId] = useState('')
  const [sourcePortId, setSourcePortId] = useState('')
  const [targetPortId, setTargetPortId] = useState('')
  const [sourceFace, setSourceFace] = useState<PortFace>('front')
  const [targetFace, setTargetFace] = useState<PortFace>('front')
  const [connectionType, setConnectionType] = useState<'physical' | 'logical'>('physical')

  const [mediumType, setMediumType] = useState<MediumType>('utp')
  const [cableTypeId, setCableTypeId] = useState('')
  const [cableTypes, setCableTypes] = useState<CableType[]>([])
  const [cableCategory, setCableCategory] = useState<CableCategory | ''>('')
  const [fiberType, setFiberType] = useState<FiberType | ''>('')
  const [fiberConnector, setFiberConnector] = useState<FiberConnector | ''>('')
  const [wifiSsid, setWifiSsid] = useState('')
  const [wifiStandard, setWifiStandard] = useState<WifiStandard | ''>('')
  const [wifiBand, setWifiBand] = useState<WifiBand | ''>('')
  const [wifiSecurity, setWifiSecurity] = useState<WifiSecurity | ''>('')
  const [cableLength, setCableLength] = useState('')
  const [connStatus, setConnStatus] = useState<ConnectionStatusType>('implemented')

  const [bandwidth, setBandwidth] = useState('')
  const [description, setDescription] = useState('')
  const [vlanName, setVlanName] = useState('')
  const [vlanId, setVlanId] = useState('')
  const [networkName, setNetworkName] = useState('')
  const [notes, setNotes] = useState('')
  const [logicalStatus, setLogicalStatus] = useState<'active' | 'down'>('active')

  const [loadingDevices, setLoadingDevices] = useState(false)
  const [loadingLogicalCatalog, setLoadingLogicalCatalog] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const resetForCreate = useCallback(() => {
    setSourceDeviceId('')
    setTargetDeviceId('')
    setSourcePortId('')
    setTargetPortId('')
    setSourceFace('front')
    setTargetFace('front')
    setConnectionType('physical')
    setMediumType('utp')
    setCableTypeId('')
    setCableCategory('')
    setFiberType('')
    setFiberConnector('')
    setWifiSsid('')
    setWifiStandard('')
    setWifiBand('')
    setWifiSecurity('')
    setCableLength('')
    setConnStatus('implemented')
    setBandwidth('')
    setDescription('')
    setVlanName('')
    setVlanId('')
    setNetworkName('')
    setNotes('')
    setLogicalStatus('active')
    setFormError(null)
    setSelectedLogicalVlanId('')
    setSelectedLogicalNetworkId('')
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setFormError(null)
    setLoadingDevices(true)
    devicesService
      .getAll()
      .then(setDevices)
      .catch(() => setDevices([]))
      .finally(() => setLoadingDevices(false))
    cableTypesService
      .getAll()
      .then(setCableTypes)
      .catch(() => setCableTypes([]))
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (edge) {
      setSourceDeviceId(edge.source)
      setTargetDeviceId(edge.target)
      setSourcePortId(edge.sourcePortId)
      setTargetPortId(edge.targetPortId)
      setSourceFace(edge.sourceFace ?? 'front')
      setTargetFace(edge.targetFace ?? 'front')
      setConnectionType(edge.connectionType === 'logical' ? 'logical' : 'physical')
      setMediumType(edge.medium?.mediumType ?? 'utp')
      setCableTypeId(edge.medium?.cableTypeId ?? '')
      setCableCategory((edge.medium?.cableCategory as CableCategory) ?? '')
      setFiberType((edge.medium?.fiberType as FiberType) ?? '')
      setFiberConnector((edge.medium?.fiberConnector as FiberConnector) ?? '')
      setWifiSsid(edge.medium?.wifiSsid ?? '')
      setWifiStandard((edge.medium?.wifiStandard as WifiStandard) ?? '')
      setWifiBand((edge.medium?.wifiBand as WifiBand) ?? '')
      setWifiSecurity((edge.medium?.wifiSecurity as WifiSecurity) ?? '')
      setCableLength(edge.medium?.cableLength ?? '')
      setConnStatus(edge.connectionStatus ?? 'implemented')
      setBandwidth(edge.bandwidth ?? '')
      setDescription(edge.description ?? '')
      const metadata: ConnectionMetadata | null | undefined = edge.metadata
      setVlanName(metadata?.vlanName ?? '')
      setVlanId(metadata?.vlanId?.toString() ?? '')
      setNetworkName(metadata?.networkName ?? '')
      setNotes(metadata?.notes ?? '')
      setLogicalStatus(metadata?.status ?? 'active')
    } else {
      resetForCreate()
    }
  }, [isOpen, edge, resetForCreate])

  useEffect(() => {
    if (!isOpen) return
    // Always create physical links in the unified topology view
    if (!edge) setConnectionType('physical')
  }, [isOpen, edge])

  useEffect(() => {
    if (!isOpen || !projectId) return
    let cancelled = false
    setLoadingLogicalCatalog(true)
    Promise.all([vlansService.getAll(projectId), networksService.getAll(projectId)])
      .then(([fetchedVlans, fetchedNetworks]) => {
        if (cancelled) return
        setVlans(fetchedVlans)
        setNetworks(fetchedNetworks)
      })
      .catch(() => {
        if (!cancelled) { setVlans([]); setNetworks([]) }
      })
      .finally(() => { if (!cancelled) setLoadingLogicalCatalog(false) })
    return () => { cancelled = true }
  }, [isOpen, projectId])

  useEffect(() => {
    if (!isOpen || !sourceDeviceId) { setSourcePorts([]); return }
    let cancelled = false
    portsService.getByDevice(sourceDeviceId)
      .then(async (ports) => {
        if (cancelled) return
        let next = ports
        if (isCloudDeviceId(devices, sourceDeviceId)) {
          next = await ensureInternetGeneralPort(sourceDeviceId, ports)
          if (cancelled) return
          if (next.length === 1 && !sourcePortId) setSourcePortId(next[0].id)
        }
        setSourcePorts(next)
      })
      .catch(() => { if (!cancelled) setSourcePorts([]) })
    return () => { cancelled = true }
  }, [isOpen, sourceDeviceId, devices])

  useEffect(() => {
    if (!isOpen || !targetDeviceId) { setTargetPorts([]); return }
    let cancelled = false
    portsService.getByDevice(targetDeviceId)
      .then(async (ports) => {
        if (cancelled) return
        let next = ports
        if (isCloudDeviceId(devices, targetDeviceId)) {
          next = await ensureInternetGeneralPort(targetDeviceId, ports)
          if (cancelled) return
          if (next.length === 1 && !targetPortId) setTargetPortId(next[0].id)
        }
        setTargetPorts(next)
      })
      .catch(() => { if (!cancelled) setTargetPorts([]) })
    return () => { cancelled = true }
  }, [isOpen, targetDeviceId, devices])

  useEffect(() => {
    if (!isOpen || isEdit) return
    if (isCloudDeviceId(devices, sourceDeviceId) || isCloudDeviceId(devices, targetDeviceId)) {
      setMediumType('internet')
    }
  }, [isOpen, isEdit, devices, sourceDeviceId, targetDeviceId])

  useEffect(() => {
    if (!isOpen || connectionType !== 'logical' || isEdit) return
    if (vlans.length && !vlanName) {
      setSelectedLogicalVlanId(vlans[0].id)
      setVlanName(vlans[0].name)
      setVlanId(vlans[0].vlanId.toString())
    }
    if (networks.length && !networkName) {
      setSelectedLogicalNetworkId(networks[0].id)
      setNetworkName(networks[0].name)
    }
  }, [isOpen, connectionType, isEdit, networkName, networks, vlanName, vlans])

  useEffect(() => {
    const trimmedName = vlanName.trim()
    if (!trimmedName) { setVlanId(''); setSelectedLogicalVlanId(''); return }
    const matched = vlans.find((vlan) => vlan.name === trimmedName)
    if (matched) { setVlanId(matched.vlanId.toString()); setSelectedLogicalVlanId(matched.id) }
    else setSelectedLogicalVlanId('')
  }, [vlans, vlanName])

  useEffect(() => {
    const trimmedName = networkName.trim()
    if (!trimmedName) { setSelectedLogicalNetworkId(''); return }
    const matched = networks.find((network) => network.name === trimmedName)
    setSelectedLogicalNetworkId(matched?.id ?? '')
  }, [networks, networkName])

  const usedPhysicalFaces = useMemo(() => {
    const ids = new Set<string>()
    for (const e of physicalEdges) {
      if (isEdit && edge && e.id === edge.id) continue
      ids.add(`${e.sourcePortId}:${e.sourceFace ?? 'front'}`)
      ids.add(`${e.targetPortId}:${e.targetFace ?? 'front'}`)
    }
    return ids
  }, [physicalEdges, isEdit, edge])

  const isFaceOccupied = useCallback(
    (portId: string, face: PortFace) => usedPhysicalFaces.has(`${portId}:${face}`),
    [usedPhysicalFaces],
  )

  const isPhysical = connectionType === 'physical'

  const portFullyOccupied = useCallback(
    (p: Port) => {
      if (!isPhysical) return false
      if (p.isPassthrough) {
        return isFaceOccupied(p.id, 'front') && isFaceOccupied(p.id, 'rear')
      }
      return isFaceOccupied(p.id, portChassisFace(p))
    },
    [isPhysical, isFaceOccupied],
  )

  useEffect(() => {
    if (!isPhysical) return
    const sourcePort = sourcePorts.find((p) => p.id === sourcePortId)
    if (sourcePortId && sourcePort && portFullyOccupied(sourcePort)) {
      setSourcePortId('')
    }
    const targetPort = targetPorts.find((p) => p.id === targetPortId)
    if (targetPortId && targetPort && portFullyOccupied(targetPort)) {
      setTargetPortId('')
    }
  }, [isPhysical, sourcePortId, targetPortId, sourcePorts, targetPorts, portFullyOccupied])

  useEffect(() => {
    if (!sourcePortId) return
    const port = sourcePorts.find((p) => p.id === sourcePortId)
    if (port && port.status !== 'up') setSourcePortId('')
    if (port?.isPassthrough) {
      if (!isFaceOccupied(sourcePortId, sourceFace)) return
      const free: PortFace = !isFaceOccupied(sourcePortId, 'rear')
        ? 'rear'
        : !isFaceOccupied(sourcePortId, 'front')
          ? 'front'
          : sourceFace
      if (free !== sourceFace) setSourceFace(free)
    } else if (port) {
      const chassis = portChassisFace(port)
      if (sourceFace !== chassis) setSourceFace(chassis)
    }
  }, [sourcePorts, sourcePortId, sourceFace, isFaceOccupied])

  useEffect(() => {
    if (!targetPortId) return
    const port = targetPorts.find((p) => p.id === targetPortId)
    if (port && port.status !== 'up') setTargetPortId('')
    if (port?.isPassthrough) {
      if (!isFaceOccupied(targetPortId, targetFace)) return
      const free: PortFace = !isFaceOccupied(targetPortId, 'rear')
        ? 'rear'
        : !isFaceOccupied(targetPortId, 'front')
          ? 'front'
          : targetFace
      if (free !== targetFace) setTargetFace(free)
    } else if (port) {
      const chassis = portChassisFace(port)
      if (targetFace !== chassis) setTargetFace(chassis)
    }
  }, [targetPorts, targetPortId, targetFace, isFaceOccupied])

  const buildPortOptions = useCallback(
    (ports: Port[]): SelectOption[] =>
      ports.map((p) => {
        const portDown = p.status !== 'up'
        const frontOccupied = isFaceOccupied(p.id, 'front')
        const rearOccupied = p.isPassthrough
          ? isFaceOccupied(p.id, 'rear')
          : portChassisFace(p) === 'rear' && isFaceOccupied(p.id, 'rear')
        const occupied = portFullyOccupied(p)
        const blocked = portDown || occupied
        let reason: string | undefined
        if (portDown && occupied) reason = `${p.status} · En uso`
        else if (portDown) reason = p.status
        else if (occupied) reason = p.isPassthrough ? 'Ambas caras en uso' : 'En uso'
        else if (p.isPassthrough && (frontOccupied || rearOccupied)) {
          reason = frontOccupied ? 'Front en uso · Rear libre' : 'Rear en uso · Front libre'
        }
        return {
          value: p.id,
          label: portOptionLabel(p, { frontOccupied, rearOccupied }),
          disabled: blocked,
          disabledReason: reason,
        }
      }),
    [portFullyOccupied, isFaceOccupied]
  )

  const sourcePortOptions = useMemo(() => buildPortOptions(sourcePorts), [buildPortOptions, sourcePorts])
  const targetPortOptions = useMemo(() => buildPortOptions(targetPorts), [buildPortOptions, targetPorts])

  const sourceDisabledStats = useMemo(() => {
    let inUse = 0, down = 0
    for (const o of sourcePortOptions) {
      if (!o.disabled) continue
      const reason = o.disabledReason ?? ''
      if (reason.includes('En uso') || reason.includes('In use')) inUse++
      if (reason.includes('down') || reason.includes('disabled')) down++
    }
    return { inUse, down, total: sourcePortOptions.filter((o) => o.disabled).length }
  }, [sourcePortOptions])

  const targetDisabledStats = useMemo(() => {
    let inUse = 0, down = 0
    for (const o of targetPortOptions) {
      if (!o.disabled) continue
      const reason = o.disabledReason ?? ''
      if (reason.includes('En uso') || reason.includes('In use')) inUse++
      if (reason.includes('down') || reason.includes('disabled')) down++
    }
    return { inUse, down, total: targetPortOptions.filter((o) => o.disabled).length }
  }, [targetPortOptions])

  const hasAnyDisabled = sourceDisabledStats.total > 0 || targetDisabledStats.total > 0
  const hasDownPorts = sourceDisabledStats.down > 0 || targetDisabledStats.down > 0
  const hasInUsePorts = isPhysical && (sourceDisabledStats.inUse > 0 || targetDisabledStats.inUse > 0)

  const deviceOptions = useMemo(
    () =>
      devices
        .slice()
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ value: d.id, label: deviceOptionLabel(d) })),
    [devices]
  )

  const metadataPayload = (() => {
    const payload: ConnectionMetadata = {}
    if (vlanName.trim()) payload.vlanName = vlanName.trim()
    if (vlanId.trim()) payload.vlanId = Number(vlanId)
    if (networkName.trim()) payload.networkName = networkName.trim()
    if (notes.trim()) payload.notes = notes.trim()
    if (connectionType === 'logical' && logicalStatus) payload.status = logicalStatus
    return Object.keys(payload).length ? payload : null
  })()

  const handleExistingVlanSelection = useCallback(
    (id: string) => {
      setSelectedLogicalVlanId(id)
      const matched = vlans.find((v) => v.id === id)
      if (matched) { setVlanName(matched.name); setVlanId(matched.vlanId.toString()) }
      else { setVlanName(''); setVlanId('') }
    },
    [vlans]
  )

  const handleExistingNetworkSelection = useCallback(
    (id: string) => {
      setSelectedLogicalNetworkId(id)
      const matched = networks.find((n) => n.id === id)
      if (matched) setNetworkName(matched.name)
      else setNetworkName('')
    },
    [networks]
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!sourcePortId || !targetPortId) { setFormError('Selecciona un puerto en ambos extremos.'); return }
    if (sourcePortId === targetPortId) { setFormError('Los puertos origen y destino deben ser diferentes.'); return }

    const bandwidthVal = bandwidth.trim() || null
    const descriptionVal = description.trim() || null
    setSubmitting(true)

    try {
      const commonPayload = {
        sourcePortId,
        targetPortId,
        sourceFace,
        targetFace,
        connectionType,
        mediumType,
        cableTypeId: cableTypeId || null,
        cableCategory: mediumType === 'utp' && cableCategory ? cableCategory as CableCategory : null,
        fiberType: mediumType === 'fiber' && fiberType ? fiberType as FiberType : null,
        fiberConnector: mediumType === 'fiber' && fiberConnector ? fiberConnector as FiberConnector : null,
        wifiSsid: mediumType === 'wifi' && wifiSsid.trim() ? wifiSsid.trim() : null,
        wifiStandard: mediumType === 'wifi' && wifiStandard ? wifiStandard as WifiStandard : null,
        wifiBand: mediumType === 'wifi' && wifiBand ? wifiBand as WifiBand : null,
        wifiSecurity: mediumType === 'wifi' && wifiSecurity ? wifiSecurity as WifiSecurity : null,
        cableLength: (mediumType === 'utp' || mediumType === 'fiber') && cableLength.trim() ? cableLength.trim() : null,
        connectionStatus: connStatus,
        bandwidth: bandwidthVal,
        description: descriptionVal,
        metadata: metadataPayload,
      }

      if (isEdit && edge) {
        await topologyService.updateConnection(edge.id, commonPayload)
      } else {
        await topologyService.createConnection({ projectId, ...commonPayload })
      }
      onSaved()
      onClose()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo guardar la conexión.'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const sourcePortVlans = useMemo(() => {
    const port = sourcePorts.find((p) => p.id === sourcePortId)
    return port?.vlans ?? []
  }, [sourcePorts, sourcePortId])

  const targetPortVlans = useMemo(() => {
    const port = targetPorts.find((p) => p.id === targetPortId)
    return port?.vlans ?? []
  }, [targetPorts, targetPortId])

  const showManualOverride = true

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Editar conexión' : 'Nueva conexión'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
        {loadingDevices ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Cargando dispositivos…</p>
        ) : deviceOptions.length === 0 ? (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            No se encontraron dispositivos. Agrega dispositivos y puertos antes de crear conexiones.
          </p>
        ) : (
          <>
            {/* Dispositivos y puertos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Dispositivo origen" placeholder="Seleccionar" options={deviceOptions} value={sourceDeviceId}
                onChange={(e) => { setSourceDeviceId(e.target.value); setSourcePortId(''); setSourceFace('front') }} required />
              <Select label="Dispositivo destino" placeholder="Seleccionar" options={deviceOptions} value={targetDeviceId}
                onChange={(e) => { setTargetDeviceId(e.target.value); setTargetPortId(''); setTargetFace('front') }} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isCloudDeviceId(devices, sourceDeviceId) && sourcePorts.length === 1 ? (
                <div className="space-y-1.5">
                  <p className="block text-sm font-medium text-gray-700 dark:text-gray-300">Puerto origen</p>
                  <p className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                    Puerto general de Internet (invisible en el diagrama)
                  </p>
                </div>
              ) : (
                <Select label="Puerto origen" placeholder={sourceDeviceId ? 'Seleccionar puerto' : 'Selecciona dispositivo primero'} options={sourcePortOptions}
                  value={sourcePortId} onChange={(e) => setSourcePortId(e.target.value)} disabled={!sourceDeviceId} required
                  hint={sourceDeviceId && sourceDisabledStats.total > 0 ? formatPortHint(sourceDisabledStats) : undefined} />
              )}
              {isCloudDeviceId(devices, targetDeviceId) && targetPorts.length === 1 ? (
                <div className="space-y-1.5">
                  <p className="block text-sm font-medium text-gray-700 dark:text-gray-300">Puerto destino</p>
                  <p className="rounded-lg border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200">
                    Puerto general de Internet (invisible en el diagrama)
                  </p>
                </div>
              ) : (
                <Select label="Puerto destino" placeholder={targetDeviceId ? 'Seleccionar puerto' : 'Selecciona dispositivo primero'} options={targetPortOptions}
                  value={targetPortId} onChange={(e) => setTargetPortId(e.target.value)} disabled={!targetDeviceId} required
                  hint={targetDeviceId && targetDisabledStats.total > 0 ? formatPortHint(targetDisabledStats) : undefined} />
              )}
            </div>

            {(sourcePorts.find((p) => p.id === sourcePortId)?.isPassthrough ||
              targetPorts.find((p) => p.id === targetPortId)?.isPassthrough) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {sourcePorts.find((p) => p.id === sourcePortId)?.isPassthrough ? (
                  <Select
                    label="Cara origen (passthrough)"
                    options={[
                      {
                        value: 'rear',
                        label: isFaceOccupied(sourcePortId, 'rear') && !(isEdit && edge?.sourceFace === 'rear')
                          ? 'Rear (ocupada)'
                          : 'Rear',
                        disabled:
                          isFaceOccupied(sourcePortId, 'rear') &&
                          !(isEdit && edge?.sourcePortId === sourcePortId && edge?.sourceFace === 'rear'),
                      },
                      {
                        value: 'front',
                        label: isFaceOccupied(sourcePortId, 'front') && !(isEdit && edge?.sourceFace === 'front')
                          ? 'Front (ocupada)'
                          : 'Front',
                        disabled:
                          isFaceOccupied(sourcePortId, 'front') &&
                          !(isEdit && edge?.sourcePortId === sourcePortId && edge?.sourceFace === 'front'),
                      },
                    ]}
                    value={sourceFace}
                    onChange={(e) => setSourceFace(e.target.value as PortFace)}
                  />
                ) : (
                  <div />
                )}
                {targetPorts.find((p) => p.id === targetPortId)?.isPassthrough ? (
                  <Select
                    label="Cara destino (passthrough)"
                    options={[
                      {
                        value: 'rear',
                        label: isFaceOccupied(targetPortId, 'rear') && !(isEdit && edge?.targetFace === 'rear')
                          ? 'Rear (ocupada)'
                          : 'Rear',
                        disabled:
                          isFaceOccupied(targetPortId, 'rear') &&
                          !(isEdit && edge?.targetPortId === targetPortId && edge?.targetFace === 'rear'),
                      },
                      {
                        value: 'front',
                        label: isFaceOccupied(targetPortId, 'front') && !(isEdit && edge?.targetFace === 'front')
                          ? 'Front (ocupada)'
                          : 'Front',
                        disabled:
                          isFaceOccupied(targetPortId, 'front') &&
                          !(isEdit && edge?.targetPortId === targetPortId && edge?.targetFace === 'front'),
                      },
                    ]}
                    value={targetFace}
                    onChange={(e) => setTargetFace(e.target.value as PortFace)}
                  />
                ) : (
                  <div />
                )}
              </div>
            )}

            {(sourcePortId || targetPortId) && (
              <div className="rounded-lg border border-violet-200 dark:border-violet-800/40 p-4 space-y-2 bg-violet-50/40 dark:bg-violet-950/20">
                <p className="text-xs uppercase tracking-wide font-semibold text-violet-700 dark:text-violet-300">
                  VLANs de los puertos (derivadas del inventario)
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-gray-700 dark:text-gray-300">
                  <div>
                    <p className="font-semibold mb-1">Origen</p>
                    {sourcePortVlans.length ? (
                      <ul className="space-y-0.5">
                        {sourcePortVlans.map((v) => (
                          <li key={v.id}>VLAN {v.vlanId} · {v.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">Sin VLANs asignadas al puerto</p>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold mb-1">Destino</p>
                    {targetPortVlans.length ? (
                      <ul className="space-y-0.5">
                        {targetPortVlans.map((v) => (
                          <li key={v.id}>VLAN {v.vlanId} · {v.name}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500">Sin VLANs asignadas al puerto</p>
                    )}
                  </div>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Para asignar VLANs reales al switch: abrí el dispositivo → Edit en el puerto → sección
                  «VLANs del puerto». La etiqueta manual más abajo es solo un complemento en el diagrama.
                </p>
              </div>
            )}

            {hasAnyDisabled && (
              <div className="space-y-2">
                {hasDownPorts && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/40">
                    <Lock className="w-3.5 h-3.5 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300">
                      Los puertos con estado <span className="font-semibold">down</span> o <span className="font-semibold">disabled</span> no pueden usarse. Cambia su estado a <span className="font-semibold">up</span> primero.
                    </p>
                  </div>
                )}
                {hasInUsePorts && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                    <Lock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Un puerto normal admite{' '}
                      <span className="font-semibold">una conexión física</span>. Un puerto puente
                      (patch panel) admite <span className="font-semibold">una por cara</span>{' '}
                      (front/rear). Desconectá la cara ocupada antes de reutilizarla.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Medio de conexión */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">Medio de conexión</p>
              <Select
                label="Tipo de cable (catálogo)"
                options={[
                  { value: '', label: 'Sin catálogo (usar medio manual)' },
                  ...cableTypes.map((ct) => ({ value: ct.id, label: ct.name })),
                ]}
                value={cableTypeId}
                onChange={(e) => {
                  const id = e.target.value
                  setCableTypeId(id)
                  const ct = cableTypes.find((c) => c.id === id)
                  if (!ct) return
                  const family = ct.mediumFamily
                  if (
                    family === 'utp' ||
                    family === 'fiber' ||
                    family === 'wifi' ||
                    family === 'internet'
                  ) {
                    setMediumType(family)
                  } else {
                    setMediumType('utp')
                  }
                  if (ct.defaultCategory) setCableCategory(ct.defaultCategory as CableCategory)
                  if (ct.defaultFiberType) setFiberType(ct.defaultFiberType as FiberType)
                }}
              />
              <Select label="Tipo de medio" options={MEDIUM_OPTIONS} value={mediumType}
                onChange={(e) => setMediumType(e.target.value as MediumType)} />

              {mediumType === 'utp' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select label="Categoría de cable" options={CABLE_CATEGORY_OPTIONS} value={cableCategory}
                    onChange={(e) => setCableCategory(e.target.value as CableCategory | '')} />
                  <Input label="Longitud" placeholder="ej. 5m, 15m" value={cableLength} onChange={(e) => setCableLength(e.target.value)} />
                </div>
              )}

              {mediumType === 'fiber' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Select label="Tipo de fibra" options={FIBER_TYPE_OPTIONS} value={fiberType}
                    onChange={(e) => setFiberType(e.target.value as FiberType | '')} />
                  <Select label="Conector" options={FIBER_CONNECTOR_OPTIONS} value={fiberConnector}
                    onChange={(e) => setFiberConnector(e.target.value as FiberConnector | '')} />
                  <Input label="Longitud" placeholder="ej. 10m, 100m" value={cableLength} onChange={(e) => setCableLength(e.target.value)} />
                </div>
              )}

              {mediumType === 'wifi' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="SSID" placeholder="ej. Corp-WiFi" value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} />
                  <Select label="Estándar" options={WIFI_STANDARD_OPTIONS} value={wifiStandard}
                    onChange={(e) => setWifiStandard(e.target.value as WifiStandard | '')} />
                  <Select label="Banda" options={WIFI_BAND_OPTIONS} value={wifiBand}
                    onChange={(e) => setWifiBand(e.target.value as WifiBand | '')} />
                  <Select label="Seguridad" options={WIFI_SECURITY_OPTIONS} value={wifiSecurity}
                    onChange={(e) => setWifiSecurity(e.target.value as WifiSecurity | '')} />
                </div>
              )}
            </div>

            {/* Estado y ancho de banda */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Estado de conexión" options={CONNECTION_STATUS_OPTIONS} value={connStatus}
                onChange={(e) => setConnStatus(e.target.value as ConnectionStatusType)} />
              <Input label="Ancho de banda" placeholder="ej. 1 Gbps, 10 Gbps" value={bandwidth} onChange={(e) => setBandwidth(e.target.value)} />
            </div>

            {/* Notas */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas (opcional)</label>
              <textarea className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 min-h-[80px]"
                value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Trunk, ID de circuito, etc." />
            </div>

            {/* Override manual opcional */}
            {showManualOverride && (
              <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/40 dark:bg-slate-900/30">
                <p className="text-xs uppercase tracking-wide font-semibold text-slate-600 dark:text-slate-400">
                  Etiqueta manual (opcional)
                </p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Se muestra en el diagrama como complemento a las VLANs del puerto, marcado como (manual).
                </p>
                {loadingLogicalCatalog && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">Cargando VLANs y redes…</p>
                )}
                {vlans.length > 0 && (
                  <Select label="VLAN existente" placeholder="Seleccione una VLAN"
                    options={[{ value: '', label: 'Seleccionar VLAN' }, ...vlans.map((v) => ({ value: v.id, label: `${v.name} (#${v.vlanId})` }))]}
                    value={selectedLogicalVlanId} onChange={(e) => handleExistingVlanSelection(e.target.value)} />
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Nombre VLAN" placeholder="ej. VLAN 210" value={vlanName}
                    onChange={(e) => { setVlanName(e.target.value); setSelectedLogicalVlanId('') }} />
                  <Input label="ID VLAN" type="number" placeholder="ej. 210" value={vlanId} onChange={(e) => setVlanId(e.target.value)} />
                </div>
                {networks.length > 0 && (
                  <Select label="Red existente" placeholder="Seleccione una red"
                    options={[{ value: '', label: 'Seleccionar red' }, ...networks.map((n) => ({ value: n.id, label: n.name }))]}
                    value={selectedLogicalNetworkId} onChange={(e) => handleExistingNetworkSelection(e.target.value)} />
                )}
                <Input label="Red" placeholder="ej. Prod VLAN" value={networkName}
                  onChange={(e) => { setNetworkName(e.target.value); setSelectedLogicalNetworkId('') }} />
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas adicionales</label>
                  <textarea className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 min-h-[80px]"
                    value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe contexto adicional…" />
                </div>
              </div>
            )}
          </>
        )}

        {formError && <p className="text-sm text-red-500" role="alert">{formError}</p>}

        {isEdit && edge?.id && (
          <div className="pt-2">
            <ObjectDocsPanel
              attachableType="connection"
              attachableId={edge.id}
              title="Documentación de la conexión"
            />
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>Cancelar</Button>
          <Button type="submit" isLoading={submitting} disabled={loadingDevices || deviceOptions.length === 0}>
            {isEdit ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
