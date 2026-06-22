import { createContext } from 'react'

export type TopologyCanvasInteractionValue = {
  readOnly: boolean
  commitLabelOffset: (edgeId: string, x: number, y: number) => void
  /** If set, clicking a device name opens its detail page. */
  onNavigateToDevice?: (deviceId: string) => void
  /** If set, clicking a link label opens the connection (e.g. edit modal). */
  onNavigateToConnection?: (connectionId: string) => void
}

export const TopologyCanvasInteractionContext = createContext<TopologyCanvasInteractionValue | null>(null)
