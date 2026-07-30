import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, Box, Cable } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { deviceTemplatesService } from '../services/device-templates.service'
import { deviceTypesService } from '../services/device-types.service'
import { portTypesService } from '../services/port-types.service'
import type { DeviceTemplate, DeviceTemplatePort } from '../types'

const initialForm = {
  name: '',
  deviceTypeId: '',
  manufacturer: '',
  model: '',
  rackUnits: '',
  notes: '',
}

const initialPortForm = {
  name: '',
  portNumber: '1',
  portType: 'ethernet',
  speed: '',
  description: '',
}

function formatError(err: unknown): string {
  const ax = err as {
    response?: {
      data?: {
        message?: string
        errors?: Array<{ message?: string; field?: string }>
      }
    }
  }
  const data = ax?.response?.data
  if (data?.message) return data.message
  const first = data?.errors?.[0]
  if (first?.message) {
    return first.field ? `${first.field}: ${first.message}` : first.message
  }
  return 'Ocurrió un error inesperado.'
}

export default function DeviceTemplates() {
  const {
    data: templates,
    isLoading,
    error,
    refetch,
  } = useApi(() => deviceTemplatesService.getAll(), [])
  const { data: deviceTypes } = useApi(() => deviceTypesService.getAll(), [])
  const { data: portTypes } = useApi(() => portTypesService.getAll(), [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [portsModalOpen, setPortsModalOpen] = useState(false)
  const [portsTemplate, setPortsTemplate] = useState<DeviceTemplate | null>(null)
  const [ports, setPorts] = useState<DeviceTemplatePort[]>([])
  const [portForm, setPortForm] = useState(initialPortForm)
  const [editingPortId, setEditingPortId] = useState<string | null>(null)
  const [portError, setPortError] = useState<string | null>(null)
  const [portsLoading, setPortsLoading] = useState(false)

  const portTypeOptions = useMemo(
    () =>
      (portTypes || []).map((pt) => ({
        value: pt.code,
        label: `${pt.name} (${pt.code})`,
      })),
    [portTypes]
  )

  const openCreateModal = () => {
    setEditingId(null)
    setForm(initialForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (tpl: DeviceTemplate) => {
    setEditingId(tpl.id)
    setForm({
      name: tpl.name,
      deviceTypeId: tpl.deviceTypeId,
      manufacturer: tpl.manufacturer || '',
      model: tpl.model || '',
      rackUnits: tpl.rackUnits != null ? String(tpl.rackUnits) : '',
      notes: tpl.notes || '',
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
    if (!name || !form.deviceTypeId) {
      setFormError('Nombre y tipo de dispositivo son obligatorios.')
      return
    }

    const rackUnits = form.rackUnits.trim()
      ? Number.parseInt(form.rackUnits.trim(), 10)
      : null
    if (form.rackUnits.trim() && (!Number.isFinite(rackUnits) || (rackUnits ?? 0) < 1)) {
      setFormError('Las unidades de rack deben ser un número entero ≥ 1.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        deviceTypeId: form.deviceTypeId,
        name,
        manufacturer: form.manufacturer.trim() || null,
        model: form.model.trim() || null,
        rackUnits,
        notes: form.notes.trim() || null,
      }
      if (editingId) {
        await deviceTemplatesService.update(editingId, payload)
      } else {
        await deviceTemplatesService.create(payload)
      }
      refetch()
      closeModal()
    } catch (e) {
      setFormError(formatError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (tpl: DeviceTemplate) => {
    const ok = window.confirm(
      `¿Eliminar el template "${tpl.name}"? Solo se puede si ningún dispositivo activo lo usa.`
    )
    if (!ok) return
    try {
      await deviceTemplatesService.delete(tpl.id)
      refetch()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const openPortsModal = async (tpl: DeviceTemplate) => {
    setPortsTemplate(tpl)
    setPorts(tpl.ports ?? [])
    setPortForm(initialPortForm)
    setEditingPortId(null)
    setPortError(null)
    setPortsModalOpen(true)
    setPortsLoading(true)
    try {
      const list = await deviceTemplatesService.getPorts(tpl.id)
      setPorts(list)
    } catch (e) {
      setPortError(formatError(e))
    } finally {
      setPortsLoading(false)
    }
  }

  const closePortsModal = () => {
    setPortsModalOpen(false)
    setPortsTemplate(null)
    setPorts([])
    setEditingPortId(null)
    setPortForm(initialPortForm)
    setPortError(null)
    refetch()
  }

  const startEditPort = (port: DeviceTemplatePort) => {
    setEditingPortId(port.id)
    setPortForm({
      name: port.name,
      portNumber: String(port.portNumber),
      portType: port.portType,
      speed: port.speed || '',
      description: port.description || '',
    })
    setPortError(null)
  }

  const handlePortSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!portsTemplate) return
    setPortError(null)

    const name = portForm.name.trim()
    const portNumber = Number.parseInt(portForm.portNumber, 10)
    if (!name || !Number.isFinite(portNumber) || portNumber < 1) {
      setPortError('Nombre y número de puerto válidos son obligatorios.')
      return
    }

    const payload = {
      name,
      portNumber,
      portType: portForm.portType || 'ethernet',
      speed: portForm.speed.trim() || null,
      description: portForm.description.trim() || null,
    }

    try {
      if (editingPortId) {
        await deviceTemplatesService.updatePort(portsTemplate.id, editingPortId, payload)
      } else {
        await deviceTemplatesService.createPort(portsTemplate.id, payload)
      }
      const list = await deviceTemplatesService.getPorts(portsTemplate.id)
      setPorts(list)
      setEditingPortId(null)
      setPortForm(initialPortForm)
    } catch (e) {
      setPortError(formatError(e))
    }
  }

  const handleDeletePort = async (port: DeviceTemplatePort) => {
    if (!portsTemplate) return
    const ok = window.confirm(`¿Eliminar el puerto template "${port.name}"?`)
    if (!ok) return
    try {
      await deviceTemplatesService.deletePort(portsTemplate.id, port.id)
      setPorts((prev) => prev.filter((p) => p.id !== port.id))
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const columns: Column<DeviceTemplate>[] = [
    {
      key: 'name',
      header: 'Template',
      sortable: true,
      render: (tpl) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
            <Box className="w-4 h-4 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{tpl.name}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {[tpl.manufacturer, tpl.model].filter(Boolean).join(' · ') || 'Sin marca/modelo'}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'deviceType',
      header: 'Tipo',
      render: (tpl) => (
        <span className="px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded text-xs font-medium">
          {tpl.deviceType?.name || '—'}
        </span>
      ),
    },
    {
      key: 'rackUnits',
      header: 'U',
      render: (tpl) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {tpl.rackUnits != null ? `${tpl.rackUnits}U` : '—'}
        </span>
      ),
    },
    {
      key: 'ports',
      header: 'Puertos',
      render: (tpl) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {tpl.ports?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (tpl) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Cable className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              void openPortsModal(tpl)
            }}
            aria-label={`Puertos de ${tpl.name}`}
          >
            Puertos
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Pencil className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              openEditModal(tpl)
            }}
            aria-label={`Editar ${tpl.name}`}
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
              void handleDelete(tpl)
            }}
            aria-label={`Eliminar ${tpl.name}`}
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
        title="Templates de dispositivo"
        subtitle={`${templates?.length || 0} templates en el catálogo compartido`}
        actions={
          <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
            Nuevo template
          </Button>
        }
      />

      {error && (
        <p className="text-sm text-red-500">No se pudieron cargar los templates.</p>
      )}

      <DataTable
        columns={columns}
        data={templates || []}
        isLoading={isLoading}
        emptyMessage="No hay templates. Crea uno para poder instanciar dispositivos en cualquier proyecto."
      />

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar template' : 'Nuevo template'}
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Cisco Catalyst 2960 24p"
          />
          <Select
            label="Tipo de dispositivo"
            value={form.deviceTypeId}
            onChange={(e) => setForm((prev) => ({ ...prev, deviceTypeId: e.target.value }))}
            options={(deviceTypes || []).map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Selecciona un tipo"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Fabricante"
              value={form.manufacturer}
              onChange={(e) => setForm((prev) => ({ ...prev, manufacturer: e.target.value }))}
            />
            <Input
              label="Modelo"
              value={form.model}
              onChange={(e) => setForm((prev) => ({ ...prev, model: e.target.value }))}
            />
          </div>
          <Input
            label="Unidades de rack (U)"
            value={form.rackUnits}
            onChange={(e) => setForm((prev) => ({ ...prev, rackUnits: e.target.value }))}
            placeholder="1"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notas
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 min-h-[80px]"
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
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

      <Modal
        isOpen={portsModalOpen}
        onClose={closePortsModal}
        title={portsTemplate ? `Puertos — ${portsTemplate.name}` : 'Puertos del template'}
        size="lg"
      >
        <div className="space-y-4">
          {portsLoading ? (
            <p className="text-sm text-gray-500">Cargando puertos…</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800 max-h-48 overflow-y-auto">
              {ports.length === 0 && (
                <li className="py-2 text-sm text-gray-500">Sin puertos definidos.</li>
              )}
              {ports.map((port) => (
                <li key={port.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      #{port.portNumber} {port.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {port.portType}
                      {port.speed ? ` · ${port.speed}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!p-2"
                      icon={<Pencil className="w-3.5 h-3.5" />}
                      onClick={() => startEditPort(port)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!p-2 text-red-500"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => void handleDeletePort(port)}
                    >
                      Borrar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4" onSubmit={handlePortSubmit}>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {editingPortId ? 'Editar puerto' : 'Agregar puerto'}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Nombre"
                value={portForm.name}
                onChange={(e) => setPortForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
              <Input
                label="Número"
                value={portForm.portNumber}
                onChange={(e) => setPortForm((prev) => ({ ...prev, portNumber: e.target.value }))}
                required
              />
              <Select
                label="Tipo"
                value={portForm.portType}
                onChange={(e) => setPortForm((prev) => ({ ...prev, portType: e.target.value }))}
                options={
                  portTypeOptions.length > 0
                    ? portTypeOptions
                    : [{ value: 'ethernet', label: 'Ethernet' }]
                }
              />
              <Input
                label="Velocidad"
                value={portForm.speed}
                onChange={(e) => setPortForm((prev) => ({ ...prev, speed: e.target.value }))}
                placeholder="1G"
              />
            </div>
            <Input
              label="Descripción"
              value={portForm.description}
              onChange={(e) => setPortForm((prev) => ({ ...prev, description: e.target.value }))}
            />
            {portError && <p className="text-sm text-red-500">{portError}</p>}
            <div className="flex justify-end gap-2">
              {editingPortId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingPortId(null)
                    setPortForm(initialPortForm)
                  }}
                >
                  Cancelar edición
                </Button>
              )}
              <Button type="submit">{editingPortId ? 'Actualizar puerto' : 'Agregar puerto'}</Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  )
}
