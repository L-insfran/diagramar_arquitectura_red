import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type Ref,
  type SetStateAction,
} from 'react'
import { Download, Maximize2, Minimize2, Printer, Save } from 'lucide-react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type ColorMode,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useTheme } from '../../contexts/ThemeContext'
import { accentColorForNodeId } from '../../utils/topologyAccent'
import { layoutTopologyNodes, TOPOLOGY_NODE_HEIGHT, TOPOLOGY_NODE_WIDTH } from '../../utils/topologyLayout'
import { DeviceFlowNode, type DeviceFlowNodeType } from './DeviceFlowNode'
import { PortLinkEdge, type PortLinkBundleMember, type PortLinkEdgeType } from './PortLinkEdge'
import { TopologyCanvasInteractionContext } from './TopologyCanvasContext'
import type { TopologyData, MediumType } from '../../types'
import { formatMediumLabel, MEDIUM_EDGE_STYLES } from '../../types'
import { normalizeTopologyHostname } from '../../utils/topologyNodeData'
import { compareTopologyPortPair } from '../../utils/topologyPortSort'
import {
  computeExportCaptureRect,
  getExportShellCssDimensions,
  type PrintOrientation,
} from '../../utils/printDiagramSectorGrid'
import { PrintSectorBoundsOverlay } from './PrintSectorBoundsOverlay'

const nodeTypes = { device: DeviceFlowNode }
const edgeTypes = { portLink: PortLinkEdge }

type EdgeEndRef = { edgeIndex: number; otherEndId: string; edgeId: string }

function assignIncidentFanOutLanes(edges: PortLinkEdgeType[]): void {
  const bySource = new Map<string, EdgeEndRef[]>()
  const byTarget = new Map<string, EdgeEndRef[]>()

  edges.forEach((edge, edgeIndex) => {
    const s = edge.source
    const t = edge.target
    const edgeId = edge.id
    if (!bySource.has(s)) bySource.set(s, [])
    bySource.get(s)!.push({ edgeIndex, otherEndId: t, edgeId })
    if (!byTarget.has(t)) byTarget.set(t, [])
    byTarget.get(t)!.push({ edgeIndex, otherEndId: s, edgeId })
  })

  const sortRefs = (a: EdgeEndRef, b: EdgeEndRef) => {
    const cmp = a.otherEndId.localeCompare(b.otherEndId)
    if (cmp !== 0) return cmp
    return a.edgeId.localeCompare(b.edgeId)
  }

  for (const list of bySource.values()) {
    list.sort(sortRefs)
    const count = list.length
    list.forEach((ref, i) => {
      const e = edges[ref.edgeIndex]
      e.data = { ...e.data!, sourceFanIndex: i, sourceFanCount: count }
    })
  }

  for (const list of byTarget.values()) {
    list.sort(sortRefs)
    const count = list.length
    list.forEach((ref, i) => {
      const e = edges[ref.edgeIndex]
      e.data = { ...e.data!, targetFanIndex: i, targetFanCount: count }
    })
  }
}

/** Unifica varias conexiones entre el mismo par origen→destino en un solo trazo. */
function mergeParallelEdgesBetweenSameNodes(edges: PortLinkEdgeType[]): PortLinkEdgeType[] {
  const byPair = new Map<string, PortLinkEdgeType[]>()
  for (const e of edges) {
    const k = `${e.source}::${e.target}`
    if (!byPair.has(k)) byPair.set(k, [])
    byPair.get(k)!.push(e)
  }
  const out: PortLinkEdgeType[] = []
  for (const group of byPair.values()) {
    if (group.length === 1) {
      out.push(group[0])
      continue
    }
    group.sort((a, b) => {
      const da = a.data!
      const db = b.data!
      const byPort = compareTopologyPortPair(da.sourcePort, da.targetPort, db.sourcePort, db.targetPort)
      if (byPort !== 0) return byPort
      return a.id.localeCompare(b.id)
    })
    const first = group[0]
    const d0 = first.data!
    const bundleMembers: PortLinkBundleMember[] = group.map((e) => {
      const ed = e.data!
      return {
        id: e.id,
        sourcePort: ed.sourcePort,
        targetPort: ed.targetPort,
        sourceColor: ed.sourceColor,
        targetColor: ed.targetColor,
        mediumType: ed.mediumType,
        mediumLabel: ed.mediumLabel,
        connectionStatus: ed.connectionStatus,
        networkLabel: ed.networkLabel,
        vlanLabel: ed.vlanLabel,
      }
    })
    const anyLogical = group.some((e) => e.animated)
    const bundleId = `nm-bundle:${first.source}:${first.target}`
    out.push({
      ...first,
      id: bundleId,
      animated: anyLogical,
      data: {
        ...d0,
        bundleMembers,
        sourcePort: `${group.length} enlaces`,
        targetPort: '—',
        pairLinkIndex: 0,
        pairLinkCount: 1,
        sourceFanIndex: 0,
        sourceFanCount: 1,
        targetFanIndex: 0,
        targetFanCount: 1,
      },
    })
  }
  return out
}

