import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import { ConnectionModal } from '../components/topology/ConnectionModal'
import { PrintReportModal } from '../components/topology/PrintReportModal'
import {
  TopologyFlowCanvas,
  type TopologyFlowCanvasHandle,
  type TopologyServerLayout,
} from '../components/topology/TopologyFlowCanvas'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { topologyService } from '../services/topology.service'
import { sitesService } from '../services/sites.service'
import { coerceWorkAreasArray } from '../utils/topologyWorkAreas'
import {
  enrichTopologyNodesSiteArea,
  mergeHostnamesFromInventory,
  normalizeTopologyHostname,
} from '../utils/topologyNodeData'
import { exportTopologyPdf } from '../utils/exportPdf'
import { systemBrandingService } from '../services/systemBranding.service'
import type {
  Area,
  Site,
  TopologyData,
  TopologyEdge,
  TopologyNode,
  TopologyRackSummary,
  MediumType,
} from '../types'
import {
  formatMediumLabel,
  MEDIUM_LABELS,
  MEDIUM_COLORS,
  CONNECTION_STATUS_LABELS,
} from '../types'
import { useToast } from '../contexts/ToastContext'
import {
  buildPortConnectLookup,
  inferDragConnectMedium,
} from '../utils/topologyDragConnect'

function formatDeviceFilterOptionLabel(node: TopologyNode): string {
  const host = normalizeTopologyHostname(node.data)
  return host ? `${node.label} — ${host}` : node.label
}

function formatEdgeNetworkLabel(edge: TopologyEdge): string | undefined {
  const networks = (edge.networks ?? []).map((network) => `${network.name} (${network.subnet})`)
  const metadataName = edge.metadata?.networkName
  if (metadataName && !networks.some((label) => label.includes(metadataName))) {
    networks.push(`${metadataName} (manual)`)
  }
  return networks.length ? networks.join(' · ') : undefined
}

function formatEdgeVlanLabel(edge: TopologyEdge): string | undefined {
  const vlans = edge.vlans ?? []
  if (edge.portRole === 'trunk' && vlans.length > 1) {
    const base = `Trunk · ${vlans.length} VLANs`
    const detail = vlans.map((v) => `${v.vlanId}`).join(', ')
    return `${base} (${detail})`
  }
  const labels = vlans.map((vlan) => {
    const tag = vlan.isTagged ? ' tagged' : ' untagged'
    return `VLAN ${vlan.vlanId} · ${vlan.name}${tag}`
  })
  const metadataName = edge.metadata?.vlanName
  if (metadataName) {
    const prefix = edge.metadata?.vlanId ? `VLAN ${edge.metadata.vlanId}` : 'VLAN'
    const manualLabel = `${prefix} · ${metadataName} (manual)`
    if (!labels.includes(manualLabel)) labels.push(manualLabel)
  }
  return labels.length ? labels.join(' · ') : undefined
}

/** Solo enlaces de capa física; los nodos ya vienen del inventario (preparados en graphTopology). */
function filterPhysicalTopology(
  topology: TopologyData,
  inventory?: TopologyNode[],
): TopologyData {
  const edges = topology.edges.filter((edge) => edge.connectionType !== 'logical')
  const nodes = topology.nodes.length ? topology.nodes : inventory?.length ? inventory : []
  return {
    nodes,
    edges,
  }
}

