import { Search } from 'lucide-react'
import { Button } from '../Button'
import {
  EMPTY_LINK_REFERENCE_FILTERS,
  hasActiveLinkReferenceFilters,
  type DiagramLinkReferenceFilters,
  type LinkReferenceFilterOptions,
} from '../../utils/diagram/filterLinkReferences'

type Props = {
  filters: DiagramLinkReferenceFilters
  onChange: (next: DiagramLinkReferenceFilters) => void
  options: LinkReferenceFilterOptions
  /** Hide the whole bar when there are no links at all. */
  disabled?: boolean
}

type FilterChip = {
  key: string
  label: string
  onRemove: () => void
}

const compactFieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-800 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'

export function LinkReferenceFilterBar({ filters, onChange, options, disabled = false }: Props) {
  if (disabled) return null

  const filtersActive = hasActiveLinkReferenceFilters(filters)

  const chips: FilterChip[] = []
  const query = filters.query.trim()
  if (query) {
    chips.push({
      key: 'q',
      label: `Buscar: ${query}`,
      onRemove: () => onChange({ ...filters, query: '' }),
    })
  }
  if (filters.siteId) {
    const option = options.sites.find((item) => item.value === filters.siteId)
    chips.push({
      key: 'site',
      label: `Sitio: ${option?.label ?? filters.siteId}`,
      onRemove: () =>
        onChange({ ...filters, siteId: '', areaId: '', container: '', deviceId: '' }),
    })
  }
  if (filters.areaId) {
    const option = options.areas.find((item) => item.value === filters.areaId)
    chips.push({
      key: 'area',
      label: `Área: ${option?.label ?? filters.areaId}`,
      onRemove: () => onChange({ ...filters, areaId: '', container: '', deviceId: '' }),
    })
  }
  if (filters.container) {
    chips.push({
      key: 'container',
      label: `Contenedor: ${filters.container}`,
      onRemove: () => onChange({ ...filters, container: '', deviceId: '' }),
    })
  }
  if (filters.deviceId) {
    const option = options.devices.find((item) => item.value === filters.deviceId)
    chips.push({
      key: 'device',
      label: `Equipo: ${option?.label ?? filters.deviceId}`,
      onRemove: () => onChange({ ...filters, deviceId: '' }),
    })
  }

  return (
    <div className="space-y-2 border-b border-slate-100 px-3 py-2 dark:border-slate-800">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="Buscar por ID, equipo, puerto, cable, rack o descripción…"
          aria-label="Buscar enlaces"
          className={`${compactFieldClass} pl-8`}
        />
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Sitio
          </span>
          <select
            value={filters.siteId}
            onChange={(e) =>
              onChange({
                ...filters,
                siteId: e.target.value,
                areaId: '',
                container: '',
                deviceId: '',
              })
            }
            aria-label="Filtrar por sitio"
            className={compactFieldClass}
            disabled={options.sites.length === 0}
          >
            <option value="">Todos</option>
            {options.sites.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Área
          </span>
          <select
            value={filters.areaId}
            onChange={(e) =>
              onChange({
                ...filters,
                areaId: e.target.value,
                container: '',
                deviceId: '',
              })
            }
            aria-label="Filtrar por área"
            className={compactFieldClass}
            disabled={options.areas.length === 0}
          >
            <option value="">Todas</option>
            {options.areas.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Contenedor
          </span>
          <select
            value={filters.container}
            onChange={(e) =>
              onChange({
                ...filters,
                container: e.target.value,
                deviceId: '',
              })
            }
            aria-label="Filtrar por contenedor"
            className={compactFieldClass}
            disabled={options.containers.length === 0}
          >
            <option value="">Todos</option>
            {options.containers.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Equipo
          </span>
          <select
            value={filters.deviceId}
            onChange={(e) => onChange({ ...filters, deviceId: e.target.value })}
            aria-label="Filtrar por equipo"
            className={compactFieldClass}
            disabled={options.devices.length === 0}
          >
            <option value="">Todos</option>
            {options.devices.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {filtersActive ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={chip.onRemove}
                title="Quitar filtro"
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <span className="truncate">{chip.label}</span>
                <span className="text-slate-400" aria-hidden>
                  ×
                </span>
              </button>
            ))}
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => onChange(EMPTY_LINK_REFERENCE_FILTERS)}
          >
            Limpiar
          </Button>
        </div>
      ) : null}
    </div>
  )
}
