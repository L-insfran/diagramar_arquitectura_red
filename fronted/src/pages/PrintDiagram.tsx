import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import {
  ConnectionDiagramCanvas,
  type ConnectionDiagramCanvasHandle,
} from '../components/diagram/ConnectionDiagramCanvas'
import { PrintModePanel } from '../components/diagram/PrintModePanel'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../contexts/ToastContext'
import {
  connectionDiagramsService,
  type UpdateConnectionDiagramPayload,
} from '../services/connection-diagrams.service'
import { systemBrandingService } from '../services/systemBranding.service'
import { areaFlowNodeId } from '../utils/areaPlacement'
import { boardFlowNodeId } from '../utils/boardPlacement'
import { rackFlowNodeId } from '../utils/diagram/rackLayout'
import {
  buildLinkEndpointPath,
  formatEndpointPathText,
  formatLinkCode,
} from '../utils/diagram/linkLabel'
import { buildLinkPathRows } from '../utils/diagram/linkPathRows'
import { collectLinkTypeLegend, linkLineStyleDef } from '../utils/diagram/linkTypeStyle'
import { omitUnchangedDiagramFields, resolveActiveLayoutState } from '../utils/diagram/layoutState'
import { exportConnectionDiagramPdf } from '../utils/exportConnectionDiagramPdf'
import type { LinkTableFormat } from '../utils/pdf/linkReferencePdf'
import type { PaperFormat, PrintOrientation } from '../utils/pdf/a4Geometry'
import {
  centerFrameOnBounds,
  fitContentIntoFrame,
  frameFromBounds,
  parsePrintFrame,
} from '../utils/pdf/printFrame'
import type {
  ConnectionDiagram,
  DiagramLayoutMode,
  DiagramPrintFrame,
  DiagramSettings,
} from '../types'

