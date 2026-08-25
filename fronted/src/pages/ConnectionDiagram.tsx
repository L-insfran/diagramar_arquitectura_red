import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cable,
  Copy,
  MoreVertical,
  Pencil,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TruncatedText } from '../components/Tooltip'
import { SimpleLinkModal } from '../components/diagram/SimpleLinkModal'
import { DiagramLinkReferenceList } from '../components/diagram/DiagramLinkReferenceList'
import { PrintModePanel } from '../components/diagram/PrintModePanel'
import { DiagramCanvasOptionsMenu } from '../components/diagram/DiagramCanvasOptionsMenu'
import { SIMPLE_DEVICE_GAP, simpleDeviceHeight, resolveDeviceGap, resolveDeviceNodeSize, SIMPLE_DEVICE_WIDTH, CONTAINER_PAD } from '../components/diagram/SimpleDeviceNode'
import { AREA_BODY_PAD } from '../components/diagram/AreaContainerNode'
import {
  areaLooseOrigin,
  initialDevicePositionForNew,
  rackBoardContentTop,
} from '../utils/diagram/containerLayout'
import {
  ConnectionDiagramCanvas,
  type ConnectionDiagramCanvasHandle,
} from '../components/diagram/ConnectionDiagramCanvas'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../contexts/ToastContext'
import { connectionDiagramsService } from '../services/connection-diagrams.service'
import { diagramLinksService } from '../services/diagram-links.service'
import { devicesService } from '../services/devices.service'
import { boardsService } from '../services/boards.service'
import { racksService } from '../services/racks.service'
import { sitesService } from '../services/sites.service'
import { systemBrandingService } from '../services/systemBranding.service'
import { exportConnectionDiagramPdf } from '../utils/exportConnectionDiagramPdf'
import type { LinkTableFormat } from '../utils/pdf/linkReferencePdf'
import type { PaperFormat, PrintOrientation } from '../utils/pdf/a4Geometry'
import {
  centerFrameOnBounds,
  fitContentIntoFrame,
  frameFromBounds,
  parsePrintFrame,
} from '../utils/pdf/printFrame'
import {
  buildLinkEndpointPath,
  formatEndpointPathText,
  formatLinkCode,
  formatLinkReference,
  occupancyEdgesFromDiagramLinks,
} from '../utils/diagram/linkLabel'
import { buildLinkPathRows } from '../utils/diagram/linkPathRows'
import { boardFlowNodeId } from '../utils/boardPlacement'
import { areaFlowNodeId } from '../utils/areaPlacement'
import { rackFlowNodeId } from '../utils/diagram/rackLayout'
import { parseDiagramHandlePort } from '../utils/diagram/diagramPortHandles'
import {
  collectContainerSubtree,
  collectRemovedDeviceIds,
  pruneDiagramState,
} from '../utils/diagram/diagramRemoval'
import {
  RemoveFromDiagramDialog,
  type RemoveFromDiagramInfo,
} from '../components/diagram/RemoveFromDiagramDialog'
import {
  resolvePhysicalContainerAssignment,
  deviceNeedsPhysicalAssign,
} from '../utils/diagram/diagramContainerAssignment'
import type {
  Area,
  Board,
  BoardKind,
  ConnectionDiagram,
  DiagramContainerState,
  DiagramLayoutMode,
  DiagramLink,
  DiagramLinkEdge,
  DiagramNodePosition,
  DiagramPortDisplay,
  DiagramPrintFrame,
  DiagramSettings,
  Rack,
  TopologyNode,
} from '../types'
import { computeTreeLayout, collectVisibleDeviceIds } from '../utils/diagram/treeLayout'
import {
  buildLayoutUpdate,
  hasTreeLayoutPositions,
  resolveActiveLayoutState,
  resolveFreeLayoutState,
  resolveTreeLayoutState,
} from '../utils/diagram/layoutState'
import {
  portSlotsVerticalRows,
  resolveDevicePortSlots,
} from '../utils/diagram/devicePortSlots'

function patchContainerDeviceIds(
  prev: DiagramContainerState,
  deviceIds: string[],
): DiagramContainerState {
  return {
    ...prev,
    x: prev.x,
    y: prev.y,
    deviceIds,
  }
}

function computeInitialPositionForAddedDevice(
  containerId: string,
  existingIds: string[],
  nodePositions: Record<string, DiagramNodePosition>,
  inventory: TopologyNode[],
  deviceGap: number,
  containers: Record<string, DiagramContainerState>,
): { x: number; y: number } {
  const heightById: Record<string, number> = {}
  for (const id of existingIds) {
    const savedH = nodePositions[id]?.height
    if (savedH != null && Number.isFinite(savedH) && savedH > 0) {
      heightById[id] = savedH
      continue
    }
    const dev = inventory.find((d) => d.id === id)
    heightById[id] = simpleDeviceHeight(0, dev?.label ?? '')
  }
  const gap = resolveDeviceGap({ deviceGap })

  if (containerId.startsWith('area:')) {
    const hasSubContainers = Object.values(containers).some(
      (c) => c.parentId === containerId
    )
    const origin = areaLooseOrigin(hasSubContainers, {})
    return initialDevicePositionForNew(
      existingIds,
      nodePositions,
      heightById,
      origin.y,
      AREA_BODY_PAD,
      gap
    )
  }

  const contentTop = rackBoardContentTop({})
  return initialDevicePositionForNew(
    existingIds,
    nodePositions,
    heightById,
    contentTop,
    CONTAINER_PAD,
    gap
  )
}

const BOARD_KIND_OPTIONS = [
  { value: 'generic', label: 'Genérico' },
  { value: 'electrical', label: 'Eléctrico' },
  { value: 'communications', label: 'Comunicaciones' },
]

