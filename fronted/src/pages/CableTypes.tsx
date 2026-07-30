import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, Network } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { cableTypesService } from '../services/cable-types.service'
import type { CableType } from '../types'

const MEDIUM_FAMILY_OPTIONS: { value: CableType['mediumFamily']; label: string }[] = [
  { value: 'utp', label: 'UTP / cobre' },
  { value: 'fiber', label: 'Fibra' },
  { value: 'wifi', label: 'Wi‑Fi' },
  { value: 'internet', label: 'Internet / WAN' },
  { value: 'power', label: 'Alimentación' },
  { value: 'console', label: 'Consola' },
  { value: 'other', label: 'Otro' },
]

const initialForm = {
  code: '',
  name: '',
  description: '',
  mediumFamily: 'utp' as CableType['mediumFamily'],
  defaultCategory: '',
  defaultFiberType: '',
  color: '',
  sortOrder: '0',
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

function familyLabel(family: CableType['mediumFamily']): string {
  return MEDIUM_FAMILY_OPTIONS.find((o) => o.value === family)?.label ?? family
}

export default function CableTypes() {
  const { data: cableTypes, isLoading, error, refetch } = useApi(
    () => cableTypesService.getAll(),
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

  const openEditModal = (ct: CableType) => {
    setEditingId(ct.id)
    setForm({
      code: ct.code,
      name: ct.name,
      description: ct.description || '',
      mediumFamily: ct.mediumFamily,
      defaultCategory: ct.defaultCategory || '',
      defaultFiberType: ct.defaultFiberType || '',
      color: ct.color || '',
      sortOrder: String(ct.sortOrder ?? 0),
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

    const sortOrder = Number.parseInt(form.sortOrder, 10)
    if (Number.isNaN(sortOrder) || sortOrder < 0) {
      setFormError('El orden debe ser un número ≥ 0.')
      return
    }

    const payload = {
      name,
      description: form.description.trim() || null,
      mediumFamily: form.mediumFamily,
      defaultCategory: form.defaultCategory.trim() || null,
      defaultFiberType: form.defaultFiberType.trim() || null,
      color: form.color.trim() || null,
      sortOrder,
    }

    try {
      setIsSubmitting(true)
      if (editingId) {
        await cableTypesService.update(editingId, payload)
      } else {
        const code = (form.code.trim() || slugifyCode(name)).toLowerCase()
        if (!/^[a-z][a-z0-9_-]*$/.test(code)) {
          setFormError('El código debe empezar con letra y solo usar a-z, 0-9, _ o -.')
          return
        }
        await cableTypesService.create({
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

  const handleDelete = async (ct: CableType) => {
    const ok = window.confirm(
      `¿Eliminar el tipo "${ct.name}"? Solo se puede si ninguna conexión activa lo usa.`
    )
    if (!ok) return
    try {
      await cableTypesService.delete(ct.id)
      refetch()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const columns: Column<CableType>[] = [
    {
      key: 'name',
      header: 'Tipo',
      sortable: true,
      render: (ct) => (
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{
              backgroundColor: ct.color ? `${ct.color}22` : undefined,
            }}
          >
            {ct.color ? (
              <span
                className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                style={{ backgroundColor: ct.color }}
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <Network className="w-4 h-4 text-orange-400" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{ct.name}</p>
            {ct.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{ct.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'code',
      header: 'Código',
      sortable: true,
      render: (ct) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">{ct.code}</span>
      ),
    },
    {
      key: 'mediumFamily',
      header: 'Familia',
      sortable: true,
      render: (ct) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {familyLabel(ct.mediumFamily)}
        </span>
      ),
    },
    {
      key: 'sortOrder',
      header: 'Orden',
      sortable: true,
      render: (ct) => (
        <span className="text-sm text-gray-600 dark:text-gray-300">{ct.sortOrder}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (ct) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Pencil className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              openEditModal(ct)
            }}
            aria-label={`Editar ${ct.name}`}
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
              void handleDelete(ct)
            }}
            aria-label={`Eliminar ${ct.name}`}
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
        title="Tipos de cable"
        subtitle={`${cableTypes?.length || 0} tipos en catálogo`}
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
        Catálogo reutilizable al documentar conexiones físicas. Al elegir un tipo en el modal de
        conexión se sugieren medio, categoría o fibra. Los enums de medio en la conexión se
        conservan por compatibilidad.
      </p>

      <DataTable
        columns={columns}
        data={cableTypes || []}
        isLoading={isLoading}
        emptyMessage="No hay tipos de cable registrados"
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar tipo de cable' : 'Nuevo tipo de cable'}
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
            placeholder="Ej: UTP Cat6A, Fibra MM OM3..."
            required
          />

          <Input
            label="Código"
            value={form.code}
            onChange={(ev) => {
              setCodeTouched(true)
              setForm((f) => ({ ...f, code: ev.target.value.toLowerCase() }))
            }}
            placeholder="ej: utp-cat6a"
            disabled={!!editingId}
            required={!editingId}
          />
          {editingId ? (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              El código no se puede cambiar una vez creado.
            </p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
              Identificador interno (a-z, 0-9, _ o -). Se genera desde el nombre si lo dejas vacío.
            </p>
          )}

          <Select
            label="Familia de medio"
            options={MEDIUM_FAMILY_OPTIONS}
            value={form.mediumFamily}
            onChange={(ev) =>
              setForm((f) => ({
                ...f,
                mediumFamily: ev.target.value as CableType['mediumFamily'],
              }))
            }
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Categoría por defecto"
              value={form.defaultCategory}
              onChange={(ev) => setForm((f) => ({ ...f, defaultCategory: ev.target.value }))}
              placeholder="ej: cat6a"
            />
            <Input
              label="Fibra por defecto"
              value={form.defaultFiberType}
              onChange={(ev) => setForm((f) => ({ ...f, defaultFiberType: ev.target.value }))}
              placeholder="ej: multimode"
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 -mt-2">
            Categoría aplica a UTP; tipo de fibra a familia fibra.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Color"
              value={form.color}
              onChange={(ev) => setForm((f) => ({ ...f, color: ev.target.value }))}
              placeholder="#f97316"
            />
            <Input
              label="Orden"
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(ev) => setForm((f) => ({ ...f, sortOrder: ev.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))}
              rows={3}
              placeholder="Descripción opcional"
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
