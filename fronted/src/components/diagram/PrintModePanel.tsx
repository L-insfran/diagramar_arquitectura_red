import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Lock,
  Maximize2,
  Move,
  Scan,
  Unlock,
  X,
} from 'lucide-react'
import { Button } from '../Button'
import type { DiagramPrintFrame } from '../../types'
import type { PaperFormat, PrintOrientation } from '../../utils/pdf/a4Geometry'
import type { LinkTableFormat } from '../../utils/pdf/linkReferencePdf'
import {
  frameWithGrid,
  frameWithScale,
  MAX_DIAGRAM_PAGES,
  mmPerPxFromScalePercent,
  scalePercentFromMmPerPx,
} from '../../utils/pdf/printFrame'

type PrintModePanelProps = {
  paperSize: PaperFormat
  printOrientation: PrintOrientation
  printFrame: DiagramPrintFrame | null
  frameLocked: boolean
  includeLegend: boolean
  includeLinkTable: boolean
  linkTableFormat: LinkTableFormat
  invertColors: boolean
  outsideCount: number
  cutCount: number
  exporting: boolean
  readOnly?: boolean
  /** Columna 0-based del sector resaltado en el canvas. */
  highlightedCol?: number
  /** Fila 0-based del sector resaltado en el canvas. */
  highlightedRow?: number
  onHighlightedSectorChange?: (col: number, row: number) => void
  onPaperSizeChange: (value: PaperFormat) => void
  onOrientationChange: (value: PrintOrientation) => void
  onFrameChange: (frame: DiagramPrintFrame) => void
  onFrameChangeEnd?: (frame: DiagramPrintFrame) => void
  onToggleLock: () => void
  onFitToContent: () => void
  onFitContentIntoFrame: () => void
  onCenterFrame: () => void
  onIncludeLegendChange: (value: boolean) => void
  onIncludeLinkTableChange: (value: boolean) => void
  onLinkTableFormatChange: (value: LinkTableFormat) => void
  onInvertColorsChange: (value: boolean) => void
  onExport: () => void
  onClose: () => void
}