export default function ConnectionDiagramPage() {
  const { activeProjectId: projectId, activeProject } = useProject()
  const { user } = useAuth()
  const { canMutate } = usePermissions()
  const toast = useToast()
  const canvasRef = useRef<ConnectionDiagramCanvasHandle>(null)

  const {
    data: diagrams,
    loading: loadingList,
    refetch: refetchList,
  } = useApi(() => connectionDiagramsService.getAll(), [projectId])

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [paperSize, setPaperSize] = useState<PaperFormat>('a4')
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('landscape')
  const [showPrintMargins, setShowPrintMargins] = useState(false)
  const [includeLegend, setIncludeLegend] = useState(true)
  const [includeLinkTable, setIncludeLinkTable] = useState(true)
  const [linkTableFormat, setLinkTableFormat] = useState<LinkTableFormat>(() => {
    try {
      const raw = localStorage.getItem('nm.diagram.linkReferenceView')
      if (raw === 'path' || raw === 'table') return raw
    } catch {
      /* ignore */
    }
    return 'path'
  })
  const [invertColors, setInvertColors] = useState(false)
  const [printFrame, setPrintFrame] = useState<DiagramPrintFrame | null>(null)
  const [printFrameLocked, setPrintFrameLocked] = useState(false)
  const [printModeOpen, setPrintModeOpen] = useState(false)
  const [highlightedPrintSector, setHighlightedPrintSector] = useState({ col: 0, row: 0 })
  const [printDiagnostics, setPrintDiagnostics] = useState({ outsideCount: 0, cutCount: 0 })
  const [staleLinkIds, setStaleLinkIds] = useState<string[]>([])
  const [referenceListCollapsed, setReferenceListCollapsed] = useState(false)
  const [deviceGap, setDeviceGap] = useState(SIMPLE_DEVICE_GAP)
  const [portDisplay, setPortDisplay] = useState<DiagramPortDisplay>('all')
  const [portFlowInverted, setPortFlowInverted] = useState(false)
  const [layoutMode, setLayoutMode] = useState<DiagramLayoutMode>('free')
  const [newLayoutMode, setNewLayoutMode] = useState<DiagramLayoutMode>('free')
  const [focusedLinkId, setFocusedLinkId] = useState<string | null>(null)
  const printSaveTimer = useRef<number | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)
  const [diagramActionsOpen, setDiagramActionsOpen] = useState(false)
  const diagramActionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!diagramActionsOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (!diagramActionsRef.current?.contains(e.target as Node)) setDiagramActionsOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDiagramActionsOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [diagramActionsOpen])

  const [scopeSiteId, setScopeSiteId] = useState('')
  const [rackSearch, setRackSearch] = useState('')

  const [rackModalOpen, setRackModalOpen] = useState(false)
  const [rackForm, setRackForm] = useState({ name: '', areaId: '', heightU: 42 })

  const [siteModalOpen, setSiteModalOpen] = useState(false)
  const [siteForm, setSiteForm] = useState({ name: '', address: '' })

  const [areaModalOpen, setAreaModalOpen] = useState(false)
  const [areaForm, setAreaForm] = useState({ name: '' })

  const [boardModalOpen, setBoardModalOpen] = useState(false)
  const [editingBoard, setEditingBoard] = useState<Board | null>(null)
  const [boardForm, setBoardForm] = useState({
    name: '',
    areaId: '',
    kind: 'generic' as BoardKind,
    gridRows: 6,
    gridCols: 8,
  })

  const [linkModal, setLinkModal] = useState<{
    open: boolean
    sourceDeviceId?: string
    targetDeviceId?: string
    sourcePortId?: string | null
    sourcePortLabel?: string
    targetPortId?: string | null
    targetPortLabel?: string
    edgeId?: string
  }>({ open: false })
  const [linkDeleteConfirm, setLinkDeleteConfirm] = useState<{
    edgeId: string
    code: string
    reference: string
  } | null>(null)
  const [deletingLink, setDeletingLink] = useState(false)

  const [removeFromDiagram, setRemoveFromDiagram] = useState<{
    info: RemoveFromDiagramInfo
    onConfirm: () => Promise<void>
  } | null>(null)
  const [removingFromDiagram, setRemovingFromDiagram] = useState(false)

  const [assignDeviceConfirm, setAssignDeviceConfirm] = useState<{
    deviceLabel: string
    fromPath: string
    toPath: string
    areaChanged: boolean
    onConfirm: () => Promise<void>
  } | null>(null)
  const [assigningDevice, setAssigningDevice] = useState(false)

  useEffect(() => {
    if (!diagrams?.length) {
      setSelectedId(null)
      return
    }
    if (!selectedId || !diagrams.some((d) => d.id === selectedId)) {
      setSelectedId(diagrams[0].id)
    }
  }, [diagrams, selectedId])

  useEffect(() => {
    setFocusedLinkId(null)
    setPrintModeOpen(false)
    setShowPrintMargins(false)
    setPrintFrameLocked(false)
    setHighlightedPrintSector({ col: 0, row: 0 })
    setStaleLinkIds([])
    setPrintDiagnostics({ outsideCount: 0, cutCount: 0 })
  }, [selectedId])

  useEffect(() => {
    if (!printFrame) return
    const maxCol = Math.max(0, printFrame.cols - 1)
    const maxRow = Math.max(0, printFrame.rows - 1)
    setHighlightedPrintSector((prev) => {
      const col = Math.min(Math.max(0, prev.col), maxCol)
      const row = Math.min(Math.max(0, prev.row), maxRow)
      if (col === prev.col && row === prev.row) return prev
      return { col, row }
    })
  }, [printFrame?.cols, printFrame?.rows])

  const {
    data: graphPayload,
    loading: loadingGraph,
    refetch: refetchGraph,
  } = useApi(
    () =>
      selectedId
        ? connectionDiagramsService.getGraph(selectedId)
        : Promise.resolve(null),
    [selectedId, projectId]
  )

  const { data: projectDiagramLinks, refetch: refetchProjectLinks } = useApi(
    () => (projectId ? diagramLinksService.getAll() : Promise.resolve([] as DiagramLink[])),
    [projectId]
  )

  const { data: sites, refetch: refetchSites } = useApi(
    () => sitesService.getAll(),
    [projectId]
  )
  const [areas, setAreas] = useState<Area[]>([])

  const loadAreas = useCallback(async (siteId: string) => {
    if (!siteId) {
      setAreas([])
      return
    }
    try {
      setAreas(await sitesService.getAreas(siteId))
    } catch {
      setAreas([])
    }
  }, [])

  useEffect(() => {
    void loadAreas(scopeSiteId)
  }, [scopeSiteId, loadAreas])

  // Restore site scope from diagram when loaded
  useEffect(() => {
    const d = graphPayload?.diagram
    if (!d) return
    const siteIds = d.scopeSiteIds ?? []
    setScopeSiteId(siteIds[0] ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only hydrate once per diagram
  }, [graphPayload?.diagram?.id])

  // Hydrate print settings from diagram
  useEffect(() => {
    const d = graphPayload?.diagram
    if (!d) return
    setPaperSize(d.settings?.paperSize === 'a3' ? 'a3' : 'a4')
    setPrintOrientation(
      d.settings?.printOrientation === 'portrait' ? 'portrait' : 'landscape',
    )
    setPrintFrame(parsePrintFrame(d.settings?.printFrame) ?? null)
    setIncludeLegend(d.settings?.printIncludeLegend !== false)
    setIncludeLinkTable(d.settings?.printIncludeLinkTable !== false)
    setLinkTableFormat(
      d.settings?.printLinkTableFormat === 'table' || d.settings?.printLinkTableFormat === 'path'
        ? d.settings.printLinkTableFormat
        : (() => {
            try {
              const raw = localStorage.getItem('nm.diagram.linkReferenceView')
              if (raw === 'path' || raw === 'table') return raw
            } catch {
              /* ignore */
            }
            return 'path'
          })(),
    )
    setInvertColors(d.settings?.printInvertColors === true)
    setDeviceGap(d.settings?.deviceGap ?? SIMPLE_DEVICE_GAP)
    setPortDisplay(d.settings?.portDisplay ?? 'all')
    setPortFlowInverted(d.settings?.portFlowInverted ?? false)
    setLayoutMode(d.layoutMode ?? 'free')
  }, [
    graphPayload?.diagram?.id,
    graphPayload?.diagram?.settings?.paperSize,
    graphPayload?.diagram?.settings?.printOrientation,
    graphPayload?.diagram?.settings?.printFrame,
    graphPayload?.diagram?.settings?.printIncludeLegend,
    graphPayload?.diagram?.settings?.printIncludeLinkTable,
    graphPayload?.diagram?.settings?.printLinkTableFormat,
    graphPayload?.diagram?.settings?.printInvertColors,
    graphPayload?.diagram?.settings?.deviceGap,
    graphPayload?.diagram?.settings?.portDisplay,
    graphPayload?.diagram?.settings?.portFlowInverted,
    graphPayload?.diagram?.layoutMode,
  ])

  useEffect(() => {
    return () => {
      if (printSaveTimer.current != null) window.clearTimeout(printSaveTimer.current)
    }
  }, [])

  const { data: siteRacks, refetch: refetchRacks } = useApi(
    () =>
      scopeSiteId
        ? racksService.getAll({ siteId: scopeSiteId, search: rackSearch || undefined })
        : Promise.resolve([] as Rack[]),
    [scopeSiteId, rackSearch, projectId]
  )

  const { data: siteBoards, refetch: refetchBoards } = useApi(
    () =>
      scopeSiteId
        ? boardsService.getAll({ siteId: scopeSiteId })
        : Promise.resolve([] as Board[]),
    [scopeSiteId, projectId]
  )

  const diagram: ConnectionDiagram | null = graphPayload?.diagram ?? null

  const diagramForCanvas = useMemo((): ConnectionDiagram | null => {
    if (!diagram) return null
    const active = resolveActiveLayoutState({ ...diagram, layoutMode })
    return {
      ...diagram,
      layoutMode,
      nodePositions: active.nodePositions ?? {},
      labelOffsets: active.labelOffsets ?? {},
      edgeRoutes: active.edgeRoutes ?? {},
      handleAnchors: active.handleAnchors ?? {},
      settings: {
        ...(diagram.settings ?? {}),
        deviceGap,
        portDisplay,
        portFlowInverted,
      },
    }
  }, [diagram, deviceGap, portDisplay, portFlowInverted, layoutMode])

  const visibleContainerIds = useMemo(() => {
    const keys = Object.keys(diagram?.containers ?? {})
    return keys.filter(
      // area: es la raíz; racks/tableros usan el id unificado container:${id}
      // (mantenemos legacy rack:/board: por compatibilidad de diagramas guardados).
      (k) =>
        k.startsWith('area:') ||
        k.startsWith('container:') ||
        k.startsWith('rack:') ||
        k.startsWith('board:')
    )
  }, [diagram?.containers])

  const persistScope = useCallback(
    async (siteId: string) => {
      if (!selectedId || !canMutate) return
      try {
        await connectionDiagramsService.update(selectedId, {
          scopeSiteIds: siteId ? [siteId] : [],
        })
      } catch {
        /* ignore */
      }
    },
    [selectedId, canMutate]
  )

  const handleSiteChange = async (siteId: string) => {
    setScopeSiteId(siteId)
    await persistScope(siteId)
    await refetchGraph()
  }

  const addContainerToDiagram = async (
    containerId: string,
    patch: DiagramContainerState,
    extraContainers?: Record<string, DiagramContainerState>
  ) => {
    if (!selectedId || !diagram) return
    const base = {
      ...diagram.containers,
      ...(extraContainers ?? {}),
    }
    const next = {
      ...base,
      [containerId]: {
        ...(base[containerId] ?? { x: 40, y: 40 }),
        ...patch,
      },
    }
    try {
      await connectionDiagramsService.update(selectedId, { containers: next })
      await refetchGraph()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo agregar al canvas')
    }
  }

  const ensureAreaOnCanvas = (
    areaId: string,
    live: Record<string, DiagramContainerState>
  ): Record<string, DiagramContainerState> => {
    const key = areaFlowNodeId(areaId)
    if (live[key]) return live
    const offset = Object.keys(live).filter((k) => k.startsWith('area:')).length * 48
    return {
      ...live,
      [key]: { x: 40 + offset, y: 40 + offset, deviceIds: [] },
    }
  }

  const nextChildOffsetInArea = (
    areaKey: string,
    live: Record<string, DiagramContainerState>
  ) => {
    // Placeholder; buildGraph re-packs all nested children below the area chrome.
    const siblings = Object.entries(live).filter(
      ([, v]) => v.parentId === areaKey
    ).length
    return {
      x: 16 + siblings * 8,
      y: 116,
    }
  }

  const liveContainers = useCallback((): Record<string, DiagramContainerState> => {
    return {
      ...(canvasRef.current?.getPersistPayload().containers ?? diagram?.containers ?? {}),
    }
  }, [diagram?.containers])

  const isNestedInArea = (containerId: string, areaId: string) => {
    const parent = diagram?.containers?.[containerId]?.parentId
    return parent === areaFlowNodeId(areaId)
  }

  const persistContainers = async (
    next: Record<string, DiagramContainerState>,
    successMsg?: string
  ) => {
    if (!selectedId) return
    try {
      await connectionDiagramsService.update(selectedId, { containers: next })
      if (successMsg) toast.success(successMsg)
      await refetchGraph()
      window.setTimeout(() => canvasRef.current?.rerouteCables(), 100)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo actualizar el diagrama')
    }
  }

  /** Quita un contenedor y todo su subárbol del canvas, con confirmación si hay equipos/enlaces. */
  const handleRemoveContainerFromCanvas = (
    containerId: string,
    label: string,
  ) => {
    if (!selectedId || !diagram) return
    const live = liveContainers()
    const subtreeIds = collectContainerSubtree(live, containerId)
    const deviceIds = collectRemovedDeviceIds(live, subtreeIds, resolveContainerDeviceIds)
    const allLinks = projectDiagramLinks ?? []
    const affectedLinks = allLinks.filter(
      (l) => deviceIds.has(l.sourceDeviceId) || deviceIds.has(l.targetDeviceId),
    )

    const doRemove = async () => {
      setRemovingFromDiagram(true)
      try {
        if (affectedLinks.length > 0) {
          await diagramLinksService.bulkDeleteByDevices([...deviceIds])
        }
        const livePayload = canvasRef.current?.getPersistPayload()
        const freeBase =
          layoutMode === 'free'
            ? {
                nodePositions: livePayload?.nodePositions ?? diagram.nodePositions ?? {},
                edgeRoutes: livePayload?.edgeRoutes ?? diagram.edgeRoutes ?? {},
                labelOffsets: livePayload?.labelOffsets ?? diagram.labelOffsets ?? {},
                handleAnchors: livePayload?.handleAnchors ?? diagram.handleAnchors ?? {},
              }
            : resolveFreeLayoutState(diagram)
        const treeBase =
          layoutMode === 'tree'
            ? {
                nodePositions: livePayload?.nodePositions ?? {},
                edgeRoutes: livePayload?.edgeRoutes ?? {},
                labelOffsets: livePayload?.labelOffsets ?? {},
                handleAnchors: livePayload?.handleAnchors ?? {},
              }
            : resolveTreeLayoutState(diagram)
        const containersBase = livePayload?.containers ?? live
        const freePruned = pruneDiagramState(
          { containers: containersBase, ...freeBase },
          subtreeIds,
          deviceIds,
          new Set(affectedLinks.map((l) => l.id)),
        )
        const treePruned = pruneDiagramState(
          { containers: containersBase, ...treeBase },
          subtreeIds,
          deviceIds,
          new Set(affectedLinks.map((l) => l.id)),
        )
        await connectionDiagramsService.update(selectedId, {
          containers: freePruned.containers,
          ...buildLayoutUpdate('free', {
            nodePositions: freePruned.nodePositions,
            edgeRoutes: freePruned.edgeRoutes,
            labelOffsets: freePruned.labelOffsets,
            handleAnchors: freePruned.handleAnchors,
          }),
          ...buildLayoutUpdate('tree', {
            nodePositions: treePruned.nodePositions,
            edgeRoutes: treePruned.edgeRoutes,
            labelOffsets: treePruned.labelOffsets,
            handleAnchors: treePruned.handleAnchors,
          }),
        })
        toast.success(`«${label}» quitado del diagrama`)
        refetchProjectLinks()
        await refetchGraph()
        window.setTimeout(() => canvasRef.current?.rerouteCables(), 100)
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'No se pudo quitar el contenedor')
      } finally {
        setRemovingFromDiagram(false)
        setRemoveFromDiagram(null)
      }
    }

    if (deviceIds.size === 0 && affectedLinks.length === 0 && subtreeIds.size <= 1) {
      void doRemove()
      return
    }

    setRemoveFromDiagram({
      info: {
        label,
        kind: 'container',
        childContainerCount: subtreeIds.size - 1,
        deviceCount: deviceIds.size,
        linkCodes: affectedLinks.map((l) => l.code).sort((a, b) => a - b),
      },
      onConfirm: doRemove,
    })
  }

  const handleAddArea = async (area: Area) => {
    const id = areaFlowNodeId(area.id)
    if (visibleContainerIds.includes(id)) {
      toast.info('El área ya está en el diagrama')
      return
    }
    const offset = visibleContainerIds.filter((k) => k.startsWith('area:')).length * 48
    await addContainerToDiagram(id, {
      x: 40 + offset,
      y: 40 + offset,
      deviceIds: [],
    })
    toast.success(`Área «${area.name}» agregada`)
  }

  /** Agrega al canvas anidado en su área, o mueve al área si ya estaba suelto. */
  const handleAddOrNestRack = async (rack: Rack) => {
    const id = rackFlowNodeId(rack.id)
    const areaKey = areaFlowNodeId(rack.areaId)
    let live = liveContainers()

    if (live[id]?.parentId === areaKey) {
      toast.info('El rack ya está dentro del área')
      return
    }

    const wasOnCanvas = Boolean(live[id])
    live = ensureAreaOnCanvas(rack.areaId, live)
    const rel = nextChildOffsetInArea(areaKey, live)
    const prev = live[id]

    live = {
      ...live,
      [id]: {
        ...(prev ?? { x: rel.x, y: rel.y }),
        x: rel.x,
        y: rel.y,
        deviceIds: prev?.deviceIds ?? [],
        parentId: areaKey,
      },
    }
    await persistContainers(
      live,
      wasOnCanvas
        ? `Rack «${rack.name}» movido al área`
        : `Rack «${rack.name}» agregado`
    )
  }

  const handleAddOrNestBoard = async (board: Board) => {
    const id = boardFlowNodeId(board.id)
    const areaKey = areaFlowNodeId(board.areaId)
    let live = liveContainers()

    if (live[id]?.parentId === areaKey) {
      toast.info('El tablero ya está dentro del área')
      return
    }

    const wasOnCanvas = Boolean(live[id])
    live = ensureAreaOnCanvas(board.areaId, live)
    const rel = nextChildOffsetInArea(areaKey, live)
    const prev = live[id]

    live = {
      ...live,
      [id]: {
        ...(prev ?? { x: rel.x, y: rel.y }),
        x: rel.x,
        y: rel.y,
        deviceIds: prev?.deviceIds ?? [],
        parentId: areaKey,
      },
    }
    await persistContainers(
      live,
      wasOnCanvas
        ? `Tablero «${board.name}» movido al área`
        : `Tablero «${board.name}» agregado`
    )
  }

  /** Saca el subcontenedor del área (queda raíz plana en el canvas). */
  const handleUnnestFromArea = async (containerId: string, label: string) => {
    const live = liveContainers()
    const prev = live[containerId]
    if (!prev?.parentId) {
      toast.info('No está dentro de un área')
      return
    }
    const areaKey = prev.parentId
    const areaPos = live[areaKey]
    await persistContainers(
      {
        ...live,
        [containerId]: {
          ...prev,
          parentId: null,
          x: (areaPos?.x ?? 40) + (prev.x ?? 0),
          y: (areaPos?.y ?? 40) + (prev.y ?? 0),
        },
      },
      `«${label}» sacado del área`
    )
  }

  const resolveContainerDeviceIds = useCallback(
    (containerId: string): string[] => {
      if (!diagram || !graphPayload) return []
      const inventoryIds = new Set(graphPayload.inventory.map((d) => d.id))
      const saved = diagram.containers?.[containerId]
      if (saved?.deviceIds != null) {
        return saved.deviceIds.filter((id) => inventoryIds.has(id))
      }
      if (containerId.startsWith('container:') || containerId.startsWith('rack:') || containerId.startsWith('board:')) {
        const prefix = containerId.startsWith('container:') ? 'container:' : containerId.startsWith('rack:') ? 'rack:' : 'board:'
        const unifiedId = containerId.slice(prefix.length)
        return graphPayload.inventory
          .filter((d) => d.data.containerId === unifiedId)
          .map((d) => d.id)
      }
      if (containerId.startsWith('area:')) {
        const areaId = containerId.slice(5)
        const rackIds = new Set((graphPayload.racks ?? []).map((r) => r.id))
        const boardIds = new Set((graphPayload.boards ?? []).map((b) => b.id))
        return graphPayload.inventory
          .filter(
            (d) =>
              d.data.areaId === areaId &&
              (!d.data.containerId || (!rackIds.has(d.data.containerId) && !boardIds.has(d.data.containerId)))
          )
          .map((d) => d.id)
      }
      return []
    },
    [diagram, graphPayload]
  )

  const persistDeviceToDiagramLayout = useCallback(
    async (containerId: string, deviceId: string) => {
      if (!selectedId || !diagram || !graphPayload) return
      const livePayload = canvasRef.current?.getPersistPayload()
      // Containers are shared; free-mode positions are container-relative.
      const live = livePayload?.containers ?? diagram.containers ?? {}
      const freeBase = resolveFreeLayoutState(diagram)
      const freePositions = {
        ...(layoutMode === 'free'
          ? (livePayload?.nodePositions ?? freeBase.nodePositions ?? {})
          : (freeBase.nodePositions ?? {})),
      }
      // Strip device from every other container so membership matches the destination only.
      const stripped: typeof live = {}
      for (const [key, state] of Object.entries(live)) {
        if (key === containerId || !state.deviceIds?.includes(deviceId)) {
          stripped[key] = state
          continue
        }
        stripped[key] = {
          ...state,
          deviceIds: state.deviceIds.filter((id) => id !== deviceId),
        }
      }
      const prev = stripped[containerId] ?? diagram.containers?.[containerId] ?? { x: 40, y: 40 }
      const current = resolveContainerDeviceIds(containerId).filter((id) => id !== deviceId)
      const deviceIds = [...new Set([...current, deviceId])]
      delete freePositions[deviceId]
      const initialPos = computeInitialPositionForAddedDevice(
        containerId,
        current,
        freePositions,
        graphPayload.inventory,
        deviceGap,
        stripped,
      )
      const treeState = resolveTreeLayoutState(diagram)
      const treePositions = { ...(treeState.nodePositions ?? {}) }
      delete treePositions[deviceId]
      const freeOffsets =
        layoutMode === 'free' && livePayload
          ? {
              labelOffsets: livePayload.labelOffsets ?? freeBase.labelOffsets ?? {},
              edgeRoutes: livePayload.edgeRoutes ?? freeBase.edgeRoutes ?? {},
              handleAnchors: livePayload.handleAnchors ?? freeBase.handleAnchors ?? {},
            }
          : {
              labelOffsets: freeBase.labelOffsets ?? {},
              edgeRoutes: freeBase.edgeRoutes ?? {},
              handleAnchors: freeBase.handleAnchors ?? {},
            }
      await connectionDiagramsService.update(selectedId, {
        containers: {
          ...stripped,
          [containerId]: patchContainerDeviceIds(prev, deviceIds),
        },
        ...buildLayoutUpdate('free', {
          nodePositions: {
            ...freePositions,
            [deviceId]: initialPos,
          },
          ...freeOffsets,
        }),
        ...buildLayoutUpdate('tree', {
          ...treeState,
          nodePositions: treePositions,
        }),
      })
      await refetchGraph()
      window.setTimeout(() => canvasRef.current?.rerouteCables(), 100)
    },
    [
      selectedId,
      diagram,
      graphPayload,
      deviceGap,
      layoutMode,
      refetchGraph,
      resolveContainerDeviceIds,
    ],
  )

  const handleAddDeviceToContainer = useCallback(
    (containerId: string, deviceId: string) => {
      if (!selectedId || !diagram || !canMutate || !graphPayload) return

      const assignment = resolvePhysicalContainerAssignment(containerId, graphPayload)
      if (!assignment) {
        toast.error('No se pudo resolver el contenedor destino')
        return
      }

      const device = graphPayload.inventory.find((d) => d.id === deviceId)
      if (!device) return

      const runAssignAndLayout = async () => {
        await devicesService.assignContainer(deviceId, {
          containerId: assignment.containerId,
          ...(assignment.containerId ? {} : { areaId: assignment.areaId }),
        })
        await persistDeviceToDiagramLayout(containerId, deviceId)
      }

      if (!deviceNeedsPhysicalAssign(device, assignment, graphPayload)) {
        void persistDeviceToDiagramLayout(containerId, deviceId).catch((e: any) => {
          toast.error(e?.response?.data?.message ?? 'No se pudo agregar el dispositivo')
        })
        return
      }

      const fromAreaName = device.data.areaName ?? 'sin área'
      const fromContainerName = device.data.containerName ?? null
      const toAreaName =
        graphPayload.areas?.find((a) => a.id === assignment.areaId)?.name ??
        graphPayload.racks?.find((r) => r.id === assignment.containerId)?.areaName ??
        graphPayload.boards?.find((b) => b.id === assignment.containerId)?.areaName ??
        'otra área'
      const fromPath = [fromAreaName, fromContainerName].filter(Boolean).join(' › ')
      const toPath = [toAreaName, assignment.label].filter(Boolean).join(' › ')
      const areaChanged = Boolean(device.data.areaId && device.data.areaId !== assignment.areaId)

      const finishAssign = async () => {
        setAssigningDevice(true)
        try {
          await runAssignAndLayout()
          toast.success(`«${device.label}» asignado a ${assignment.label}`)
          setAssignDeviceConfirm(null)
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'No se pudo mover el dispositivo')
        } finally {
          setAssigningDevice(false)
        }
      }

      setAssignDeviceConfirm({
        deviceLabel: device.label,
        fromPath,
        toPath,
        areaChanged,
        onConfirm: finishAssign,
      })
    },
    [
      selectedId,
      diagram,
      canMutate,
      graphPayload,
      persistDeviceToDiagramLayout,
      toast,
    ],
  )

  const handleRemoveDeviceFromContainer = useCallback(
    (containerId: string, deviceId: string) => {
      if (!selectedId || !diagram || !canMutate) return
      const deviceLabel =
        graphPayload?.inventory.find((d) => d.id === deviceId)?.label ?? 'Equipo'
      const allLinks = projectDiagramLinks ?? []
      const affectedLinks = allLinks.filter(
        (l) => l.sourceDeviceId === deviceId || l.targetDeviceId === deviceId,
      )

      const doRemove = async () => {
        setRemovingFromDiagram(true)
        try {
          if (affectedLinks.length > 0) {
            await diagramLinksService.bulkDeleteByDevices([deviceId])
          }
          const livePayload = canvasRef.current?.getPersistPayload()
          const live = livePayload?.containers ?? diagram.containers ?? {}
          const prev = live[containerId] ?? diagram.containers?.[containerId] ?? { x: 40, y: 40 }
          const current = resolveContainerDeviceIds(containerId)
          const deviceIds = current.filter((id) => id !== deviceId)
          const removedDeviceIds = new Set([deviceId])
          const removedLinkIds = new Set(affectedLinks.map((l) => l.id))
          const freeBase =
            layoutMode === 'free'
              ? {
                  nodePositions: livePayload?.nodePositions ?? diagram.nodePositions ?? {},
                  edgeRoutes: livePayload?.edgeRoutes ?? diagram.edgeRoutes ?? {},
                  labelOffsets: livePayload?.labelOffsets ?? diagram.labelOffsets ?? {},
                  handleAnchors: livePayload?.handleAnchors ?? diagram.handleAnchors ?? {},
                }
              : resolveFreeLayoutState(diagram)
          const treeBase =
            layoutMode === 'tree'
              ? {
                  nodePositions: livePayload?.nodePositions ?? {},
                  edgeRoutes: livePayload?.edgeRoutes ?? {},
                  labelOffsets: livePayload?.labelOffsets ?? {},
                  handleAnchors: livePayload?.handleAnchors ?? {},
                }
              : resolveTreeLayoutState(diagram)
          const containersNext = {
            ...live,
            [containerId]: patchContainerDeviceIds(prev, deviceIds),
          }
          const freePruned = pruneDiagramState(
            { containers: containersNext, ...freeBase },
            new Set<string>(),
            removedDeviceIds,
            removedLinkIds,
          )
          const treePruned = pruneDiagramState(
            { containers: containersNext, ...treeBase },
            new Set<string>(),
            removedDeviceIds,
            removedLinkIds,
          )
          await connectionDiagramsService.update(selectedId, {
            containers: freePruned.containers,
            ...buildLayoutUpdate('free', {
              nodePositions: freePruned.nodePositions,
              edgeRoutes: freePruned.edgeRoutes,
              labelOffsets: freePruned.labelOffsets,
              handleAnchors: freePruned.handleAnchors,
            }),
            ...buildLayoutUpdate('tree', {
              nodePositions: treePruned.nodePositions,
              edgeRoutes: treePruned.edgeRoutes,
              labelOffsets: treePruned.labelOffsets,
              handleAnchors: treePruned.handleAnchors,
            }),
          })
          toast.success('Equipo sacado del diagrama')
          refetchProjectLinks()
          await refetchGraph()
          window.setTimeout(() => canvasRef.current?.rerouteCables(), 100)
        } catch (e: any) {
          toast.error(e?.response?.data?.message ?? 'No se pudo sacar el dispositivo')
        } finally {
          setRemovingFromDiagram(false)
          setRemoveFromDiagram(null)
        }
      }

      if (affectedLinks.length === 0) {
        void doRemove()
        return
      }

      setRemoveFromDiagram({
        info: {
          label: deviceLabel,
          kind: 'device',
          childContainerCount: 0,
          deviceCount: 1,
          linkCodes: affectedLinks.map((l) => l.code).sort((a, b) => a - b),
        },
        onConfirm: doRemove,
      })
    },
    [selectedId, diagram, canMutate, graphPayload?.inventory, projectDiagramLinks, refetchGraph, refetchProjectLinks, toast, resolveContainerDeviceIds, layoutMode]
  )

  const handleReorderDevicesInContainer = useCallback(
    async (containerId: string, deviceIds: string[]) => {
      if (!selectedId || !diagram || !canMutate) return
      const live = canvasRef.current?.getPersistPayload().containers ?? diagram.containers ?? {}
      const prev = live[containerId] ?? diagram.containers?.[containerId] ?? { x: 40, y: 40 }
      const current = resolveContainerDeviceIds(containerId)
      if (
        current.length === deviceIds.length &&
        current.every((id, i) => id === deviceIds[i])
      ) {
        return
      }
      try {
        await connectionDiagramsService.update(selectedId, {
          containers: {
            ...live,
            [containerId]: patchContainerDeviceIds(prev, deviceIds),
          },
        })
        await refetchGraph()
        window.setTimeout(() => canvasRef.current?.rerouteCables(), 100)
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'No se pudo reordenar')
      }
    },
    [selectedId, diagram, canMutate, refetchGraph, toast, resolveContainerDeviceIds]
  )

  const handleCreateDiagram = async () => {
    if (!projectId || !newName.trim()) return
    try {
      const created = await connectionDiagramsService.create({
        projectId,
        name: newName.trim(),
        scopeSiteIds: scopeSiteId ? [scopeSiteId] : [],
        scopeAreaIds: [],
        layoutMode: newLayoutMode,
        settings: {
          portDisplay: 'all',
          deviceGap: SIMPLE_DEVICE_GAP,
        },
      })
      toast.success('Diagrama creado')
      setCreateOpen(false)
      setNewName('')
      setNewLayoutMode('free')
      await refetchList()
      setSelectedId(created.id)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo crear el diagrama')
    }
  }

  const openRenameDiagram = () => {
    if (!diagram) return
    setRenameName(diagram.name)
    setRenameOpen(true)
  }

  const handleRenameDiagram = async () => {
    if (!selectedId || !renameName.trim()) return
    setRenaming(true)
    try {
      await connectionDiagramsService.update(selectedId, { name: renameName.trim() })
      toast.success('Nombre actualizado')
      setRenameOpen(false)
      await refetchList()
      await refetchGraph()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo renombrar el diagrama')
    } finally {
      setRenaming(false)
    }
  }

  const handleDuplicate = async () => {
    if (!selectedId) return
    try {
      const copy = await connectionDiagramsService.duplicate(selectedId)
      toast.success('Diagrama duplicado')
      await refetchList()
      setSelectedId(copy.id)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo duplicar')
    }
  }

  const handleDelete = async () => {
    if (!selectedId) return
    if (!window.confirm('¿Eliminar este diagrama? No se borran racks, tableros ni conexiones.'))
      return
    try {
      await connectionDiagramsService.delete(selectedId)
      toast.success('Diagrama eliminado')
      setSelectedId(null)
      await refetchList()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo eliminar')
    }
  }

  const buildPrintSettings = useCallback((): DiagramSettings => {
    return {
      ...(diagram?.settings ?? {}),
      deviceGap,
      portDisplay,
      portFlowInverted,
      paperSize,
      printOrientation,
      ...(printFrame ? { printFrame } : {}),
      printIncludeLegend: includeLegend,
      printIncludeLinkTable: includeLinkTable,
      printLinkTableFormat: linkTableFormat,
      printInvertColors: invertColors,
    }
  }, [
    diagram?.settings,
    deviceGap,
    portDisplay,
    portFlowInverted,
    paperSize,
    printOrientation,
    printFrame,
    includeLegend,
    includeLinkTable,
    linkTableFormat,
    invertColors,
  ])

  const persistSettingsSoon = useCallback(
    (settings?: DiagramSettings) => {
      if (!selectedId || !canMutate) return
      if (printSaveTimer.current != null) window.clearTimeout(printSaveTimer.current)
      printSaveTimer.current = window.setTimeout(() => {
        void connectionDiagramsService
          .update(selectedId, { settings: settings ?? buildPrintSettings() })
          .catch(() => undefined)
      }, 700)
    },
    [selectedId, canMutate, buildPrintSettings],
  )

  const measureDeviceForTree = useCallback(
    (deviceId: string): { width: number; height: number } => {
      const dev = graphPayload?.inventory.find((d) => d.id === deviceId)
      const treePositions = resolveTreeLayoutState(diagram ?? { treeLayout: {} }).nodePositions
      const saved = treePositions?.[deviceId]
      const nodeWidth =
        saved?.width && saved.width > 0 ? saved.width : SIMPLE_DEVICE_WIDTH
      const preliminary = dev
        ? resolveDevicePortSlots({
            deviceId,
            ports: dev.data.ports ?? [],
            edges: graphPayload?.graph.edges ?? [],
            layoutMode: 'tree',
            portDisplay,
            portFlowInverted,
            savedAnchors: {},
          })
        : []
      const rows = portSlotsVerticalRows(preliminary)
      const autoH = simpleDeviceHeight(
        rows,
        dev?.label ?? '',
        nodeWidth,
        preliminary.length > 0 && preliminary.every((s) => !s.connected)
      )
      return resolveDeviceNodeSize(autoH, saved)
    },
    [diagram?.treeLayout, graphPayload, portDisplay, portFlowInverted]
  )

  const computeTreePositions = useCallback((): Record<string, DiagramNodePosition> => {
    if (!diagram || !graphPayload) return {}
    const deviceIds = collectVisibleDeviceIds({
      diagram,
      inventory: graphPayload.inventory,
      racks: graphPayload.racks,
      boards: graphPayload.boards,
      visibleContainerIds,
    })
    const sizes = new Map<string, { width: number; height: number }>()
    for (const id of deviceIds) {
      sizes.set(id, measureDeviceForTree(id))
    }
    return computeTreeLayout(
      deviceIds,
      graphPayload.graph.edges,
      sizes,
      resolveDeviceGap({ deviceGap })
    )
  }, [diagram, graphPayload, visibleContainerIds, measureDeviceForTree, deviceGap])

  const applyLayoutModeChange = useCallback(
    async (next: DiagramLayoutMode) => {
      if (!selectedId || !canMutate) return
      try {
        const live = canvasRef.current?.getPersistPayload()
        const savedOutgoing =
          layoutMode === 'tree'
            ? resolveTreeLayoutState(diagram ?? { treeLayout: {} })
            : resolveFreeLayoutState(diagram ?? {})
        const outgoingGeometry = {
          nodePositions: live?.nodePositions ?? savedOutgoing.nodePositions ?? {},
          labelOffsets: live?.labelOffsets ?? savedOutgoing.labelOffsets ?? {},
          edgeRoutes: live?.edgeRoutes ?? savedOutgoing.edgeRoutes ?? {},
          handleAnchors: live?.handleAnchors ?? savedOutgoing.handleAnchors ?? {},
        }
        // Snapshot the mode we leave so unsaved drags survive the switch.
        const updates: Parameters<typeof connectionDiagramsService.update>[1] = {
          layoutMode: next,
          settings: live?.settings ?? buildPrintSettings(),
          ...(live?.containers ? { containers: live.containers } : {}),
          ...buildLayoutUpdate(layoutMode, outgoingGeometry),
        }
        // First time entering tree with no saved tree layout → compute dagre once.
        if (next === 'tree' && !hasTreeLayoutPositions(diagram?.treeLayout)) {
          updates.treeLayout = {
            nodePositions: computeTreePositions(),
            edgeRoutes: {},
            labelOffsets: {},
            handleAnchors: {},
          }
        }
        await connectionDiagramsService.update(selectedId, updates)
        await refetchGraph()
        setLayoutMode(next)
        toast.success(next === 'tree' ? 'Modo árbol activado' : 'Modo libre activado')
        window.setTimeout(() => {
          canvasRef.current?.fitView()
          canvasRef.current?.rerouteCables()
        }, 120)
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'No se pudo cambiar el modo')
      }
    },
    [
      selectedId,
      canMutate,
      layoutMode,
      diagram,
      buildPrintSettings,
      computeTreePositions,
      refetchGraph,
      toast,
    ]
  )

  const handleLayoutModeChange = useCallback(
    (next: DiagramLayoutMode) => {
      if (next === layoutMode) return
      void applyLayoutModeChange(next)
    },
    [layoutMode, applyLayoutModeChange]
  )

  const handleReorganizeTree = useCallback(async () => {
    if (!selectedId || !canMutate || layoutMode !== 'tree') return
    try {
      const treeState = resolveTreeLayoutState(diagram ?? { treeLayout: {} })
      await connectionDiagramsService.update(selectedId, {
        ...buildLayoutUpdate('tree', {
          nodePositions: computeTreePositions(),
          edgeRoutes: {},
          labelOffsets: treeState.labelOffsets ?? {},
          handleAnchors: treeState.handleAnchors ?? {},
        }),
      })
      toast.success('Árbol reorganizado')
      await refetchGraph()
      window.setTimeout(() => canvasRef.current?.rerouteCables(), 120)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo reorganizar')
    }
  }, [selectedId, canMutate, layoutMode, computeTreePositions, diagram, refetchGraph, toast])

  const persistPortSettingsSoon = useCallback(
    (patch: Partial<Pick<DiagramSettings, 'portDisplay' | 'portFlowInverted'>>) => {
      if (!selectedId || !canMutate) return
      if (printSaveTimer.current != null) window.clearTimeout(printSaveTimer.current)
      printSaveTimer.current = window.setTimeout(() => {
        void connectionDiagramsService
          .update(selectedId, { settings: { ...buildPrintSettings(), ...patch } })
          .catch(() => undefined)
      }, 400)
    },
    [selectedId, canMutate, buildPrintSettings]
  )

  const handlePortDisplayChange = useCallback(
    (mode: DiagramPortDisplay) => {
      setPortDisplay(mode)
      persistPortSettingsSoon({ portDisplay: mode })
    },
    [persistPortSettingsSoon]
  )

  const handlePortFlowInvertedChange = useCallback(
    (inverted: boolean) => {
      setPortFlowInverted(inverted)
      persistPortSettingsSoon({ portFlowInverted: inverted })
    },
    [persistPortSettingsSoon]
  )

  const applyPrintFrame = useCallback(
    (next: DiagramPrintFrame, persist = true) => {
      setPrintFrame(next)
      if (persist) {
        persistSettingsSoon({ ...buildPrintSettings(), printFrame: next })
      }
    },
    [buildPrintSettings, persistSettingsSoon],
  )

  const ensurePrintFrame = useCallback((): DiagramPrintFrame | null => {
    if (printFrame) return printFrame
    const bounds = canvasRef.current?.getContentBounds()
    if (!bounds) return null
    const next = frameFromBounds(bounds, paperSize, printOrientation)
    setPrintFrame(next)
    return next
  }, [printFrame, paperSize, printOrientation])

  const openPrintMode = () => {
    setPrintModeOpen(true)
    setShowPrintMargins(true)
    setHighlightedPrintSector({ col: 0, row: 0 })
    const frame = ensurePrintFrame()
    if (frame) {
      persistSettingsSoon({ ...buildPrintSettings(), printFrame: frame })
    }
  }

  const closePrintMode = () => {
    setPrintModeOpen(false)
    setShowPrintMargins(false)
  }

  const handleFitFrameToContent = () => {
    const bounds = canvasRef.current?.getContentBounds()
    if (!bounds) {
      toast.error('No hay objetos para ajustar el marco')
      return
    }
    applyPrintFrame(frameFromBounds(bounds, paperSize, printOrientation))
  }

  const handleFitContentIntoFrame = () => {
    const frame = ensurePrintFrame()
    const bounds = canvasRef.current?.getContentBounds()
    if (!frame || !bounds) {
      toast.error('No hay objetos para encajar en el marco')
      return
    }
    applyPrintFrame(fitContentIntoFrame(bounds, frame, paperSize, printOrientation))
  }

  const handleCenterFrame = () => {
    const frame = ensurePrintFrame()
    const bounds = canvasRef.current?.getContentBounds()
    if (!frame || !bounds) return
    applyPrintFrame(centerFrameOnBounds(bounds, frame, paperSize, printOrientation))
  }

  const handleAutorouteLinks = (ids: string[]) => {
    canvasRef.current?.autorouteLinks(ids)
  }

  const handleSaveLayout = async () => {
    if (!selectedId || !canvasRef.current) return
    setSaving(true)
    try {
      const payload = canvasRef.current.getPersistPayload({
        paperSize,
        printOrientation,
        printFrame: printFrame ?? undefined,
        printIncludeLegend: includeLegend,
        printIncludeLinkTable: includeLinkTable,
        printLinkTableFormat: linkTableFormat,
        printInvertColors: invertColors,
      })
      const { nodePositions, labelOffsets, edgeRoutes, handleAnchors, containers, settings } =
        payload
      await connectionDiagramsService.update(selectedId, {
        containers,
        settings,
        layoutMode,
        scopeSiteIds: scopeSiteId ? [scopeSiteId] : [],
        scopeAreaIds: [],
        ...buildLayoutUpdate(layoutMode, {
          nodePositions,
          labelOffsets,
          edgeRoutes,
          handleAnchors,
        }),
      })
      toast.success('Layout guardado')
      await refetchGraph()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo guardar el layout')
    } finally {
      setSaving(false)
    }
  }

  const handleExportPdf = async () => {
    if (!selectedId || !canvasRef.current || !diagram) return
    setExporting(true)
    try {
      const authorName = user?.firstName
        ? `${user.firstName} ${user.lastName ?? ''}`.trim()
        : undefined

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

      const inventory = graphPayload?.inventory ?? []
      const linkReferences = visibleLinkEdges
        .slice()
        .sort((a, b) => (a.code ?? 0) - (b.code ?? 0) || a.id.localeCompare(b.id))
        .map((e) => ({
          code: formatLinkCode(e.code),
          origin: formatEndpointPathText(
            buildLinkEndpointPath(e.source, e.sourcePort, inventory, containerByDeviceId)
          ),
          destination: formatEndpointPathText(
            buildLinkEndpointPath(e.target, e.targetPort, inventory, containerByDeviceId),
            { mirrored: true }
          ),
          description: e.description?.trim() || '',
        }))
      const linkPathReferences = buildLinkPathRows(
        visibleLinkEdges,
        inventory,
        containerByDeviceId,
      ).map((row) => ({
        code: row.code,
        originSite: row.origin.site ?? '',
        originArea: row.origin.area ?? '',
        originContainer: row.origin.container ?? '',
        originDevice: row.origin.device ?? '',
        originPort: row.origin.port ?? '',
        cable: row.cable ?? '',
        destinationPort: row.destination.port ?? '',
        destinationDevice: row.destination.device ?? '',
        destinationContainer: row.destination.container ?? '',
        destinationArea: row.destination.area ?? '',
        destinationSite: row.destination.site ?? '',
        description: row.edge.description?.trim() || '',
      }))

      // Captura el layout actual (sin reempaquetar contenedores).
      await exportConnectionDiagramPdf({
        title: diagram.name || 'Diagrama de conexión',
        projectName: activeProject?.name,
        clientName: activeProject?.clientName ?? undefined,
        authorName,
        branding,
        orientation: printOrientation,
        format: paperSize,
        includeLegend,
        includeLinkTable,
        linkTableFormat,
        invertColors,
        linkReferences,
        linkPathReferences,
        captureDiagram: (format, orientation) =>
          canvasRef.current!.captureDiagramPng(format, orientation, invertColors),
      })
      toast.success('PDF exportado')
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo exportar el PDF')
    } finally {
      setExporting(false)
    }
  }

  const openCreateBoardModal = () => {
    setEditingBoard(null)
    setBoardForm({
      name: '',
      areaId: areas[0]?.id ?? '',
      kind: 'generic',
      gridRows: 6,
      gridCols: 8,
    })
    setBoardModalOpen(true)
  }

  const openEditBoardModal = (board: Board) => {
    setEditingBoard(board)
    setBoardForm({
      name: board.name,
      areaId: board.areaId,
      kind: board.kind,
      gridRows: board.gridRows,
      gridCols: board.gridCols,
    })
    setBoardModalOpen(true)
  }

  const closeBoardModal = () => {
    setBoardModalOpen(false)
    setEditingBoard(null)
    setBoardForm({ name: '', areaId: '', kind: 'generic', gridRows: 6, gridCols: 8 })
  }

  const handleSaveBoard = async () => {
    if (!boardForm.name.trim() || !boardForm.areaId) return
    try {
      if (editingBoard) {
        const previousAreaId = editingBoard.areaId
        const updated = await boardsService.update(editingBoard.id, {
          name: boardForm.name.trim(),
          areaId: boardForm.areaId,
          kind: boardForm.kind,
          gridRows: boardForm.gridRows,
          gridCols: boardForm.gridCols,
        })
        toast.success('Tablero actualizado')
        closeBoardModal()
        await refetchBoards()
        await refetchGraph()
        const containerId = boardFlowNodeId(updated.id)
        const wasNestedInPreviousArea =
          liveContainers()[containerId]?.parentId === areaFlowNodeId(previousAreaId)
        if (previousAreaId !== updated.areaId && wasNestedInPreviousArea) {
          await handleAddOrNestBoard(updated)
        }
        return
      }
      if (!projectId) return
      const board = await boardsService.create({
        projectId,
        areaId: boardForm.areaId,
        name: boardForm.name.trim(),
        kind: boardForm.kind,
        gridRows: boardForm.gridRows,
        gridCols: boardForm.gridCols,
      })
      toast.success('Tablero creado')
      closeBoardModal()
      await refetchBoards()
      await refetchGraph()
      await handleAddOrNestBoard(board)
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ??
          (editingBoard ? 'No se pudo actualizar el tablero' : 'No se pudo crear el tablero')
      )
    }
  }

  const handleCreateRack = async () => {
    if (!rackForm.name.trim() || !rackForm.areaId || !projectId) return
    try {
      const rack = await racksService.create({
        projectId,
        areaId: rackForm.areaId,
        name: rackForm.name.trim(),
        heightU: rackForm.heightU,
      })
      toast.success('Rack creado')
      setRackModalOpen(false)
      setRackForm({ name: '', areaId: '', heightU: 42 })
      await refetchRacks()
      await refetchGraph()
      await handleAddOrNestRack(rack)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo crear el rack')
    }
  }

  const handleCreateSite = async () => {
    if (!siteForm.name.trim() || !projectId) return
    try {
      const site = await sitesService.create({
        projectId,
        name: siteForm.name.trim(),
        address: siteForm.address.trim() || null,
      })
      toast.success('Sitio creado')
      setSiteModalOpen(false)
      setSiteForm({ name: '', address: '' })
      await refetchSites()
      setScopeSiteId(site.id)
      await persistScope(site.id)
      await refetchGraph()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo crear el sitio')
    }
  }

  const handleCreateArea = async () => {
    if (!areaForm.name.trim() || !scopeSiteId) return
    try {
      const area = await sitesService.createArea(scopeSiteId, {
        name: areaForm.name.trim(),
      })
      toast.success('Área creada')
      setAreaModalOpen(false)
      setAreaForm({ name: '' })
      await loadAreas(scopeSiteId)
      await refetchGraph()
      await handleAddArea(area)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo crear el área')
    }
  }

  const handleDeleteBoard = async (board: Board) => {
    if (
      !window.confirm(
        `¿Eliminar el tablero «${board.name}»? Solo se puede si no tiene dispositivos montados.`
      )
    ) {
      return
    }
    try {
      await boardsService.delete(board.id)
      const containerId = boardFlowNodeId(board.id)
      if (selectedId && diagram?.containers?.[containerId]) {
        const { [containerId]: _removed, ...rest } = diagram.containers
        await connectionDiagramsService.update(selectedId, { containers: rest })
      }
      toast.success('Tablero eliminado')
      await refetchBoards()
      await refetchGraph()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo eliminar el tablero')
    }
  }

  const handleConnectDevices = useCallback(
    (params: {
      sourceDeviceId: string
      targetDeviceId: string
      sourceHandle?: string | null
      targetHandle?: string | null
    }) => {
      const sourceParsed = params.sourceHandle
        ? parseDiagramHandlePort(params.sourceHandle)
        : { portId: null, portLabel: null }
      const targetParsed = params.targetHandle
        ? parseDiagramHandlePort(params.targetHandle)
        : { portId: null, portLabel: null }
      setLinkModal({
        open: true,
        sourceDeviceId: params.sourceDeviceId,
        targetDeviceId: params.targetDeviceId,
        sourcePortId: sourceParsed.portId,
        sourcePortLabel: sourceParsed.portLabel ?? undefined,
        targetPortId: targetParsed.portId,
        targetPortLabel: targetParsed.portLabel ?? undefined,
      })
    },
    []
  )

  const handlePortClick = useCallback(
    (params: {
      deviceId: string
      handleId: string
      label: string
      side: 'source' | 'target'
    }) => {
      const parsed = parseDiagramHandlePort(params.handleId)
      if (params.side === 'target') {
        setLinkModal({
          open: true,
          targetDeviceId: params.deviceId,
          targetPortId: parsed.portId,
          targetPortLabel: parsed.portLabel ?? params.label,
        })
        return
      }
      setLinkModal({
        open: true,
        sourceDeviceId: params.deviceId,
        sourcePortId: parsed.portId,
        sourcePortLabel: parsed.portLabel ?? params.label,
      })
    },
    []
  )

  const handleDeviceDoubleClick = useCallback((deviceId: string) => {
    setLinkModal({
      open: true,
      sourceDeviceId: deviceId,
    })
  }, [])

  const handleOpenCreateLink = useCallback(() => {
    setLinkModal({ open: true })
  }, [])

  const modalEdge: DiagramLinkEdge | null = useMemo(() => {
    if (!linkModal.open || !linkModal.edgeId) return null
    return graphPayload?.graph.edges.find((e) => e.id === linkModal.edgeId) ?? null
  }, [linkModal, graphPayload])

  const modalSourceDeviceId =
    linkModal.sourceDeviceId ?? modalEdge?.source ?? ''
  const modalTargetDeviceId =
    linkModal.targetDeviceId ?? modalEdge?.target ?? undefined

  /** Contenedor visual del diagrama por device (preferido sobre montaje de inventario). */
  const containerByDeviceId = useMemo(() => {
    const map: Record<string, string> = {}
    if (!diagram || !graphPayload) return map
    const containers = diagram.containers ?? {}
    const visible = new Set(visibleContainerIds)
    const inventory = graphPayload.inventory
    const inventoryIds = new Set(inventory.map((d) => d.id))

    for (const rack of graphPayload.racks) {
      const key = rackFlowNodeId(rack.id)
      if (!visible.has(key)) continue
      const saved = containers[key]
      const ids = (
        saved?.deviceIds != null
          ? saved.deviceIds
          : inventory.filter((d) => d.data.rackId === rack.id).map((d) => d.id)
      ).filter((id) => inventoryIds.has(id))
      for (const id of ids) map[id] = rack.name
    }

    for (const board of graphPayload.boards) {
      const key = boardFlowNodeId(board.id)
      if (!visible.has(key)) continue
      const saved = containers[key]
      const ids = (
        saved?.deviceIds != null
          ? saved.deviceIds
          : inventory.filter((d) => d.data.boardId === board.id).map((d) => d.id)
      ).filter((id) => inventoryIds.has(id))
      for (const id of ids) map[id] = board.name
    }

    for (const area of graphPayload.areas ?? []) {
      const key = areaFlowNodeId(area.id)
      if (!visible.has(key)) continue
      const saved = containers[key]
      const ids = (saved?.deviceIds ?? []).filter((id) => inventoryIds.has(id))
      for (const id of ids) {
        if (!map[id]) map[id] = area.name
      }
    }

    return map
  }, [diagram, graphPayload, visibleContainerIds])

  const requestDeleteLink = useCallback(
    (edgeId: string) => {
      const edge = graphPayload?.graph.edges.find((e) => e.id === edgeId)
      if (!edge) return
      const code = formatLinkCode(edge.code)
      const reference = formatLinkReference(
        edge,
        graphPayload?.inventory ?? [],
        containerByDeviceId
      )
      setLinkDeleteConfirm({ edgeId, code, reference })
    },
    [containerByDeviceId, graphPayload?.graph.edges, graphPayload?.inventory]
  )

  const handleConfirmDeleteLink = useCallback(async () => {
    if (!linkDeleteConfirm) return
    const { edgeId, code } = linkDeleteConfirm
    setDeletingLink(true)
    try {
      await diagramLinksService.delete(edgeId)
      if (focusedLinkId === edgeId) setFocusedLinkId(null)
      setLinkDeleteConfirm(null)
      toast.success(`Enlace ${code} eliminado`)
      refetchProjectLinks()
      await refetchGraph()
      window.setTimeout(() => canvasRef.current?.rerouteCables(), 120)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo eliminar el enlace')
    } finally {
      setDeletingLink(false)
    }
  }, [focusedLinkId, linkDeleteConfirm, refetchGraph, refetchProjectLinks, toast])

  const visibleLinkEdges = useMemo(() => {
    const shown = new Set(Object.keys(containerByDeviceId))
    return (graphPayload?.graph.edges ?? []).filter(
      (e) => shown.has(e.source) && shown.has(e.target)
    )
  }, [containerByDeviceId, graphPayload?.graph.edges])

  const destinationDeviceOptions = useMemo(() => {
    const inventory = graphPayload?.inventory ?? []
    const byId = new Map(inventory.map((d: TopologyNode) => [d.id, d]))
    return Object.keys(containerByDeviceId)
      .map((id) => {
        const device = byId.get(id)
        if (!device) return null
        const container = containerByDeviceId[id]
        const label = [device.label, container].filter(Boolean).join(' · ')
        return { value: id, label }
      })
      .filter((o): o is { value: string; label: string } => Boolean(o))
      .sort((a, b) => a.label.localeCompare(b.label, 'es'))
  }, [containerByDeviceId, graphPayload?.inventory])
  const diagramOptions = useMemo(
    () => [
      { value: '', label: 'Seleccionar diagrama…' },
      ...(diagrams ?? []).map((d) => ({ value: d.id, label: d.name })),
    ],
    [diagrams]
  )

  const siteOptions = useMemo(
    () => [
      { value: '', label: 'Seleccionar sitio…' },
      ...(sites ?? []).map((s) => ({ value: s.id, label: s.name })),
    ],
    [sites]
  )

  const areaOptions = useMemo(
    () => [
      { value: '', label: 'Seleccionar área…' },
      ...areas.map((a) => ({ value: a.id, label: a.name })),
    ],
    [areas]
  )

  const areaNameById = useMemo(() => {
    const map = new Map(areas.map((a) => [a.id, a.name]))
    return map
  }, [areas])

  const areasOnCanvas = useMemo(() => {
    const ids = new Set(
      visibleContainerIds.filter((k) => k.startsWith('area:')).map((k) => k.slice(5))
    )
    return (graphPayload?.areas ?? areas).filter((a) => ids.has(a.id))
  }, [visibleContainerIds, graphPayload?.areas, areas])

  const racksOnCanvas = useMemo(() => {
    const visible = new Set(visibleContainerIds)
    return (graphPayload?.racks ?? []).filter((r) => visible.has(rackFlowNodeId(r.id)))
  }, [visibleContainerIds, graphPayload?.racks])

  const boardsOnCanvas = useMemo(() => {
    const visible = new Set(visibleContainerIds)
    return (graphPayload?.boards ?? []).filter((b) => visible.has(boardFlowNodeId(b.id)))
  }, [visibleContainerIds, graphPayload?.boards])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
        <PageHeader
          title="Documentar enlaces"
          subtitle="Sitio → áreas → racks o tableros → arrastrá un enlace entre equipos (E1, E2…)."
          className="mb-0"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="min-w-[200px]"
              options={diagramOptions}
            />
            {canMutate && (
              <>
                <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                  Nuevo
                </Button>
                {selectedId ? (
                  <div className="relative" ref={diagramActionsRef}>
                    <Button
                      size="sm"
                      variant={diagramActionsOpen ? 'primary' : 'secondary'}
                      icon={<MoreVertical className="h-4 w-4" />}
                      onClick={() => setDiagramActionsOpen((v) => !v)}
                      aria-expanded={diagramActionsOpen}
                      aria-haspopup="menu"
                    >
                      Más
                    </Button>
                    {diagramActionsOpen ? (
                      <div
                        className="absolute right-0 top-full z-50 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
                        role="menu"
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => {
                            setDiagramActionsOpen(false)
                            openRenameDiagram()
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          Renombrar
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                          onClick={() => {
                            setDiagramActionsOpen(false)
                            void handleDuplicate()
                          }}
                        >
                          <Copy className="h-4 w-4" />
                          Duplicar
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                          onClick={() => {
                            setDiagramActionsOpen(false)
                            void handleDelete()
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        }
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-0">
        <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-auto border-r border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Alcance del diagrama
          </div>
          {layoutMode === 'tree' ? (
            <p className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs leading-snug text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              Modo árbol: agregá equipos desde áreas/racks como siempre; en el canvas se
              muestran sin contenedores físicos.
            </p>
          ) : null}

          <div className="flex items-end gap-1">
            <div className="min-w-0 flex-1">
              <Select
                label="Sitio"
                value={scopeSiteId}
                onChange={(e) => void handleSiteChange(e.target.value)}
                options={siteOptions}
                disabled={!selectedId}
              />
            </div>
            {canMutate && selectedId ? (
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus className="h-3.5 w-3.5" />}
                onClick={() => setSiteModalOpen(true)}
                title="Crear sitio"
              />
            ) : null}
          </div>

          {scopeSiteId ? (
            <>
              <div className="mt-1 border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Áreas del sitio
                  </div>
                  {canMutate ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => {
                        setAreaForm({ name: '' })
                        setAreaModalOpen(true)
                      }}
                    >
                      Nueva
                    </Button>
                  ) : null}
                </div>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {areas.length === 0 ? (
                    <p className="text-[11px] text-slate-400">No hay áreas en este sitio.</p>
                  ) : (
                    areas.map((area) => {
                      const areaKey = areaFlowNodeId(area.id)
                      const onCanvas = visibleContainerIds.includes(areaKey)
                      return (
                        <div
                          key={area.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-sky-200/80 px-2 py-1.5 dark:border-sky-800/50"
                        >
                          <div className="min-w-0 flex-1">
                            <TruncatedText
                              text={area.name}
                              className="text-xs font-medium text-sky-900 dark:text-sky-100"
                            />
                          </div>
                          {canMutate ? (
                            onCanvas ? (
                              <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                                En lienzo
                              </span>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleAddArea(area)}
                              >
                                Agregar
                              </Button>
                            )
                          ) : onCanvas ? (
                            <span className="shrink-0 text-[10px] text-slate-400">En lienzo</span>
                          ) : null}
                          {canMutate && onCanvas ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                void handleRemoveContainerFromCanvas(areaKey, area.name)
                              }
                            >
                              Quitar
                            </Button>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="mt-1 border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Racks del sitio
                  </div>
                  {canMutate ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={() => {
                        setRackForm({ name: '', areaId: areas[0]?.id ?? '', heightU: 42 })
                        setRackModalOpen(true)
                      }}
                    >
                      Nuevo
                    </Button>
                  ) : null}
                </div>
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-7 pr-2 text-xs dark:border-slate-600 dark:bg-slate-800"
                    placeholder="Buscar rack…"
                    value={rackSearch}
                    onChange={(e) => setRackSearch(e.target.value)}
                  />
                </div>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {(siteRacks ?? []).length === 0 ? (
                    <p className="text-[11px] text-slate-400">No hay racks en este sitio.</p>
                  ) : (
                    (siteRacks ?? []).map((rack) => {
                      const rackKey = rackFlowNodeId(rack.id)
                      const onCanvas = visibleContainerIds.includes(rackKey)
                      const nested = isNestedInArea(rackKey, rack.areaId)
                      const areaLabel = rack.area?.name ?? areaNameById.get(rack.areaId)
                      const rackSubtitle = areaLabel
                        ? `${areaLabel}${nested ? ' · en área' : onCanvas ? ' · suelto' : ''}`
                        : ''
                      return (
                        <div
                          key={rack.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5 dark:border-slate-700"
                        >
                          <div className="min-w-0 flex-1">
                            <TruncatedText
                              text={rack.name}
                              className="text-xs font-medium text-slate-800 dark:text-slate-100"
                            />
                            {rackSubtitle ? (
                              <TruncatedText
                                text={rackSubtitle}
                                className="text-[10px] text-slate-400"
                              />
                            ) : null}
                          </div>
                          {canMutate ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              {!onCanvas ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void handleAddOrNestRack(rack)}
                                >
                                  Agregar
                                </Button>
                              ) : nested ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Sacar del área (queda en el canvas)"
                                    onClick={() =>
                                      void handleUnnestFromArea(rackKey, rack.name)
                                    }
                                  >
                                    Sacar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Quitar del diagrama"
                                    onClick={() =>
                                      void handleRemoveContainerFromCanvas(rackKey, rack.name)
                                    }
                                  >
                                    Quitar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    title="Mover dentro del área"
                                    onClick={() => void handleAddOrNestRack(rack)}
                                  >
                                    Al área
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Quitar del diagrama"
                                    onClick={() =>
                                      void handleRemoveContainerFromCanvas(rackKey, rack.name)
                                    }
                                  >
                                    Quitar
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Tableros
                  </div>
                  {canMutate ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={<Plus className="h-3.5 w-3.5" />}
                      onClick={openCreateBoardModal}
                    >
                      Nuevo
                    </Button>
                  ) : null}
                </div>
                <div className="max-h-40 space-y-1 overflow-auto">
                  {(siteBoards ?? []).length === 0 ? (
                    <p className="text-[11px] text-slate-400">No hay tableros en este sitio.</p>
                  ) : (
                    (siteBoards ?? []).map((board) => {
                      const boardKey = boardFlowNodeId(board.id)
                      const onCanvas = visibleContainerIds.includes(boardKey)
                      const nested = isNestedInArea(boardKey, board.areaId)
                      const areaLabel = board.area?.name ?? areaNameById.get(board.areaId)
                      const boardSubtitle = areaLabel
                        ? `${areaLabel}${nested ? ' · en área' : onCanvas ? ' · suelto' : ''}`
                        : ''
                      return (
                        <div
                          key={board.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-amber-200/80 px-2 py-1.5 dark:border-amber-800/50"
                        >
                          <div className="min-w-0 flex-1">
                            <TruncatedText
                              text={board.name}
                              className="text-xs font-medium text-amber-900 dark:text-amber-100"
                            />
                            {boardSubtitle ? (
                              <TruncatedText
                                text={boardSubtitle}
                                className="text-[10px] text-amber-700/70 dark:text-amber-300/70"
                              />
                            ) : null}
                          </div>
                          {canMutate ? (
                            <div className="flex shrink-0 items-center gap-0.5">
                              <button
                                type="button"
                                title="Renombrar tablero"
                                className="rounded p-1 text-amber-700/80 hover:bg-amber-100 hover:text-amber-900 dark:text-amber-300 dark:hover:bg-amber-900/50 dark:hover:text-amber-100"
                                onClick={() => openEditBoardModal(board)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                title="Eliminar tablero"
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                                onClick={() => void handleDeleteBoard(board)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                              {!onCanvas ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => void handleAddOrNestBoard(board)}
                                >
                                  Agregar
                                </Button>
                              ) : nested ? (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Sacar del área (queda en el canvas)"
                                    onClick={() =>
                                      void handleUnnestFromArea(boardKey, board.name)
                                    }
                                  >
                                    Sacar
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Quitar del diagrama"
                                    onClick={() =>
                                      void handleRemoveContainerFromCanvas(boardKey, board.name)
                                    }
                                  >
                                    Quitar
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    title="Mover dentro del área"
                                    onClick={() => void handleAddOrNestBoard(board)}
                                  >
                                    Al área
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    title="Quitar del diagrama"
                                    onClick={() =>
                                      void handleRemoveContainerFromCanvas(boardKey, board.name)
                                    }
                                  >
                                    Quitar
                                  </Button>
                                </>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                En el canvas: {areasOnCanvas.length} área(s), {racksOnCanvas.length} rack(s),{' '}
                {boardsOnCanvas.length} tablero(s). Usá «Al área» para meter racks/tableros
                sueltos dentro de su área; «Sacar» los desanida; «Quitar» los elimina del
                diagrama.
              </div>
            </>
          ) : (
            <p className="text-xs text-slate-500">
              Seleccioná un sitio para listar áreas, racks y tableros.
            </p>
          )}
        </aside>

        <section className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="absolute right-3 top-3 z-20 flex flex-wrap items-center justify-end gap-2">
            {canMutate && selectedId && (
              <Button
                size="sm"
                icon={<Save className="h-4 w-4" />}
                isLoading={saving}
                onClick={() => void handleSaveLayout()}
              >
                Guardar layout
              </Button>
            )}
            {selectedId ? (
              <Button
                size="sm"
                variant={printModeOpen ? 'primary' : 'secondary'}
                icon={<Printer className="h-4 w-4" />}
                aria-pressed={printModeOpen}
                onClick={() => (printModeOpen ? closePrintMode() : openPrintMode())}
              >
                {printModeOpen ? 'Cerrar impresión' : 'Impresión'}
              </Button>
            ) : null}
            {selectedId ? (
              <DiagramCanvasOptionsMenu
                layoutMode={layoutMode}
                onLayoutModeChange={canMutate ? handleLayoutModeChange : undefined}
                portDisplay={portDisplay}
                onPortDisplayChange={canMutate ? handlePortDisplayChange : undefined}
                portFlowInverted={portFlowInverted}
                onPortFlowInvertedChange={
                  canMutate ? handlePortFlowInvertedChange : undefined
                }
                onReorganizeTree={
                  canMutate && layoutMode === 'tree' ? () => void handleReorganizeTree() : undefined
                }
                layoutDisabled={!canMutate}
              />
            ) : null}
          </div>

          {!selectedId && !loadingList && (
            <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-slate-500">
              <Cable className="h-12 w-12 opacity-40" />
              <div>
                <p className="text-base font-medium text-slate-700 dark:text-slate-200">
                  Empezá a documentar enlaces
                </p>
                <ol className="mt-3 space-y-1 text-sm text-slate-500 dark:text-slate-400">
                  <li>1. Creá o seleccioná un diagrama</li>
                  <li>2. Elegí un sitio en el panel izquierdo</li>
                  <li>3. Agregá un área y conectá equipos</li>
                </ol>
              </div>
              {canMutate && (
                <Button
                  size="sm"
                  icon={<Plus className="h-4 w-4" />}
                  onClick={() => setCreateOpen(true)}
                >
                  Nuevo diagrama
                </Button>
              )}
            </div>
          )}

          {selectedId && !scopeSiteId && (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-slate-500">
              <p className="font-medium text-slate-700 dark:text-slate-200">Elegí un sitio</p>
              <p className="max-w-sm text-slate-500 dark:text-slate-400">
                Usá el selector de sitio en el panel izquierdo para cargar áreas, racks y tableros.
              </p>
            </div>
          )}

          {selectedId && scopeSiteId && diagramForCanvas && graphPayload && (
            <ConnectionDiagramCanvas
              canvasRef={canvasRef}
              inventory={graphPayload.inventory}
              edges={graphPayload.graph.edges}
              racks={graphPayload.racks}
              boards={graphPayload.boards}
              areas={graphPayload.areas ?? []}
              visibleContainerIds={visibleContainerIds}
              diagram={diagramForCanvas}
              readOnly={!canMutate}
              paperSize={paperSize}
              printOrientation={printOrientation}
              showPrintMargins={showPrintMargins}
              printInvertColors={invertColors}
              printFrame={printFrame}
              printFrameLocked={printFrameLocked}
              highlightedPrintCol={highlightedPrintSector.col}
              highlightedPrintRow={highlightedPrintSector.row}
              onPrintFrameChange={canMutate ? setPrintFrame : undefined}
              onPrintFrameChangeEnd={canMutate ? (frame) => applyPrintFrame(frame) : undefined}
              onPrintDiagnostics={setPrintDiagnostics}
              onStaleLinkIdsChange={setStaleLinkIds}
              focusedLinkId={focusedLinkId}
              onFocusedLinkChange={setFocusedLinkId}
              onConnectDevices={canMutate ? handleConnectDevices : undefined}
              onPortClick={canMutate ? handlePortClick : undefined}
              onDeviceDoubleClick={canMutate ? handleDeviceDoubleClick : undefined}
              onNavigateToLink={
                canMutate ? (id) => setLinkModal({ open: true, edgeId: id }) : undefined
              }
              onAddDeviceToContainer={canMutate ? handleAddDeviceToContainer : undefined}
              onRemoveDeviceFromContainer={
                canMutate ? handleRemoveDeviceFromContainer : undefined
              }
              onReorderDevicesInContainer={
                canMutate ? handleReorderDevicesInContainer : undefined
              }
            />
          )}

          {loadingGraph && selectedId ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 text-sm text-slate-300">
              Cargando…
            </div>
          ) : null}
          </div>

          {selectedId && scopeSiteId && diagram && graphPayload ? (
            <DiagramLinkReferenceList
              key={selectedId}
              edges={visibleLinkEdges}
              inventory={graphPayload.inventory}
              containerByDeviceId={containerByDeviceId}
              collapsed={referenceListCollapsed}
              onToggle={() => setReferenceListCollapsed((v) => !v)}
              selectedLinkId={focusedLinkId}
              onSelectLink={(id) => canvasRef.current?.selectLink(id)}
              onEditLink={
                canMutate ? (id) => setLinkModal({ open: true, edgeId: id }) : undefined
              }
              onDeleteLink={canMutate ? requestDeleteLink : undefined}
              onCreateLink={canMutate ? handleOpenCreateLink : undefined}
              createDisabled={destinationDeviceOptions.length < 2}
              createDisabledReason="Agregá al menos dos equipos al diagrama"
              staleLinkIds={staleLinkIds}
              onAutorouteLink={
                canMutate ? (id) => handleAutorouteLinks([id]) : undefined
              }
              onAutorouteAllStale={
                canMutate && staleLinkIds.length > 0
                  ? () => handleAutorouteLinks(staleLinkIds)
                  : undefined
              }
            />
          ) : null}
          </div>
          {printModeOpen && selectedId ? (
            <PrintModePanel
              paperSize={paperSize}
              printOrientation={printOrientation}
              printFrame={printFrame}
              frameLocked={printFrameLocked}
              highlightedCol={highlightedPrintSector.col}
              highlightedRow={highlightedPrintSector.row}
              onHighlightedSectorChange={(col, row) =>
                setHighlightedPrintSector({ col, row })
              }
              includeLegend={includeLegend}
              includeLinkTable={includeLinkTable}
              linkTableFormat={linkTableFormat}
              invertColors={invertColors}
              outsideCount={printDiagnostics.outsideCount}
              cutCount={printDiagnostics.cutCount}
              exporting={exporting}
              readOnly={!canMutate}
              onPaperSizeChange={(value) => {
                setPaperSize(value)
                persistSettingsSoon({ ...buildPrintSettings(), paperSize: value })
              }}
              onOrientationChange={(value) => {
                setPrintOrientation(value)
                persistSettingsSoon({ ...buildPrintSettings(), printOrientation: value })
              }}
              onFrameChange={setPrintFrame}
              onFrameChangeEnd={(frame) => applyPrintFrame(frame)}
              onToggleLock={() => setPrintFrameLocked((v) => !v)}
              onFitToContent={handleFitFrameToContent}
              onFitContentIntoFrame={handleFitContentIntoFrame}
              onCenterFrame={handleCenterFrame}
              onIncludeLegendChange={(value) => {
                setIncludeLegend(value)
                persistSettingsSoon({ ...buildPrintSettings(), printIncludeLegend: value })
              }}
              onIncludeLinkTableChange={(value) => {
                setIncludeLinkTable(value)
                persistSettingsSoon({ ...buildPrintSettings(), printIncludeLinkTable: value })
              }}
              onLinkTableFormatChange={(value) => {
                setLinkTableFormat(value)
                persistSettingsSoon({ ...buildPrintSettings(), printLinkTableFormat: value })
              }}
              onInvertColorsChange={(value) => {
                setInvertColors(value)
                persistSettingsSoon({ ...buildPrintSettings(), printInvertColors: value })
              }}
              onExport={() => void handleExportPdf()}
              onClose={closePrintMode}
            />
          ) : null}
        </section>
      </div>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Nuevo diagrama">
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Sala servidores"
          />
          <Select
            label="Tipo de diagrama"
            value={newLayoutMode}
            onChange={(e) => setNewLayoutMode(e.target.value as DiagramLayoutMode)}
            options={[
              { value: 'free', label: 'Libre (contenedores físicos)' },
              { value: 'tree', label: 'Árbol (layout jerárquico)' },
            ]}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateDiagram} disabled={!newName.trim()}>
              Crear
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Renombrar diagrama"
      >
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            placeholder="Sala servidores"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && renameName.trim()) void handleRenameDiagram()
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleRenameDiagram()}
              disabled={!renameName.trim()}
              isLoading={renaming}
            >
              Guardar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={boardModalOpen}
        onClose={closeBoardModal}
        title={editingBoard ? 'Editar tablero' : 'Nuevo tablero'}
      >
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={boardForm.name}
            onChange={(e) => setBoardForm((f) => ({ ...f, name: e.target.value }))}
          />
          <Select
            label="Área"
            value={boardForm.areaId}
            onChange={(e) => setBoardForm((f) => ({ ...f, areaId: e.target.value }))}
            options={areaOptions}
            disabled={!scopeSiteId || areas.length === 0}
          />
          <Select
            label="Tipo"
            value={boardForm.kind}
            onChange={(e) =>
              setBoardForm((f) => ({ ...f, kind: e.target.value as BoardKind }))
            }
            options={BOARD_KIND_OPTIONS}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={closeBoardModal}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleSaveBoard()}
              disabled={
                !boardForm.name.trim() ||
                !boardForm.areaId ||
                (!editingBoard && !projectId)
              }
            >
              {editingBoard ? 'Guardar' : 'Crear y agregar'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={areaModalOpen}
        onClose={() => setAreaModalOpen(false)}
        title="Nueva área"
      >
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={areaForm.name}
            onChange={(e) => setAreaForm({ name: e.target.value })}
            placeholder="Sala de servidores"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && areaForm.name.trim()) void handleCreateArea()
            }}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setAreaModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCreateArea()}
              disabled={!areaForm.name.trim() || !scopeSiteId}
            >
              Crear y agregar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={rackModalOpen}
        onClose={() => setRackModalOpen(false)}
        title="Nuevo rack"
      >
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={rackForm.name}
            onChange={(e) => setRackForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="RACK-01"
          />
          <Select
            label="Área"
            value={rackForm.areaId}
            onChange={(e) => setRackForm((f) => ({ ...f, areaId: e.target.value }))}
            options={areaOptions}
            disabled={!scopeSiteId || areas.length === 0}
          />
          <Input
            label="Altura (U)"
            type="number"
            value={String(rackForm.heightU)}
            onChange={(e) =>
              setRackForm((f) => ({ ...f, heightU: Number(e.target.value) || 42 }))
            }
            min={1}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRackModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCreateRack()}
              disabled={!rackForm.name.trim() || !rackForm.areaId || !projectId}
            >
              Crear y agregar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={siteModalOpen}
        onClose={() => setSiteModalOpen(false)}
        title="Nuevo sitio"
      >
        <div className="space-y-3">
          <Input
            label="Nombre"
            value={siteForm.name}
            onChange={(e) => setSiteForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Oficina central"
          />
          <Input
            label="Dirección (opcional)"
            value={siteForm.address}
            onChange={(e) => setSiteForm((f) => ({ ...f, address: e.target.value }))}
            placeholder="Av. Ejemplo 1234"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSiteModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => void handleCreateSite()}
              disabled={!siteForm.name.trim() || !projectId}
            >
              Crear sitio
            </Button>
          </div>
        </div>
      </Modal>

      {canMutate && projectId && linkModal.open ? (
        <SimpleLinkModal
          isOpen={linkModal.open}
          onClose={() => setLinkModal({ open: false })}
          projectId={projectId}
          sourceDeviceId={modalSourceDeviceId || undefined}
          targetDeviceId={modalTargetDeviceId}
          initialSourcePortId={linkModal.sourcePortId}
          initialSourcePortLabel={linkModal.sourcePortLabel}
          initialTargetPortId={linkModal.targetPortId}
          initialTargetPortLabel={linkModal.targetPortLabel}
          containerByDeviceId={containerByDeviceId}
          destinationOptions={destinationDeviceOptions}
          edge={modalEdge}
          existingEdges={occupancyEdgesFromDiagramLinks(
            projectDiagramLinks ?? [],
            (graphPayload?.inventory ?? []).map((d) => d.id)
          )}
          inventory={graphPayload?.inventory ?? []}
          racks={graphPayload?.racks ?? []}
          boards={graphPayload?.boards ?? []}
          onSaved={async () => {
            setLinkModal({ open: false })
            refetchProjectLinks()
            await refetchGraph()
            window.setTimeout(() => canvasRef.current?.rerouteCables(), 120)
          }}
          onDeleted={async () => {
            setLinkModal({ open: false })
            refetchProjectLinks()
            await refetchGraph()
            window.setTimeout(() => canvasRef.current?.rerouteCables(), 120)
          }}
        />
      ) : null}

      <ConfirmDialog
        isOpen={Boolean(linkDeleteConfirm)}
        onClose={() => {
          if (!deletingLink) setLinkDeleteConfirm(null)
        }}
        onConfirm={handleConfirmDeleteLink}
        title={
          linkDeleteConfirm
            ? `Eliminar enlace ${linkDeleteConfirm.code}`
            : 'Eliminar enlace'
        }
        description={
          linkDeleteConfirm ? (
            <>
              Se eliminará el enlace{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {linkDeleteConfirm.code}
              </span>
              {linkDeleteConfirm.reference ? (
                <>
                  {' '}
                  (
                  <span className="break-words text-gray-500 dark:text-gray-400">
                    {linkDeleteConfirm.reference}
                  </span>
                  )
                </>
              ) : null}
              . Esta acción no se puede deshacer.
            </>
          ) : null
        }
        confirmLabel="Eliminar"
        isLoading={deletingLink}
      />

      <RemoveFromDiagramDialog
        isOpen={Boolean(removeFromDiagram)}
        info={removeFromDiagram?.info ?? null}
        onClose={() => {
          if (!removingFromDiagram) setRemoveFromDiagram(null)
        }}
        onConfirm={async () => {
          if (removeFromDiagram) await removeFromDiagram.onConfirm()
        }}
        isLoading={removingFromDiagram}
      />

      <ConfirmDialog
        isOpen={Boolean(assignDeviceConfirm)}
        onClose={() => {
          if (!assigningDevice) setAssignDeviceConfirm(null)
        }}
        onConfirm={async () => {
          if (assignDeviceConfirm) await assignDeviceConfirm.onConfirm()
        }}
        title={`Mover «${assignDeviceConfirm?.deviceLabel ?? ''}»`}
        description={
          assignDeviceConfirm ? (
            <>
              Se modificará la ruta de «{assignDeviceConfirm.deviceLabel}»:{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {assignDeviceConfirm.fromPath}
              </span>{' '}
              →{' '}
              <span className="font-semibold text-gray-900 dark:text-white">
                {assignDeviceConfirm.toPath}
              </span>
              . Inventario y diagrama quedarán sincronizados
              {assignDeviceConfirm.areaChanged
                ? ' (cambio de área en la ficha del equipo)'
                : ''}
              .
            </>
          ) : null
        }
        confirmLabel="Actualizar ruta"
        isLoading={assigningDevice}
      />
    </div>
  )
}
