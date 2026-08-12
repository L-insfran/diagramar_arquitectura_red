import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cable,
  Copy,
  Download,
  Eye,
  EyeOff,
  MoreVertical,
  Pencil,
  Plus,
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
import { SimpleLinkModal } from '../components/diagram/SimpleLinkModal'
import { DiagramLinkReferenceList } from '../components/diagram/DiagramLinkReferenceList'
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
import { boardsService } from '../services/boards.service'
import { racksService } from '../services/racks.service'
import { sitesService } from '../services/sites.service'
import { systemBrandingService } from '../services/systemBranding.service'
import { exportConnectionDiagramPdf } from '../utils/exportConnectionDiagramPdf'
import type { PaperFormat, PrintOrientation } from '../utils/pdf/a4Geometry'
import { formatLinkCode, formatLinkReference } from '../utils/diagram/linkLabel'
import { boardFlowNodeId } from '../utils/boardPlacement'
import { areaFlowNodeId } from '../utils/areaPlacement'
import { rackFlowNodeId } from '../utils/topologyRackLayout'
import { parseDiagramHandlePort } from '../utils/diagram/diagramPortHandles'
import type {
  Area,
  Board,
  BoardKind,
  ConnectionDiagram,
  DiagramContainerState,
  DiagramLinkEdge,
  Rack,
  TopologyNode,
} from '../types'

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
  const [printMenuOpen, setPrintMenuOpen] = useState(false)
  const [referenceListCollapsed, setReferenceListCollapsed] = useState(false)
  const [focusedLinkId, setFocusedLinkId] = useState<string | null>(null)
  const printMenuRef = useRef<HTMLDivElement | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [scopeSiteId, setScopeSiteId] = useState('')
  const [rackSearch, setRackSearch] = useState('')

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
    edgeId?: string
  }>({ open: false })
  const [linkDeleteConfirm, setLinkDeleteConfirm] = useState<{
    edgeId: string
    code: string
    reference: string
  } | null>(null)
  const [deletingLink, setDeletingLink] = useState(false)

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
  }, [selectedId])

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

  const { data: sites } = useApi(
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
  }, [graphPayload?.diagram?.id, graphPayload?.diagram?.settings?.paperSize, graphPayload?.diagram?.settings?.printOrientation])

  useEffect(() => {
    if (!printMenuOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (!printMenuRef.current?.contains(e.target as Node)) setPrintMenuOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPrintMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [printMenuOpen])

  const { data: siteRacks } = useApi(
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

  const visibleContainerIds = useMemo(() => {
    const keys = Object.keys(diagram?.containers ?? {})
    return keys.filter(
      (k) => k.startsWith('area:') || k.startsWith('rack:') || k.startsWith('board:')
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

  /** Quita un contenedor del canvas. Si es un área, desanida sus hijos (quedan sueltos). */
  const handleRemoveContainerFromCanvas = async (
    containerId: string,
    label: string
  ) => {
    if (!selectedId || !diagram) return
    let next = { ...liveContainers() }
    const { [containerId]: _removed, ...rest } = next
    next = rest
    if (containerId.startsWith('area:')) {
      const areaPos = diagram.containers?.[containerId]
      next = Object.fromEntries(
        Object.entries(next).map(([key, state]) => {
          if (state.parentId !== containerId) return [key, state]
          return [
            key,
            {
              ...state,
              parentId: null,
              x: (areaPos?.x ?? 40) + (state.x ?? 0),
              y: (areaPos?.y ?? 40) + (state.y ?? 0),
            },
          ]
        })
      )
    }
    await persistContainers(next, `«${label}» sacado del diagrama`)
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
      const saved = diagram.containers?.[containerId]
      if (saved?.deviceIds != null) return [...saved.deviceIds]
      if (containerId.startsWith('rack:')) {
        const rackId = containerId.slice(5)
        return graphPayload.inventory
          .filter((d) => d.data.rackId === rackId)
          .map((d) => d.id)
      }
      if (containerId.startsWith('board:')) {
        const boardId = containerId.slice(6)
        return graphPayload.inventory
          .filter((d) => d.data.boardId === boardId)
          .map((d) => d.id)
      }
      if (containerId.startsWith('area:')) {
        const areaId = containerId.slice(5)
        return graphPayload.inventory
          .filter(
            (d) =>
              d.data.areaId === areaId && !d.data.rackId && !d.data.boardId
          )
          .map((d) => d.id)
      }
      return []
    },
    [diagram, graphPayload]
  )

  const handleAddDeviceToContainer = useCallback(
    async (containerId: string, deviceId: string) => {
      if (!selectedId || !diagram || !canMutate) return
      const live = canvasRef.current?.getPersistPayload().containers ?? diagram.containers ?? {}
      const prev = live[containerId] ?? diagram.containers?.[containerId] ?? { x: 40, y: 40 }
      const current = resolveContainerDeviceIds(containerId)
      const deviceIds = [...new Set([...current, deviceId])]
      try {
        await connectionDiagramsService.update(selectedId, {
          containers: {
            ...live,
            [containerId]: { ...prev, x: prev.x, y: prev.y, deviceIds },
          },
        })
        await refetchGraph()
        window.setTimeout(() => canvasRef.current?.rerouteCables(), 100)
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'No se pudo agregar el dispositivo')
      }
    },
    [selectedId, diagram, canMutate, refetchGraph, toast, resolveContainerDeviceIds]
  )

  const handleRemoveDeviceFromContainer = useCallback(
    async (containerId: string, deviceId: string) => {
      if (!selectedId || !diagram || !canMutate) return
      const live = canvasRef.current?.getPersistPayload().containers ?? diagram.containers ?? {}
      const prev = live[containerId] ?? diagram.containers?.[containerId] ?? { x: 40, y: 40 }
      const current = resolveContainerDeviceIds(containerId)
      const deviceIds = current.filter((id) => id !== deviceId)
      try {
        await connectionDiagramsService.update(selectedId, {
          containers: {
            ...live,
            [containerId]: { ...prev, x: prev.x, y: prev.y, deviceIds },
          },
        })
        toast.success('Equipo sacado del diagrama')
        await refetchGraph()
        window.setTimeout(() => canvasRef.current?.rerouteCables(), 100)
      } catch (e: any) {
        toast.error(e?.response?.data?.message ?? 'No se pudo sacar el dispositivo')
      }
    },
    [selectedId, diagram, canMutate, refetchGraph, toast, resolveContainerDeviceIds]
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
            [containerId]: { ...prev, x: prev.x, y: prev.y, deviceIds },
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
      })
      toast.success('Diagrama creado')
      setCreateOpen(false)
      setNewName('')
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

  const handleSaveLayout = async () => {
    if (!selectedId || !canvasRef.current) return
    setSaving(true)
    try {
      const payload = canvasRef.current.getPersistPayload({
        paperSize,
        printOrientation,
      })
      await connectionDiagramsService.update(selectedId, {
        ...payload,
        scopeSiteIds: scopeSiteId ? [scopeSiteId] : [],
        scopeAreaIds: [],
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

      const edgeCount = visibleLinkEdges.length
      const containerCount = visibleContainerIds.length
      const inventory = graphPayload?.inventory ?? []
      const linkReferences = visibleLinkEdges
        .slice()
        .sort((a, b) => (a.code ?? 0) - (b.code ?? 0) || a.id.localeCompare(b.id))
        .map((e) => ({
          code: formatLinkCode(e.code),
          reference: formatLinkReference(e, inventory, containerByDeviceId),
          description: e.description?.trim() || '',
        }))

      // Captura el layout actual (sin reempaquetar contenedores).
      await exportConnectionDiagramPdf({
        title: diagram.name || 'Diagrama de conexión',
        subtitle: `${containerCount} contenedor(es) · ${edgeCount} enlace(s) · ${paperSize.toUpperCase()} ${
          printOrientation === 'landscape' ? 'horizontal' : 'vertical'
        }`,
        projectName: activeProject?.name,
        authorName,
        branding,
        orientation: printOrientation,
        format: paperSize,
        includeLegend,
        linkReferences,
        captureDiagram: (format, orientation) =>
          canvasRef.current!.captureDiagramPng(format, orientation),
      })
      toast.success('PDF exportado')
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo exportar el PDF')
    } finally {
      setExporting(false)
      setPrintMenuOpen(false)
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
    (params: { sourceDeviceId: string; targetDeviceId: string }) => {
      setLinkModal({
        open: true,
        sourceDeviceId: params.sourceDeviceId,
        targetDeviceId: params.targetDeviceId,
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

    for (const rack of graphPayload.racks) {
      const key = rackFlowNodeId(rack.id)
      if (!visible.has(key)) continue
      const saved = containers[key]
      const ids =
        saved?.deviceIds != null
          ? saved.deviceIds
          : inventory.filter((d) => d.data.rackId === rack.id).map((d) => d.id)
      for (const id of ids) map[id] = rack.name
    }

    for (const board of graphPayload.boards) {
      const key = boardFlowNodeId(board.id)
      if (!visible.has(key)) continue
      const saved = containers[key]
      const ids =
        saved?.deviceIds != null
          ? saved.deviceIds
          : inventory.filter((d) => d.data.boardId === board.id).map((d) => d.id)
      for (const id of ids) map[id] = board.name
    }

    for (const area of graphPayload.areas ?? []) {
      const key = areaFlowNodeId(area.id)
      if (!visible.has(key)) continue
      const saved = containers[key]
      const ids = saved?.deviceIds ?? []
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
      await refetchGraph()
      window.setTimeout(() => canvasRef.current?.rerouteCables(), 120)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'No se pudo eliminar el enlace')
    } finally {
      setDeletingLink(false)
    }
  }, [focusedLinkId, linkDeleteConfirm, refetchGraph, toast])

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
        const label = [container, device.label].filter(Boolean).join(' ')
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
    const ids = new Set(
      visibleContainerIds.filter((k) => k.startsWith('rack:')).map((k) => k.slice(5))
    )
    return (graphPayload?.racks ?? []).filter((r) => ids.has(r.id))
  }, [visibleContainerIds, graphPayload?.racks])

  const boardsOnCanvas = useMemo(() => {
    const ids = new Set(
      visibleContainerIds.filter((k) => k.startsWith('board:')).map((k) => k.slice(6))
    )
    return (graphPayload?.boards ?? []).filter((b) => ids.has(b.id))
  }, [visibleContainerIds, graphPayload?.boards])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 p-4">
      <PageHeader
        title="Diagrama de conexión"
        subtitle="Elegí un sitio, agregá áreas como contenedores y dentro racks, tableros o equipos sueltos."
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
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Pencil className="h-4 w-4" />}
                  disabled={!selectedId}
                  onClick={openRenameDiagram}
                  title="Renombrar diagrama"
                >
                  Renombrar
                </Button>
                <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>
                  Nuevo
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Copy className="h-4 w-4" />}
                  disabled={!selectedId}
                  onClick={handleDuplicate}
                >
                  Duplicar
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  icon={<Trash2 className="h-4 w-4" />}
                  disabled={!selectedId}
                  onClick={handleDelete}
                >
                  Eliminar
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex min-h-0 flex-1 gap-3">
        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-auto rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Alcance
          </div>

          <Select
            label="Sitio"
            value={scopeSiteId}
            onChange={(e) => void handleSiteChange(e.target.value)}
            options={siteOptions}
            disabled={!selectedId}
          />

          {scopeSiteId ? (
            <>
              <div className="mt-1 border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Áreas del sitio
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
                            <span className="block truncate text-xs font-medium text-sky-900 dark:text-sky-100">
                              {area.name}
                            </span>
                          </div>
                          {canMutate ? (
                            onCanvas ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() =>
                                  void handleRemoveContainerFromCanvas(areaKey, area.name)
                                }
                              >
                                Quitar
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => void handleAddArea(area)}
                              >
                                Agregar
                              </Button>
                            )
                          ) : null}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="mt-1 border-t border-slate-200 pt-3 dark:border-slate-700">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Racks del sitio
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
                      return (
                        <div
                          key={rack.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-2 py-1.5 dark:border-slate-700"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-slate-800 dark:text-slate-100">
                              {rack.name}
                            </span>
                            {areaLabel ? (
                              <span className="block truncate text-[10px] text-slate-400">
                                {areaLabel}
                                {nested ? ' · en área' : onCanvas ? ' · suelto' : ''}
                              </span>
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
                      return (
                        <div
                          key={board.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-amber-200/80 px-2 py-1.5 dark:border-amber-800/50"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-medium text-amber-900 dark:text-amber-100">
                              {board.name}
                            </span>
                            {areaLabel ? (
                              <span className="block truncate text-[10px] text-amber-700/70 dark:text-amber-300/70">
                                {areaLabel}
                                {nested ? ' · en área' : onCanvas ? ' · suelto' : ''}
                              </span>
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

        <section className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
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
            {selectedId && (
              <div className="relative" ref={printMenuRef}>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<MoreVertical className="h-4 w-4" />}
                  onClick={() => setPrintMenuOpen((v) => !v)}
                  aria-expanded={printMenuOpen}
                  aria-haspopup="menu"
                >
                  Impresión
                </Button>
                {printMenuOpen && (
                  <div
                    className="absolute right-0 top-full z-50 mt-1 w-60 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
                    role="menu"
                  >
                    <div className="px-2.5 py-1.5">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Formato
                      </p>
                      <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          aria-pressed={paperSize === 'a4'}
                          onClick={() => setPaperSize('a4')}
                          className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
                            paperSize === 'a4'
                              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          A4
                        </button>
                        <button
                          type="button"
                          aria-pressed={paperSize === 'a3'}
                          onClick={() => setPaperSize('a3')}
                          className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
                            paperSize === 'a3'
                              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          A3
                        </button>
                      </div>
                    </div>

                    <div className="px-2.5 py-1.5">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        Orientación
                      </p>
                      <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                        <button
                          type="button"
                          aria-pressed={printOrientation === 'portrait'}
                          onClick={() => setPrintOrientation('portrait')}
                          className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
                            printOrientation === 'portrait'
                              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          Vertical
                        </button>
                        <button
                          type="button"
                          aria-pressed={printOrientation === 'landscape'}
                          onClick={() => setPrintOrientation('landscape')}
                          className={`flex-1 px-2 py-1 text-[11px] font-semibold transition ${
                            printOrientation === 'landscape'
                              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                        >
                          Horizontal
                        </button>
                      </div>
                    </div>

                    <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />

                    <button
                      type="button"
                      role="menuitem"
                      aria-pressed={showPrintMargins}
                      onClick={() => {
                        setShowPrintMargins((v) => !v)
                        setPrintMenuOpen(false)
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
                        showPrintMargins
                          ? 'bg-orange-100 text-orange-900 dark:bg-orange-950/60 dark:text-orange-100'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {showPrintMargins ? (
                        <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      ) : (
                        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      {showPrintMargins ? 'Ocultar márgenes' : 'Ver márgenes'}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      aria-pressed={includeLegend}
                      onClick={() => setIncludeLegend((v) => !v)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
                        includeLegend
                          ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100'
                          : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800'
                      }`}
                    >
                      {includeLegend ? (
                        <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      ) : (
                        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      {includeLegend ? 'Ocultar leyenda' : 'Ver leyenda'}
                    </button>

                    <button
                      type="button"
                      role="menuitem"
                      disabled={exporting}
                      onClick={() => void handleExportPdf()}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <Download className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      {exporting ? 'Exportando…' : 'Exportar PDF'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {!selectedId && !loadingList && (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-500">
              <Cable className="h-10 w-10 opacity-40" />
              <p>Creá o seleccioná un diagrama de conexión.</p>
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
            <div className="flex h-full items-center justify-center text-sm text-slate-500">
              Elegí un sitio en el panel izquierdo para empezar.
            </div>
          )}

          {selectedId && scopeSiteId && diagram && graphPayload && (
            <ConnectionDiagramCanvas
              canvasRef={canvasRef}
              inventory={graphPayload.inventory}
              edges={graphPayload.graph.edges}
              racks={graphPayload.racks}
              boards={graphPayload.boards}
              areas={graphPayload.areas ?? []}
              visibleContainerIds={visibleContainerIds}
              diagram={diagram}
              readOnly={!canMutate}
              paperSize={paperSize}
              printOrientation={printOrientation}
              showPrintMargins={showPrintMargins}
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

      {canMutate && projectId && linkModal.open && modalSourceDeviceId ? (
        <SimpleLinkModal
          isOpen={linkModal.open}
          onClose={() => setLinkModal({ open: false })}
          projectId={projectId}
          sourceDeviceId={modalSourceDeviceId}
          targetDeviceId={modalTargetDeviceId}
          initialSourcePortId={linkModal.sourcePortId}
          initialSourcePortLabel={linkModal.sourcePortLabel}
          containerByDeviceId={containerByDeviceId}
          destinationOptions={destinationDeviceOptions}
          edge={modalEdge}
          existingEdges={graphPayload?.graph.edges ?? []}
          inventory={graphPayload?.inventory ?? []}
          racks={graphPayload?.racks ?? []}
          boards={graphPayload?.boards ?? []}
          onSaved={async () => {
            setLinkModal({ open: false })
            await refetchGraph()
            window.setTimeout(() => canvasRef.current?.rerouteCables(), 120)
          }}
          onDeleted={async () => {
            setLinkModal({ open: false })
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
    </div>
  )
}
