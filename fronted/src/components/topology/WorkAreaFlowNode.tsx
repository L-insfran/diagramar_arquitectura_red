import { NodeResizer, type Node, type NodeProps } from '@xyflow/react'
import { useCallback, useContext, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { TopologyCanvasInteractionContext } from './TopologyCanvasContext'

export const WORK_AREA_TITLE_FONT_MIN = 12
export const WORK_AREA_TITLE_FONT_MAX = 120
export const WORK_AREA_TITLE_FONT_DEFAULT = 18
export const WORK_AREA_TITLE_FONT_STEP = 4

export type WorkAreaNodeData = {
  name: string
  titleFontSize?: number
}

export type WorkAreaFlowNodeType = Node<WorkAreaNodeData, 'workArea'>

export function clampWorkAreaTitleFontSize(value: number): number {
  if (!Number.isFinite(value)) return WORK_AREA_TITLE_FONT_DEFAULT
  return Math.min(
    WORK_AREA_TITLE_FONT_MAX,
    Math.max(WORK_AREA_TITLE_FONT_MIN, Math.round(value)),
  )
}

export function WorkAreaFlowNode({ id, data, selected, width, height }: NodeProps<WorkAreaFlowNodeType>) {
  const ctx = useContext(TopologyCanvasInteractionContext)
  const readOnly = ctx?.readOnly ?? false
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(data.name)
  const titleFontSize = clampWorkAreaTitleFontSize(data.titleFontSize ?? WORK_AREA_TITLE_FONT_DEFAULT)

  const commitName = useCallback(() => {
    const next = draft.trim() || 'ÁREA'
    setDraft(next)
    setEditing(false)
    ctx?.renameWorkArea?.(id, next)
  }, [ctx, draft, id])

  const bumpTitleFont = useCallback(
    (delta: number) => {
      if (readOnly) return
      ctx?.setWorkAreaTitleFontSize?.(id, clampWorkAreaTitleFontSize(titleFontSize + delta))
    },
    [ctx, id, readOnly, titleFontSize],
  )

  const onLabelDoubleClick = useCallback(
    (e: MouseEvent) => {
      if (readOnly) return
      e.stopPropagation()
      setDraft(data.name)
      setEditing(true)
    },
    [data.name, readOnly],
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        commitName()
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setDraft(data.name)
        setEditing(false)
      }
    },
    [commitName, data.name],
  )

  return (
    <div
      className={`relative h-full w-full rounded-sm border-2 border-dashed bg-slate-900/[0.03] dark:bg-white/[0.03] ${
        selected
          ? 'border-sky-500 shadow-[0_0_0_1px_rgba(14,165,233,0.35)]'
          : 'border-slate-700/80 dark:border-slate-300/70'
      }`}
      style={{ width: width ?? undefined, height: height ?? undefined, minWidth: 120, minHeight: 80 }}
    >
      {!readOnly && (
        <NodeResizer
          minWidth={120}
          minHeight={80}
          isVisible={selected}
          lineClassName="!border-sky-400/80 !border-[2px]"
          handleClassName="!h-4 !w-4 !rounded-sm !border-2 !border-sky-500 !bg-white dark:!bg-gray-900"
        />
      )}
      <div className="absolute left-2.5 top-2 z-10 flex max-w-[calc(100%-11rem)] items-start gap-1">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={onKeyDown}
            className="nodrag nopan w-full max-w-[360px] rounded border border-sky-400 bg-white px-2 py-1 font-bold uppercase tracking-wide text-slate-800 outline-none dark:bg-gray-900 dark:text-slate-100"
            style={{ fontSize: titleFontSize }}
            aria-label="Nombre del área de trabajo"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={onLabelDoubleClick}
            className="nodrag nopan max-w-full truncate rounded px-0.5 text-left font-bold uppercase tracking-wide text-slate-800 dark:text-slate-100"
            style={{ fontSize: titleFontSize, lineHeight: 1.15 }}
            title={readOnly ? data.name : 'Doble clic para renombrar'}
          >
            {data.name}
          </button>
        )}
      </div>
      {!readOnly && selected && (
        <div className="nodrag nopan absolute right-2 top-2 z-10 flex items-center gap-1.5">
          <div className="flex overflow-hidden rounded-md bg-white shadow-md ring-1 ring-slate-300 dark:bg-gray-900 dark:ring-slate-600">
            <button
              type="button"
              className="px-2.5 py-1.5 text-sm font-bold leading-none text-slate-800 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-100 dark:hover:bg-gray-800"
              title="Reducir título"
              disabled={titleFontSize <= WORK_AREA_TITLE_FONT_MIN}
              onClick={(e) => {
                e.stopPropagation()
                bumpTitleFont(-WORK_AREA_TITLE_FONT_STEP)
              }}
            >
              A−
            </button>
            <span className="flex min-w-[2.75rem] items-center justify-center border-x border-slate-300 px-1.5 text-xs font-bold tabular-nums text-slate-700 dark:border-slate-600 dark:text-slate-200">
              {titleFontSize}
            </span>
            <button
              type="button"
              className="px-2.5 py-1.5 text-sm font-bold leading-none text-slate-800 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-100 dark:hover:bg-gray-800"
              title="Aumentar título"
              disabled={titleFontSize >= WORK_AREA_TITLE_FONT_MAX}
              onClick={(e) => {
                e.stopPropagation()
                bumpTitleFont(WORK_AREA_TITLE_FONT_STEP)
              }}
            >
              A+
            </button>
          </div>
          <button
            type="button"
            className="rounded-md bg-white px-2.5 py-1.5 text-xs font-bold text-red-700 shadow-md ring-1 ring-red-300 hover:bg-red-50 dark:bg-gray-900 dark:text-red-300 dark:ring-red-800 dark:hover:bg-red-950/50"
            title="Eliminar área (los equipos quedan sueltos)"
            onClick={(e) => {
              e.stopPropagation()
              ctx?.removeWorkArea?.(id)
            }}
          >
            Quitar
          </button>
        </div>
      )}
    </div>
  )
}