export default function PrintDiagram() {
  const navigate = useNavigate()
  const location = useLocation()
  const { activeProjectId: projectId, activeProject } = useProject()
  const { user } = useAuth()
  const { canMutate } = usePermissions()
  const toast = useToast()
  const canvasRef = useRef<ConnectionDiagramCanvasHandle>(null)
  const printSaveTimer = useRef<number | null>(null)

  const handleBack = () => {
    if (location.key !== 'default') {
      navigate(-1)
      return
    }
    navigate('/connection-diagram')
  }

  const {
    data: diagrams,
    loading: loadingList,
  } = useApi(() => connectionDiagramsService.getAll(), [projectId])

  const [selectedId, setSelectedId] = useState('')
  const [layoutMode, setLayoutMode] = useState<DiagramLayoutMode>('free')
  const [exporting, setExporting] = useState(false)
  const [paperSize, setPaperSize] = useState<PaperFormat>('a4')
  const [printOrientation, setPrintOrientation] = useState<PrintOrientation>('landscape')
  const [includeLegend, setIncludeLegend] = useState(true)
  const [includeLinkTable, setIncludeLinkTable] = useState(true)
  const [linkTableFormat, setLinkTableFormat] = useState<LinkTableFormat>('path')
  const [invertColors, setInvertColors] = useState(false)
  const [printFrame, setPrintFrame] = useState<DiagramPrintFrame | null>(null)
  const [printFrameLocked, setPrintFrameLocked] = useState(false)
  const [highlightedPrintSector, setHighlightedPrintSector] = useState({ col: 0, row: 0 })
  const [printDiagnostics, setPrintDiagnostics] = useState({ outsideCount: 0, cutCount: 0 })

  useEffect(() => {
    if (!diagrams?.length) {
      setSelectedId('')
      return
    }
    if (!selectedId || !diagrams.some((d) => d.id === selectedId)) {
      setSelectedId(diagrams[0].id)
    }
  }, [diagrams, selectedId])

  useEffect(() => {
    setPrintFrameLocked(false)
    setHighlightedPrintSector({ col: 0, row: 0 })
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

  useEffect(() => {
    return () => {
      if (printSaveTimer.current != null) window.clearTimeout(printSaveTimer.current)
    }
  }, [])

  const {
    data: graphPayload,
    loading: loadingGraph,
  } = useApi(
    () =>
      selectedId
        ? connectionDiagramsService.getGraph(selectedId)
        : Promise.resolve(null),
    [selectedId, projectId]
  )

  const diagram: ConnectionDiagram | null = graphPayload?.diagram ?? null

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
        : 'path',
    )
    setInvertColors(d.settings?.printInvertColors === true)
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
    graphPayload?.diagram?.layoutMode,
  ])

  const saveDiagram = useCallback(
    async (payload: UpdateConnectionDiagramPayload) => {
      if (!selectedId) return
      const body = diagram ? omitUnchangedDiagramFields(payload, diagram) : payload
      if (Object.keys(body).length === 0) return
      await connectionDiagramsService.update(selectedId, body)
    },
    [selectedId, diagram]
  )

  const buildPrintSettings = useCallback((): DiagramSettings => {
    return {
      ...(diagram?.settings ?? {}),
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
        void saveDiagram({ settings: settings ?? buildPrintSettings() }).catch(() => undefined)
      }, 700)
    },
    [selectedId, canMutate, buildPrintSettings, saveDiagram],
  )

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
    }
  }, [diagram, layoutMode])

  const visibleContainerIds = useMemo(() => {
    const keys = Object.keys(diagram?.containers ?? {})
    return keys.filter(
      (k) =>
        k.startsWith('area:') ||
        k.startsWith('container:') ||
        k.startsWith('rack:') ||
        k.startsWith('board:')
    )
  }, [diagram?.containers])

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

  const visibleLinkEdges = useMemo(() => {
    const shown = new Set(Object.keys(containerByDeviceId))
    return (graphPayload?.graph.edges ?? []).filter(
      (e) => shown.has(e.source) && shown.has(e.target)
    )
  }, [containerByDeviceId, graphPayload?.graph.edges])

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

  // Crear marco inicial al cargar el canvas
  useEffect(() => {
    if (!selectedId || !diagramForCanvas || !graphPayload || loadingGraph) return
    if (printFrame) return
    const timer = window.setTimeout(() => {
      const frame = ensurePrintFrame()
      if (frame) {
        persistSettingsSoon({ ...buildPrintSettings(), printFrame: frame })
      }
    }, 300)
    return () => window.clearTimeout(timer)
  }, [
    selectedId,
    diagramForCanvas,
    graphPayload,
    loadingGraph,
    printFrame,
    ensurePrintFrame,
    persistSettingsSoon,
    buildPrintSettings,
  ])

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
          linkTypeName: e.linkTypeName,
          linkTypeColor: e.linkTypeColor,
          linkTypeLineStyle: e.linkTypeLineStyle,
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
        linkTypeName: row.edge.linkTypeName,
        linkTypeColor: row.edge.linkTypeColor,
        linkTypeLineStyle: row.edge.linkTypeLineStyle,
      }))

      await exportConnectionDiagramPdf({
        title: diagram.name || 'Diagrama de conexión',
        projectName: activeProject?.name,
        clientName: activeProject?.clientName ?? undefined,
        authorName,
        branding,
        orientation: printOrientation,
        format: paperSize,
        includeLegend,
        legendItems: collectLinkTypeLegend(visibleLinkEdges).map((item) => ({
          label: item.label,
          color: item.color,
          dash: linkLineStyleDef(item.lineStyle).pdfDash,
        })),
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

  const diagramOptions = (diagrams ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }))

  const hasCanvas = Boolean(selectedId && diagramForCanvas && graphPayload)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:px-6">
        <div className="mb-4 flex items-start gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            icon={<ArrowLeft className="h-4 w-4" />}
            className="mt-0.5 shrink-0"
          >
            Volver
          </Button>
          <PageHeader
            title="Imprimir"
            subtitle="Configurá el marco y exportá el diagrama a PDF."
            className="mb-0 min-w-0 flex-1"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 sm:max-w-sm">
            <Select
              label="Diagrama"
              options={diagramOptions}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              placeholder={loadingList ? 'Cargando…' : 'Seleccionar diagrama'}
              disabled={loadingList || diagramOptions.length === 0}
            />
          </div>
          <div className="w-full sm:w-44">
            <Select
              label="Vista"
              options={[
                { value: 'free', label: 'Libre' },
                { value: 'tree', label: 'Árbol' },
              ]}
              value={layoutMode}
              onChange={(e) => setLayoutMode(e.target.value as DiagramLayoutMode)}
              disabled={!diagram}
            />
          </div>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950">
        {!loadingList && diagramOptions.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
            <Printer className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No hay diagramas en este proyecto
            </p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Creá un diagrama de conexión en Infraestructura para poder imprimirlo.
            </p>
          </div>
        ) : (
          <>
            <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
              {hasCanvas ? (
                <ConnectionDiagramCanvas
                  canvasRef={canvasRef}
                  inventory={graphPayload!.inventory}
                  edges={graphPayload!.graph.edges}
                  racks={graphPayload!.racks}
                  boards={graphPayload!.boards}
                  areas={graphPayload!.areas ?? []}
                  visibleContainerIds={visibleContainerIds}
                  diagram={diagramForCanvas!}
                  readOnly
                  paperSize={paperSize}
                  printOrientation={printOrientation}
                  showPrintMargins
                  printInvertColors={invertColors}
                  printFrame={printFrame}
                  printFrameLocked={printFrameLocked}
                  highlightedPrintCol={highlightedPrintSector.col}
                  highlightedPrintRow={highlightedPrintSector.row}
                  onPrintFrameChange={canMutate ? setPrintFrame : undefined}
                  onPrintFrameChangeEnd={
                    canMutate ? (frame) => applyPrintFrame(frame) : undefined
                  }
                  onPrintDiagnostics={setPrintDiagnostics}
                />
              ) : null}

              {loadingGraph && selectedId ? (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 text-sm text-slate-300">
                  Cargando diagrama…
                </div>
              ) : null}
            </div>

            {hasCanvas ? (
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
              />
            ) : null}
          </>
        )}
      </div>
    </div>
  )
}
