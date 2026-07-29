import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow, type Node } from '@xyflow/react'
import type { PortLinkEdgeType } from './PortLinkEdge'
import type { TopologyLinkSelection } from './TopologyCanvasContext'
import { PortLinkCallout, type PortLinkCalloutItem } from './PortLinkCallout'

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

export function PortNavigationBridge({ selection, edges, nodes, onClearSelection }: PortNavigationBridgeProps) {
  const { fitView } = useReactFlow()
  const [calloutItems, setCalloutItems] = useState<PortLinkCalloutItem[]>([])
  const lastHandledPortRef = useRef<string | null>(null)

  const dismissCallout = useCallback(() => {
    setCalloutItems([])
    lastHandledPortRef.current = null
    onClearSelection()
  }, [onClearSelection])

  useEffect(() => {
    if (selection?.kind !== 'port') {
      setCalloutItems([])
      lastHandledPortRef.current = null
      return
    }

    const portId = selection.portId
    if (lastHandledPortRef.current === portId) return

    const connectedEdges = edges.filter(
      (edge) => edge.data?.sourcePortId === portId || edge.data?.targetPortId === portId,
    )
    if (!connectedEdges.length) return

    lastHandledPortRef.current = portId

    const remoteNodeIds = [
      ...new Set(
        connectedEdges.map((edge) => {
          const isSource = edge.data?.sourcePortId === portId
          return isSource ? edge.target : edge.source
        }),
      ),
    ]

    const items = buildCalloutItems(portId, connectedEdges, nodes)
    setCalloutItems(items)

    requestAnimationFrame(() => {
      void fitView({
        nodes: remoteNodeIds.map((id) => ({ id })),
        padding: 0.4,
        duration: 450,
        maxZoom: 1.4,
      })
    })
  }, [selection, edges, nodes, fitView])

  if (!calloutItems.length) return null

  return <PortLinkCallout items={calloutItems} onDismiss={dismissCallout} />
}
