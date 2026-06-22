import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  Pencil,
  Search,
  Trash2,
  Wifi,
  Cable,
  Zap,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { StatusBadge } from '../components/StatusBadge'
import { ConnectionModal } from '../components/topology/ConnectionModal'
import {
  TopologyFlowCanvas,
  type TopologyFlowCanvasHandle,
  type TopologyServerLayout,
} from '../components/topology/TopologyFlowCanvas'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { topologyService } from '../services/topology.service'
import { companiesService } from '../services/companies.service'
import { exportTopologyPdf } from '../utils/exportPdf'
import type {
  LogicalTopologyEdge,
  LogicalTopologyLayer,
  TopologyData,
  TopologyEdge,
  TopologyNode,
  MediumType,
} from '../types'
import {
  formatMediumLabel,
  MEDIUM_LABELS,
  MEDIUM_COLORS,
  CONNECTION_STATUS_LABELS,
} from '../types'
import { mergeHostnamesFromInventory, normalizeTopologyHostname } from '../utils/topologyNodeData'
import { useToast } from '../contexts/ToastContext'

/** Etiqueta para selects de filtro: nombre + hostname cuando exista (p. ej. dos PTA). */
function formatDeviceFilterOptionLabel(node: TopologyNode): string {
  const host = normalizeTopologyHostname(node.data)
  return host ? `${node.label} — ${host}` : node.label
}

const formatLogicalNetworkLabel = (edge: LogicalTopologyEdge) => {
  const networks = edge.networks.map((network) => `${network.name} (${network.subnet})`)
  const metadataName = edge.metadata?.networkName
  if (metadataName && !networks.some((label) => label.includes(metadataName))) {
    networks.push(`${metadataName} (manual)`)
  }
  return networks.length ? networks.join(' · ') : undefined
}

const formatLogicalVlanLabel = (edge: LogicalTopologyEdge) => {
  const labels = edge.vlans.map((vlan) => `VLAN ${vlan.vlanId} · ${vlan.name}`)
  const metadataName = edge.metadata?.vlanName
  if (metadataName) {
    const prefix = edge.metadata?.vlanId ? `VLAN ${edge.metadata.vlanId}` : 'VLAN'
    const manualLabel = `${prefix} · ${metadataName} (manual)`
    if (!labels.includes(manualLabel)) labels.push(manualLabel)
  }
  return labels.length ? labels.join(' · ') : undefined
}

const MEDIUM_ICON: Record<MediumType, typeof Cable> = {
  utp: Cable,
  fiber: Zap,
  wifi: Wifi,
}

