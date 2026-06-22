import { Handle, Position, useNodeId, type Node, type NodeProps } from '@xyflow/react'
import { useContext } from 'react'
import { TOPOLOGY_NODE_HEIGHT, TOPOLOGY_NODE_WIDTH } from '../../utils/topologyLayout'
import { TopologyCanvasInteractionContext } from './TopologyCanvasContext'

export type DeviceNodeData = {
  label: string
  hostname: string | null
  ipAddress: string | null
  status: string
  accentColor: string
  location: string | null
  deviceType: string | null
}

export type DeviceFlowNodeType = Node<DeviceNodeData, 'device'>

export function DeviceFlowNode({ data }: NodeProps<DeviceFlowNodeType>) {
  const nodeId = useNodeId()
  const interaction = useContext(TopologyCanvasInteractionContext)
  const goDevice = interaction?.onNavigateToDevice

  const statusDot =
    data.status === 'online'
      ? 'bg-emerald-500'
      : data.status === 'offline'
        ? 'bg-red-500'
        : data.status === 'maintenance'
          ? 'bg-amber-500'
          : 'bg-gray-400'

  return (
    <div
      className="box-border flex flex-col justify-center rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-md pl-4 pr-3.5 py-3 border-l-[5px] shrink-0"
      style={{
        borderLeftColor: data.accentColor,
        width: TOPOLOGY_NODE_WIDTH,
        height: TOPOLOGY_NODE_HEIGHT,
        minWidth: TOPOLOGY_NODE_WIDTH,
        maxWidth: TOPOLOGY_NODE_WIDTH,
        minHeight: TOPOLOGY_NODE_HEIGHT,
        maxHeight: TOPOLOGY_NODE_HEIGHT,
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!size-3 !border-gray-400 !bg-gray-200 dark:!bg-gray-600"
      />
      <div className="flex items-center gap-3 min-h-0 min-w-0">
        <span className={`size-3 rounded-full shrink-0 ${statusDot}`} title={data.status} />
        <div className="min-w-0 flex-1">
          {goDevice && nodeId ? (
            <button
              type="button"
              className="nodrag nopan text-base font-semibold leading-tight text-gray-900 dark:text-white truncate text-left w-full hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
              title={`Ver dispositivo: ${data.label}`}
              onClick={(e) => { e.stopPropagation(); goDevice(nodeId) }}
            >
              {data.label}
            </button>
          ) : (
            <p className="text-base font-semibold leading-tight text-gray-900 dark:text-white truncate" title={data.label}>
              {data.label}
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1">
            {data.deviceType && (
              <span className="text-sm leading-tight font-medium text-gray-500 dark:text-gray-400 truncate">{data.deviceType}</span>
            )}
          </div>
          {data.hostname ? (
            <p className="text-sm font-mono leading-snug text-gray-600 dark:text-gray-300 truncate mt-1" title={data.hostname}>
              {data.hostname}
            </p>
          ) : (
            <p className="text-sm leading-snug text-gray-400 dark:text-gray-500 mt-1">Sin hostname</p>
          )}
          {data.ipAddress ? (
            <p className="text-sm font-mono leading-snug text-gray-600 dark:text-gray-300 truncate mt-1" title={data.ipAddress}>
              {data.ipAddress}
            </p>
          ) : (
            <p className="text-sm leading-snug text-gray-400 dark:text-gray-500 mt-1">Sin IP</p>
          )}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-3 !border-gray-400 !bg-gray-200 dark:!bg-gray-600"
      />
    </div>
  )
}
