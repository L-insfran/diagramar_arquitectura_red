import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useReactFlow, type Node } from '@xyflow/react'
import { racksNeedingBothFacesForEdges } from '../../utils/topologyRackReveal'
import type { PortLinkEdgeType } from './PortLinkEdge'
import { PortLinkCallout, type PortLinkCalloutItem } from './PortLinkCallout'
import {
  TopologyCanvasInteractionContext,
  type TopologyLinkSelection,
} from './TopologyCanvasContext'

type PortNavigationBridgeProps = {
  selection: TopologyLinkSelection | null
  edges: PortLinkEdgeType[]
  nodes: Node[]
  onClearSelection: () => void
}

function deviceLabel(nodes: Node[], deviceId: string): string {
  const node = nodes.find((n) => n.id === deviceId)
  if (!node) return deviceId
  const data = node.data as { label?: string }
  return data.label?.trim() || deviceId
}

function buildCalloutItems(
  portId: string,
  edges: PortLinkEdgeType[],
  nodes: Node[],
): PortLinkCalloutItem[] {
  const items: PortLinkCalloutItem[] = []

  for (const edge of edges) {
    const data = edge.data
    if (!data) continue
    const isSource = data.sourcePortId === portId
    const isTarget = data.targetPortId === portId
    if (!isSource && !isTarget) continue

    const localDeviceId = isSource ? edge.source : edge.target
    const remoteDeviceId = isSource ? edge.target : edge.source
    const localPort = isSource ? data.sourcePort : data.targetPort
    const remotePort = isSource ? data.targetPort : data.sourcePort

    items.push({
      localDevice: deviceLabel(nodes, localDeviceId),
      localPort: localPort?.trim() || '—',
      remoteDevice: deviceLabel(nodes, remoteDeviceId),
      remotePort: remotePort?.trim() || '—',
      mediumLabel: data.mediumLabel ?? null,
    })
  }

  return items
}

function selectionKey(selection: TopologyLinkSelection): string {
  return selection.kind === 'port' ? `port:${selection.portId}` : `edge:${selection.edgeId}`
}

export function PortNavigationBridge({
  selection,
  edges,
  nodes,
  onClearSelection,
}: PortNavigationBridgeProps) {
  const { fitView } = useReactFlow()
  const ctx = useContext(TopologyCanvasInteractionContext)
  const setRackFace = ctx?.setRackFace
  const [calloutItems, setCalloutItems] = useState<PortLinkCalloutItem[]>([])
  const lastHandledKeyRef = useRef<string | null>(null)
  const pendingFitRef = useRef<string[] | null>(null)

  const runFitView = useCallback(
    (nodeIds: string[]) => {
      if (!nodeIds.length) return
      requestAnimationFrame(() => {
        void fitView({
          nodes: nodeIds.map((id) => ({ id })),
          padding: 0.4,
          duration: 450,
          maxZoom: 1.4,
        })
      })
    },
    [fitView],
  )

  const dismissCallout = useCallback(() => {
    setCalloutItems([])
    lastHandledKeyRef.current = null
    pendingFitRef.current = null
    onClearSelection()
  }, [onClearSelection])

  useEffect(() => {
    if (!selection) {
      setCalloutItems([])
      lastHandledKeyRef.current = null
      pendingFitRef.current = null
      return
    }

    const key = selectionKey(selection)
    if (lastHandledKeyRef.current === key) return

    let connectedEdges: PortLinkEdgeType[]
    let focusNodeIds: string[]

    if (selection.kind === 'port') {
      const portId = selection.portId
      connectedEdges = edges.filter(
        (edge) => edge.data?.sourcePortId === portId || edge.data?.targetPortId === portId,
      )
      if (!connectedEdges.length) return

      lastHandledKeyRef.current = key
      focusNodeIds = [
        ...new Set(
          connectedEdges.map((edge) => {
            const isSource = edge.data?.sourcePortId === portId
            return isSource ? edge.target : edge.source
          }),
        ),
      ]
      setCalloutItems(buildCalloutItems(portId, connectedEdges, nodes))
    } else {
      const edge = edges.find((e) => e.id === selection.edgeId)
      if (!edge) return

      lastHandledKeyRef.current = key
      connectedEdges = [edge]
      focusNodeIds = [edge.source, edge.target]
      setCalloutItems([])
    }

    const racksToReveal = racksNeedingBothFacesForEdges(nodes, connectedEdges)
    const canReveal = racksToReveal.length > 0 && !!setRackFace
    if (canReveal) {
      for (const rackNodeId of racksToReveal) {
        setRackFace(rackNodeId, 'both')
      }
    }

    const fitTargets = [...new Set([...focusNodeIds, ...racksToReveal])]
    if (canReveal) {
      pendingFitRef.current = fitTargets
    } else {
      pendingFitRef.current = null
      runFitView(fitTargets)
    }
  }, [selection, edges, nodes, setRackFace, runFitView])

  /** Tras setRackFace('both'), esperar a que los nodos dejen de estar hidden. */
  useEffect(() => {
    const pending = pendingFitRef.current
    if (!pending) return

    const byId = new Map(nodes.map((n) => [n.id, n]))
    const stillHidden = pending.some((id) => byId.get(id)?.hidden)
    if (stillHidden) return

    pendingFitRef.current = null
    runFitView(pending)
  }, [nodes, runFitView])

  if (!calloutItems.length) return null

  return <PortLinkCallout items={calloutItems} onDismiss={dismissCallout} />
}
