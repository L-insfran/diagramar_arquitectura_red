import { useEffect, useMemo, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Plus, Pencil, Trash2, Server, ArrowRightLeft } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { ContainerKindPicker } from '../components/containers/ContainerKindPicker'
import { Modal } from '../components/Modal'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TruncatedText } from '../components/Tooltip'
import { useApi } from '../hooks/useApi'
import { useProject } from '../contexts/ProjectContext'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../contexts/ToastContext'
import { containersService } from '../services/containers.service'
import { sitesService } from '../services/sites.service'
import type { Container, ContainerKind, Site } from '../types'

const COMMON_RACK_HEIGHTS_U = [
  4, 6, 8, 9, 12, 15, 16, 18, 21, 22, 24, 27, 30, 32, 36, 37, 40, 42, 44, 45, 47, 48, 50, 52, 58, 60,
] as const

const HEIGHT_OPTIONS = COMMON_RACK_HEIGHTS_U.map((u) => ({
  value: String(u),
  label: `${u}U`,
}))

const KIND_OPTIONS: { value: ContainerKind; label: string }[] = [
  { value: 'rack', label: 'Rack' },
  { value: 'board', label: 'Tablero' },
  { value: 'default', label: 'Default' },
]

const BOARD_KIND_OPTIONS = [
  { value: 'electrical', label: 'Eléctrico' },
  { value: 'communications', label: 'Comunicaciones' },
  { value: 'generic', label: 'Genérico' },
]

const FILTER_KIND_OPTIONS = [
  { value: '', label: 'Todos' },
  ...KIND_OPTIONS,
]

const initialForm = {
  kind: 'rack' as ContainerKind,
  name: '',
  code: '',
  siteId: '',
  areaId: '',
  heightU: '42',
  boardKind: 'generic',
  gridRows: '4',
  gridCols: '6',
  manufacturer: '',
  model: '',
  notes: '',
}

function FormSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <div className="border-b border-gray-200 dark:border-gray-800 pb-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
        {description && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {children}
    </section>
  )
}

function kindBadge(kind: ContainerKind) {
  switch (kind) {
    case 'rack':
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-slate-100 text-slate-700 ring-1 ring-slate-300/80 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-600">
          Rack
        </span>
      )
    case 'board':
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-400/60 dark:bg-amber-950 dark:text-amber-200 dark:ring-amber-600/60">
          Tablero
        </span>
      )
    default:
      return (
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 ring-1 ring-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-600">
          Por defecto
        </span>
      )
  }
}

function formatError(err: unknown): string {
  const ax = err as {
    message?: string
    response?: {
      status?: number
      data?: {
        message?: string
        errors?:
          | Array<{ message?: string; field?: string }>
          | Record<string, string[] | Array<{ message?: string }>>
      }
    }
  }
  const data = ax?.response?.data
  const status = ax?.response?.status

  if (typeof data?.message === 'string' && data.message.trim() && data.message !== 'Validation failed') {
    return data.message
  }
  const errors = data?.errors
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0]
    if (first?.message) return first.field ? `${first.field}: ${first.message}` : first.message
  } else if (errors && typeof errors === 'object') {
    for (const [field, msgs] of Object.entries(errors)) {
      const list = Array.isArray(msgs) ? msgs : []
      const raw = list[0]
      const msg = typeof raw === 'string' ? raw : raw?.message
      if (msg) return `${field}: ${msg}`
    }
  }
  if (status === 404) return 'Endpoint no encontrado.'
  if (ax?.message && !/^Request failed with status code \d+$/i.test(ax.message)) return ax.message
  if (status) return `Error del servidor (${status}).`
  return 'Ocurrió un error inesperado.'
}

