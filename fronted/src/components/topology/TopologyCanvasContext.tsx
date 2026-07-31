import { createContext } from 'react'

export type TopologyLinkSelection =
  | { kind: 'edge'; edgeId: string }
  | { kind: 'port'; portId: string }

export type TopologyCanvasInteractionValue = {
  readOnly: boolean
  commitLabelOffset: (edgeId: string, x: number, y: number) => void
  commitPathBend: (edgeId: string, x: number, y: number) => void
  /** If set, clicking a device name opens its detail page. */
  onNavigateToDevice?: (deviceId: string) => void
  /** If set, opening a connection (e.g. double-click on edge) opens the edit modal. */
  onNavigateToConnection?: (connectionId: string) => void
  /** Selección actual: un enlace concreto, o un puerto (todos sus enlaces). */
  selection: TopologyLinkSelection | null
  /** Clic en celda de puerto. */
  selectPort: (portId: string | null) => void
  /** Ids de puertos a marcar visualmente (extremos del enlace seleccionado). */
  highlightedPortIds: ReadonlySet<string>
  renameWorkArea?: (areaId: string, name: string) => void
  removeWorkArea?: (areaId: string) => void
  setWorkAreaTitleFontSize?: (areaId: string, titleFontSize: number) => void
  /** Cambia la cara visible de un nodo rack (`rack:{id}`). Incluye vista "ambas". */
  setRackFace?: (rackNodeId: string, face: 'front' | 'rear' | 'both') => void
}

export const TopologyCanvasInteractionContext = createContext<TopologyCanvasInteractionValue | null>(null)