export default function Topology() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeProjectId, activeProject, roleInActiveProject } = useProject()
  const { canMutate } = usePermissions()
  const toast = useToast()
  const projectId = activeProjectId
  const projectName = activeProject?.name
  const canvasRef = useRef<HTMLDivElement | null>(null)
  const topologyFlowRef = useRef<TopologyFlowCanvasHandle | null>(null)

  const { data: topology, isLoading, error, refetch } = useApi(
    () => topologyService.getTopology(projectId || undefined),
    [projectId]
  )

  const topologyRacks = topology?.racks ?? []

  const { data: sitesData } = useApi<Site[]>(
    () => (projectId ? sitesService.getAll() : Promise.resolve([])),
    [projectId]
  )
  const sites = sitesData ?? []

  const graphTopology: TopologyData = useMemo(() => {
    const base = topology?.graph ?? { nodes: [], edges: [] }
    const sourceNodes = topology?.inventory?.length ? topology.inventory : base.nodes
    const withHostnames = mergeHostnamesFromInventory(sourceNodes, topology?.inventory)
    const nodes = enrichTopologyNodesSiteArea(withHostnames, sites)
    return {
      nodes,
      edges: base.edges.map((edge) => ({
        ...edge,
        networkLabel: formatEdgeNetworkLabel(edge),
        vlanLabel: formatEdgeVlanLabel(edge),
        description: edge.description ?? edge.metadata?.notes ?? null,
      })),
    }
  }, [topology?.graph, topology?.inventory, sites])

  const physicalDiagram = useMemo(
    () => filterPhysicalTopology(graphTopology, topology?.inventory),
    [graphTopology, topology?.inventory]
  )

  const areasBySiteId = useMemo(() => {
    const map: Record<string, Area[]> = {}
    for (const site of sites) {
      map[site.id] = site.areas ?? []
    }
    // Completar áreas conocidas solo por racks si el listado de sitios no trae areas
    for (const rack of topologyRacks) {
      if (!rack.siteId || !rack.areaId) continue
      const list = map[rack.siteId] ?? []
      if (!list.some((a) => a.id === rack.areaId)) {
        list.push({
          id: rack.areaId,
          siteId: rack.siteId,
          name: rack.areaName ?? 'Área',
          notes: null,
          createdAt: '',
          updatedAt: '',
        })
        map[rack.siteId] = list
      }
    }
    return map
  }, [sites, topologyRacks])

  const [printOverride, setPrintOverride] = useState<{
    topology: TopologyData
    racks: TopologyRackSummary[]
  } | null>(null)
  const [printModalOpen, setPrintModalOpen] = useState(false)

  const canvasTopology = printOverride?.topology ?? physicalDiagram
  const canvasRacks = printOverride?.racks ?? topologyRacks

  const [modalOpen, setModalOpen] = useState(false)
  const [editingEdge, setEditingEdge] = useState<TopologyEdge | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const flowPersistenceKey = useMemo(() => {
    if (!projectId) return undefined
    const base = `topology-${projectId}-unified`
    if (roleInActiveProject === 'viewer' && user?.id) return `${base}-viewer-${user.id}`
    return base
  }, [projectId, roleInActiveProject, user?.id])

  const [serverLayout, setServerLayout] = useState<TopologyServerLayout | undefined>(undefined)

  useEffect(() => {
    if (!projectId) {
      setServerLayout(undefined)
      return
    }
    let cancelled = false
    setServerLayout(undefined)
    ;(async () => {
      try {
        const data = await topologyService.getCanvasLayout(projectId)
        if (!cancelled) {
          setServerLayout({
            nodePositions: data.nodePositions ?? {},
            labelOffsets: data.labelOffsets ?? {},
            workAreas: coerceWorkAreasArray(data.workAreas),
            nodeParents: data.nodeParents ?? {},
          })
        }
      } catch {
        if (!cancelled) {
          setServerLayout({ nodePositions: {}, labelOffsets: {}, workAreas: [], nodeParents: {} })
        }
      }
    })()
    return () => { cancelled = true }
  }, [projectId])

  const [connSearch, setConnSearch] = useState('')
  const [filterSourceDevice, setFilterSourceDevice] = useState('')
  const [filterTargetDevice, setFilterTargetDevice] = useState('')
  const [filterMedium, setFilterMedium] = useState('')
  const [filterBandwidth, setFilterBandwidth] = useState('')
  const [filterVlan, setFilterVlan] = useState('')
  const [filterNetwork, setFilterNetwork] = useState('')
  const connectionFiltersStorageKey = useMemo(
    () => `nm-topology:connection-filters:${projectId || 'global'}`, [projectId]
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
        filterVlan: string
        filterNetwork: string
      }>
      if (typeof parsed.connSearch === 'string') setConnSearch(parsed.connSearch)
      if (typeof parsed.filterSourceDevice === 'string') setFilterSourceDevice(parsed.filterSourceDevice)
      if (typeof parsed.filterTargetDevice === 'string') setFilterTargetDevice(parsed.filterTargetDevice)
      if (typeof parsed.filterMedium === 'string') setFilterMedium(parsed.filterMedium)
      if (typeof parsed.filterBandwidth === 'string') setFilterBandwidth(parsed.filterBandwidth)
      if (typeof parsed.filterVlan === 'string') setFilterVlan(parsed.filterVlan)
      if (typeof parsed.filterNetwork === 'string') setFilterNetwork(parsed.filterNetwork)
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
        filterVlan,
        filterNetwork,
      }))
    } catch { /* */ }
  }, [connSearch, filterSourceDevice, filterTargetDevice, filterMedium, filterBandwidth, filterVlan, filterNetwork, connectionFiltersStorageKey])

  const connectionsCollapsedStorageKey = useMemo(
    () => `nm-topology:connections-collapsed:${projectId || 'global'}`, [projectId]
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
    setConnSearch('')
    setFilterSourceDevice('')
    setFilterTargetDevice('')
    setFilterMedium('')
    setFilterBandwidth('')
    setFilterVlan('')
    setFilterNetwork('')
  }, [])

  const openCreate = useCallback(() => {
    setEditingEdge(null)
    setModalOpen(true)
  }, [])

  const openEdit = useCallback((edge: TopologyEdge) => {
    setEditingEdge(edge)
    setModalOpen(true)
  }, [])

  const handleNavigateToDevice = useCallback((deviceId: string) => { navigate(`/devices/${deviceId}`) }, [navigate])

  const handleNavigateToConnection = useCallback(
    (connectionId: string) => {
      const edge = graphTopology.edges.find((e) => e.id === connectionId)
      if (edge) openEdit(edge)
    },
    [graphTopology.edges, openEdit]
  )

  const handleConnectPorts = useCallback(
    async (
      sourcePortId: string,
      targetPortId: string,
      sourceFace: 'front' | 'rear' = 'front',
      targetFace: 'front' | 'rear' = 'front',
    ) => {
      if (!projectId || !canMutate) return
      const lookup = buildPortConnectLookup(physicalDiagram)
      const source = lookup.get(sourcePortId)
      const target = lookup.get(targetPortId)
      if (!source || !target) {
        toast.error('No se pudo crear el enlace', 'Puerto no encontrado en el diagrama.')
        return
      }
      try {
        await topologyService.createConnection({
          projectId,
          sourcePortId,
          targetPortId,
          sourceFace,
          targetFace,
          connectionType: 'physical',
          mediumType: inferDragConnectMedium(source, target),
          connectionStatus: 'implemented',
        })
        toast.success('Enlace creado', 'Doble clic en el cable para editar detalles.')
        refetch()
      } catch (err: unknown) {
        const axiosErr = err as {
          response?: {
            data?: {
              message?: string
              errors?: Array<{ message?: string; field?: string; rule?: string }>
            }
          }
        }
        const fieldErrors = axiosErr.response?.data?.errors
          ?.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
          .filter(Boolean)
          .join('; ')
        const message =
          fieldErrors ||
          axiosErr.response?.data?.message ||
          'No se pudo crear la conexión.'
        toast.error('No se pudo crear el enlace', message)
      }
    },
    [projectId, canMutate, physicalDiagram, toast, refetch],
  )

  const closeModal = useCallback(() => { setModalOpen(false); setEditingEdge(null) }, [])

  const resolveNodeLabel = useCallback(
    (id: string) => graphTopology.nodes.find((n) => n.id === id)?.label ?? 'Desconocido',
    [graphTopology.nodes]
  )

  const handleDelete = useCallback(
    async (edge: TopologyEdge) => {
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

  const handleExportPdf = useCallback(() => {
    const pages = topologyFlowRef.current?.estimatePrintPages()
    if (pages != null && pages > 1) {
      toast.info(
        `El diagrama ocupa ${pages} páginas`,
        'Usá «Ajustar a A4» o mové nodos con «Mostrar límites» antes de exportar.',
      )
    }
    setPrintModalOpen(true)
  }, [toast])

  const waitFrames = (n = 2) =>
    new Promise<void>((resolve) => {
      const step = (left: number) => {
        if (left <= 0) {
          resolve()
          return
        }
        requestAnimationFrame(() => step(left - 1))
      }
      step(n)
    })

  const handleConfirmPrintReport = useCallback(
    async (payload: {
      filters: import('../utils/topologyPrintFilter').TopologyPrintFilters
      filteredTopology: TopologyData
      filteredRacks: TopologyRackSummary[]
      externalNodesById: Map<string, import('../types').TopologyNode>
      externalEdgeCount: number
      subtitle: string
    }) => {
      const {
        filters,
        filteredTopology,
        filteredRacks,
        externalNodesById,
        externalEdgeCount,
        subtitle,
      } = payload
      setExporting(true)
      try {
        const authorName = user?.firstName ? `${user.firstName} ${user.lastName}` : undefined
        const externalHint =
          externalEdgeCount > 0 ? ` · ${externalEdgeCount} enlaces hacia el exterior` : ''

        let branding: { logoDataUrl?: string; reportTagline?: string } | undefined
        try {
          const meta = await systemBrandingService.get()
          const logoDataUrl = meta.hasLogo
            ? (await systemBrandingService.fetchLogoPngDataUrl()) ?? undefined
            : undefined
          branding = {
            logoDataUrl,
            reportTagline: meta.reportTagline ?? undefined,
          }
        } catch {
          branding = undefined
        }

        const baseOpts = {
          title: 'Arquitectura de Red',
          subtitle: `${subtitle} · ${filteredTopology.nodes.length} equipos · ${filteredTopology.edges.length} enlaces${externalHint}`,
          projectName: projectName ?? undefined,
          authorName,
          branding,
          topology: filteredTopology,
          orientation: filters.orientation,
          racks: filteredRacks,
          rackFace: filters.face,
          externalNodesById,
          tableSortBy: filters.tableSortBy,
        }

        if (filters.content === 'table') {
          await exportTopologyPdf({ ...baseOpts, content: 'table' })
          toast.success('PDF exportado', 'Se descargó la tabla de conexiones filtrada.')
          setPrintModalOpen(false)
          return
        }

        setPrintOverride({ topology: filteredTopology, racks: filteredRacks })
        await waitFrames(3)
        // Pequeña pausa para que React Flow mida nodos filtrados
        await new Promise((r) => setTimeout(r, 120))

        const restorePrint = await topologyFlowRef.current?.prepareForPrint({
          face: filters.face,
          orientation: filters.orientation,
        })
        await waitFrames(2)
        await new Promise((r) => setTimeout(r, 80))

        const canvasEl = canvasRef.current
        if (!canvasEl) {
          restorePrint?.()
          throw new Error('No se encontró el lienzo del diagrama')
        }

        try {
          await exportTopologyPdf({
            ...baseOpts,
            content: filters.content === 'diagram' ? 'diagram' : 'full',
            canvasElement: canvasEl,
            captureDiagram: (orientation) =>
              topologyFlowRef.current?.captureDiagramPng(orientation) ?? Promise.resolve(null),
          })
        } finally {
          restorePrint?.()
        }
        toast.success(
          'PDF exportado',
          filters.content === 'diagram'
            ? 'Se descargó el diagrama filtrado.'
            : 'Se descargó el reporte (diagrama + tabla).',
        )
        setPrintModalOpen(false)
      } catch (err) {
        console.error('Error exporting PDF:', err)
        toast.error('Error al exportar el PDF', 'Intenta de nuevo.')
      } finally {
        setPrintOverride(null)
        setExporting(false)
      }
    },
    [user, projectName, toast],
  )

  const deviceFilterOptions = useMemo(() => {
    if (!graphTopology.nodes.length) return [{ value: '', label: 'Todos' }]
    const sorted = [...graphTopology.nodes].sort((a, b) =>
      formatDeviceFilterOptionLabel(a).localeCompare(formatDeviceFilterOptionLabel(b), undefined, { sensitivity: 'base' })
    )
    return [
      { value: '', label: 'Todos' },
      ...sorted.map((n) => ({ value: n.id, label: formatDeviceFilterOptionLabel(n) })),
    ]
  }, [graphTopology.nodes])

  const mediumFilterOptions = useMemo(() => [
    { value: '', label: 'Todos los medios' },
    { value: 'utp', label: 'Cable UTP' },
    { value: 'fiber', label: 'Fibra óptica' },
    { value: 'wifi', label: 'WiFi' },
    { value: 'internet', label: 'Internet / WAN' },
  ], [])

  const bandwidthFilterOptions = useMemo(() => {
    if (!graphTopology.edges.length) return [{ value: '', label: 'Todas' }]
    const set = new Set<string>()
    for (const e of graphTopology.edges) { if (e.bandwidth?.trim()) set.add(e.bandwidth.trim()) }
    const sorted = [...set].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    return [{ value: '', label: 'Todas' }, ...sorted.map((b) => ({ value: b, label: b }))]
  }, [graphTopology.edges])

  const vlanFilterOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const edge of graphTopology.edges) {
      for (const vlan of edge.vlans ?? []) {
        map.set(vlan.id, `VLAN ${vlan.vlanId} · ${vlan.name}`)
      }
    }
    const sorted = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
    return [{ value: '', label: 'Todas las VLANs' }, ...sorted.map(([value, label]) => ({ value, label }))]
  }, [graphTopology.edges])

  const networkFilterOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const edge of graphTopology.edges) {
      for (const network of edge.networks ?? []) {
        map.set(network.id, `${network.name} (${network.subnet})`)
      }
    }
    const sorted = [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }))
    return [{ value: '', label: 'Todas las redes' }, ...sorted.map(([value, label]) => ({ value, label }))]
  }, [graphTopology.edges])

  const filteredEdges = useMemo(() => {
    if (!graphTopology.edges.length) return []
    const q = connSearch.trim().toLowerCase()
    return graphTopology.edges.filter((edge) => {
      const srcNode = graphTopology.nodes.find((n) => n.id === edge.source)
      const tgtNode = graphTopology.nodes.find((n) => n.id === edge.target)
      const srcLabel = (srcNode?.label ?? '').toLowerCase()
      const tgtLabel = (tgtNode?.label ?? '').toLowerCase()
      const srcHost = (normalizeTopologyHostname(srcNode?.data) ?? '').toLowerCase()
      const tgtHost = (normalizeTopologyHostname(tgtNode?.data) ?? '').toLowerCase()
      const sp = edge.sourcePort.toLowerCase()
      const tp = edge.targetPort.toLowerCase()
      const desc = (edge.description ?? '').toLowerCase()
      const bw = (edge.bandwidth ?? '').toLowerCase()
      const ml = edge.medium ? formatMediumLabel(edge.medium).toLowerCase() : ''
      const vlanHay = (edge.vlanLabel ?? '').toLowerCase()
      const netHay = (edge.networkLabel ?? '').toLowerCase()

      if (filterSourceDevice && edge.source !== filterSourceDevice) return false
      if (filterTargetDevice && edge.target !== filterTargetDevice) return false
      if (filterMedium && (edge.medium?.mediumType ?? 'utp') !== filterMedium) return false
      if (filterBandwidth && (edge.bandwidth?.trim() ?? '') !== filterBandwidth) return false
      if (filterVlan && !(edge.vlans ?? []).some((v) => v.id === filterVlan)) return false
      if (filterNetwork && !(edge.networks ?? []).some((n) => n.id === filterNetwork)) return false

      if (q) {
        const hay = `${srcLabel} ${tgtLabel} ${srcHost} ${tgtHost} ${sp} ${tp} ${desc} ${bw} ${ml} ${vlanHay} ${netHay}`
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [graphTopology.edges, graphTopology.nodes, connSearch, filterSourceDevice, filterTargetDevice, filterMedium, filterBandwidth, filterVlan, filterNetwork])

  const hasActiveFilters = !!connSearch.trim() || !!filterSourceDevice || !!filterTargetDevice || !!filterMedium || !!filterBandwidth || !!filterVlan || !!filterNetwork
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = []
    if (connSearch.trim()) chips.push({ key: 'q', label: `Buscar: ${connSearch.trim()}`, onRemove: () => setConnSearch('') })
    if (filterSourceDevice) {
      const node = graphTopology.nodes.find((n) => n.id === filterSourceDevice)
      chips.push({ key: 'src', label: `Origen: ${node ? formatDeviceFilterOptionLabel(node) : filterSourceDevice}`, onRemove: () => setFilterSourceDevice('') })
    }
    if (filterTargetDevice) {
      const node = graphTopology.nodes.find((n) => n.id === filterTargetDevice)
      chips.push({ key: 'tgt', label: `Destino: ${node ? formatDeviceFilterOptionLabel(node) : filterTargetDevice}`, onRemove: () => setFilterTargetDevice('') })
    }
    if (filterMedium) {
      const label = MEDIUM_LABELS[filterMedium as MediumType] ?? filterMedium
      chips.push({ key: 'medium', label: `Medio: ${label}`, onRemove: () => setFilterMedium('') })
    }
    if (filterBandwidth) chips.push({ key: 'bw', label: `Velocidad: ${filterBandwidth}`, onRemove: () => setFilterBandwidth('') })
    if (filterVlan) {
      const opt = vlanFilterOptions.find((o) => o.value === filterVlan)
      chips.push({ key: 'vlan', label: `VLAN: ${opt?.label ?? filterVlan}`, onRemove: () => setFilterVlan('') })
    }
    if (filterNetwork) {
      const opt = networkFilterOptions.find((o) => o.value === filterNetwork)
      chips.push({ key: 'net', label: `Red: ${opt?.label ?? filterNetwork}`, onRemove: () => setFilterNetwork('') })
    }
    return chips
  }, [connSearch, filterSourceDevice, filterTargetDevice, filterMedium, filterBandwidth, filterVlan, filterNetwork, graphTopology.nodes, vlanFilterOptions, networkFilterOptions])

  const statusStats = useMemo(() => {
    const counts = { planned: 0, implemented: 0, verified: 0 }
    for (const edge of physicalDiagram.edges) {
      const status = edge.connectionStatus ?? 'implemented'
      if (status in counts) counts[status]++
    }
    return counts
  }, [physicalDiagram.edges])

  const logicalLinkCount = graphTopology.edges.length - physicalDiagram.edges.length
  const canPrintReport =
    physicalDiagram.nodes.length > 0 || topologyRacks.length > 0 || physicalDiagram.edges.length > 0

  return (
    <div className="space-y-3">
      <PageHeader
        title={projectName ? `${projectName} — Arquitectura de Red` : 'Arquitectura de Red'}
        subtitle={`Documentación visual unificada · Rol: ${roleInActiveProject === 'admin' ? 'Administrador' : roleInActiveProject === 'operator' ? 'Operador' : 'Visualizador'}`}
      />

      {!isLoading && !error && topology && (
        <>
          {physicalDiagram.edges.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-2.5 py-1.5 rounded-md border border-gray-200/80 dark:border-gray-700/80 bg-white/80 dark:bg-gray-900/80">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Leyenda</span>
              {([['utp', 'UTP', '─'], ['fiber', 'Fibra', '─'], ['wifi', 'WiFi', '┈'], ['internet', 'WAN', '·─']] as const).map(([mt, label, line]) => (
                <span key={mt} className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
                  <span className="font-mono font-bold text-[10px]" style={{ color: MEDIUM_COLORS[mt] }}>{line}{line}</span>
                  {label}
                </span>
              ))}
              <span className="mx-1 h-3 w-px bg-gray-200 dark:bg-gray-700" />
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
                <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">Trunk</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
                <span className="rounded px-1 py-0.5 text-[8px] font-bold uppercase bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">Access</span>
              </span>
              <span className="mx-1 h-3 w-px bg-gray-200 dark:bg-gray-700" />
              {Object.entries(CONNECTION_STATUS_LABELS).map(([key, label]) => {
                const dotColor = key === 'planned' ? 'bg-yellow-400' : key === 'verified' ? 'bg-emerald-400' : 'bg-blue-400'
                return (
                  <span key={key} className="inline-flex items-center gap-1 text-[11px] text-gray-600 dark:text-gray-300">
                    <span className={`size-1.5 rounded-full ${dotColor}`} />
                    {label}{statusStats[key as keyof typeof statusStats] ? ` (${statusStats[key as keyof typeof statusStats]})` : ''}
                  </span>
                )
              })}
            </div>
          )}

          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-2 sm:p-3">
            <div className="mb-2 px-1">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Diagrama de topología (capa física)</h3>
              <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400 mt-0.5">
                Clic en puerto conectado para resaltar; doble clic en el cable para editar.
                {logicalLinkCount > 0
                  ? ` ${logicalLinkCount} enlace${logicalLinkCount === 1 ? '' : 's'} lógico${logicalLinkCount === 1 ? '' : 's'} solo en la tabla.`
                  : ''}
              </p>
            </div>
            {physicalDiagram.nodes.length === 0 && topologyRacks.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Aún no hay topología documentada</p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Creá dispositivos (y racks si corresponde), asigná puertos y documentá las conexiones entre ellos.
                </p>
                {canMutate && projectId && (
                  <div className="mt-4">
                    <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>Nueva conexión</Button>
                  </div>
                )}
              </div>
            ) : (
              <TopologyFlowCanvas
                ref={topologyFlowRef}
                topology={canvasTopology}
                racks={canvasRacks}
                persistenceKey={flowPersistenceKey}
                readOnly={!canMutate}
                onNavigateToDevice={handleNavigateToDevice}
                onNavigateToConnection={handleNavigateToConnection}
                onConnectPorts={canMutate ? handleConnectPorts : undefined}
                canvasRef={canvasRef}
                onExportPdf={canPrintReport ? handleExportPdf : undefined}
                exporting={exporting}
                onNewConnection={canMutate && projectId ? openCreate : undefined}
                serverLayout={serverLayout}
                onPersistLayout={
                  projectId
                    ? async (payload) => {
                        try {
                          const saved = await topologyService.saveCanvasLayout({
                            projectId,
                            nodePositions: payload.nodePositions,
                            labelOffsets: payload.labelOffsets,
                            workAreas: payload.workAreas,
                            nodeParents: payload.nodeParents,
                          })
                          setServerLayout({
                            nodePositions: saved.nodePositions ?? payload.nodePositions,
                            labelOffsets: saved.labelOffsets ?? payload.labelOffsets,
                            workAreas: coerceWorkAreasArray(saved.workAreas ?? payload.workAreas),
                            nodeParents: saved.nodeParents ?? payload.nodeParents,
                          })
                        } catch (err: unknown) {
                          const axiosErr = err as {
                            response?: { data?: { message?: string; errors?: Array<{ message?: string; field?: string }> } }
                            message?: string
                          }
                          const data = axiosErr.response?.data
                          const fieldErrors = data?.errors
                            ?.map((e) => (e.field ? `${e.field}: ${e.message}` : e.message))
                            .filter(Boolean)
                            .join('; ')
                          const detail = fieldErrors || data?.message || axiosErr.message || 'Error desconocido'
                          toast.error('Error al guardar posiciones', detail)
                          throw err
                        }
                      }
                    : undefined
                }
                onClearServerLayout={
                  projectId
                    ? async () => {
                        await topologyService.clearCanvasLayout(projectId)
                        setServerLayout({ nodePositions: {}, labelOffsets: {}, workAreas: [], nodeParents: {} })
                      }
                    : undefined
                }
              />
            )}
          </div>
        </>
      )}

      {isLoading && <div className="text-center py-8 text-gray-500">Cargando topología...</div>}
      {error && <div className="text-center py-8 text-red-500" role="alert">{error}</div>}

      {!isLoading && !error && topology && (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">Enlaces documentados</h3>
              {graphTopology.edges.length > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Mostrando {filteredEdges.length} de {graphTopology.edges.length}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 justify-between sm:justify-end">
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
              : graphTopology.edges.length > 0
                ? 'h-[min(72vh,52rem)] max-h-[min(72vh,52rem)] opacity-100'
                : 'max-h-[min(72vh,52rem)] opacity-100',
          ].join(' ')}>
            <div
              className={[
                'flex min-h-0 flex-col',
                graphTopology.edges.length > 0 && !connectionsCollapsed ? 'h-full max-h-full' : 'max-h-[min(72vh,52rem)]',
              ].filter(Boolean).join(' ')}
            >
              {graphTopology.edges.length > 0 && (
                <div className="shrink-0 border-b border-gray-200 bg-gray-50/80 px-6 py-4 space-y-3 dark:border-gray-800 dark:bg-gray-900/40">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input type="search" placeholder="Buscar por dispositivo, hostname, puerto, VLAN, red, medio…"
                      value={connSearch} onChange={(e) => setConnSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100" />
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <Select label="Dispositivo origen" options={deviceFilterOptions} value={filterSourceDevice}
                      onChange={(e) => setFilterSourceDevice(e.target.value)} className="!mb-0" />
                    <Select label="Dispositivo destino" options={deviceFilterOptions} value={filterTargetDevice}
                      onChange={(e) => setFilterTargetDevice(e.target.value)} className="!mb-0" />
                    <Select label="Medio" options={mediumFilterOptions} value={filterMedium}
                      onChange={(e) => setFilterMedium(e.target.value)} className="!mb-0" />
                    <Select label="Velocidad" options={bandwidthFilterOptions} value={filterBandwidth}
                      onChange={(e) => setFilterBandwidth(e.target.value)} className="!mb-0" />
                    <Select label="VLAN" options={vlanFilterOptions} value={filterVlan}
                      onChange={(e) => setFilterVlan(e.target.value)} className="!mb-0" />
                    <Select label="Red" options={networkFilterOptions} value={filterNetwork}
                      onChange={(e) => setFilterNetwork(e.target.value)} className="!mb-0" />
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
              {!graphTopology.edges.length ? (
                <div className="px-6 py-12 text-center text-sm text-gray-500 dark:text-gray-400">
                  Aún no hay conexiones documentadas.
                  {canMutate && projectId && (
                    <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Usá &quot;Nueva conexión&quot; en el menú del diagrama (⋮) o arrastrá entre puertos libres.
                    </p>
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
                      const srcNode = graphTopology.nodes.find((n) => n.id === edge.source)
                      const tgtNode = graphTopology.nodes.find((n) => n.id === edge.target)
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
                                {srcNode?.data.ipAddress && (
                                  <p className="truncate text-xs font-mono text-blue-600 dark:text-blue-400">{srcNode.data.ipAddress}</p>
                                )}
                                <p className="truncate text-xs text-gray-500">{edge.sourcePort}</p>
                              </div>
                              <ArrowRight className="hidden h-4 w-4 flex-shrink-0 text-gray-400 sm:block" />
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium text-gray-900 dark:text-white">{tgtNode?.label || 'Desconocido'}</p>
                                {tgtHost && (
                                  <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={tgtHost}>{tgtHost}</p>
                                )}
                                {tgtNode?.data.ipAddress && (
                                  <p className="truncate text-xs font-mono text-blue-600 dark:text-blue-400">{tgtNode.data.ipAddress}</p>
                                )}
                                <p className="truncate text-xs text-gray-500">{edge.targetPort}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 lg:flex-shrink-0 lg:justify-end">
                              <span className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                                style={{ borderColor: mediumColor, color: mediumColor }}>
                                {mediumLabel}
                              </span>
                              {edge.connectionType === 'logical' && (
                                <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                                  Lógico
                                </span>
                              )}
                              {edge.portRole && (
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  edge.portRole === 'trunk'
                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                                }`}>
                                  {edge.portRole}
                                </span>
                              )}
                              {edge.vlanLabel && (
                                <span className="max-w-[14rem] truncate rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300" title={edge.vlanLabel}>
                                  {edge.vlanLabel}
                                </span>
                              )}
                              {edge.networkLabel && (
                                <span className="max-w-[12rem] truncate rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300" title={edge.networkLabel}>
                                  {edge.networkLabel}
                                </span>
                              )}
                              {edge.bandwidth && (
                                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{edge.bandwidth}</span>
                              )}
                              <span className="inline-flex items-center gap-1 rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-800">
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
      )}

      <PrintReportModal
        isOpen={printModalOpen}
        onClose={() => {
          if (!exporting) setPrintModalOpen(false)
        }}
        topology={physicalDiagram}
        racks={topologyRacks}
        sites={sites}
        areasBySiteId={areasBySiteId}
        exporting={exporting}
        onConfirm={handleConfirmPrintReport}
      />

      {canMutate && projectId && (
        <ConnectionModal isOpen={modalOpen} onClose={closeModal} projectId={projectId}
          edge={editingEdge} onSaved={refetch} physicalEdges={physicalDiagram.edges} />
      )}
    </div>
  )
}
