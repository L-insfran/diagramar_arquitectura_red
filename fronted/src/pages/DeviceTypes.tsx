import { useState } from 'react'
import type { FormEvent } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Plus,
  Pencil,
  Trash2,
  Server,
  Globe,
  Shield,
  Radio,
  Camera,
  Network,
  Cpu,
  Box,
  Monitor,
  Cloud,
  Phone,
  Laptop,
  PhoneForwarded,
  Printer,
  HardDrive,
  Wifi,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { deviceTypesService } from '../services/device-types.service'
import type { DeviceType } from '../types'

const ICON_MAP: Record<string, LucideIcon> = {
  server: Server,
  globe: Globe,
  shield: Shield,
  radio: Radio,
  camera: Camera,
  network: Network,
  cpu: Cpu,
  box: Box,
  monitor: Monitor,
  cloud: Cloud,
  phone: Phone,
  laptop: Laptop,
  'phone-forwarded': PhoneForwarded,
  printer: Printer,
  'hard-drive': HardDrive,
  wifi: Wifi,
}

const iconOptions = [
  { value: '', label: 'Sin icono' },
  { value: 'server', label: 'Servidor' },
  { value: 'globe', label: 'Globo / Router' },
  { value: 'shield', label: 'Escudo / Firewall' },
  { value: 'radio', label: 'Radio / Access Point' },
  { value: 'camera', label: 'Cámara / CCTV' },
  { value: 'network', label: 'Red / Cableado' },
  { value: 'cpu', label: 'CPU / Servidor' },
  { value: 'box', label: 'Caja / ESXi' },
  { value: 'monitor', label: 'Monitor / VM' },
  { value: 'cloud', label: 'Nube / ISP' },
  { value: 'phone', label: 'Teléfono IP' },
  { value: 'laptop', label: 'Notebook' },
  { value: 'phone-forwarded', label: 'Central telefónica' },
  { value: 'printer', label: 'Impresora' },
  { value: 'hard-drive', label: 'Disco / Storage' },
  { value: 'wifi', label: 'WiFi' },
]

const initialForm = {
  name: '',
  icon: '',
  description: '',
}

function formatError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string } } }
  return ax?.response?.data?.message || 'Ocurrió un error inesperado.'
}

function DeviceTypeIcon({ icon }: { icon: string | null }) {
  const Icon = icon ? ICON_MAP[icon] || Server : Server
  return (
    <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-blue-400" />
    </div>
  )
}

export default function DeviceTypes() {
  const { data: deviceTypes, isLoading, error, refetch } = useApi(
    () => deviceTypesService.getAll(),
    []
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

  const openEditModal = (dt: DeviceType) => {
    setEditingId(dt.id)
    setForm({
      name: dt.name,
      icon: dt.icon || '',
      description: dt.description || '',
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

    const name = form.name.trim()
    if (!name) {
      setFormError('El nombre es obligatorio.')
      return
    }

    const payload = {
      name,
      icon: form.icon.trim() || undefined,
      description: form.description.trim() || undefined,
    }

    try {
      setIsSubmitting(true)
      if (editingId) {
        await deviceTypesService.update(editingId, payload)
      } else {
        await deviceTypesService.create(payload)
      }
      refetch()
      closeModal()
    } catch (e) {
      setFormError(formatError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (dt: DeviceType) => {
    const ok = window.confirm(
      `¿Eliminar el tipo "${dt.name}"? Los dispositivos que lo usen podrían verse afectados.`
    )
    if (!ok) return
    try {
      await deviceTypesService.delete(dt.id)
      refetch()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const columns: Column<DeviceType>[] = [
    {
      key: 'name',
      header: 'Tipo',
      sortable: true,
      render: (dt) => (
        <div className="flex items-center gap-3">
          <DeviceTypeIcon icon={dt.icon} />
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{dt.name}</p>
            {dt.description && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{dt.description}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'icon',
      header: 'Icono',
      render: (dt) => (
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {dt.icon || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (dt) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Pencil className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              openEditModal(dt)
            }}
            aria-label={`Editar ${dt.name}`}
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
              void handleDelete(dt)
            }}
            aria-label={`Eliminar ${dt.name}`}
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
        title="Tipos de dispositivo"
        subtitle={`${deviceTypes?.length || 0} tipos registrados`}
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
        Los tipos definidos aquí aparecerán en el selector al crear o editar dispositivos.
      </p>

      <DataTable
        columns={columns}
        data={deviceTypes || []}
        isLoading={isLoading}
        emptyMessage="No hay tipos de dispositivo registrados"
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar tipo de dispositivo' : 'Nuevo tipo de dispositivo'}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Nombre"
            value={form.name}
            onChange={(ev) => setForm((f) => ({ ...f, name: ev.target.value }))}
            placeholder="Ej: Switch, Firewall, UPS..."
            required
          />

          <Select
            label="Icono"
            value={form.icon}
            onChange={(ev) => setForm((f) => ({ ...f, icon: ev.target.value }))}
            options={iconOptions}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              value={form.description}
              onChange={(ev) => setForm((f) => ({ ...f, description: ev.target.value }))}
              rows={3}
              placeholder="Descripción opcional del tipo de dispositivo"
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