function assignPairLinkIndices(edges: PortLinkEdgeType[]): void {
  const byPair = new Map<string, { edgeIndex: number; edgeId: string }[]>()

  edges.forEach((edge, edgeIndex) => {
    const key = `${edge.source}::${edge.target}`
    if (!byPair.has(key)) byPair.set(key, [])
    byPair.get(key)!.push({ edgeIndex, edgeId: edge.id })
  })

  for (const list of byPair.values()) {
    list.sort((a, b) => a.edgeId.localeCompare(b.edgeId))
    const count = list.length
    list.forEach((ref, i) => {
      const e = edges[ref.edgeIndex]
      e.data = { ...e.data!, pairLinkIndex: i, pairLinkCount: count }
    })
  }
}

function topologyToFlowElements(data: TopologyData): { nodes: DeviceFlowNodeType[]; edges: PortLinkEdgeType[] } {
  const nodes: DeviceFlowNodeType[] = data.nodes.map((n) => ({
    id: n.id,
    type: 'device' as const,
    position: { x: 0, y: 0 },
    style: { width: TOPOLOGY_NODE_WIDTH, height: TOPOLOGY_NODE_HEIGHT },
    data: {
      label: n.label,
      hostname: normalizeTopologyHostname(n.data),
      ipAddress: n.data.ipAddress,
      status: n.data.status,
      accentColor: accentColorForNodeId(n.id),
      location: n.data.location ?? null,
      deviceType: n.data.deviceType ?? null,
    },
  }))

  const colorById = new Map(nodes.map((n) => [n.id, n.data.accentColor]))

  const rawEdges: PortLinkEdgeType[] = data.edges.map((e) => {
    const medium = e.medium ?? { mediumType: 'utp' as MediumType, cableCategory: null, fiberType: null, fiberConnector: null, wifiSsid: null, wifiStandard: null, wifiBand: null, wifiSecurity: null, cableLength: null }
    const edgeStyle = MEDIUM_EDGE_STYLES[medium.mediumType] ?? MEDIUM_EDGE_STYLES.utp
    const isLogical = e.connectionType === 'logical'

    return {
      id: e.id,
      type: 'portLink' as const,
      source: e.source,
      target: e.target,
      animated: isLogical,
      style: { stroke: edgeStyle.stroke, strokeWidth: 2.25, strokeDasharray: edgeStyle.strokeDasharray },
      data: {
        sourcePort: e.sourcePort,
        targetPort: e.targetPort,
        sourceColor: colorById.get(e.source) ?? '#64748b',
        targetColor: colorById.get(e.target) ?? '#64748b',
        sourceFanIndex: 0,
        sourceFanCount: 1,
        targetFanIndex: 0,
        targetFanCount: 1,
        pairLinkIndex: 0,
        pairLinkCount: 1,
        mediumType: medium.mediumType,
        mediumLabel: formatMediumLabel(medium),
        connectionStatus: e.connectionStatus ?? 'implemented',
        networkLabel: e.networkLabel,
        vlanLabel: e.vlanLabel,
      },
    }
  })

  const edges = mergeParallelEdgesBetweenSameNodes(rawEdges)

  assignPairLinkIndices(edges)
  assignIncidentFanOutLanes(edges)

  const { nodes: layouted } = layoutTopologyNodes(nodes, edges)
  return { nodes: layouted as DeviceFlowNodeType[], edges: edges as PortLinkEdgeType[] }
}