function SegmentToggle<T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  disabled?: boolean
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 px-2 py-1.5 text-[11px] font-semibold transition disabled:opacity-50 ${
            value === opt.value
              ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function Stepper({
  label,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <div className="flex items-center overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
        <button
          type="button"
          disabled={disabled || value <= min}
          className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onChange(value - 1)}
        >
          −
        </button>
        <span className="min-w-8 px-1.5 text-center text-xs font-semibold tabular-nums text-slate-800 dark:text-slate-100">
          {value}
        </span>
        <button
          type="button"
          disabled={disabled || value >= max}
          className="px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
          onClick={() => onChange(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function PrintModePanel({
  paperSize,
  printOrientation,
  printFrame,
  frameLocked,
  includeLegend,
  includeLinkTable,
  linkTableFormat,
  invertColors,
  outsideCount,
  cutCount,
  exporting,
  readOnly = false,
  highlightedCol = 0,
  highlightedRow = 0,
  onHighlightedSectorChange,
  onPaperSizeChange,
  onOrientationChange,
  onFrameChange,
  onFrameChangeEnd,
  onToggleLock,
  onFitToContent,
  onFitContentIntoFrame,
  onCenterFrame,
  onIncludeLegendChange,
  onIncludeLinkTableChange,
  onLinkTableFormatChange,
  onInvertColorsChange,
  onExport,
  onClose,
}: PrintModePanelProps) {
  const cols = printFrame?.cols ?? 1
  const rows = printFrame?.rows ?? 1
  const pages = cols * rows
  const scalePct = printFrame ? scalePercentFromMmPerPx(printFrame.mmPerPx) : 100
  const maxCols = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / rows))
  const maxRows = Math.max(1, Math.floor(MAX_DIAGRAM_PAGES / cols))
  const canEditFrame = Boolean(printFrame) && !frameLocked && !readOnly
  const activeCol = Math.min(Math.max(0, highlightedCol), cols - 1)
  const activeRow = Math.min(Math.max(0, highlightedRow), rows - 1)
  const activePageIndex = activeRow * cols + activeCol + 1
  const canSelectSector = Boolean(onHighlightedSectorChange) && pages > 1

  const commitGrid = (nextCols: number, nextRows: number) => {
    if (!printFrame) return
    const next = frameWithGrid(printFrame, nextCols, nextRows)
    onFrameChange(next)
    onFrameChangeEnd?.(next)
  }

  const commitScale = (percent: number, ended = false) => {
    if (!printFrame) return
    const next = frameWithScale(
      printFrame,
      mmPerPxFromScalePercent(percent),
      paperSize,
      printOrientation,
    )
    onFrameChange(next)
    if (ended) onFrameChangeEnd?.(next)
  }

  const stepHighlightedPage = (delta: number) => {
    if (!onHighlightedSectorChange || pages <= 1) return
    const flat = activeRow * cols + activeCol
    const nextFlat = (flat + delta + pages) % pages
    onHighlightedSectorChange(nextFlat % cols, Math.floor(nextFlat / cols))
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Modo impresión
          </p>
          <p className="text-[11px] text-slate-400">
            {pages} página{pages === 1 ? '' : 's'} · {paperSize.toUpperCase()}{' '}
            {printOrientation === 'landscape' ? 'horizontal' : 'vertical'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          title="Cerrar modo impresión"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto px-3 py-3">
        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Formato</p>
          <SegmentToggle
            value={paperSize}
            onChange={onPaperSizeChange}
            options={[
              { value: 'a4', label: 'A4' },
              { value: 'a3', label: 'A3' },
            ]}
          />
          <SegmentToggle
            value={printOrientation}
            onChange={onOrientationChange}
            options={[
              { value: 'portrait', label: 'Vertical' },
              { value: 'landscape', label: 'Horizontal' },
            ]}
          />
        </section>

        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Marco</p>
            <button
              type="button"
              disabled={readOnly || !printFrame}
              onClick={onToggleLock}
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                frameLocked
                  ? 'bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-100'
                  : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              title={frameLocked ? 'Desbloquear marco' : 'Bloquear marco'}
            >
              {frameLocked ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
              {frameLocked ? 'Bloqueado' : 'Bloquear'}
            </button>
          </div>

          <Stepper
            label="Columnas"
            value={cols}
            min={1}
            max={maxCols}
            disabled={!canEditFrame}
            onChange={(v) => commitGrid(v, rows)}
          />
          <Stepper
            label="Filas"
            value={rows}
            min={1}
            max={maxRows}
            disabled={!canEditFrame}
            onChange={(v) => commitGrid(cols, v)}
          />

          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-300">
              <span>Escala</span>
              <span className="tabular-nums font-semibold">{scalePct}%</span>
            </div>
            <input
              type="range"
              min={50}
              max={200}
              step={5}
              value={Math.min(200, Math.max(50, scalePct))}
              disabled={!canEditFrame}
              onChange={(e) => commitScale(Number(e.target.value))}
              onMouseUp={(e) => commitScale(Number((e.currentTarget as HTMLInputElement).value), true)}
              onTouchEnd={(e) => commitScale(Number((e.currentTarget as HTMLInputElement).value), true)}
              className="w-full accent-orange-500 disabled:opacity-40"
            />
          </label>

          <div className="grid grid-cols-1 gap-1.5">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Scan className="h-3.5 w-3.5" />}
              disabled={readOnly}
              onClick={onFitToContent}
            >
              Ajustar al contenido
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Maximize2 className="h-3.5 w-3.5" />}
              disabled={readOnly || !printFrame}
              onClick={onFitContentIntoFrame}
            >
              Encajar en el marco
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              icon={<Move className="h-3.5 w-3.5" />}
              disabled={readOnly || !printFrame}
              onClick={onCenterFrame}
            >
              Centrar marco
            </Button>
          </div>
          <p className="text-[10px] leading-snug text-slate-400">
            Arrastrá el marco naranja en el canvas. Los handles suman o quitan páginas enteras.
          </p>
        </section>

        {pages > 1 ? (
          <section className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Página resaltada
            </p>
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                Pág. {activePageIndex} · fila {activeRow + 1} · columna {activeCol + 1}
              </p>
              <div className="flex items-center overflow-hidden rounded-md border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  disabled={!canSelectSector}
                  className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Página anterior"
                  onClick={() => stepHighlightedPage(-1)}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!canSelectSector}
                  className="px-1.5 py-1 text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-800"
                  title="Página siguiente"
                  onClick={() => stepHighlightedPage(1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <div
              className="inline-grid gap-1 rounded-md border border-slate-200 bg-slate-50 p-1.5 dark:border-slate-700 dark:bg-slate-800/60"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
              role="group"
              aria-label="Seleccionar página a resaltar"
            >
              {Array.from({ length: pages }, (_, i) => {
                const c = i % cols
                const r = Math.floor(i / cols)
                const pageNum = i + 1
                const isActive = c === activeCol && r === activeRow
                return (
                  <button
                    key={pageNum}
                    type="button"
                    disabled={!canSelectSector}
                    aria-pressed={isActive}
                    title={`Pág. ${pageNum} (fila ${r + 1}, columna ${c + 1})`}
                    onClick={() => onHighlightedSectorChange?.(c, r)}
                    className={`h-6 min-w-6 rounded-sm text-[10px] font-semibold tabular-nums transition disabled:opacity-50 ${
                      isActive
                        ? 'bg-orange-500 text-white shadow-sm'
                        : 'bg-slate-200 text-slate-600 hover:bg-orange-100 hover:text-orange-800 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-orange-950/50 dark:hover:text-orange-100'
                    }`}
                  >
                    {pageNum}
                  </button>
                )
              })}
            </div>
            <p className="text-[10px] leading-snug text-slate-400">
              Elegí la página a resaltar desde esta grilla o con las flechas.
            </p>
          </section>
        ) : null}

        <section className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Contenido del PDF
          </p>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={includeLegend}
              onChange={(e) => onIncludeLegendChange(e.target.checked)}
              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            Incluir leyenda
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={includeLinkTable}
              onChange={(e) => onIncludeLinkTableChange(e.target.checked)}
              className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            Incluir tabla de enlaces
          </label>
          {includeLinkTable ? (
            <div className="space-y-1.5 pl-6">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Formato de enlaces
              </p>
              <SegmentToggle
                value={linkTableFormat}
                onChange={onLinkTableFormatChange}
                options={[
                  { value: 'table', label: 'Tabla' },
                  { value: 'path', label: 'Ruta lineal' },
                ]}
              />
            </div>
          ) : null}
          <label className="flex items-start gap-2 text-xs text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={invertColors}
              onChange={(e) => onInvertColorsChange(e.target.checked)}
              className="mt-0.5 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
            />
            <span>
              Invertir colores (impresión B/N)
              <span className="mt-0.5 block text-[10px] leading-snug text-slate-400">
                Fondos claros y trazos oscuros para imprimir sin manchas.
              </span>
            </span>
          </label>
        </section>

        {(outsideCount > 0 || cutCount > 0) && (
          <section className="space-y-1.5 rounded-md border border-amber-300/70 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">
            <p className="flex items-center gap-1.5 font-semibold">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Revisión de recorte
            </p>
            {outsideCount > 0 ? (
              <p>
                {outsideCount} objeto{outsideCount === 1 ? '' : 's'} fuera del marco.
              </p>
            ) : null}
            {cutCount > 0 ? (
              <p>
                {cutCount} objeto{cutCount === 1 ? '' : 's'} cortado
                {cutCount === 1 ? '' : 's'} por el pliegue de página.
              </p>
            ) : null}
          </section>
        )}
      </div>

      <div className="border-t border-slate-200 p-3 dark:border-slate-700">
        <Button
          type="button"
          size="sm"
          className="w-full"
          icon={<Download className="h-4 w-4" />}
          isLoading={exporting}
          onClick={onExport}
        >
          {exporting ? 'Exportando…' : 'Exportar PDF'}
        </Button>
      </div>
    </aside>
  )
}
