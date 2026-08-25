import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronRight, ChevronUp, Download, FileSpreadsheet, Layers } from 'lucide-react'
import { Button } from './Button'
import { Card } from './Card'
import { StatusBadge } from './StatusBadge'
import { useToast } from '../contexts/ToastContext'
import { systemBrandingService } from '../services/systemBranding.service'
import type { Device } from '../types'
import {
  groupDevicesByTemplate,
  inventoryRowsToCsvRecords,
  INVENTORY_CSV_HEADERS,
  type DeviceInventoryRow,
} from '../utils/deviceInventory'
import { downloadCsv } from '../utils/exportCsv'
import { exportDeviceInventoryPdf } from '../utils/pdf/deviceInventoryPdf'
import { safePdfFilename } from '../utils/pdf/pdfChrome'

type SortKey = 'deviceTypeName' | 'templateName' | 'manufacturer' | 'count'

const LOCALE_COMPARE_OPTS: Intl.CollatorOptions = { sensitivity: 'base', numeric: true }

interface DeviceInventoryPanelProps {
  devices: Device[]
  filtersActive?: boolean
  projectName?: string
  clientName?: string
  authorName?: string
  onSelectTemplate: (templateId: string) => void
}

export function DeviceInventoryPanel({
  devices,
  filtersActive,
  projectName,
  clientName,
  authorName,
  onSelectTemplate,
}: DeviceInventoryPanelProps) {
  const navigate = useNavigate()
  const toast = useToast()
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('count')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [exportingPdf, setExportingPdf] = useState(false)

  const summary = useMemo(() => groupDevicesByTemplate(devices), [devices])

  const rows = useMemo(() => {
    const sorted = [...summary.rows]
    sorted.sort((a, b) => {
      const aVal = a[sortKey]
      const bVal = b[sortKey]
      const cmp =
        typeof aVal === 'number' && typeof bVal === 'number'
          ? aVal - bVal
          : String(aVal).localeCompare(String(bVal), 'es', LOCALE_COMPARE_OPTS)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [summary.rows, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'count' ? 'desc' : 'asc')
    }
  }

  const toggleExpanded = (templateId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(templateId)) next.delete(templateId)
      else next.add(templateId)
      return next
    })
  }

  const fileStem = `${safePdfFilename(projectName || 'inventario')}_Inventario_modelos_${new Date()
    .toISOString()
    .slice(0, 10)}`

  const handleCsv = () => {
    downloadCsv(`${fileStem}.csv`, INVENTORY_CSV_HEADERS, inventoryRowsToCsvRecords(summary.rows))
    toast.success('CSV exportado', 'Se descargó el inventario por modelo.')
  }

  const handlePdf = async () => {
    setExportingPdf(true)
    try {
      let branding: { logoDataUrl?: string; reportTagline?: string } | undefined
      try {
        const meta = await systemBrandingService.get()
        branding = {
          logoDataUrl: meta.hasLogo
            ? ((await systemBrandingService.fetchLogoPngDataUrl()) ?? undefined)
            : undefined,
          reportTagline: meta.reportTagline ?? undefined,
        }
      } catch {
        branding = undefined
      }

      await exportDeviceInventoryPdf({
        summary,
        projectName,
        clientName,
        authorName,
        branding,
        subtitle: `${summary.deviceCount} equipos · ${summary.templateCount} modelos${
          filtersActive ? ' · según filtros activos' : ''
        }`,
      })
      toast.success('PDF exportado', 'Se descargó el inventario por modelo.')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      toast.error('No se pudo exportar el PDF', message)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {summary.deviceCount} equipos · {summary.templateCount} modelos
          {filtersActive ? ' · según filtros activos' : ''}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<FileSpreadsheet className="h-4 w-4" />}
            onClick={handleCsv}
            disabled={!summary.rows.length}
          >
            Exportar CSV
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            icon={<Download className="h-4 w-4" />}
            isLoading={exportingPdf}
            onClick={() => void handlePdf()}
            disabled={!summary.rows.length}
          >
            {exportingPdf ? 'Exportando…' : 'Exportar PDF'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card compact title="Equipos" value={summary.deviceCount} />
        <Card compact title="Modelos" value={summary.templateCount} />
        <Card compact title="Tipos" value={summary.typeCount} />
      </div>

      {rows.length === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
          No hay equipos para agrupar con los filtros actuales.
        </p>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <th className="w-8 px-3 py-3.5" />
                  <SortHeader
                    label="Tipo"
                    active={sortKey === 'deviceTypeName'}
                    dir={sortDir}
                    onClick={() => handleSort('deviceTypeName')}
                  />
                  <SortHeader
                    label="Template"
                    active={sortKey === 'templateName'}
                    dir={sortDir}
                    onClick={() => handleSort('templateName')}
                  />
                  <SortHeader
                    label="Fabricante"
                    active={sortKey === 'manufacturer'}
                    dir={sortDir}
                    onClick={() => handleSort('manufacturer')}
                  />
                  <SortHeader
                    label="Cantidad"
                    active={sortKey === 'count'}
                    dir={sortDir}
                    onClick={() => handleSort('count')}
                    align="right"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {rows.map((row) => (
                  <InventoryRow
                    key={row.templateId}
                    row={row}
                    expanded={expandedIds.has(row.templateId)}
                    onToggle={() => toggleExpanded(row.templateId)}
                    onSelect={() => onSelectTemplate(row.templateId)}
                    onOpenDevice={(id) => navigate(`/devices/${id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Layers className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
        Expandí una fila para ver los nombres. Clic en el modelo para filtrar la lista de dispositivos.
      </p>
    </div>
  )
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
  align,
}: {
  label: string
  active: boolean
  dir: 'asc' | 'desc'
  onClick: () => void
  align?: 'right'
}) {
  return (
    <th
      className={`px-4 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 cursor-pointer select-none hover:text-gray-700 dark:hover:text-gray-200 ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
      onClick={onClick}
    >
      <span className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        {active && (dir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)}
      </span>
    </th>
  )
}

function InventoryRow({
  row,
  expanded,
  onToggle,
  onSelect,
  onOpenDevice,
}: {
  row: DeviceInventoryRow
  expanded: boolean
  onToggle: () => void
  onSelect: () => void
  onOpenDevice: (id: string) => void
}) {
  return (
    <>
      <tr
        className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer"
        onClick={onSelect}
      >
        <td className="px-3 py-3">
          <button
            type="button"
            className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
            onClick={(e) => {
              e.stopPropagation()
              onToggle()
            }}
            aria-expanded={expanded}
            aria-label={expanded ? 'Ocultar equipos' : 'Ver equipos'}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
        <td className="px-4 py-3">
          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
            {row.deviceTypeName}
          </span>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900 dark:text-white">{row.templateName}</p>
          {row.model !== '—' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{row.model}</p>
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">{row.manufacturer}</td>
        <td className="px-4 py-3 text-right">
          <span className="text-lg font-bold tabular-nums text-gray-900 dark:text-white">{row.count}</span>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50/80 dark:bg-gray-800/30">
          <td colSpan={5} className="px-6 py-3">
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {row.devices.map((device) => (
                <li key={device.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-800"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenDevice(device.id)
                    }}
                  >
                    <span className="truncate font-medium">{device.name}</span>
                    <StatusBadge status={device.status} />
                  </button>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  )
}
