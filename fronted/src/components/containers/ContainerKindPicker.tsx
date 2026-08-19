import type { KeyboardEvent } from 'react'
import { Box, LayoutGrid, Server } from 'lucide-react'
import type { ContainerKind } from '../../types'

type ContainerKindPickerProps = {
  value: ContainerKind
  onChange: (kind: ContainerKind) => void
  disabled?: boolean
}

const PRIMARY_OPTIONS: {
  value: Exclude<ContainerKind, 'default'>
  label: string
  description: string
  icon: typeof Server
}[] = [
  {
    value: 'rack',
    label: 'Rack',
    description: 'Montaje en unidades U con vista frontal y posterior.',
    icon: Server,
  },
  {
    value: 'board',
    label: 'Tablero',
    description: 'Grilla para equipos en tablero eléctrico o de comunicaciones.',
    icon: LayoutGrid,
  },
]

function KindCard({
  label,
  description,
  icon: Icon,
  selected,
  disabled,
  onSelect,
}: {
  label: string
  description: string
  icon: typeof Server
  selected: boolean
  disabled?: boolean
  onSelect: () => void
}) {
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onSelect()
    }
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      onKeyDown={handleKeyDown}
      className={[
        'flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-gray-900',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-blue-400/60',
        selected
          ? 'border-blue-500 bg-blue-500/5 ring-2 ring-blue-500'
          : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800/50',
      ].join(' ')}
    >
      <div
        className={[
          'flex h-9 w-9 items-center justify-center rounded-lg',
          selected ? 'bg-blue-500/15 text-blue-500' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
        ].join(' ')}
      >
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </button>
  )
}

export function ContainerKindPicker({ value, onChange, disabled = false }: ContainerKindPickerProps) {
  const isDefault = value === 'default'

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        Tipo de contenedor
      </label>

      <div role="radiogroup" aria-label="Tipo de contenedor" className="grid grid-cols-2 gap-3">
        {PRIMARY_OPTIONS.map((opt) => (
          <KindCard
            key={opt.value}
            label={opt.label}
            description={opt.description}
            icon={opt.icon}
            selected={value === opt.value}
            disabled={disabled}
            onSelect={() => onChange(opt.value)}
          />
        ))}
      </div>

      <div className="pt-1">
        {isDefault ? (
          <div
            className={[
              'flex items-start gap-3 rounded-lg border px-3 py-2.5',
              'border-gray-300 bg-gray-50 dark:border-gray-600 dark:bg-gray-800/60',
              disabled ? 'opacity-60' : '',
            ].join(' ')}
          >
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              <Box className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-200">
                Contenedor genérico seleccionado
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                Para equipos sueltos en un área, sin rack ni tablero.
              </p>
              {!disabled && (
                <button
                  type="button"
                  className="mt-1.5 text-xs text-blue-500 hover:text-blue-400 hover:underline"
                  onClick={() => onChange('rack')}
                >
                  Volver a Rack o Tablero
                </button>
              )}
            </div>
          </div>
        ) : (
          !disabled && (
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              onClick={() => onChange('default')}
            >
              ¿Equipos sueltos sin rack ni tablero?{' '}
              <span className="text-blue-500 hover:underline">Usar contenedor genérico</span>
            </button>
          )
        )}
      </div>
    </div>
  )
}
