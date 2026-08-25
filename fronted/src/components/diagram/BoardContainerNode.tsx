import { memo } from 'react'
import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import type { TopologyBoardSummary } from '../../types'
import {
  ContainerDevicePicker,
  type ContainerDeviceOption,
} from './ContainerDevicePicker'
import {
  CONTAINER_HEADER_H,
  CONTAINER_PAD,
  CONTAINER_SELECTOR_H,
  SIMPLE_DEVICE_STACK_PAD,
} from './SimpleDeviceNode'
import {
  DIAGRAM_CONTAINER_BADGE,
  DIAGRAM_CONTAINER_TITLE,
  DIAGRAM_EMPTY_HINT,
} from '../../utils/diagram/diagramTypography'
import { rackBoardResizeFloor } from '../../utils/diagram/containerLayout'

export type BoardContainerData = {
  board: TopologyBoardSummary
  /** Unified container ID (replaces legacy boardId reference). */
  containerId?: string
  label?: string
  deviceIds: string[]
  deviceOptions: ContainerDeviceOption[]
  contentMinWidth?: number
  contentMinHeight?: number
  readOnly?: boolean
  /** Oculta el buscador (p. ej. exportación PDF). */
  hidePicker?: boolean
  onAddDevice?: (deviceId: string) => void
  onPickerOpenChange?: (open: boolean) => void
  [key: string]: unknown
}

export type BoardContainerNodeType = Node<BoardContainerData, 'boardContainer'>

function BoardContainerNodeComponent({
  data,
  selected,
  width,
  height,
}: NodeProps<BoardContainerNodeType>) {
  const board = data.board
  const showPicker = !data.readOnly && !data.hidePicker
  const floor = rackBoardResizeFloor({ hidePicker: data.hidePicker })
  const minW = floor.width
  const minH = floor.height

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-amber-50/95 shadow-sm dark:bg-amber-950/50 ${
        selected
          ? 'border-amber-500 ring-1 ring-amber-400/30'
          : 'border-amber-400/60 dark:border-amber-500/40'
      }`}
      style={{
        width: width ?? undefined,
        height: height ?? undefined,
        minWidth: minW,
        minHeight: minH,
      }}
    >
      {!data.readOnly && !data.hidePicker ? (
        <NodeResizer
          minWidth={minW}
          minHeight={minH}
          isVisible={selected}
          keepAspectRatio={false}
          lineClassName="!border-amber-400/80 !border-[2px]"
          handleClassName="!h-3.5 !w-3.5 !rounded-sm !border-2 !border-amber-500 !bg-white dark:!bg-slate-900"
        />
      ) : null}

      <div
        className="board-drag-handle flex shrink-0 cursor-grab items-center justify-between gap-2 overflow-hidden border-b border-amber-300/50 px-3 py-1.5 active:cursor-grabbing dark:border-amber-700/50"
        style={{ minHeight: CONTAINER_HEADER_H, height: CONTAINER_HEADER_H }}
        title="Arrastrá el tablero desde aquí · redimensioná desde los bordes"
      >
        <div className="min-w-0 flex-1">
          <div className={`truncate ${DIAGRAM_CONTAINER_TITLE} text-amber-950 dark:text-amber-50`}>
            {data.label ?? board.name}
          </div>
        </div>
        <span className={`shrink-0 rounded px-1.5 py-0.5 ${DIAGRAM_CONTAINER_BADGE} text-amber-800 ring-1 ring-amber-400/60 dark:text-amber-200 dark:ring-amber-600/60`}>
          Tablero
        </span>
      </div>

      {showPicker ? (
        <div
          className="nodrag nopan shrink-0 border-b border-amber-300/40 px-2 py-1.5 dark:border-amber-700/40"
          style={{ height: CONTAINER_SELECTOR_H }}
        >
          <ContainerDevicePicker
            options={data.deviceOptions}
            onAdd={(id) => data.onAddDevice?.(id)}
            onOpenChange={data.onPickerOpenChange}
            accent="amber"
          />
        </div>
      ) : data.readOnly && !data.hidePicker ? (
        <div
          style={{ height: CONTAINER_SELECTOR_H }}
          className="shrink-0 border-b border-amber-300/40 dark:border-amber-700/40"
        />
      ) : null}

      <div
        className="pointer-events-none relative min-h-0 flex-1 bg-[radial-gradient(circle,_rgb(217_119_6/0.22)_1px,_transparent_1px)] [background-size:14px_14px] dark:bg-[radial-gradient(circle,_rgb(180_83_9/0.35)_1px,_transparent_1px)]"
        style={{ margin: CONTAINER_PAD, marginTop: SIMPLE_DEVICE_STACK_PAD }}
      >
        {data.deviceIds.length === 0 ? (
          <div className={`pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center ${DIAGRAM_EMPTY_HINT} text-amber-700/60 dark:text-amber-300/50`}>
            {data.hidePicker ? 'Sin equipos' : 'Sin equipos · usá el buscador'}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const BoardContainerNode = memo(BoardContainerNodeComponent)
