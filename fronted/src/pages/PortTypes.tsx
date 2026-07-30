import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, Cable } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { portTypesService } from '../services/port-types.service'
import type { PortType } from '../types'

const DIRECTION_OPTIONS = [
  { value: 'bidirectional', label: 'Bidireccional' },
  { value: 'in', label: 'Entrada (in)' },
  { value: 'out', label: 'Salida (out)' },
]

const initialForm = {
  code: '',
  name: '',
  description: '',
  defaultSpeed: '',
  color: '',
  icon: '',
  direction: 'bidirectional' as PortType['direction'],
}

function slugifyCode(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50)
}

function formatError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string } } }
  return ax?.response?.data?.message || 'Ocurrió un error inesperado.'
}

function directionLabel(direction: PortType['direction']): string {
  return DIRECTION_OPTIONS.find((o) => o.value === direction)?.label ?? direction
}

export default function PortTypes() {
  const { data: portTypes, isLoading, error, refetch } = useApi(
    () => portTypesService.getAll(),
    []
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [codeTouched, setCodeTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openCreateModal = () => {
    setEditingId(null)
    setForm(initialForm)
    setCodeTouched(false)
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (pt: PortType) => {
    setEditingId(pt.id)
    setForm({
      code: pt.code,
      name: pt.name,
      description: pt.description || '',
      defaultSpeed: pt.defaultSpeed || '',
      color: pt.color || '',
      icon: pt.icon || '',
      direction: pt.direction || 'bidirectional',
    })
    setCodeTouched(true)
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalOpen(false)
    setEditingId(null)
    setForm(initialForm)
    setCodeTouched(false)
    setFormError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    const name = form.name.trim()
    if (!name) {
      setFormError('El nombre es obligatorio.')
      return
    }

    const payload = {
      name,
      description: form.description.trim() || null,
      defaultSpeed: form.defaultSpeed.trim() || null,
      color: form.color.trim() || null,
      icon: form.icon.trim() || null,
      direction: form.direction,
    }

    try {
      setIsSubmitting(true)
      if (editingId) {
        await portTypesService.update(editingId, payload)
      } else {
        const code = (form.code.trim() || slugifyCode(name)).toLowerCase()
        if (!/^[a-z][a-z0-9_-]*$/.test(code)) {
          setFormError('El código debe empezar con letra y solo usar a-z, 0-9, _ o -.')
          return
        }
        await portTypesService.create({
          code,
          ...payload,
          description: form.description.trim() || undefined,
        })
      }
      refetch()
      closeModal()
    } catch (e) {
      setFormError(formatError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (pt: PortType) => {
    const ok = window.confirm(
      `¿Eliminar el tipo "${pt.name}"? Solo se puede si ningún puerto lo usa.`
    )
    if (!ok) return
    try {
      await portTypesService.delete(pt.id)
      refetch()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const columns: Column<PortType>[] = [
    {
      key: 'name',
      header: 'Tipo',
      sortable: true,
      render: (pt) => (
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: pt.color ? `${pt.color}22` : undefined,
            }}
          >
            {pt.color ? (
              <span
                className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                style={{ backgroundColor: pt.color }}
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                <Cable className="w-4 h-4 text-cyan-400" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{pt.name}</p>
            {pt.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{pt.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Código',
      sortable: true,
      render: (pt) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{pt.code}</span>
      ),
    },
    {
      key: 'defaultSpeed',
      header: 'Velocidad',
      sortable: true,
      render: (pt) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {pt.defaultSpeed || '—'}
        </span>
      ),
    },
    {
      key: 'direction',
      header: 'Dirección',
      sortable: true,
      render: (pt) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {directionLabel(pt.direction)}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (pt) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Pencil className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              openEditModal(pt)
            }}
            aria-label={`Editar ${pt.name}`}
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
              void handleDelete(pt)
            }}
            aria-label={`Eliminar ${pt.name}`}
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
        title="Tipos de puerto"
        subtitle={`${portTypes?.length || 0} tipos registrados`}
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
        Los tipos definidos aquí aparecerán en el selector al crear o editar puertos de un
        dispositivo. El código <code className="font-mono text-xs">wireless</code> se usa para
        interfaces Wi‑Fi en la topología. La velocidad por defecto es una sugerencia; cada puerto
        puede tener la suya.
      </p>

      <DataTable
        columns={columns}
        data={portTypes || []}
        isLoading={isLoading}
        emptyMessage="No hay tipos de puerto registrados"
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar tipo de puerto' : 'Nuevo tipo de puerto'}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Nombre"
            value={form.name}
            onChange={(ev) => {
              const name = ev.target.value
              setForm((f) => ({
                ...f,
                name,
                code: !editingId && !codeTouched ? slugifyCode(name) : f.code,
              }))
            }}
            placeholder="Ej: Coaxil, SFP28, PoE..."
            required
          />

          <Input
            label="Código"
            value={form.code}
            onChange={(ev) => {
              setCodeTouched(true)
              setForm((f) => ({ ...f, code: ev.target.value.toLowerCase() }))
            }}
            placeholder="ej: coaxial"
            disabled={!!editingId}
            required={!editingId}
          />
          {editingId ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              El código no se puede cambiar porque ya puede estar en uso en puertos existentes.
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Identificador interno (a-z, 0-9, _ o -). Se genera desde el nombre si lo dejas vacío.
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Velocidad por defecto"
              value={form.defaultSpeed}
              onChange={(ev) => setForm((f) => ({ ...f, defaultSpeed: ev.target.value }))}
              placeholder="ej: 1G, 10G, 100M"
            />
            <Select
              label="Dirección"
              options={DIRECTION_OPTIONS}
              value={form.direction}
              onChange={(ev) =>
                setForm((f) => ({
                  ...f,
                  direction: ev.target.value as PortType['direction'],
                }))
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Color"
              value={form.color}
              onChange={(ev) => setForm((f) => ({ ...f, color: ev.target.value }))}
              placeholder="#22d3ee o cyan"
            />
            <Input
              label="Icono"
              value={form.icon}
              onChange={(ev) => setForm((f) => ({ ...f, icon: ev.target.value }))}
              placeholder="ej: ethernet, sfp"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 sm:col-span-2 -mt-1">
              Clave opcional para UI futura
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))}
              rows={3}
              placeholder="Descripción opcional del tipo de puerto"
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none"
            />
          </div>

          {formError && (
            <p className="text-sm text-red-500" role="alert">
              {formError}
            </p>
          )}

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