export default function Topology() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const toast = useToast()
  const canMutate = user?.role !== 'viewer'
  const companyId = user?.companyId ?? ''
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const topologyFlowRef = useRef<TopologyFlowCanvasHandle | null>(null)

  const { data: topology, isLoading, error, refetch } = useApi(() => topologyService.getTopology())
  const { data: companies } = useApi(() => companiesService.getAll())
  const companyName = useMemo(() => {
    if (!companies?.length || !companyId) return undefined
    return companies.find((c) => c.id === companyId)?.name
  }, [companies, companyId])
  const physicalTopology: TopologyData = useMemo(() => {
    const base = topology?.physical ?? { nodes: [], edges: [] }
    return {
      ...base,
      nodes: mergeHostnamesFromInventory(base.nodes, topology?.inventory),
    }
  }, [topology?.physical, topology?.inventory])

  const logicalTopology: LogicalTopologyLayer = useMemo(() => {
    const base = topology?.logical ?? { nodes: [], edges: [] }
    return {
      ...base,
      nodes: mergeHostnamesFromInventory(base.nodes, topology?.inventory),
    }
  }, [topology?.logical, topology?.inventory])
  const logicalEdges = logicalTopology.edges
  const logicalNodes = logicalTopology.nodes

  const logicalStatuses = useMemo(
    () => logicalEdges.reduce((acc, edge) => {
      if (edge.status === 'active') acc.active += 1
      else acc.down += 1
      return acc
    }, { active: 0, down: 0 }),
    [logicalEdges]
  )

  const logicalNetworkNames = useMemo(() => {
    const names = logicalEdges.flatMap((edge) => edge.networks.map((n) => `${n.name} (${n.subnet})`))
    const metadataNames = logicalEdges.map((e) => e.metadata?.networkName).filter((n): n is string => Boolean(n)).map((n) => `${n} (manual)`)
    return Array.from(new Set([...names, ...metadataNames]))
  }, [logicalEdges])

  const logicalVlanLabels = useMemo(() => {
    const labels = new Set<string>()
    logicalEdges.forEach((edge) => {
      edge.vlans.forEach((v) => labels.add(`VLAN ${v.vlanId} · ${v.name}`))
      const mn = edge.metadata?.vlanName
      if (mn) { const prefix = edge.metadata?.vlanId ? `VLAN ${edge.metadata.vlanId}` : 'VLAN'; labels.add(`${prefix} · ${mn} (manual)`) }
    })
    return Array.from(labels)
  }, [logicalEdges])

  const logicalCanvasTopology: TopologyData = useMemo(
    () => ({
      nodes: logicalTopology.nodes,
      edges: logicalTopology.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourcePort: edge.sourcePort,
        targetPort: edge.targetPort,
        sourcePortId: edge.sourcePortId,
        targetPortId: edge.targetPortId,
        connectionType: edge.connectionType,
        medium: edge.medium,
        connectionStatus: edge.connectionStatus,
        bandwidth: edge.bandwidth,
        networkLabel: formatLogicalNetworkLabel(edge),
        vlanLabel: formatLogicalVlanLabel(edge),
        description: edge.description ?? edge.metadata?.notes ?? null,
      })),
    }),
    [logicalTopology]
  )

  const mediumStats = useMemo(() => {
    const stats: Record<MediumType, number> = { utp: 0, fiber: 0, wifi: 0 }
    for (const e of physicalTopology.edges) {
      const mt = e.medium?.mediumType ?? 'utp'
      if (mt in stats) stats[mt as MediumType]++
    }
    return stats
  }, [physicalTopology.edges])

  const statusStats = useMemo(() => {
    const stats: Record<string, number> = { planned: 0, implemented: 0, verified: 0 }
    for (const e of physicalTopology.edges) {
      const st = e.connectionStatus ?? 'implemented'
      stats[st] = (stats[st] || 0) + 1
    }
    return stats
  }, [physicalTopology.edges])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingEdge, setEditingEdge] = useState<TopologyEdge | LogicalTopologyEdge | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [activeLayer, setActiveLayer] = useState<'physical' | 'logical'>('physical')
  const [modalLayer, setModalLayer] = useState<'physical' | 'logical'>('physical')
  const [exporting, setExporting] = useState(false)

  const topologyForCanvas = activeLayer === 'physical' ? physicalTopology : logicalCanvasTopology

  const flowPersistenceKey = useMemo(() => {
    if (!companyId) return undefined
    const base = `topology-${companyId}-${activeLayer}`
    if (user?.role === 'viewer' && user?.id) return `${base}-viewer-${user.id}`
    return base
  }, [companyId, activeLayer, user?.role, user?.id])

  const [serverLayout, setServerLayout] = useState<TopologyServerLayout | undefined>(undefined)

  useEffect(() => {
    if (!companyId) {
      setServerLayout(undefined)
      return
    }
    let cancelled = false
    setServerLayout(undefined)
    ;(async () => {
      try {
        const data = await topologyService.getCanvasLayout(companyId, activeLayer)
        if (!cancelled) {
          setServerLayout({
            nodePositions: data.nodePositions ?? {},
            labelOffsets: data.labelOffsets ?? {},
          })
        }
      } catch {
        if (!cancelled) setServerLayout({ nodePositions: {}, labelOffsets: {} })
      }
    })()
    return () => { cancelled = true }
  }, [companyId, activeLayer])

  const [connSearch, setConnSearch] = useState('')
  const [filterSourceDevice, setFilterSourceDevice] = useState('')
  const [filterTargetDevice, setFilterTargetDevice] = useState('')
  const [filterMedium, setFilterMedium] = useState('')
  const [filterBandwidth, setFilterBandwidth] = useState('')
  const connectionFiltersStorageKey = useMemo(
    () => `nm-topology:connection-filters:${companyId || 'global'}`, [companyId]
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(connectionFiltersStorageKey)
      if (!raw) return
      const parsed = JSON.parse(raw) as Partial<{
        connSearch: string
        filterSourceDevice: string
        filterTargetDevice: string
        filterMedium: string
        filterBandwidth: string
      }>
      if (typeof parsed.connSearch === 'string') setConnSearch(parsed.connSearch)
      if (typeof parsed.filterSourceDevice === 'string') setFilterSourceDevice(parsed.filterSourceDevice)
      if (typeof parsed.filterTargetDevice === 'string') setFilterTargetDevice(parsed.filterTargetDevice)
      if (typeof parsed.filterMedium === 'string') setFilterMedium(parsed.filterMedium)
      if (typeof parsed.filterBandwidth === 'string') setFilterBandwidth(parsed.filterBandwidth)
    } catch { /* */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionFiltersStorageKey])

  useEffect(() => {
    try {
      localStorage.setItem(connectionFiltersStorageKey, JSON.stringify({
        connSearch,
        filterSourceDevice,
        filterTargetDevice,
        filterMedium,
        filterBandwidth,
      }))
    } catch { /* */ }
  }, [connSearch, filterSourceDevice, filterTargetDevice, filterMedium, filterBandwidth, connectionFiltersStorageKey])
  const connectionsCollapsedStorageKey = useMemo(
    () => `nm-topology:connections-collapsed:${companyId || 'global'}`, [companyId]
  )
  const [connectionsCollapsed, setConnectionsCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem(connectionsCollapsedStorageKey) === '1' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(connectionsCollapsedStorageKey, connectionsCollapsed ? '1' : '0') } catch { /* */ }
  }, [connectionsCollapsed, connectionsCollapsedStorageKey])

  useEffect(() => {
    try { setConnectionsCollapsed(localStorage.getItem(connectionsCollapsedStorageKey) === '1') } catch { /* */ }
  }, [connectionsCollapsedStorageKey])

  const clearConnectionFilters = useCallback(() => {
    setConnSearch(''); setFilterSourceDevice(''); setFilterTargetDevice(''); setFilterMedium(''); setFilterBandwidth('')
  }, [])

  const openCreate = useCallback(() => {
    setModalLayer(activeLayer); setEditingEdge(null); setModalOpen(true)
  }, [activeLayer])

  const openEdit = useCallback((edge: TopologyEdge | LogicalTopologyEdge) => {
    setModalLayer(edge.connectionType === 'logical' ? 'logical' : 'physical')
    setEditingEdge(edge); setModalOpen(true)
  }, [])

  const handleNavigateToDevice = useCallback((deviceId: string) => { navigate(`/devices/${deviceId}`) }, [navigate])

  const handleNavigateToConnection = useCallback(
    (connectionId: string) => {
      const phys = physicalTopology.edges.find((e) => e.id === connectionId)
      if (phys) { setActiveLayer('physical'); openEdit(phys); return }
      const log = logicalTopology.edges.find((e) => e.id === connectionId)
      if (log) { setActiveLayer('logical'); openEdit(log) }
    },
    [physicalTopology.edges, logicalTopology.edges, openEdit]
  )

  const closeModal = useCallback(() => { setModalOpen(false); setEditingEdge(null) }, [])

  const resolveNodeLabel = useCallback(
    (id: string) =>
      physicalTopology.nodes.find((n) => n.id === id)?.label ??
      logicalTopology.nodes.find((n) => n.id === id)?.label ??
      'Desconocido',
    [logicalTopology.nodes, physicalTopology.nodes]
  )

  const handleDelete = useCallback(
    async (edge: TopologyEdge | LogicalTopologyEdge) => {
      const src = resolveNodeLabel(edge.source)
      const tgt = resolveNodeLabel(edge.target)
      const ok = window.confirm(`¿Eliminar conexión ${src} → ${tgt}? Esta acción no se puede deshacer.`)
      if (!ok) return
      try {
        setDeletingId(edge.id)
        await topologyService.deleteConnection(edge.id)
        refetch()
      } catch (err: unknown) {
        const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message || 'No se pudo eliminar la conexión.'
        toast.error('No se pudo eliminar la conexión', message)
      } finally { setDeletingId(null) }
    },
    [refetch, resolveNodeLabel, toast]
  )

  const handleExportPdf = useCallback(async () => {
    if (!canvasRef.current || !topology) return
    setExporting(true)
    try {
      const orientation = topologyFlowRef.current?.getPrintOrientation() ?? 'landscape'
      await exportTopologyPdf({
        title: 'Arquitectura de Red',
        subtitle: `${topologyForCanvas.nodes.length} dispositivos · ${topologyForCanvas.edges.length} conexiones`,
        companyName: companyName ?? undefined,
        authorName: user?.firstName ? `${user.firstName} ${user.lastName}` : undefined,
        canvasElement: canvasRef.current,
        topology: topologyForCanvas,
        orientation,
        prepareHighResCanvas: topologyFlowRef.current?.prepareExportCapture,
      })
      toast.success('PDF exportado', 'Se descargó el archivo con el diagrama y la tabla de conexiones.')
    } catch (err) {
      console.error('Error exporting PDF:', err)
      toast.error('Error al exportar el PDF', 'Intenta de nuevo.')
    } finally { setExporting(false) }
  }, [topology, topologyForCanvas, user, companyName, toast])

  const deviceFilterOptions = useMemo(() => {
    if (!physicalTopology.nodes.length) return [{ value: '', label: 'Todos' }]
    const sorted = [...physicalTopology.nodes].sort((a, b) =>
      formatDeviceFilterOptionLabel(a).localeCompare(formatDeviceFilterOptionLabel(b), undefined, { sensitivity: 'base' })
    )
    return [
      { value: '', label: 'Todos' },
      ...sorted.map((n) => ({ value: n.id, label: formatDeviceFilterOptionLabel(n) })),
    ]
  }, [physicalTopology.nodes])

  const mediumFilterOptions = useMemo(() => [
    { value: '', label: 'Todos los medios' },
    { value: 'utp', label: 'Cable UTP' },
    { value: 'fiber', label: 'Fibra óptica' },
    { value: 'wifi', label: 'WiFi' },
  ], [])

  const bandwidthFilterOptions = useMemo(() => {
    if (!physicalTopology.edges.length) return [{ value: '', label: 'Todas' }]
    const set = new Set<string>()
    for (const e of physicalTopology.edges) { if (e.bandwidth?.trim()) set.add(e.bandwidth.trim()) }
    const sorted = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return [{ value: '', label: 'Todas' }, ...sorted.map((b) => ({ value: b, label: b }))]
  }, [physicalTopology.edges])

  const filteredEdges = useMemo(() => {
    if (!physicalTopology.edges.length) return []
    const q = connSearch.trim().toLowerCase()
    return physicalTopology.edges.filter((edge) => {
      const srcNode = physicalTopology.nodes.find((n) => n.id === edge.source)
      const tgtNode = physicalTopology.nodes.find((n) => n.id === edge.target)
      const srcLabel = (srcNode?.label ?? '').toLowerCase()
      const tgtLabel = (tgtNode?.label ?? '').toLowerCase()
      const srcHost = (normalizeTopologyHostname(srcNode?.data) ?? '').toLowerCase()
      const tgtHost = (normalizeTopologyHostname(tgtNode?.data) ?? '').toLowerCase()
      const sp = edge.sourcePort.toLowerCase()
      const tp = edge.targetPort.toLowerCase()
      const desc = (edge.description ?? '').toLowerCase()
      const bw = (edge.bandwidth ?? '').toLowerCase()
      const ml = edge.medium ? formatMediumLabel(edge.medium).toLowerCase() : ''

      if (filterSourceDevice && edge.source !== filterSourceDevice) return false
      if (filterTargetDevice && edge.target !== filterTargetDevice) return false
      if (filterMedium && (edge.medium?.mediumType ?? 'utp') !== filterMedium) return false
      if (filterBandwidth && (edge.bandwidth?.trim() ?? '') !== filterBandwidth) return false

      if (q) {
        const hay = `${srcLabel} ${tgtLabel} ${srcHost} ${tgtHost} ${sp} ${tp} ${desc} ${bw} ${ml}`
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [physicalTopology.edges, physicalTopology.nodes, connSearch, filterSourceDevice, filterTargetDevice, filterMedium, filterBandwidth])

  const hasActiveFilters = !!connSearch.trim() || !!filterSourceDevice || !!filterTargetDevice || !!filterMedium || !!filterBandwidth
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (connSearch.trim()) chips.push({ key: 'q', label: `Buscar: ${connSearch.trim()}`, onRemove: () => setConnSearch('') })
    if (filterSourceDevice) {
      const node = physicalTopology.nodes.find((n) => n.id === filterSourceDevice)
      chips.push({ key: 'src', label: `Origen: ${node ? formatDeviceFilterOptionLabel(node) : filterSourceDevice}`, onRemove: () => setFilterSourceDevice('') })
    }
    if (filterTargetDevice) {
      const node = physicalTopology.nodes.find((n) => n.id === filterTargetDevice)
      chips.push({ key: 'tgt', label: `Destino: ${node ? formatDeviceFilterOptionLabel(node) : filterTargetDevice}`, onRemove: () => setFilterTargetDevice('') })
    }
    if (filterMedium) {
      const label = filterMedium === 'utp' ? 'Cable UTP' : filterMedium === 'fiber' ? 'Fibra óptica' : filterMedium === 'wifi' ? 'WiFi' : filterMedium
      chips.push({ key: 'medium', label: `Medio: ${label}`, onRemove: () => setFilterMedium('') })
    }
    if (filterBandwidth) chips.push({ key: 'bw', label: `Velocidad: ${filterBandwidth}`, onRemove: () => setFilterBandwidth('') })
    return chips
  }, [connSearch, filterSourceDevice, filterTargetDevice, filterMedium, filterBandwidth, physicalTopology.nodes])

  return (
    <div className="space-y-6">
      <PageHeader
        title={companyName ? `${companyName} — Arquitectura de Red` : 'Arquitectura de Red'}
        subtitle="Documentación visual de la topología de red del sitio"
        actions={
          <div className="flex gap-2">
            {canMutate && companyId && (
              <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nueva conexión</Button>
            )}
            {topologyForCanvas.nodes.length > 0 && (
              <Button variant="secondary" icon={<Download className="w-4 h-4" />} onClick={handleExportPdf} isLoading={exporting} disabled={exporting}>
                Exportar PDF
              </Button>
            )}
          </div>
        }
      />

      {/* Layer tabs */}
      <div className="flex flex-wrap gap-3">
        <button type="button" className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeLayer === 'physical' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
          onClick={() => setActiveLayer('physical')}>
          Capa física
        </button>
        <button type="button" className={`px-4 py-2 rounded-full text-sm font-semibold transition ${activeLayer === 'logical' ? 'bg-violet-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
          onClick={() => setActiveLayer('logical')}>
          Capa lógica
        </button>
      </div>

      {/* Stats cards */}
      {!isLoading && !error && topology && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card title="Dispositivos" value={topologyForCanvas.nodes.length} subtitle={activeLayer === 'physical' ? 'En capa física' : 'En capa lógica'} />
            <Card title="Conexiones" value={topologyForCanvas.edges.length} subtitle="Documentadas" />
            {activeLayer === 'physical' && (
              <>
                {Object.entries(mediumStats).map(([mt, count]) => {
                  const Icon = MEDIUM_ICON[mt as MediumType]
                  return (
                    <Card key={mt} title={MEDIUM_LABELS[mt as MediumType]} value={count}
                      subtitle={<span className="inline-flex items-center gap-1"><Icon className="w-3 h-3" style={{ color: MEDIUM_COLORS[mt as MediumType] }} />{mt.toUpperCase()}</span>} />
                  )
                })}
              </>
            )}
            {activeLayer === 'logical' && (
              <>
                <Card title="Redes" value={logicalNetworkNames.length} subtitle="Documentadas" />
                <Card title="VLANs" value={logicalVlanLabels.length} subtitle="Registradas" />
                <Card title="Activos" value={logicalStatuses.active} subtitle="Puertos arriba" />
                <Card title="Caídos" value={logicalStatuses.down} subtitle="Puertos abajo" />
              </>
            )}
          </div>

          {/* Medium legend */}
          {activeLayer === 'physical' && physicalTopology.edges.length > 0 && (
            <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Leyenda:</span>
              {([['utp', 'Cable UTP', '─'], ['fiber', 'Fibra óptica', '─'], ['wifi', 'WiFi', '┈']] as const).map(([mt, label, line]) => (
                <span key={mt} className="inline-flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <span className="font-mono font-bold" style={{ color: MEDIUM_COLORS[mt] }}>{line}{line}</span>
                  {label}
                </span>
              ))}
              <span className="mx-2 h-4 w-px bg-gray-200 dark:bg-gray-700" />
              {Object.entries(CONNECTION_STATUS_LABELS).map(([key, label]) => {
                const dotColor = key === 'planned' ? 'bg-yellow-400' : key === 'verified' ? 'bg-emerald-400' : 'bg-blue-400'
                return (
                  <span key={key} className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                    <span className={`size-2 rounded-full ${dotColor}`} />
                    {label}{statusStats[key] ? ` (${statusStats[key]})` : ''}
                  </span>
                )
              })}
            </div>
          )}

          {/* Canvas */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-3 sm:p-4">
            <div className="mb-3 px-1 space-y-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Diagrama de topología</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Arrastra los nodos para reorganizar. Usa «Guardar en servidor» para persistir el diagrama en la base de datos; el navegador también conserva un respaldo local al mover nodos.
              </p>
            </div>
            <TopologyFlowCanvas
              ref={topologyFlowRef}
              topology={topologyForCanvas}
              persistenceKey={flowPersistenceKey}
              readOnly={!canMutate}
              onNavigateToDevice={handleNavigateToDevice}
              onNavigateToConnection={handleNavigateToConnection}
              canvasRef={canvasRef}
              onExportPdf={handleExportPdf}
              exporting={exporting}
              serverLayout={serverLayout}
              onPersistLayout={
                companyId
                  ? async (payload) => {
                      await topologyService.saveCanvasLayout({
                        companyId,
                        layer: activeLayer,
                        nodePositions: payload.nodePositions,
                        labelOffsets: payload.labelOffsets,
                      })
                    }
                  : undefined
              }
              onClearServerLayout={
                companyId
                  ? async () => {
                      await topologyService.clearCanvasLayout(companyId, activeLayer)
                    }
                  : undefined
              }
            />
          </div>
        </>
      )}

      {isLoading && <div className="text-center py-8 text-gray-500">Cargando topología...</div>}
      {error && <div className="text-center py-8 text-red-500" role="alert">{error}</div>}

      {!isLoading && !error && topology && (
        <>
          {/* Physical connections table */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">Conexiones físicas</h3>
                {physicalTopology.edges.length > 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Mostrando {filteredEdges.length} de {physicalTopology.edges.length}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 justify-between sm:justify-end">
                <button type="button" onClick={() => setConnectionsCollapsed((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                  aria-expanded={!connectionsCollapsed}>
                  {connectionsCollapsed ? <><ChevronDown className="h-4 w-4 shrink-0" aria-hidden />Expandir</> : <><ChevronUp className="h-4 w-4 shrink-0" aria-hidden />Retraer</>}
                </button>
              </div>
            </div>
            <div className={[
              'overflow-hidden will-change-[max-height,height,opacity]',
              'transition-[max-height,height,opacity] duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
              connectionsCollapsed
                ? 'h-0 max-h-0 opacity-0 pointer-events-none'
                : physicalTopology.edges.length > 0
                  ? 'h-[min(72vh,52rem)] max-h-[min(72vh,52rem)] opacity-100'
                  : 'max-h-[min(72vh,52rem)] opacity-100',
            ].join(' ')}>
              <div
                className={[
                  'flex min-h-0 flex-col',
                  physicalTopology.edges.length > 0 && !connectionsCollapsed ? 'h-full max-h-full' : 'max-h-[min(72vh,52rem)]',
                ].filter(Boolean).join(' ')}
              >
                {physicalTopology.edges.length > 0 && (
                  <div className="shrink-0 border-b border-gray-200 bg-gray-50/80 px-6 py-4 space-y-3 dark:border-gray-800 dark:bg-gray-900/40">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                      <input type="search" placeholder="Buscar por dispositivo, hostname, puerto, medio, velocidad…"
                        value={connSearch} onChange={(e) => setConnSearch(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <Select label="Dispositivo origen" options={deviceFilterOptions} value={filterSourceDevice}
                        onChange={(e) => setFilterSourceDevice(e.target.value)} className="!mb-0" />
                      <Select label="Dispositivo destino" options={deviceFilterOptions} value={filterTargetDevice}
                        onChange={(e) => setFilterTargetDevice(e.target.value)} className="!mb-0" />
                      <Select label="Medio" options={mediumFilterOptions} value={filterMedium}
                        onChange={(e) => setFilterMedium(e.target.value)} className="!mb-0" />
                      <Select label="Velocidad" options={bandwidthFilterOptions} value={filterBandwidth}
                        onChange={(e) => setFilterBandwidth(e.target.value)} className="!mb-0" />
                    </div>
                    {hasActiveFilters && (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Filtros
                          </span>
                          {activeFilterChips.map((chip) => (
                            <button
                              key={chip.key}
                              type="button"
                              onClick={chip.onRemove}
                              className="inline-flex max-w-full items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                              title="Quitar filtro"
                            >
                              <span className="truncate">{chip.label}</span>
                              <span className="text-gray-400 dark:text-gray-500" aria-hidden>×</span>
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-end">
                          <Button type="button" size="sm" variant="secondary" onClick={clearConnectionFilters}>Limpiar todo</Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!physicalTopology.edges.length ? (
                  <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    Aún no hay conexiones documentadas.
                    {canMutate && companyId && (
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Presiona &quot;Nueva conexión&quot; para documentar tu primer enlace.</p>
                    )}
                  </div>
                ) : filteredEdges.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                    No hay conexiones que coincidan con los filtros.
                    {hasActiveFilters && (
                      <span className="mt-2 block"><Button size="sm" variant="secondary" onClick={clearConnectionFilters}>Limpiar todo</Button></span>
                    )}
                  </div>
                ) : (
                  <div className="min-h-0 flex-1 overflow-y-scroll [scrollbar-gutter:stable]">
                    <div className="divide-y divide-gray-100 dark:divide-gray-800/50">
                      {filteredEdges.map((edge) => {
                        const srcNode = physicalTopology.nodes.find((n) => n.id === edge.source)
                        const tgtNode = physicalTopology.nodes.find((n) => n.id === edge.target)
                        const srcHost = normalizeTopologyHostname(srcNode?.data)
                        const tgtHost = normalizeTopologyHostname(tgtNode?.data)
                        const mediumLabel = edge.medium ? formatMediumLabel(edge.medium) : 'Sin especificar'
                        const mediumColor = MEDIUM_COLORS[edge.medium?.mediumType ?? 'utp']
                        const statusLabel = CONNECTION_STATUS_LABELS[edge.connectionStatus] ?? edge.connectionStatus
                        const statusDot = edge.connectionStatus === 'planned' ? 'bg-yellow-400' : edge.connectionStatus === 'verified' ? 'bg-emerald-400' : 'bg-blue-400'

                        return (
                          <div key={edge.id} className="space-y-2 px-6 py-4">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                              <div className="flex min-w-0 flex-1 items-center gap-4">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-gray-900 dark:text-white">{srcNode?.label || 'Desconocido'}</p>
                                  {srcHost && (
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={srcHost}>{srcHost}</p>
                                  )}
                                  <p className="truncate text-xs text-gray-500">{edge.sourcePort}</p>
                                </div>
                                <ArrowRight className="hidden h-4 w-4 flex-shrink-0 text-gray-400 sm:block" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium text-gray-900 dark:text-white">{tgtNode?.label || 'Desconocido'}</p>
                                  {tgtHost && (
                                    <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={tgtHost}>{tgtHost}</p>
                                  )}
                                  <p className="truncate text-xs text-gray-500">{edge.targetPort}</p>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0 lg:justify-end">
                                <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                                  style={{ borderColor: mediumColor, color: mediumColor }}>
                                  {mediumLabel}
                                </span>
                                {edge.bandwidth && (
                                  <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{edge.bandwidth}</span>
                                )}
                                <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-300 dark:bg-gray-800">
                                  <span className={`size-1.5 rounded-full ${statusDot}`} />
                                  {statusLabel}
                                </span>
                                {canMutate && (
                                  <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="sm" className="!p-2"
                                      icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(edge)} aria-label="Editar">Editar</Button>
                                    <Button type="button" variant="ghost" size="sm" className="!p-2 text-red-600 hover:text-red-700 dark:text-red-400"
                                      icon={<Trash2 className="h-4 w-4" />} onClick={() => handleDelete(edge)}
                                      disabled={deletingId === edge.id} isLoading={deletingId === edge.id} aria-label="Eliminar">Eliminar</Button>
                                  </div>
                                )}
                              </div>
                            </div>
                            {edge.description && <p className="text-xs text-gray-500 dark:text-gray-400">{edge.description}</p>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Logical section */}
          <div className="space-y-5">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Topología lógica</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Redes, VLANs y estado de los enlaces virtuales entre dispositivos.
                </p>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                {logicalEdges.length} enlace{logicalEdges.length === 1 ? '' : 's'} · {logicalNetworkNames.length} red{logicalNetworkNames.length === 1 ? '' : 'es'} · {logicalVlanLabels.length} VLAN{logicalVlanLabels.length === 1 ? '' : 's'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <StatusBadge status="up">{logicalStatuses.active} enlaces activos</StatusBadge>
              <StatusBadge status="down">{logicalStatuses.down} enlaces caídos</StatusBadge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Redes visibles</p>
                <div className="flex flex-wrap gap-2">
                  {logicalNetworkNames.length ? logicalNetworkNames.map((name) => (
                    <span key={name} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 px-3 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">{name}</span>
                  )) : <p className="text-xs text-gray-500 dark:text-gray-400">Aún no hay redes documentadas.</p>}
                </div>
              </div>
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-5 space-y-2">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">VLANs activas</p>
                <div className="flex flex-wrap gap-2">
                  {logicalVlanLabels.length ? logicalVlanLabels.map((label) => (
                    <span key={label} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 px-3 py-1 text-[11px] font-semibold text-gray-700 dark:text-gray-200">{label}</span>
                  )) : <p className="text-xs text-gray-500 dark:text-gray-400">No hay VLANs registradas.</p>}
                </div>
              </div>
            </div>

            <LogicalConnectionsTable edges={logicalEdges} nodes={logicalNodes}
              onEdit={(edge) => openEdit(edge)} onDelete={(edge) => handleDelete(edge)} deletingId={deletingId} />
          </div>
        </>
      )}

      {canMutate && companyId && (
        <ConnectionModal isOpen={modalOpen} onClose={closeModal} companyId={companyId}
          edge={editingEdge} onSaved={refetch} mode={modalLayer} physicalEdges={physicalTopology.edges} />
      )}
    </div>
  )
}

interface LogicalConnectionsTableProps {
  edges: LogicalTopologyEdge[]
  nodes: TopologyNode[]
  onEdit: (edge: LogicalTopologyEdge) => void
  onDelete: (edge: LogicalTopologyEdge) => void
  deletingId: string | null
}

function LogicalConnectionsTable({ edges, nodes, onEdit, onDelete, deletingId }: LogicalConnectionsTableProps) {
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? 'Desconocido'

  if (!edges.length) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/40 dark:bg-gray-900/30 px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
        Aún no hay enlaces lógicos. Agrega conexiones de tipo "Lógico" para registrarlas.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800 text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            <tr>
              <th className="px-6 py-3">Origen</th>
              <th className="px-6 py-3">Destino</th>
              <th className="px-6 py-3">Medio</th>
              <th className="px-6 py-3">VLANs</th>
              <th className="px-6 py-3">Redes</th>
              <th className="px-6 py-3 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {edges.map((edge) => {
              const linkStatus = edge.metadata?.status ?? edge.status
              const normalizedLinkStatus = linkStatus === 'active' ? 'up' : linkStatus
              const mediumLabel = edge.medium ? formatMediumLabel(edge.medium) : '—'
              const mediumColor = MEDIUM_COLORS[edge.medium?.mediumType ?? 'utp']
              return (
                <tr key={edge.id}>
                  <td className="px-6 py-4 align-top">
                    <p className="font-medium text-gray-900 dark:text-white">{label(edge.source)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{edge.sourcePort} · #{edge.sourcePortNumber}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <StatusBadge status={edge.sourcePortStatus} />
                    </div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <p className="font-medium text-gray-900 dark:text-white">{label(edge.target)}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{edge.targetPort} · #{edge.targetPortNumber}</p>
                    <div className="mt-2"><StatusBadge status={edge.targetPortStatus} /></div>
                  </td>
                  <td className="px-6 py-4 align-top">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                      style={{ borderColor: mediumColor, color: mediumColor }}>{mediumLabel}</span>
                  </td>
                  <td className="px-6 py-4 align-top">
                    {edge.vlans.length ? (
                      <div className="flex flex-wrap gap-1">
                        {edge.vlans.map((v) => (
                          <span key={v.id} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                            {v.name} · VLAN {v.vlanId} {v.isTagged ? 'tagged' : 'untagged'}
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-500">Sin VLAN</p>}
                  </td>
                  <td className="px-6 py-4 align-top">
                    {edge.networks.length ? (
                      <div className="flex flex-wrap gap-1">
                        {edge.networks.map((n) => (
                          <span key={n.id} className="rounded-full border border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-800/60 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                            {n.name} ({n.subnet})
                          </span>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-500">Sin red</p>}
                  </td>
                  <td className="px-6 py-4 align-top text-right">
                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={normalizedLinkStatus} />
                      <p className="text-xs text-gray-500">{edge.bandwidth ?? 'Sin velocidad'}</p>
                      <div className="flex items-center gap-1 mt-2">
                        <Button type="button" variant="ghost" size="sm" className="!p-0 text-blue-600 dark:text-blue-300"
                          icon={<Pencil className="w-4 h-4" />} onClick={() => onEdit(edge)}>Editar</Button>
                        <Button type="button" variant="ghost" size="sm" className="!p-0 text-red-600 dark:text-red-400"
                          icon={<Trash2 className="w-4 h-4" />} onClick={() => onDelete(edge)}
                          disabled={deletingId === edge.id} isLoading={deletingId === edge.id}>Eliminar</Button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
