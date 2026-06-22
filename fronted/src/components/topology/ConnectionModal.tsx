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
import type {
  ConnectionMetadata,
  Device,
  Network,
  Port,
  TopologyEdge,
  Vlan,
  MediumType,
  CableCategory,
  FiberType,
  FiberConnector,
  WifiStandard,
  WifiBand,
  WifiSecurity,
  ConnectionStatusType,
} from '../../types'

function portOptionLabel(p: Port) {
  return `${p.name} (#${p.portNumber}) — ${p.portType}`
}

function deviceOptionLabel(d: Device) {
  const host = d.hostname?.trim()
  if (!host) return d.name
  if (host === d.name.trim()) return d.name
  return `${d.name} — ${host}`
}

function formatPortHint(stats: { inUse: number; down: number }): string {
  const parts: string[] = []
  if (stats.down > 0) parts.push(`${stats.down} down`)
  if (stats.inUse > 0) parts.push(`${stats.inUse} en uso`)
  return parts.join(' · ')
}

/** Igual que `device_types.name` del seeder (patch panel / cableado horizontal). */
const STRUCTURED_CABLING_DEVICE_TYPE_NAME = 'Cableado Estructurado'

function allowsMultiplePhysicalConnectionsPerPort(devices: Device[], deviceId: string): boolean {
  const device = devices.find((d) => d.id === deviceId)
  return device?.deviceType?.name === STRUCTURED_CABLING_DEVICE_TYPE_NAME
}

interface PhysicalEdgeRef {
  id: string
  sourcePortId: string
  targetPortId: string
}

interface ConnectionModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  edge: TopologyEdge | null
  onSaved: () => void
  mode?: 'physical' | 'logical'
  physicalEdges?: PhysicalEdgeRef[]
}

