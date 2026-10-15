import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileBox } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/Button'
import { Select } from '../components/Select'
import {
  ConnectionDiagramCanvas,
  type ConnectionDiagramCanvasHandle,
} from '../components/diagram/ConnectionDiagramCanvas'
import { useApi } from '../hooks/useApi'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../contexts/ToastContext'
import { connectionDiagramsService } from '../services/connection-diagrams.service'
import type { ConnectionDiagram, DiagramLayoutMode } from '../types'
import { resolveActiveLayoutState } from '../utils/diagram/layoutState'
import { exportConnectionDiagramDxf } from '../utils/exportConnectionDiagramDxf'

export default function ExportDxf() {
  const { activeProjectId: projectId, activeProject } = useProject()
  const toast = useToast()
  const canvasRef = useRef<ConnectionDiagramCanvasHandle>(null)

  const {
    data: diagrams,
    loading: loadingList,
  } = useApi(() => connectionDiagramsService.getAll(), [projectId])

  const [selectedId, setSelectedId] = useState('')
  const [layoutMode, setLayoutMode] = useState<DiagramLayoutMode>('free')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!diagrams?.length) {
      setSelectedId('')
      return
    }
    if (!selectedId || !diagrams.some((d) => d.id === selectedId)) {
      setSelectedId(diagrams[0].id)
    }
  }, [diagrams, selectedId])

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
    if (!diagram) return
    setLayoutMode(diagram.layoutMode ?? 'free')
  }, [diagram?.id, diagram?.layoutMode])

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

  const handleExportDxf = () => {
    if (!selectedId || !canvasRef.current || !diagram || exporting) return
    setExporting(true)
    try {
      const scene = canvasRef.current.getExportScene()
      if (!scene) {
        toast.error('No hay equipos ni contenedores en el diagrama para exportar.')
        return
      }
      exportConnectionDiagramDxf({
        title: diagram.name || 'Diagrama de conexión',
        projectName: activeProject?.name,
        clientName: activeProject?.clientName ?? undefined,
        scene,
      })
      toast.success('DXF exportado')
    } catch (e: any) {
      toast.error(e?.message ?? 'No se pudo exportar el DXF')
    } finally {
      setExporting(false)
    }
  }

  const diagramOptions = (diagrams ?? []).map((d) => ({
    value: d.id,
    label: d.name,
  }))

  const canExport = Boolean(selectedId && diagramForCanvas && graphPayload && !loadingGraph)

  return (
    <div className="space-y-6 pb-8">
      <PageHeader
        title="Exportar a DXF"
        subtitle="Elegí un diagrama y descargá el archivo CAD vectorial."
      />

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Select
            label="Diagrama"
            options={diagramOptions}
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            placeholder={loadingList ? 'Cargando…' : 'Seleccionar diagrama'}
            disabled={loadingList || diagramOptions.length === 0}
          />
        </div>
        <div className="w-full sm:w-48">
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
        <Button
          icon={<Download className="h-4 w-4" />}
          isLoading={exporting}
          disabled={!canExport || exporting}
          onClick={handleExportDxf}
        >
          Exportar DXF
        </Button>
      </div>

      <div className="relative h-[min(60vh,560px)] overflow-hidden rounded-xl border border-gray-200 bg-slate-50 dark:border-gray-800 dark:bg-slate-950">
        {!loadingList && diagramOptions.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center text-slate-500">
            <FileBox className="h-10 w-10 opacity-40" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
              No hay diagramas en este proyecto
            </p>
            <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">
              Creá un diagrama de conexión en Infraestructura para poder exportarlo a DXF.
            </p>
          </div>
        ) : null}

        {selectedId && diagramForCanvas && graphPayload ? (
          <ConnectionDiagramCanvas
            canvasRef={canvasRef}
            inventory={graphPayload.inventory}
            edges={graphPayload.graph.edges}
            racks={graphPayload.racks}
            boards={graphPayload.boards}
            areas={graphPayload.areas ?? []}
            visibleContainerIds={visibleContainerIds}
            diagram={diagramForCanvas}
            readOnly
          />
        ) : null}

        {loadingGraph && selectedId ? (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/20 text-sm text-slate-300">
            Cargando diagrama…
          </div>
        ) : null}
      </div>
    </div>
  )
}
