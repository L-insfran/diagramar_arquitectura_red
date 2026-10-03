import type { DiagramExportScene } from './diagram/exportScene'
import {
  buildConnectionDiagramDxf,
  type ConnectionDiagramDxfMeta,
} from './dxf/connectionDiagramDxf'
import { safePdfFilename } from './pdf/pdfChrome'

export type ExportConnectionDiagramDxfOptions = ConnectionDiagramDxfMeta & {
  scene: DiagramExportScene
}

/**
 * Descarga el diagrama completo (vista libre o árbol) como DXF vectorial.
 */
export function exportConnectionDiagramDxf(options: ExportConnectionDiagramDxfOptions): void {
  const { scene, ...meta } = options
  const content = buildConnectionDiagramDxf(scene, meta)
  const blob = new Blob([content], { type: 'application/dxf' })
  const url = URL.createObjectURL(blob)
  const mode = scene.layoutMode === 'tree' ? 'arbol' : 'libre'
  const base = safePdfFilename(meta.title) || 'diagrama_conexiones'
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${base}_${mode}.dxf`
  anchor.click()
  URL.revokeObjectURL(url)
}