const MEDIUM_OPTIONS: SelectOption[] = [
  { value: 'utp', label: 'Cable UTP' },
  { value: 'fiber', label: 'Fibra óptica' },
  { value: 'wifi', label: 'WiFi' },
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

export function ConnectionModal({ isOpen, onClose, companyId, edge, onSaved, mode, physicalEdges = [] }: ConnectionModalProps) {
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
  const [connectionType, setConnectionType] = useState<'physical' | 'logical'>('physical')

  const [mediumType, setMediumType] = useState<MediumType>('utp')
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
    setConnectionType('physical')
    setMediumType('utp')
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
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (edge) {
      setSourceDeviceId(edge.source)
      setTargetDeviceId(edge.target)
      setSourcePortId(edge.sourcePortId)
      setTargetPortId(edge.targetPortId)
      setConnectionType(edge.connectionType === 'logical' ? 'logical' : 'physical')
      setMediumType(edge.medium?.mediumType ?? 'utp')
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
    if (mode) setConnectionType(mode)
  }, [isOpen, mode])

  useEffect(() => {
    if (!isOpen || !companyId) return
    let cancelled = false
    setLoadingLogicalCatalog(true)
    Promise.all([vlansService.getAll(companyId), networksService.getAll(companyId)])
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
  }, [isOpen, companyId])

  useEffect(() => {
    if (!isOpen || !sourceDeviceId) { setSourcePorts([]); return }
    let cancelled = false
    portsService.getByDevice(sourceDeviceId)
      .then((ports) => { if (!cancelled) setSourcePorts(ports) })
      .catch(() => { if (!cancelled) setSourcePorts([]) })
    return () => { cancelled = true }
  }, [isOpen, sourceDeviceId])

  useEffect(() => {
    if (!isOpen || !targetDeviceId) { setTargetPorts([]); return }
    let cancelled = false
    portsService.getByDevice(targetDeviceId)
      .then((ports) => { if (!cancelled) setTargetPorts(ports) })
      .catch(() => { if (!cancelled) setTargetPorts([]) })
    return () => { cancelled = true }
  }, [isOpen, targetDeviceId])

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

  const usedPhysicalPortIds = useMemo(() => {
    const ids = new Set<string>()
    for (const e of physicalEdges) {
      if (isEdit && edge && e.id === edge.id) continue
      ids.add(e.sourcePortId)
      ids.add(e.targetPortId)
    }
    return ids
  }, [physicalEdges, isEdit, edge])

  const isPhysical = connectionType === 'physical'

  useEffect(() => {
    if (!isPhysical) return
    if (sourcePortId && usedPhysicalPortIds.has(sourcePortId)) {
      const p = sourcePorts.find((x) => x.id === sourcePortId)
      if (p && !allowsMultiplePhysicalConnectionsPerPort(devices, p.deviceId)) setSourcePortId('')
    }
    if (targetPortId && usedPhysicalPortIds.has(targetPortId)) {
      const p = targetPorts.find((x) => x.id === targetPortId)
      if (p && !allowsMultiplePhysicalConnectionsPerPort(devices, p.deviceId)) setTargetPortId('')
    }
  }, [isPhysical, usedPhysicalPortIds, sourcePortId, targetPortId, devices, sourcePorts, targetPorts])

  useEffect(() => {
    if (!sourcePortId) return
    const port = sourcePorts.find((p) => p.id === sourcePortId)
    if (port && port.status !== 'up') setSourcePortId('')
  }, [sourcePorts, sourcePortId])

  useEffect(() => {
    if (!targetPortId) return
    const port = targetPorts.find((p) => p.id === targetPortId)
    if (port && port.status !== 'up') setTargetPortId('')
  }, [targetPorts, targetPortId])

  const buildPortOptions = useCallback(
    (ports: Port[]): SelectOption[] =>
      ports.map((p) => {
        const portDown = p.status !== 'up'
        const occupied =
          isPhysical &&
          usedPhysicalPortIds.has(p.id) &&
          !allowsMultiplePhysicalConnectionsPerPort(devices, p.deviceId)
        const blocked = portDown || occupied
        let reason: string | undefined
        if (portDown && occupied) reason = `${p.status} · En uso`
        else if (portDown) reason = p.status
        else if (occupied) reason = 'En uso'
        return { value: p.id, label: portOptionLabel(p), disabled: blocked, disabledReason: reason }
      }),
    [isPhysical, usedPhysicalPortIds, devices]
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

  const metadataPayload =
    connectionType === 'logical'
      ? (() => {
          const payload: ConnectionMetadata = {}
          if (vlanName.trim()) payload.vlanName = vlanName.trim()
          if (vlanId.trim()) payload.vlanId = Number(vlanId)
          if (networkName.trim()) payload.networkName = networkName.trim()
          if (notes.trim()) payload.notes = notes.trim()
          if (logicalStatus) payload.status = logicalStatus
          return Object.keys(payload).length ? payload : null
        })()
      : undefined

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
        connectionType,
        mediumType,
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
        metadata: connectionType === 'logical' ? metadataPayload : undefined,
      }

      if (isEdit && edge) {
        await topologyService.updateConnection(edge.id, commonPayload)
      } else {
        await topologyService.createConnection({ companyId, ...commonPayload })
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

  const showLogicalFields = connectionType === 'logical'

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
                onChange={(e) => { setSourceDeviceId(e.target.value); setSourcePortId('') }} required />
              <Select label="Dispositivo destino" placeholder="Seleccionar" options={deviceOptions} value={targetDeviceId}
                onChange={(e) => { setTargetDeviceId(e.target.value); setTargetPortId('') }} required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select label="Puerto origen" placeholder={sourceDeviceId ? 'Seleccionar puerto' : 'Selecciona dispositivo primero'} options={sourcePortOptions}
                value={sourcePortId} onChange={(e) => setSourcePortId(e.target.value)} disabled={!sourceDeviceId} required
                hint={sourceDeviceId && sourceDisabledStats.total > 0 ? formatPortHint(sourceDisabledStats) : undefined} />
              <Select label="Puerto destino" placeholder={targetDeviceId ? 'Seleccionar puerto' : 'Selecciona dispositivo primero'} options={targetPortOptions}
                value={targetPortId} onChange={(e) => setTargetPortId(e.target.value)} disabled={!targetDeviceId} required
                hint={targetDeviceId && targetDisabledStats.total > 0 ? formatPortHint(targetDisabledStats) : undefined} />
            </div>

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
                      Los puertos asignados a una conexión física están bloqueados (excepto en dispositivos <span className="font-semibold">Cableado Estructurado</span>, donde un mismo puerto puede tener varios enlaces físicos). Las conexiones lógicas pueden reutilizar cualquier puerto.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Tipo de conexión */}
            <Select label="Tipo de enlace" options={[
              { value: 'physical', label: 'Físico' },
              { value: 'logical', label: 'Lógico' },
            ]} value={connectionType} onChange={(e) => setConnectionType(e.target.value as 'physical' | 'logical')} />

            {/* Medio de conexión */}
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 bg-gray-50/50 dark:bg-gray-800/30">
              <p className="text-xs uppercase tracking-wide font-semibold text-gray-500 dark:text-gray-400">Medio de conexión</p>
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

            {/* Campos lógicos */}
            {showLogicalFields && (
              <div className="space-y-3 rounded-lg border border-indigo-200 dark:border-indigo-800/40 p-4 bg-indigo-50/30 dark:bg-indigo-950/20">
                <p className="text-xs uppercase tracking-wide font-semibold text-indigo-600 dark:text-indigo-400">Metadatos lógicos</p>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Red" placeholder="ej. Prod VLAN" value={networkName}
                    onChange={(e) => { setNetworkName(e.target.value); setSelectedLogicalNetworkId('') }} />
                  <Select label="Estado del enlace" options={[
                    { value: 'active', label: 'Activo' },
                    { value: 'down', label: 'Caído' },
                  ]} value={logicalStatus} onChange={(e) => setLogicalStatus(e.target.value as 'active' | 'down')} />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas adicionales</label>
                  <textarea className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 min-h-[80px]"
                    value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Describe el contexto lógico (vSwitch, subred, owner...)" />
                </div>
              </div>
            )}
          </>
        )}

        {formError && <p className="text-sm text-red-500" role="alert">{formError}</p>}

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
