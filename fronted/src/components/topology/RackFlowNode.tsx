import { type Node, type NodeProps } from '@xyflow/react'
import { useContext, useMemo } from 'react'
import type { TopologyRackAccessory } from '../../types'
import {
  RACK_COLUMN_GAP,
  RACK_CONTENT_WIDTH,
  RACK_HEADER_H,
  RACK_INNER_PAD,
  RACK_RAIL_W,
  RACK_U_PX,
  shelfPositionInRack,
  type RackViewFace,
} from '../../utils/topologyRackLayout'
import { TopologyCanvasInteractionContext } from './TopologyCanvasContext'

export type RackNodeData = {
  rackId: string
  name: string
  code: string | null
  heightU: number
  areaName: string | null
  siteName: string | null
  activeFace: RackViewFace
  deviceCountFront: number
  deviceCountRear: number
  accessories?: TopologyRackAccessory[]
}

export type RackFlowNodeType = Node<RackNodeData, 'rack'>

const VIEW_OPTIONS: Array<{ value: RackViewFace; label: string }> = [
  { value: 'front', label: 'Front' },
  { value: 'rear', label: 'Rear' },
  { value: 'both', label: 'Ambas' },
]

export function RackFlowNode({ id, data, selected, width, height }: NodeProps<RackFlowNodeType>) {
  const ctx = useContext(TopologyCanvasInteractionContext)
  const setFace = ctx?.setRackFace
  const heightU = Math.max(1, data.heightU || 42)
  const units = Array.from({ length: heightU }, (_, i) => heightU - i)
  const location = [data.siteName, data.areaName].filter(Boolean).join(' · ')
  const displayW = typeof width === 'number' && width > 0 ? width : undefined
  const displayH = typeof height === 'number' && height > 0 ? height : undefined
  const both = data.activeFace === 'both'
  const totalCount = data.deviceCountFront + data.deviceCountRear

  const shelfBands = useMemo(() => {
    const accessories = data.accessories ?? []
    const bands: Array<{
      key: string
      label: string
      x: number
      y: number
      width: number
      height: number
    }> = []
    for (const shelf of accessories) {
      const faces =
        data.activeFace === 'both'
          ? shelf.faces
          : data.activeFace === 'rear'
            ? shelf.faces.filter((f) => f === 'rear')
            : shelf.faces.filter((f) => f === 'front')

      for (const face of faces) {
        const column: 0 | 1 =
          data.activeFace === 'both' && face === 'rear' ? 1 : 0
        const col = data.activeFace === 'rear' ? 0 : column
        const pos = shelfPositionInRack(shelf.unitStart, shelf.heightU, heightU, col)
        bands.push({
          key: `${shelf.id}-${face}`,
          label: `${shelf.name}${shelf.mountType === 'four_post' ? ' · 4P' : ''}`,
          x: pos.x,
          y: pos.y,
          width: pos.width,
          height: pos.height,
        })
      }
    }
    return bands
  }, [data.accessories, data.activeFace, heightU])

  return (
    <div
      className={`relative box-border flex flex-col overflow-hidden rounded-md border-2 bg-slate-950 text-slate-100 shadow-lg ${
        selected
          ? 'border-sky-400 shadow-[0_0_0_1px_rgba(56,189,248,0.45)]'
          : 'border-slate-600'
      }`}
      style={{
        width: displayW,
        height: displayH,
        minWidth: 200,
        minHeight: RACK_HEADER_H + RACK_U_PX,
      }}
    >
      <div
        className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-700 bg-slate-900 px-2.5 py-1.5"
        style={{ height: RACK_HEADER_H, minHeight: RACK_HEADER_H }}
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold tracking-tight text-white" title={data.name}>
            {data.name}
            {data.code ? (
              <span className="ml-1.5 font-mono text-[10px] font-medium text-slate-400">{data.code}</span>
            ) : null}
          </p>
          <p className="truncate text-[10px] text-slate-400" title={location || undefined}>
            {location || 'Sin sitio/área'} · {heightU}U
          </p>
        </div>
        <div className="nodrag nopan flex shrink-0 overflow-hidden rounded border border-slate-600 bg-slate-950 text-[10px] font-bold uppercase tracking-wide">
          {VIEW_OPTIONS.map(({ value, label }) => {
            const active = data.activeFace === value
            const count =
              value === 'front'
                ? data.deviceCountFront
                : value === 'rear'
                  ? data.deviceCountRear
                  : totalCount
            return (
              <button
                key={value}
                type="button"
                className={`px-2 py-1 transition ${
                  active
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
                title={
                  value === 'front'
                    ? `Cara frontal (${count})`
                    : value === 'rear'
                      ? `Cara trasera (${count})`
                      : `Ambas caras (${count})`
                }
                onClick={(e) => {
                  e.stopPropagation()
                  setFace?.(id, value)
                }}
              >
                {label}
                <span className="ml-1 tabular-nums opacity-80">{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative min-h-0 flex-1" style={{ padding: RACK_INNER_PAD }}>
        <div
          className="pointer-events-none absolute bottom-[6px] top-[6px] flex flex-col border-r border-slate-700/80 bg-slate-900/80"
          style={{ left: RACK_INNER_PAD, width: RACK_RAIL_W }}
          aria-hidden
        >
          {units.map((unit) => (
            <div
              key={unit}
              className="flex items-center justify-center border-b border-slate-800/80 font-mono text-[9px] tabular-nums text-slate-500"
              style={{ height: RACK_U_PX, minHeight: RACK_U_PX }}
            >
              {unit}
            </div>
          ))}
        </div>

        {both ? (
          <>
            <div
              className="pointer-events-none absolute bottom-[6px] top-[6px] rounded-sm bg-[repeating-linear-gradient(180deg,transparent,transparent_43px,rgba(51,65,85,0.45)_43px,rgba(51,65,85,0.45)_44px)]"
              style={{
                left: RACK_INNER_PAD + RACK_RAIL_W,
                width: RACK_CONTENT_WIDTH,
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute top-[6px] z-[1] rounded bg-slate-900/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-sky-300"
              style={{ left: RACK_INNER_PAD + RACK_RAIL_W + 4 }}
            >
              Frente
            </div>
            <div
              className="pointer-events-none absolute bottom-[6px] top-[6px] rounded-sm bg-[repeating-linear-gradient(180deg,transparent,transparent_43px,rgba(120,53,15,0.35)_43px,rgba(120,53,15,0.35)_44px)]"
              style={{
                left: RACK_INNER_PAD + RACK_RAIL_W + RACK_CONTENT_WIDTH + RACK_COLUMN_GAP,
                width: RACK_CONTENT_WIDTH,
              }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute top-[6px] z-[1] rounded bg-slate-900/90 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-amber-300"
              style={{
                left: RACK_INNER_PAD + RACK_RAIL_W + RACK_CONTENT_WIDTH + RACK_COLUMN_GAP + 4,
              }}
            >
              Dorso
            </div>
          </>
        ) : (
          <div
            className="pointer-events-none absolute bottom-[6px] top-[6px] rounded-sm bg-[repeating-linear-gradient(180deg,transparent,transparent_43px,rgba(51,65,85,0.45)_43px,rgba(51,65,85,0.45)_44px)]"
            style={{ left: RACK_INNER_PAD + RACK_RAIL_W, right: RACK_INNER_PAD }}
            aria-hidden
          />
        )}
      </div>

      {shelfBands.map((band) => (
        <div key={band.key}>
          <div
            className="pointer-events-none absolute z-0 overflow-hidden rounded-sm border border-amber-500/70 bg-amber-900/50 shadow-[inset_0_1px_0_0_rgba(252,211,77,0.35)]"
            style={{
              left: band.x,
              top: band.y,
              width: band.width,
              height: band.height,
            }}
            title={`Bandeja fija · ${band.label}`}
          >
            {/* Soportes laterales (brackets) */}
            <div
              className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-amber-400 to-amber-700/80"
              aria-hidden
            />
            <div
              className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-l from-amber-400 to-amber-700/80"
              aria-hidden
            />
            <div className="flex h-full items-start px-3 pt-0.5 text-[9px] font-extrabold uppercase tracking-wide text-amber-100">
              <span className="truncate drop-shadow-sm">Bandeja · {band.label}</span>
            </div>
          </div>
          {/* Labio debajo de la U: no solapa puertos de equipos apoyados */}
          <div
            className="pointer-events-none absolute z-0 rounded-b-sm border-t border-amber-200/40 bg-gradient-to-b from-amber-400 to-amber-700"
            style={{
              left: band.x,
              top: band.y + band.height,
              width: band.width,
              height: 5,
            }}
            aria-hidden
            title={`Bandeja fija · ${band.label}`}
          />
        </div>
      ))}
    </div>
  )
}
