import { useCallback, useRef } from 'react'
import { UnfoldVertical } from 'lucide-react'
import {
  DEVICE_GAP_MAX,
  DEVICE_GAP_MIN,
  DEVICE_GAP_STEP,
  SIMPLE_DEVICE_GAP,
} from './SimpleDeviceNode'

export type DeviceStackGapPreset = {
  id: string
  label: string
  value: number
}

const PRESETS: DeviceStackGapPreset[] = [
  { id: 'compact', label: 'Compacto', value: 8 },
  { id: 'medium', label: 'Medio', value: SIMPLE_DEVICE_GAP },
  { id: 'wide', label: 'Amplio', value: 48 },
]

type DeviceStackGapControlProps = {
  value: number
  onChange: (value: number) => void
  onChangeEnd?: (value: number) => void
  disabled?: boolean
}

function clampGap(n: number): number {
  const stepped = Math.round(n / DEVICE_GAP_STEP) * DEVICE_GAP_STEP
  return Math.min(DEVICE_GAP_MAX, Math.max(DEVICE_GAP_MIN, stepped))
}

export function DeviceStackGapControl({
  value,
  onChange,
  onChangeEnd,
  disabled = false,
}: DeviceStackGapControlProps) {
  const draggingRef = useRef(false)
  const valueRef = useRef(value)
  valueRef.current = value

  const commit = useCallback(
    (raw: number, end = false) => {
      const next = clampGap(raw)
      onChange(next)
      if (end) onChangeEnd?.(next)
    },
    [onChange, onChangeEnd],
  )

  return (
    <div
      className="w-[min(100%,22rem)] rounded-xl border border-slate-200/90 bg-white/95 px-3 py-2.5 shadow-lg backdrop-blur-sm dark:border-slate-600/90 dark:bg-slate-900/95"
      role="group"
      aria-label="Espacio entre equipos apilados"
    >
      <div className="mb-2 flex items-center gap-2">
        <UnfoldVertical
          className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400"
          aria-hidden
        />
        <span className="min-w-0 flex-1 text-xs font-semibold text-slate-800 dark:text-slate-100">
          Espacio entre equipos
        </span>
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {value} px
        </span>
      </div>

      <input
        type="range"
        min={DEVICE_GAP_MIN}
        max={DEVICE_GAP_MAX}
        step={DEVICE_GAP_STEP}
        value={value}
        disabled={disabled}
        aria-valuemin={DEVICE_GAP_MIN}
        aria-valuemax={DEVICE_GAP_MAX}
        aria-valuenow={value}
        aria-label="Espacio vertical entre equipos apilados"
        title="Ajustá el canal vertical entre equipos. A partir de ~24 px los enlaces pueden pasar entre ellos."
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-sky-600 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:accent-sky-500 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-sky-600 [&::-webkit-slider-thumb]:shadow-md"
        onChange={(e) => commit(Number(e.target.value))}
        onPointerDown={() => {
          draggingRef.current = true
        }}
        onPointerUp={() => {
          if (!draggingRef.current) return
          draggingRef.current = false
          onChangeEnd?.(valueRef.current)
        }}
        onPointerCancel={() => {
          draggingRef.current = false
        }}
      />

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {PRESETS.map((preset) => {
          const active = value === preset.value
          return (
            <button
              key={preset.id}
              type="button"
              disabled={disabled}
              aria-pressed={active}
              title={`${preset.label} (${preset.value} px)`}
              onClick={() => commit(preset.value, true)}
              className={`rounded-md px-2 py-0.5 text-[10px] font-semibold transition disabled:opacity-50 ${
                active
                  ? 'bg-sky-600 text-white shadow-sm dark:bg-sky-500'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {preset.label}
            </button>
          )
        })}
      </div>

      <p className="mt-1.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Los enlaces pueden pasar entre equipos a partir de ~24 px.
      </p>
    </div>
  )
}