function mergePersistedLabelOffsets(
  edges: PortLinkEdgeType[],
  offsets: Readonly<Record<string, { x: number; y: number }>>
): PortLinkEdgeType[] {
  return edges.map((e) => {
    const o = offsets[e.id]
    if (!o) return e
    return { ...e, data: { ...e.data!, labelOffsetX: o.x, labelOffsetY: o.y } }
  })
}

const NODE_POS_STORAGE_PREFIX = 'nm-topology-node-pos:'
const LABEL_OFFSET_STORAGE_PREFIX = 'nm-topology-label-offset:'

function loadNodePositions(key: string): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(NODE_POS_STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, { x: number; y: number }>
  } catch { return {} }
}

function saveNodePositions(key: string, positions: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(NODE_POS_STORAGE_PREFIX + key, JSON.stringify(positions)) }
  catch { /* quota / private mode */ }
}

function clearNodePositions(key: string) {
  try { localStorage.removeItem(NODE_POS_STORAGE_PREFIX + key) }
  catch { /* ignore */ }
}

function isValidOffsetEntry(v: unknown): v is { x: number; y: number } {
  if (v === null || typeof v !== 'object') return false
  const o = v as { x?: unknown; y?: unknown }
  return typeof o.x === 'number' && Number.isFinite(o.x) && typeof o.y === 'number' && Number.isFinite(o.y)
}

function loadLabelOffsets(key: string): Record<string, { x: number; y: number }> {
  try {
    const raw = localStorage.getItem(LABEL_OFFSET_STORAGE_PREFIX + key)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    const out: Record<string, { x: number; y: number }> = {}
    for (const [id, val] of Object.entries(parsed as Record<string, unknown>)) {
      if (isValidOffsetEntry(val)) out[id] = { x: val.x, y: val.y }
    }
    return out
  } catch { return {} }
}

function saveLabelOffsets(key: string, offsets: Record<string, { x: number; y: number }>) {
  try { localStorage.setItem(LABEL_OFFSET_STORAGE_PREFIX + key, JSON.stringify(offsets)) }
  catch { /* quota / private mode */ }
}

function clearLabelOffsets(key: string) {
  try { localStorage.removeItem(LABEL_OFFSET_STORAGE_PREFIX + key) }
  catch { /* ignore */ }
}

function mergePersistedNodePositions(
  nodes: DeviceFlowNodeType[],
  saved: Readonly<Record<string, { x: number; y: number }>>
): DeviceFlowNodeType[] {
  return nodes.map((n) => {
    const p = saved[n.id]
    if (p == null) return n
    return { ...n, position: { x: p.x, y: p.y } }
  })
}

function snapshotNodePositions(nodes: readonly Node[]): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {}
  for (const n of nodes) out[n.id] = { x: n.position.x, y: n.position.y }
  return out
}

export type TopologyServerLayout = {
  nodePositions: Record<string, { x: number; y: number }>
  labelOffsets: Record<string, { x: number; y: number }>
}

export type TopologyFlowCanvasHandle = {
  /**
   * Amplía temporalmente el lienzo y ajusta el zoom para que la captura PNG/PDF
   * tenga más píxeles por nodo. Devuelve una función para restaurar la vista.
   */
  prepareExportCapture: (orientation?: PrintOrientation) => Promise<() => void>
  /** Orientación actualmente seleccionada por el usuario para impresión / exportación. */
  getPrintOrientation: () => PrintOrientation
}

function GetNodesBridge({ getNodesRef }: { getNodesRef: MutableRefObject<(() => Node[]) | null> }) {
  const { getNodes } = useReactFlow()
  useLayoutEffect(() => {
    getNodesRef.current = () => getNodes()
    return () => { getNodesRef.current = null }
  }, [getNodes, getNodesRef])
  return null
}