export default function ContainersPage() {
  const { activeProjectId } = useProject()
  const { canMutate } = usePermissions()
  const toast = useToast()
  const {
    data: containers,
    isLoading,
    error,
    refetch,
  } = useApi(() => containersService.getAll(), [activeProjectId])
  const { data: sites } = useApi<Site[]>(() => sitesService.getAll(), [activeProjectId])

  const [filterKind, setFilterKind] = useState('')
  const [filterSiteId, setFilterSiteId] = useState('')
  const [filterAreaId, setFilterAreaId] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [deleteConfirm, setDeleteConfirm] = useState<Container | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [moveSource, setMoveSource] = useState<Container | null>(null)
  const [moveTargetId, setMoveTargetId] = useState('')
  const [moving, setMoving] = useState(false)

  const filterAreaOptions = useMemo(() => {
    const site = sites?.find((s) => s.id === filterSiteId)
    return (site?.areas ?? []).map((a) => ({ value: a.id, label: a.name }))
  }, [sites, filterSiteId])

  const formAreaOptions = useMemo(() => {
    const site = sites?.find((s) => s.id === form.siteId)
    return (site?.areas ?? []).map((a) => ({ value: a.id, label: a.name }))
  }, [sites, form.siteId])

  const filtered = useMemo(() => {
    if (!containers) return []
    return containers.filter((c) => {
      if (filterKind && c.kind !== filterKind) return false
      if (filterSiteId && c.area?.site?.id !== filterSiteId && c.area?.siteId !== filterSiteId)
        return false
      if (filterAreaId && c.areaId !== filterAreaId) return false
      return true
    })
  }, [containers, filterKind, filterSiteId, filterAreaId])

  const moveTargetOptions = useMemo(() => {
    if (!moveSource || !containers) return []
    return containers
      .filter((c) => c.id !== moveSource.id && c.areaId === moveSource.areaId)
      .map((c) => ({ value: c.id, label: `${c.name} (${c.kind})` }))
  }, [moveSource, containers])

  const resolveInitialKind = (): ContainerKind => {
    if (filterKind === 'rack' || filterKind === 'board' || filterKind === 'default') {
      return filterKind
    }
    return 'rack'
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...initialForm, kind: resolveInitialKind() })
    setFormError(null)
    setModalOpen(true)
  }

  const handleKindChange = (kind: ContainerKind) => {
    setForm((prev) => ({
      ...prev,
      kind,
      heightU: '42',
      boardKind: 'generic',
      gridRows: '4',
      gridCols: '6',
    }))
  }

  const openEdit = (container: Container) => {
    setEditingId(container.id)
    setForm({
      kind: container.kind,
      name: container.name,
      code: container.code || '',
      siteId: container.area?.siteId || container.area?.site?.id || '',
      areaId: container.areaId,
      heightU: container.heightU != null ? String(container.heightU) : '42',
      boardKind: container.boardKind || 'generic',
      gridRows: container.gridRows != null ? String(container.gridRows) : '4',
      gridCols: container.gridCols != null ? String(container.gridCols) : '6',
      manufacturer: container.manufacturer || '',
      model: container.model || '',
      notes: container.notes || '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalOpen(false)
    setEditingId(null)
    setForm(initialForm)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!form.name.trim() || !form.areaId) {
      setFormError('Nombre y área son obligatorios.')
      return
    }
    if (!activeProjectId) {
      setFormError('Selecciona un proyecto activo.')
      return
    }
    try {
      setIsSubmitting(true)
      const payload = {
        areaId: form.areaId,
        kind: form.kind,
        name: form.name.trim(),
        code: form.code.trim() || null,
        heightU: form.kind === 'rack' ? Number.parseInt(form.heightU, 10) || 42 : null,
        boardKind: form.kind === 'board' ? form.boardKind : null,
        gridRows: form.kind === 'board' ? Number.parseInt(form.gridRows, 10) || 4 : null,
        gridCols: form.kind === 'board' ? Number.parseInt(form.gridCols, 10) || 6 : null,
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (editingId) {
        await containersService.update(editingId, payload)
        toast.success('Contenedor actualizado')
      } else {
        await containersService.create({ projectId: activeProjectId, ...payload })
        toast.success('Contenedor creado')
      }
      refetch()
      closeModal()
    } catch (e) {
      setFormError(formatError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    try {
      await containersService.delete(deleteConfirm.id)
      toast.success(`Contenedor «${deleteConfirm.name}» eliminado`)
      setDeleteConfirm(null)
      refetch()
    } catch (e) {
      toast.error(formatError(e))
    } finally {
      setDeleting(false)
    }
  }

  const handleMoveDevices = async () => {
    if (!moveSource || !moveTargetId) return
    setMoving(true)
    try {
      await containersService.moveDevices(moveSource.id, moveTargetId)
      toast.success('Equipos movidos correctamente')
      setMoveSource(null)
      setMoveTargetId('')
      refetch()
    } catch (e) {
      toast.error(formatError(e))
    } finally {
      setMoving(false)
    }
  }

  useEffect(() => {
    if (!editingId || form.siteId || !form.areaId || !sites) return
    for (const site of sites) {
      if (site.areas?.some((a) => a.id === form.areaId)) {
        setForm((prev) => ({ ...prev, siteId: site.id }))
        break
      }
    }
  }, [editingId, form.areaId, form.siteId, sites])

  const columns: Column<Container>[] = [
    {
      key: 'name',
      header: 'Nombre',
      sortable: true,
      render: (c) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-500/10 flex items-center justify-center shrink-0">
            <Server className="w-4 h-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <TruncatedText
                text={c.name}
                className="font-medium text-gray-900 dark:text-white"
              />
              {kindBadge(c.kind)}
            </div>
            <TruncatedText
              text={`${[c.area?.site?.name, c.area?.name].filter(Boolean).join(' › ') || '—'}${c.code ? ` · ${c.code}` : ''}`}
              className="text-xs text-gray-500"
            />
          </div>
        </div>
      ),
    },
    {
      key: 'kind',
      header: 'Tipo',
      render: (c) => {
        const label = c.kind === 'rack' ? 'Rack' : c.kind === 'board' ? 'Tablero' : 'Default'
        return <span className="text-sm">{label}</span>
      },
    },
    {
      key: 'location',
      header: 'Ubicación',
      render: (c) => (
        <span className="text-sm text-gray-500">
          {[c.area?.site?.name, c.area?.name].filter(Boolean).join(' › ') || '—'}
        </span>
      ),
    },
    {
      key: 'heightU',
      header: 'Altura U',
      render: (c) =>
        c.kind === 'rack' && c.heightU != null ? (
          <span className="text-sm">{c.heightU}U</span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        ),
    },
    {
      key: 'deviceCount',
      header: 'Equipos',
      render: (c) => {
        const count = c.deviceCount ?? 0
        return count > 0 ? (
          <span className="text-sm font-medium">{count}</span>
        ) : (
          <span className="text-sm text-gray-400">0</span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (c) => {
        const count = c.deviceCount ?? 0
        const canDelete = count === 0
        return (
          <div className="flex items-center gap-1">
            {canMutate && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!p-2"
                  icon={<Pencil className="w-4 h-4" />}
                  onClick={(ev) => {
                    ev.stopPropagation()
                    openEdit(c)
                  }}
                >
                  Editar
                </Button>
                {count > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="!p-2"
                    icon={<ArrowRightLeft className="w-4 h-4" />}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setMoveSource(c)
                      setMoveTargetId('')
                    }}
                    title="Mover equipos a otro contenedor"
                  >
                    Mover
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="!p-2 text-red-500"
                  icon={<Trash2 className="w-4 h-4" />}
                  disabled={!canDelete}
                  title={
                    canDelete
                      ? 'Eliminar contenedor'
                      : `No se puede eliminar: tiene ${count} equipo(s). Mové los equipos primero.`
                  }
                  onClick={(ev) => {
                    ev.stopPropagation()
                    if (canDelete) setDeleteConfirm(c)
                  }}
                >
                  Eliminar
                </Button>
              </>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contenedores"
        subtitle="Racks, tableros y otros contenedores de equipos"
        actions={
          canMutate ? (
            <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
              Nuevo contenedor
            </Button>
          ) : undefined
        }
      />

      {error && <p className="text-sm text-red-500">No se pudieron cargar los contenedores.</p>}

      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Tipo"
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value)}
          options={FILTER_KIND_OPTIONS}
        />
        <Select
          label="Sitio"
          value={filterSiteId}
          onChange={(e) => {
            setFilterSiteId(e.target.value)
            setFilterAreaId('')
          }}
          options={[
            { value: '', label: 'Todos' },
            ...(sites || []).map((s) => ({ value: s.id, label: s.name })),
          ]}
        />
        <Select
          label="Área"
          value={filterAreaId}
          onChange={(e) => setFilterAreaId(e.target.value)}
          options={[{ value: '', label: 'Todas' }, ...filterAreaOptions]}
          disabled={!filterSiteId}
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        emptyMessage="No hay contenedores. Creá uno bajo un sitio/área."
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar contenedor' : 'Nuevo contenedor'}
      >
        <form className="space-y-5" onSubmit={handleSubmit}>
          {editingId ? (
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Tipo de contenedor
              </span>
              <div className="flex items-center gap-2">
                {kindBadge(form.kind)}
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  El tipo no se puede cambiar tras crear.
                </span>
              </div>
            </div>
          ) : (
            <ContainerKindPicker value={form.kind} onChange={handleKindChange} />
          )}

          <FormSection title="Identidad" description="Nombre y datos de referencia del contenedor.">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              required
            />
            <Input
              label="Código"
              value={form.code}
              onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))}
              placeholder={form.kind === 'rack' ? 'RACK-01' : form.kind === 'board' ? 'TAB-01' : 'CONT-01'}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Fabricante"
                value={form.manufacturer}
                onChange={(e) => setForm((p) => ({ ...p, manufacturer: e.target.value }))}
              />
              <Input
                label="Modelo"
                value={form.model}
                onChange={(e) => setForm((p) => ({ ...p, model: e.target.value }))}
              />
            </div>
            <Input
              label="Notas"
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
            />
          </FormSection>

          <FormSection title="Ubicación" description="Sitio y área donde se instalará el contenedor.">
            <Select
              label="Sitio"
              value={form.siteId}
              onChange={(e) => setForm((p) => ({ ...p, siteId: e.target.value, areaId: '' }))}
              options={[
                { value: '', label: 'Selecciona…' },
                ...(sites || []).map((s) => ({ value: s.id, label: s.name })),
              ]}
              required
            />
            <Select
              label="Área"
              value={form.areaId}
              onChange={(e) => setForm((p) => ({ ...p, areaId: e.target.value }))}
              options={[{ value: '', label: 'Selecciona…' }, ...formAreaOptions]}
              disabled={!form.siteId}
              required
            />
          </FormSection>

          {(form.kind === 'rack' || form.kind === 'board') && (
            <FormSection
              title={form.kind === 'rack' ? 'Configuración de rack' : 'Configuración de tablero'}
              description={
                form.kind === 'rack'
                  ? 'Capacidad vertical en unidades rack (U).'
                  : 'Tipo de tablero y dimensiones de la grilla de montaje.'
              }
            >
              <div
                className="space-y-3 transition-opacity duration-150"
                key={form.kind}
              >
                {form.kind === 'rack' && (
                  <Select
                    label="Altura"
                    value={form.heightU}
                    onChange={(e) => setForm((p) => ({ ...p, heightU: e.target.value }))}
                    options={
                      HEIGHT_OPTIONS.some((o) => o.value === form.heightU)
                        ? HEIGHT_OPTIONS
                        : [...HEIGHT_OPTIONS, { value: form.heightU, label: `${form.heightU}U` }].sort(
                            (a, b) => Number(a.value) - Number(b.value)
                          )
                    }
                  />
                )}

                {form.kind === 'board' && (
                  <>
                    <Select
                      label="Tipo de tablero"
                      value={form.boardKind}
                      onChange={(e) => setForm((p) => ({ ...p, boardKind: e.target.value }))}
                      options={BOARD_KIND_OPTIONS}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="Filas"
                        type="number"
                        min={1}
                        max={20}
                        value={form.gridRows}
                        onChange={(e) => setForm((p) => ({ ...p, gridRows: e.target.value }))}
                      />
                      <Input
                        label="Columnas"
                        type="number"
                        min={1}
                        max={20}
                        value={form.gridCols}
                        onChange={(e) => setForm((p) => ({ ...p, gridCols: e.target.value }))}
                      />
                    </div>
                  </>
                )}
              </div>
            </FormSection>
          )}

          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteConfirm)}
        onClose={() => { if (!deleting) setDeleteConfirm(null) }}
        onConfirm={handleConfirmDelete}
        title={`Eliminar «${deleteConfirm?.name ?? ''}»`}
        description={`Se eliminará el contenedor «${deleteConfirm?.name ?? ''}». Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        isLoading={deleting}
      />

      <Modal
        isOpen={Boolean(moveSource)}
        onClose={() => { if (!moving) { setMoveSource(null); setMoveTargetId('') } }}
        title={`Mover equipos de «${moveSource?.name ?? ''}»`}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Se moverán {moveSource?.deviceCount ?? 0} equipo(s) al contenedor destino.
            Las posiciones de montaje (U, fila/columna) se reiniciarán.
          </p>
          <Select
            label="Contenedor destino"
            value={moveTargetId}
            onChange={(e) => setMoveTargetId(e.target.value)}
            options={[
              { value: '', label: 'Selecciona…' },
              ...moveTargetOptions,
            ]}
          />
          {moveTargetOptions.length === 0 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              No hay otros contenedores en la misma área.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="secondary"
              onClick={() => { setMoveSource(null); setMoveTargetId('') }}
              disabled={moving}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleMoveDevices()}
              disabled={!moveTargetId}
              isLoading={moving}
            >
              Mover equipos
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
