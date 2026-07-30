import {
  Handle,
  NodeResizer,
  Position,
  useNodeId,
  useUpdateNodeInternals,
  type Node,
  type NodeProps,
} from '@xyflow/react'
import { Fragment, useContext, useLayoutEffect } from 'react'
import { TopologyCanvasInteractionContext } from './TopologyCanvasContext'
import type { DeviceNodeData } from './DeviceFlowNode'
import { CLOUD_NODE_HEIGHT, CLOUD_NODE_WIDTH, portConnectSourceHandleId, portConnectTargetHandleId, portSourceHandleId, portTargetHandleId } from '../../utils/topologyPortPanel'
import { clampNodeScale, CLOUD_NODE_SCALE_MAX, NODE_SCALE_MIN } from '../../utils/topologyNodeScale'

export type CloudFlowNodeType = Node<DeviceNodeData, 'cloud'>

/**
 * Nube de Internet: forma de nube, etiqueta centrada y handles de puerto
 * invisibles en el centro (arriba/abajo) para anclar enlaces WAN.
 */
export function CloudFlowNode({ data, selected, width, height }: NodeProps<CloudFlowNodeType>) {
  const nodeId = useNodeId()
  const updateNodeInternals = useUpdateNodeInternals()
  const interaction = useContext(TopologyCanvasInteractionContext)
  const readOnly = interaction?.readOnly ?? false
  const goDevice = interaction?.onNavigateToDevice

  const baseWidth = CLOUD_NODE_WIDTH
  const baseHeight = CLOUD_NODE_HEIGHT
  const scaleFromData = clampNodeScale(data.nodeScale ?? 1, CLOUD_NODE_SCALE_MAX)
  const displayWidth =
    typeof width === 'number' && width > 0 ? width : Math.round(baseWidth * scaleFromData)
  const displayHeight =
    typeof height === 'number' && height > 0 ? height : Math.round(baseHeight * scaleFromData)
  const scaleX = displayWidth / baseWidth
  const scaleY = displayHeight / baseHeight

  const ports = data.ports ?? []
  const portLayoutKey = ports.map((p) => p.id).join('|')

  useLayoutEffect(() => {
    if (nodeId) updateNodeInternals(nodeId)
  }, [nodeId, updateNodeInternals, portLayoutKey, displayWidth, displayHeight, scaleX, scaleY])

  return (
    <div
      className={`relative box-border select-none ${selected ? 'z-20' : ''}`}
      style={{ width: displayWidth, height: displayHeight }}
      title={data.label}
    >
      {!readOnly && (
        <NodeResizer
          keepAspectRatio
          isVisible={!!selected}
          minWidth={Math.round(baseWidth * NODE_SCALE_MIN)}
          minHeight={Math.round(baseHeight * NODE_SCALE_MIN)}
          maxWidth={Math.round(baseWidth * CLOUD_NODE_SCALE_MAX)}
          maxHeight={Math.round(baseHeight * CLOUD_NODE_SCALE_MAX)}
          lineClassName="!border-sky-400/90 !border-[2px]"
          handleClassName="!h-3.5 !w-3.5 !rounded-sm !border-2 !border-sky-500 !bg-white dark:!bg-gray-900"
        />
      )}

      <div
        className={`relative box-border ${
          selected
            ? 'rounded-lg ring-2 ring-sky-400 ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
            : ''
        }`}
        style={{
          width: baseWidth,
          height: baseHeight,
          transform: `scale(${scaleX}, ${scaleY})`,
          transformOrigin: 'top left',
        }}
      >
        <svg
          viewBox="0 0 200 120"
          width={baseWidth}
          height={baseHeight}
          className="absolute inset-0 drop-shadow-sm"
          aria-hidden
        >
          <defs>
            <linearGradient id={`cloud-fill-${nodeId ?? 'x'}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#bae6fd" />
            </linearGradient>
          </defs>
          <path
            d="M48 86h104c18 0 32-12 32-28s-12-28-28-28c-2-18-16-32-34-32-14 0-26 8-32 20-4-2-8-4-14-4-16 0-28 12-28 28 0 2 0 4 1 6-12 2-22 12-22 24 0 14 12 14 21 14z"
            fill={`url(#cloud-fill-${nodeId ?? 'x'})`}
            stroke="#0284c7"
            strokeWidth="2.25"
            className="dark:opacity-90"
          />
          <path
            d="M48 86h104c18 0 32-12 32-28s-12-28-28-28c-2-18-16-32-34-32-14 0-26 8-32 20-4-2-8-4-14-4-16 0-28 12-28 28 0 2 0 4 1 6-12 2-22 12-22 24 0 14 12 14 21 14z"
            fill="none"
            stroke="#7dd3fc"
            strokeWidth="1"
            opacity="0.55"
            transform="translate(0 -1)"
          />
        </svg>

        <div className="relative z-[1] flex h-full w-full flex-col items-center justify-center px-6 pb-1 pt-3 text-center">
          {goDevice && nodeId ? (
            <button
              type="button"
              className="nodrag nopan max-w-full truncate text-sm font-extrabold tracking-tight text-sky-950 hover:text-sky-700 focus:outline-none dark:text-sky-50 dark:hover:text-sky-200"
              title={`Ver dispositivo: ${data.label}`}
              onClick={(e) => {
                e.stopPropagation()
                goDevice(nodeId)
              }}
            >
              {data.label}
            </button>
          ) : (
            <p className="max-w-full truncate text-sm font-extrabold tracking-tight text-sky-950 dark:text-sky-50">
              {data.label}
            </p>
          )}
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700/80 dark:text-sky-300/90">
            Internet
          </p>
        </div>

        {/* Puerto(s) general(es): handles invisibles centrados para anclar cables. */}
        {ports.length > 0 ? (
          ports.map((port) => {
            const canConnect = !readOnly && !port.connected && port.status === 'up'
            return (
              <Fragment key={port.id}>
                <Handle
                  id={portTargetHandleId(port.id, 'top')}
                  type="target"
                  position={Position.Top}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{ left: '50%', top: '42%', transform: 'translate(-50%, -50%)' }}
                  isConnectable={false}
                />
                <Handle
                  id={portSourceHandleId(port.id, 'top')}
                  type="source"
                  position={Position.Top}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{ left: '50%', top: '42%', transform: 'translate(-50%, -50%)' }}
                  isConnectable={false}
                />
                <Handle
                  id={portTargetHandleId(port.id, 'bottom')}
                  type="target"
                  position={Position.Bottom}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{ left: '50%', top: '72%', transform: 'translate(-50%, -50%)' }}
                  isConnectable={false}
                />
                <Handle
                  id={portSourceHandleId(port.id, 'bottom')}
                  type="source"
                  position={Position.Bottom}
                  className="!opacity-0 !size-1 !border-0 !bg-transparent !pointer-events-none"
                  style={{ left: '50%', top: '72%', transform: 'translate(-50%, -50%)' }}
                  isConnectable={false}
                />
                {canConnect && (
                  <>
                    <Handle
                      id={portConnectTargetHandleId(port.id)}
                      type="target"
                      position={Position.Top}
                      isConnectable
                      className="!z-30 !rounded-full !border-0 !bg-transparent !opacity-0"
                      style={{ left: '50%', top: '58%', width: 36, height: 36, transform: 'translate(-50%, -50%)' }}
                    />
                    <Handle
                      id={portConnectSourceHandleId(port.id)}
                      type="source"
                      position={Position.Bottom}
                      isConnectable
                      className="!z-30 !rounded-full !border-2 !border-emerald-400/80 !bg-emerald-400/20"
                      style={{ left: '50%', top: '58%', width: 28, height: 28, transform: 'translate(-50%, -50%)' }}
                      title="Arrastrá a otro puerto libre para enlazar"
                    />
                  </>
                )}
              </Fragment>
            )
          })
        ) : (
          <>
            <Handle
              type="target"
              position={Position.Top}
              className="!opacity-0 !size-1 !border-0 !bg-transparent"
              style={{ left: '50%', top: '42%', transform: 'translate(-50%, -50%)' }}
              isConnectable={false}
            />
            <Handle
              type="source"
              position={Position.Bottom}
              className="!opacity-0 !size-1 !border-0 !bg-transparent"
              style={{ left: '50%', top: '72%', transform: 'translate(-50%, -50%)' }}
              isConnectable={false}
            />
          </>
        )}
      </div>
    </div>
  )
}