function ExportCaptureBridge({
  exportHandleRef,
  shellElRef,
  getNodesRef,
  fullscreen,
  printOrientationRef,
}: {
  exportHandleRef?: Ref<TopologyFlowCanvasHandle | null>
  shellElRef: MutableRefObject<HTMLDivElement | null>
  getNodesRef: MutableRefObject<(() => Node[]) | null>
  fullscreen: boolean
  printOrientationRef: MutableRefObject<PrintOrientation>
}) {
  const { fitView } = useReactFlow()

  const prepareExportCapture = useCallback(async (orientation?: PrintOrientation) => {
    const shell = shellElRef.current
    if (!shell) return () => {}
    const effectiveOrientation = orientation ?? printOrientationRef.current
    const nodeCount = (getNodesRef.current?.() ?? []).length
    const { w, h } = getExportShellCssDimensions(nodeCount, effectiveOrientation)
    const prevCssText = shell.style.cssText
    const extra = `position:fixed!important;left:0!important;top:0!important;width:${w}px!important;height:${h}px!important;min-height:${h}px!important;max-height:none!important;z-index:2147483646!important;background:#f8fafc!important;`
    shell.style.cssText = prevCssText + extra

    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    await fitView({ padding: 0.08, duration: 0, maxZoom: 4 })
    await new Promise<void>((r) => requestAnimationFrame(() => r()))

    return () => {
      shell.style.cssText = prevCssText
      requestAnimationFrame(() => {
        void fitView({ padding: fullscreen ? 0.12 : 0.2, duration: 0 })
      })
    }
  }, [fitView, fullscreen, getNodesRef, shellElRef, printOrientationRef])

  const getPrintOrientation = useCallback(() => printOrientationRef.current, [printOrientationRef])

  useImperativeHandle(
    exportHandleRef,
    () => ({ prepareExportCapture, getPrintOrientation }),
    [prepareExportCapture, getPrintOrientation]
  )

  return null
}

function FitViewAfterLayoutChange({ fullscreen }: { fullscreen: boolean }) {
  const { fitView } = useReactFlow()
  const prevFullscreen = useRef<boolean | null>(null)
  useEffect(() => {
    if (prevFullscreen.current === null) { prevFullscreen.current = fullscreen; return }
    if (prevFullscreen.current === fullscreen) return
    prevFullscreen.current = fullscreen
    const id = window.requestAnimationFrame(() => { fitView({ padding: fullscreen ? 0.12 : 0.2 }) })
    return () => cancelAnimationFrame(id)
  }, [fullscreen, fitView])
  return null
}

type LayoutSaveState = 'idle' | 'saving' | 'saved' | 'error'

function saveLayoutButtonLabel(state: LayoutSaveState): string {
  if (state === 'saving') return 'Guardando…'
  if (state === 'saved') return 'Guardado'
  if (state === 'error') return 'Error al guardar'
  return 'Guardar en servidor'
}

