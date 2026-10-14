import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { useProject } from '../contexts/ProjectContext'
import { diagramLinkTypesService } from '../services/diagram-link-types.service'
import { LinkLineSample } from '../components/diagram/LinkLineSample'
import { LINK_LINE_STYLE_CATALOG, type LinkLineStyle } from '../utils/diagram/linkTypeStyle'
import type { DiagramLinkType } from '../types'

const DEFAULT_COLOR = '#3b82f6'

const initialForm = {
  name: '',
  color: DEFAULT_COLOR,
  description: '',
  sortOrder: '0',
  isDefault: false,
  lineStyle: 'solid' as LinkLineStyle,
}

function formatError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string } } }
  return ax?.response?.data?.message || 'Ocurrió un error inesperado.'
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-black/20"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

export default function DiagramLinkTypes() {
  const { activeProjectId } = useProject()
  const { data: linkTypes, isLoading, error, refetch } = useApi(
    () => diagramLinkTypesService.getAll(),
    [activeProjectId]
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openCreateModal = () => {
    setEditingId(null)
    setForm(initialForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (type: DiagramLinkType) => {
    setEditingId(type.id)
    setForm({
      name: type.name,
      color: type.color || DEFAULT_COLOR,
      description: type.description ?? '',
      sortOrder: String(type.sortOrder ?? 0),
      isDefault: type.isDefault,
      lineStyle: type.lineStyle ?? 'solid',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalOpen(false)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const name = form.name.trim()
    const color = form.color.trim().toLowerCase()
    if (!name) {
      setFormError('Indicá un nombre.')
      return
    }
    if (!/^#[0-9a-f]{6}$/.test(color)) {
      setFormError('El color tiene que ser un hex de 6 dígitos, por ejemplo #22c55e.')
      return
    }
    setIsSubmitting(true)
    setFormError(null)
    const payload = {
      name,
      color,
      description: form.description.trim() || null,
      sortOrder: Number(form.sortOrder) || 0,
      isDefault: form.isDefault,
      lineStyle: form.lineStyle,
    }
    try {
      if (editingId) {
        await diagramLinkTypesService.update(editingId, payload)
      } else {
        await diagramLinkTypesService.create(payload)
      }
      setModalOpen(false)
      await refetch()
    } catch (err) {
      setFormError(formatError(err))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (type: DiagramLinkType) => {
    if (!window.confirm(`¿Eliminar el tipo «${type.name}»?`)) return
    try {
      await diagramLinkTypesService.delete(type.id)
      await refetch()
    } catch (err) {
      window.alert(formatError(err))
    }
  }

  const columns: Column<DiagramLinkType>[] = [
    {
      key: 'color',
      header: '',
      render: (type) => <ColorSwatch color={type.color} />,
    },
    { key: 'name', header: 'Nombre', sortable: true },
    {
      key: 'lineStyle',
      header: 'Trazo',
      render: (type) => (
        <LinkLineSample
          lineStyle={type.lineStyle}
          color={type.color}
          title={LINK_LINE_STYLE_CATALOG.find((style) => style.id === type.lineStyle)?.label}
        />
      ),
    },
    {
      key: 'description',
      header: 'Descripción',
      render: (type) => type.description || '—',
    },
    {
      key: 'isDefault',
      header: 'Al crear',
      render: (type) => (type.isDefault ? 'Sí' : '—'),
    },
    { key: 'sortOrder', header: 'Orden', sortable: true },
    {
      key: 'actions',
      header: '',
      render: (type) => (
        <div className="flex justify-end gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Pencil className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              openEditModal(type)
            }}
            aria-label={`Editar ${type.name}`}
          >
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              void handleDelete(type)
            }}
            aria-label={`Eliminar ${type.name}`}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tipos de enlace"
        subtitle={`${linkTypes?.length || 0} tipos en este proyecto`}
        actions={
          <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
            Nuevo tipo
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <p className="text-sm text-gray-500 dark:text-gray-400">
        Cada tipo pinta los enlaces del diagrama con su color y su estilo de línea. Anillo, acceso
        a equipo final o troncal se eligen al crear o editar el enlace. El color y el trazo se
        cambian acá y se actualizan en todos los enlaces de ese tipo. El tipo de cable sigue siendo
        el medio físico.
      </p>

      <DataTable
        columns={columns}
        data={linkTypes || []}
        isLoading={isLoading}
        emptyMessage="No hay tipos de enlace. Creá el primero para distinguir los trazos por color."
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar tipo de enlace' : 'Nuevo tipo de enlace'}
        size="lg"
      >
        <form className="space-y-4" onSubmit={(ev) => void handleSubmit(ev)}>
          <Input
            label="Nombre"
            value={form.name}
            onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
            placeholder="Ej: Anillo, Acceso, Troncal"
            required
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={/^#[0-9a-fA-F]{6}$/.test(form.color) ? form.color : DEFAULT_COLOR}
                  onChange={(ev) => setForm((f) => ({ ...f, color: ev.target.value }))}
                  className="h-10 w-12 cursor-pointer rounded border border-gray-300 bg-white p-1 dark:border-gray-700 dark:bg-gray-800"
                  aria-label="Elegir color"
                />
                <Input
                  value={form.color}
                  onChange={(ev) => setForm((f) => ({ ...f, color: ev.target.value }))}
                  placeholder="#22c55e"
                />
              </div>
            </div>
            <Input
              label="Orden"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(ev) => setForm((f) => ({ ...f, sortOrder: ev.target.value }))}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Estilo de línea
            </legend>
            <div className="grid gap-2">
              {LINK_LINE_STYLE_CATALOG.map((style) => {
                const selected = form.lineStyle === style.id
                return (
                  <label
                    key={style.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 ${
                      selected
                        ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40'
                        : 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800'
                    }`}
                  >
                    <input
                      type="radio"
                      name="lineStyle"
                      className="mt-1"
                      checked={selected}
                      onChange={() => setForm((current) => ({ ...current, lineStyle: style.id }))}
                    />
                    <LinkLineSample lineStyle={style.id} color={form.color || DEFAULT_COLOR} width={48} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">
                        {style.label}
                      </span>
                      <span className="block text-xs leading-snug text-gray-500 dark:text-gray-400">
                        {style.description}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              checked={form.isDefault}
              onChange={(ev) => setForm((f) => ({ ...f, isDefault: ev.target.checked }))}
            />
            Usar al crear un enlace
          </label>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))}
              rows={3}
              placeholder="Para qué se usa este tipo"
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-500"
            />
          </div>

          {formError ? (
            <p className="text-sm text-red-500" role="alert">
              {formError}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closeModal} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingId ? 'Actualizar' : 'Crear tipo'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
