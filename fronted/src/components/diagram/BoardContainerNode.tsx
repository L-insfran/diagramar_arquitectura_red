import { memo } from 'react'
import { type Node, type NodeProps } from '@xyflow/react'
import type { TopologyBoardSummary } from '../../types'
import {
  ContainerDevicePicker,
  type ContainerDeviceOption,
} from './ContainerDevicePicker'
import {
  CONTAINER_HEADER_H,
  CONTAINER_PAD,
  CONTAINER_SELECTOR_H,
  SIMPLE_DEVICE_WIDTH,
} from './SimpleDeviceNode'

export type BoardContainerData = {
  board: TopologyBoardSummary
  label?: string
  deviceIds: string[]
  deviceOptions: ContainerDeviceOption[]
  readOnly?: boolean
  /** Oculta el buscador (p. ej. exportación PDF). */
  hidePicker?: boolean
  onAddDevice?: (deviceId: string) => void
  onPickerOpenChange?: (open: boolean) => void
  [key: string]: unknown
}

export type BoardContainerNodeType = Node<BoardContainerData, 'boardContainer'>

function BoardContainerNodeComponent({ data, selected }: NodeProps<BoardContainerNodeType>) {
  const board = data.board
  const showPicker = !data.readOnly && !data.hidePicker

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-lg border bg-amber-50/95 shadow-sm dark:bg-amber-950/50 ${
        selected
          ? 'border-amber-500 ring-1 ring-amber-400/30'
          : 'border-amber-400/60 dark:border-amber-500/40'
      }`}
      style={{
        minWidth: CONTAINER_PAD * 2 + SIMPLE_DEVICE_WIDTH + 8,
        minHeight:
          CONTAINER_HEADER_H +
          (data.hidePicker ? 0 : CONTAINER_SELECTOR_H) +
          56,
      }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 overflow-hidden border-b border-amber-300/50 px-3 py-1.5 dark:border-amber-700/50"
        style={{ minHeight: CONTAINER_HEADER_H, height: CONTAINER_HEADER_H }}
      >
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold leading-tight tracking-tight text-amber-950 dark:text-amber-50">
            {data.label ?? board.name}
          </div>
        </div>
        <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-800 ring-1 ring-amber-400/60 dark:text-amber-200 dark:ring-amber-600/60">
          Tablero
        </span>
      </div>

      {showPicker ? (
        <div
          className="shrink-0 border-b border-amber-300/40 px-2 py-1.5 dark:border-amber-700/40"
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

      {data.deviceIds.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-3 text-center text-[11px] text-amber-700/60 dark:text-amber-300/50">
          {data.hidePicker ? 'Sin equipos' : 'Sin equipos · usá el buscador'}
        </div>
      ) : null}
    </div>
  )
}

export const BoardContainerNode = memo(BoardContainerNodeComponent)