function TopologyFlowPanels({
  persistenceKey, topology, setNodes, setEdges, labelOffsetsRef, fullscreen, onFullscreenChange, onExportPdf, exporting, readOnly,
  onPersistLayout, onClearServerLayout, layoutSaveState, onSaveLayout, showPrintBounds, onTogglePrintBounds, onShowPrintBounds,
  printOrientation, onPrintOrientationChange,
}: {
  persistenceKey: string | undefined
  topology: TopologyData
  setNodes: Dispatch<SetStateAction<DeviceFlowNodeType[]>>
  setEdges: Dispatch<SetStateAction<PortLinkEdgeType[]>>
  labelOffsetsRef: MutableRefObject<Record<string, { x: number; y: number }>>
  fullscreen: boolean
  onFullscreenChange: (next: boolean) => void
  onExportPdf?: () => void
  exporting?: boolean
  readOnly?: boolean
  onPersistLayout?: (payload: TopologyServerLayout) => Promise<void>
  onClearServerLayout?: () => Promise<void>
  layoutSaveState: LayoutSaveState
  onSaveLayout: () => void
  showPrintBounds: boolean
  onTogglePrintBounds: () => void
  onShowPrintBounds: () => void
  printOrientation: PrintOrientation
  onPrintOrientationChange: (next: PrintOrientation) => void
}) {
  const { fitView, fitBounds, getNodes } = useReactFlow()

  const handleFitToPrint = useCallback(() => {
    const rect = computeExportCaptureRect(getNodes(), printOrientation)
    if (!rect) return
    onShowPrintBounds()
    requestAnimationFrame(() => {
      void fitBounds(rect, { padding: 0, duration: 300 })
    })
  }, [fitBounds, getNodes, onShowPrintBounds, printOrientation])

  const handleReset = useCallback(async () => {
    if (!persistenceKey) return
    try {
      if (onClearServerLayout) await onClearServerLayout()
    } catch { /* continuar con reset local */ }
    clearNodePositions(persistenceKey)
    clearLabelOffsets(persistenceKey)
    labelOffsetsRef.current = {}
    const { nodes: fresh, edges: freshEdges } = topologyToFlowElements(topology)
    setNodes(fresh)
    setEdges(freshEdges)
    requestAnimationFrame(() => fitView({ padding: 0.2 }))
  }, [persistenceKey, topology, setNodes, setEdges, fitView, labelOffsetsRef, onClearServerLayout])

  return (
    <Panel
      position="top-right"
      className="!m-2 !rounded-lg !border !border-gray-200 !bg-white/95 !p-1 !shadow-md dark:!border-gray-700 dark:!bg-gray-900/95"
    >
      <div className="flex flex-col gap-1 min-w-[188px]">
        {!fullscreen && (
          <button type="button" onClick={() => onFullscreenChange(true)}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
            title="Ver diagrama en pantalla completa">
            <Maximize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
            Pantalla completa
          </button>
        )}
        {onExportPdf && (
          <button type="button" onClick={onExportPdf} disabled={exporting}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800 disabled:opacity-50"
            title="Exportar diagrama a PDF">
            <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {exporting ? 'Exportando…' : 'Exportar PDF'}
          </button>
        )}
        <div className="flex items-stretch rounded-md border border-gray-200 overflow-hidden dark:border-gray-700">
          <button
            type="button"
            onClick={() => onPrintOrientationChange('landscape')}
            aria-pressed={printOrientation === 'landscape'}
            className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
              printOrientation === 'landscape'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
            }`}
            title="Imprimir / exportar en horizontal (A4 apaisado)">
            Horizontal
          </button>
          <button
            type="button"
            onClick={() => onPrintOrientationChange('portrait')}
            aria-pressed={printOrientation === 'portrait'}
            className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
              printOrientation === 'portrait'
                ? 'bg-blue-600 text-white'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
            }`}
            title="Imprimir / exportar en vertical (A4 retrato)">
            Vertical
          </button>
        </div>
        <button
          type="button"
          onClick={handleFitToPrint}
          className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          title="Centra la vista al tamaño real que se exportará y muestra los límites de impresión">
          <Printer className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Vista para impresión
        </button>
        <button
          type="button"
          onClick={onTogglePrintBounds}
          aria-pressed={showPrintBounds}
          className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
            showPrintBounds
              ? 'bg-orange-100 text-orange-900 ring-1 ring-orange-300 dark:bg-orange-950/60 dark:text-orange-100 dark:ring-orange-700'
              : 'text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800'
          }`}
          title="Muestra líneas que coinciden con el recorte por sectores al exportar a PDF (mismo criterio automático que la exportación)">
          {showPrintBounds ? 'Ocultar límites' : 'Mostrar límites'}
        </button>
        {(persistenceKey && (onPersistLayout || persistenceKey)) && (
          <div className="h-px bg-gray-200/80 dark:bg-gray-700/70 mx-1 my-1" />
        )}
        {persistenceKey && onPersistLayout && (
          <button type="button" onClick={onSaveLayout} disabled={layoutSaveState === 'saving'}
            className="inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:text-emerald-200 dark:hover:bg-emerald-950/50 disabled:opacity-50"
            title="Guardar posiciones en el servidor">
            <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {saveLayoutButtonLabel(layoutSaveState)}
          </button>
        )}
        {persistenceKey && (
          <button type="button" onClick={() => void handleReset()}
            className="rounded-md px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800">
            Restaurar posiciones
          </button>
        )}
        {readOnly && (
          <div className="px-2 pt-1">
            <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              Solo lectura
            </span>
          </div>
        )}
      </div>
    </Panel>
  )
}

interface InnerProps {
  topology: TopologyData
  persistenceKey?: string
  readOnly?: boolean
  onNavigateToDevice?: (deviceId: string) => void
  onNavigateToConnection?: (connectionId: string) => void
  fullscreen: boolean
  onFullscreenChange: (next: boolean) => void
  canvasRef?: MutableRefObject<HTMLDivElement | null>
  onExportPdf?: () => void
  exporting?: boolean
  /** `undefined`: aún no cargó el layout del servidor */
  serverLayout?: TopologyServerLayout | undefined
  onPersistLayout?: (payload: TopologyServerLayout) => Promise<void>
  onClearServerLayout?: () => Promise<void>
  exportHandleRef?: Ref<TopologyFlowCanvasHandle | null>
}

function TopologyFlowInner({
  topology, persistenceKey, readOnly, onNavigateToDevice, onNavigateToConnection, fullscreen, onFullscreenChange, canvasRef, onExportPdf, exporting,
  serverLayout, onPersistLayout, onClearServerLayout, exportHandleRef,
}: InnerProps) {
  const { theme } = useTheme()
  const colorMode: ColorMode = theme === 'dark' ? 'dark' : 'light'
  const labelOffsetsRef = useRef<Record<string, { x: number; y: number }>>({})
  const shellElRef = useRef<HTMLDivElement | null>(null)
  const getNodesRef = useRef<(() => Node[]) | null>(null)
  const layoutSaveResetTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null)
  const [layoutSaveState, setLayoutSaveState] = useState<LayoutSaveState>('idle')
  const [showPrintBounds, setShowPrintBounds] = useState(false)
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('landscape')
  const printOrientationRef = useRef<PrintOrientation>('landscape')
  useEffect(() => { printOrientationRef.current = printOrientation }, [printOrientation])

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const built = topologyToFlowElements(topology)
    const localPos = persistenceKey ? loadNodePositions(persistenceKey) : {}
    const localLabels = persistenceKey ? loadLabelOffsets(persistenceKey) : {}
    const hasServer = serverLayout !== undefined
    const serverPos = hasServer ? serverLayout.nodePositions : null
    const serverLabels = hasServer ? serverLayout.labelOffsets : null
    let nodes = mergePersistedNodePositions(built.nodes, localPos)
    let edges = mergePersistedLabelOffsets(built.edges, localLabels)
    if (serverPos !== null) nodes = mergePersistedNodePositions(nodes, serverPos)
    if (serverLabels !== null) edges = mergePersistedLabelOffsets(edges, serverLabels)
    return { nodes, edges }
  }, [topology, persistenceKey, serverLayout])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState<PortLinkEdgeType>(initialEdges)

  useEffect(() => {
    const { nodes: nextNodes, edges: nextEdges } = topologyToFlowElements(topology)
    const currentPositions =
      getNodesRef.current
        ? snapshotNodePositions(getNodesRef.current())
        : {}
    const localPos = persistenceKey ? loadNodePositions(persistenceKey) : {}
    const localLabels = persistenceKey ? loadLabelOffsets(persistenceKey) : {}
    const hasServer = serverLayout !== undefined
    const serverPos = hasServer ? serverLayout.nodePositions : null
    const serverLabels = hasServer ? serverLayout.labelOffsets : null
    // Prioridad de posiciones:
    // 1) lo que el usuario ya ve en el canvas (evita que Dagre "mueva todo" al refrescar por nueva conexión)
    // 2) respaldo local
    // 3) layout del servidor (cuando exista)
    let n = mergePersistedNodePositions(nextNodes, currentPositions)
    n = mergePersistedNodePositions(n, localPos)
    let e = mergePersistedLabelOffsets(nextEdges, localLabels)
    if (serverPos !== null) n = mergePersistedNodePositions(n, serverPos)
    if (serverLabels !== null) e = mergePersistedLabelOffsets(e, serverLabels)
    labelOffsetsRef.current = hasServer ? { ...localLabels, ...serverLayout!.labelOffsets } : localLabels
    setNodes(n)
    setEdges(e)
  }, [topology, persistenceKey, serverLayout, setNodes, setEdges])

  const persistNodePositionsAfterDrag = useCallback(() => {
    if (!persistenceKey) return
    const getNodes = getNodesRef.current
    if (!getNodes) return
    const nds = getNodes()
    const positions: Record<string, { x: number; y: number }> = {}
    for (const n of nds) positions[n.id] = { x: n.position.x, y: n.position.y }
    saveNodePositions(persistenceKey, positions)
  }, [persistenceKey])

  useEffect(() => () => {
    if (layoutSaveResetTimerRef.current != null) window.clearTimeout(layoutSaveResetTimerRef.current)
  }, [])

  const handleSaveLayout = useCallback(() => {
    if (!onPersistLayout) return
    const getNodes = getNodesRef.current
    if (!getNodes) return
    setLayoutSaveState('saving')
    void (async () => {
      try {
        const nds = getNodes()
        const nodePositions: Record<string, { x: number; y: number }> = {}
        for (const n of nds) nodePositions[n.id] = { x: n.position.x, y: n.position.y }
        const labelOffsets = { ...labelOffsetsRef.current }
        await onPersistLayout({ nodePositions, labelOffsets })
        if (persistenceKey) {
          saveNodePositions(persistenceKey, nodePositions)
          saveLabelOffsets(persistenceKey, labelOffsets)
        }
        setLayoutSaveState('saved')
        if (layoutSaveResetTimerRef.current != null) window.clearTimeout(layoutSaveResetTimerRef.current)
        layoutSaveResetTimerRef.current = window.setTimeout(() => {
          layoutSaveResetTimerRef.current = null
          setLayoutSaveState('idle')
        }, 2000)
      } catch {
        setLayoutSaveState('error')
      }
    })()
  }, [onPersistLayout, persistenceKey, labelOffsetsRef])

  const commitLabelOffset = useCallback((edgeId: string, x: number, y: number) => {
    if (persistenceKey) {
      const next = { ...loadLabelOffsets(persistenceKey), [edgeId]: { x, y } }
      saveLabelOffsets(persistenceKey, next)
      labelOffsetsRef.current = next
    } else {
      labelOffsetsRef.current[edgeId] = { x, y }
    }
    setEdges((eds) => eds.map((e) => e.id === edgeId ? { ...e, data: { ...e.data!, labelOffsetX: x, labelOffsetY: y } } : e))
  }, [persistenceKey, setEdges])

  const interactionValue = useMemo(
    () => ({
      readOnly: readOnly ?? false,
      commitLabelOffset,
      onNavigateToDevice,
      onNavigateToConnection,
    }),
    [readOnly, commitLabelOffset, onNavigateToDevice, onNavigateToConnection]
  )

  const setShellRef = useCallback(
    (el: HTMLDivElement | null) => {
      shellElRef.current = el
      if (canvasRef) canvasRef.current = el
    },
    [canvasRef]
  )

  const onInit = useCallback((instance: { fitView: (opts?: { padding?: number }) => void }) => {
    requestAnimationFrame(() => instance.fitView({ padding: 0.2 }))
  }, [])

  useEffect(() => {
    if (!fullscreen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previousOverflow }
  }, [fullscreen])

  useEffect(() => {
    if (!fullscreen) return
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onFullscreenChange(false) }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, onFullscreenChange])

  const shellClass = fullscreen
    ? 'fixed inset-0 z-[130] flex flex-col overflow-hidden bg-slate-50 dark:bg-gray-950'
    : 'relative h-[min(620px,82vh)] w-full min-h-[380px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-950'

  return (
    <div className={shellClass} ref={setShellRef}>
      {fullscreen && (
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-200 bg-white/95 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/95">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Diagrama de arquitectura de red</p>
          <div className="flex items-center gap-2">
            {persistenceKey && onPersistLayout && (
              <button type="button" onClick={handleSaveLayout} disabled={layoutSaveState === 'saving'}
                className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-sm transition hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                title="Guardar posiciones en el servidor">
                <Save className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {saveLayoutButtonLabel(layoutSaveState)}
              </button>
            )}
            {onExportPdf && (
              <button type="button" onClick={onExportPdf} disabled={exporting}
                className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-50 dark:border-blue-700 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/50">
                <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {exporting ? 'Exportando…' : 'Exportar PDF'}
              </button>
            )}
            <button type="button" onClick={() => onFullscreenChange(false)}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700">
              <Minimize2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              Vista normal
            </button>
          </div>
        </header>
      )}
      <div className={fullscreen ? 'min-h-0 flex-1' : 'h-full w-full'}>
        <TopologyCanvasInteractionContext.Provider value={interactionValue}>
          <ReactFlow
            className="h-full w-full"
            nodes={nodes} edges={edges}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
            onNodeDragStop={persistNodePositionsAfterDrag}
            nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            colorMode={colorMode}
            nodesDraggable nodesConnectable={false} elementsSelectable panOnScroll zoomOnScroll
            minZoom={0.15} maxZoom={4}
            onInit={onInit} fitView
            defaultEdgeOptions={{ type: 'portLink' }}
          >
            <GetNodesBridge getNodesRef={getNodesRef} />
            <ExportCaptureBridge
              exportHandleRef={exportHandleRef}
              shellElRef={shellElRef}
              getNodesRef={getNodesRef}
              fullscreen={fullscreen}
              printOrientationRef={printOrientationRef}
            />
            <FitViewAfterLayoutChange fullscreen={fullscreen} />
            <TopologyFlowPanels persistenceKey={persistenceKey} topology={topology}
              setNodes={setNodes} setEdges={setEdges} labelOffsetsRef={labelOffsetsRef}
              fullscreen={fullscreen} onFullscreenChange={onFullscreenChange}
              onExportPdf={onExportPdf} exporting={exporting}
              readOnly={readOnly}
              onPersistLayout={onPersistLayout} onClearServerLayout={onClearServerLayout}
              layoutSaveState={layoutSaveState} onSaveLayout={handleSaveLayout}
              showPrintBounds={showPrintBounds}
              onTogglePrintBounds={() => setShowPrintBounds((v) => !v)}
              onShowPrintBounds={() => setShowPrintBounds(true)}
              printOrientation={printOrientation}
              onPrintOrientationChange={(o) => setPrintOrientation(o)} />
            <PrintSectorBoundsOverlay enabled={showPrintBounds} orientation={printOrientation} />
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="!bg-transparent" />
            <Controls className="!shadow-md !border-gray-200 dark:!border-gray-700 !bg-white dark:!bg-gray-900" />
            <MiniMap className="!bg-white/90 dark:!bg-gray-900/90 !border-gray-200 dark:!border-gray-700" maskColor="rgba(0,0,0,0.08)" />
          </ReactFlow>
        </TopologyCanvasInteractionContext.Provider>
      </div>
    </div>
  )
}

export interface TopologyFlowCanvasProps {
  topology: TopologyData
  persistenceKey?: string
  readOnly?: boolean
  onNavigateToDevice?: (deviceId: string) => void
  onNavigateToConnection?: (connectionId: string) => void
  canvasRef?: MutableRefObject<HTMLDivElement | null>
  onExportPdf?: () => void
  exporting?: boolean
  serverLayout?: TopologyServerLayout | undefined
  onPersistLayout?: (payload: TopologyServerLayout) => Promise<void>
  onClearServerLayout?: () => Promise<void>
}

export const TopologyFlowCanvas = forwardRef<TopologyFlowCanvasHandle, TopologyFlowCanvasProps>(function TopologyFlowCanvas(
  {
    topology, persistenceKey, readOnly, onNavigateToDevice, onNavigateToConnection, canvasRef, onExportPdf, exporting,
    serverLayout, onPersistLayout, onClearServerLayout,
  },
  ref
) {
  const [fullscreen, setFullscreen] = useState(false)

  if (!topology.nodes.length) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-center px-6 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aún no hay dispositivos en el diagrama. Crea conexiones para enlazar dispositivos y puertos.
        </p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <TopologyFlowInner
        topology={topology} persistenceKey={persistenceKey} readOnly={readOnly}
        onNavigateToDevice={onNavigateToDevice} onNavigateToConnection={onNavigateToConnection}
        fullscreen={fullscreen} onFullscreenChange={setFullscreen} canvasRef={canvasRef}
        onExportPdf={onExportPdf} exporting={exporting}
        serverLayout={serverLayout} onPersistLayout={onPersistLayout} onClearServerLayout={onClearServerLayout}
        exportHandleRef={ref}
      />
    </ReactFlowProvider>
  )
})
