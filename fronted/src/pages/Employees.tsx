import { useState } from 'react'
import type { FormEvent } from 'react'
import { Eye, Pencil, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { employeesService } from '../services/employees.service'
import { departmentsService } from '../services/departments.service'
import type { Employee } from '../types'

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  position: '',
  departmentId: '',
}

function formatSubmitError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string; messages?: unknown } } }
  const msg = ax.response?.data?.message
  if (typeof msg === 'string' && msg.trim()) return msg
  const messages = ax.response?.data?.messages
  if (messages && typeof messages === 'object') {
    const parts = Object.entries(messages as Record<string, string[]>).flatMap(([k, v]) =>
      (v ?? []).map((m) => `${k}: ${m}`)
    )
    if (parts.length) return parts.join('. ')
  }
  return 'No se pudo guardar el empleado.'
}

export default function Employees() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { canMutate, isViewer } = usePermissions()
  const { data: employees, isLoading, error, refetch } = useApi(() => employeesService.getAll())
  const { data: departments } = useApi(() => departmentsService.getAll())

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openModal = () => {
    setEditingId(null)
    setForm(initialForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (e: Employee) => {
    setEditingId(e.id)
    setForm({
      firstName: e.firstName ?? '',
      lastName: e.lastName ?? '',
      email: e.email ?? '',
      phone: e.phone ?? '',
      position: e.position ?? '',
      departmentId: e.departmentId ?? '',
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!user?.companyId) {
      setFormError('Tu sesión no tiene empresa asignada.')
      return
    }

    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    if (!firstName || !lastName) {
      setFormError('Nombre y apellido son obligatorios.')
      return
    }

    const email = form.email.trim()
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Introduce un email válido o déjalo vacío.')
      return
    }

    try {
      setIsSubmitting(true)
      if (editingId) {
        await employeesService.update(editingId, {
          firstName,
          lastName,
          email: email || null,
          phone: form.phone.trim() || null,
          position: form.position.trim() || null,
          departmentId: form.departmentId ? form.departmentId : null,
        })
      } else {
        await employeesService.create({
          companyId: user.companyId,
          firstName,
          lastName,
          ...(email ? { email } : {}),
          ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
          ...(form.position.trim() ? { position: form.position.trim() } : {}),
          ...(form.departmentId ? { departmentId: form.departmentId } : {}),
        })
      }
      refetch()
      setModalOpen(false)
      setEditingId(null)
      setForm(initialForm)
    } catch (e) {
      setFormError(formatSubmitError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const departmentOptions =
    departments?.map((d) => ({ value: d.id, label: d.name })) ?? []

  const handleDelete = async (e: Employee) => {
    const ok = window.confirm(
      `¿Eliminar a ${e.firstName} ${e.lastName}? Esta acción no se puede deshacer.`
    )
    if (!ok) return
    try {
      await employeesService.delete(e.id)
      refetch()
    } catch (err) {
      window.alert(formatSubmitError(err))
    }
  }

  // If viewer has exactly one employee (themselves), go straight to detail
  if (isViewer && !isLoading && employees && employees.length === 1) {
    navigate(`/employees/${employees[0].id}`, { replace: true })
    return null
  }

  const columns: Column<Employee>[] = [
    {
      key: 'firstName',
      header: 'Name',
      sortable: true,
      render: (e) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
            {e.firstName.charAt(0)}
            {e.lastName.charAt(0)}
          </div>
          <div>
            <p className="font-medium text-gray-900 dark:text-white">
              {e.firstName} {e.lastName}
            </p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Email',
      render: (e) => (
        <span className="text-gray-500 dark:text-gray-400">{e.email || '—'}</span>
      ),
    },
    {
      key: 'department',
      header: 'Department',
      render: (e) =>
        e.department ? (
          <span className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs font-medium">
            {e.department.name}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'position',
      header: 'Position',
      render: (e) => (
        <span className="text-gray-600 dark:text-gray-300">{e.position || '—'}</span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone',
      render: (e) => (
        <span className="text-gray-500 dark:text-gray-400">{e.phone || '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (e) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Eye className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              navigate(`/employees/${e.id}`)
            }}
            aria-label={`Ver ${e.firstName} ${e.lastName}`}
          >
            Ver
          </Button>
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
                  openEditModal(e)
                }}
                aria-label={`Editar ${e.firstName} ${e.lastName}`}
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
                  void handleDelete(e)
                }}
                aria-label={`Eliminar ${e.firstName} ${e.lastName}`}
              >
                Eliminar
              </Button>
            </>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        subtitle={`${employees?.length || 0} employees registered`}
        actions={
          canMutate ? (
            <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={openModal}>
              Add Employee
            </Button>
          ) : undefined
        }
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <DataTable
        columns={columns}
        data={employees || []}
        isLoading={isLoading}
        emptyMessage={isViewer ? 'No se encontró un empleado vinculado a tu cuenta' : 'No employees registered yet'}
      />

      {canMutate && (
        <Modal
          isOpen={modalOpen}
          onClose={closeModal}
          title={editingId ? 'Editar empleado' : 'Agregar empleado'}
          size="md"
        >
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Nombre"
                value={form.firstName}
                onChange={(ev) => setForm((f) => ({ ...f, firstName: ev.target.value }))}
                autoComplete="given-name"
                required
              />
              <Input
                label="Apellido"
                value={form.lastName}
                onChange={(ev) => setForm((f) => ({ ...f, lastName: ev.target.value }))}
                autoComplete="family-name"
                required
              />
            </div>
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(ev) => setForm((f) => ({ ...f, email: ev.target.value }))}
              autoComplete="email"
            />
            <Input
              label="Teléfono"
              value={form.phone}
              onChange={(ev) => setForm((f) => ({ ...f, phone: ev.target.value }))}
              autoComplete="tel"
            />
            <Input
              label="Puesto"
              value={form.position}
              onChange={(ev) => setForm((f) => ({ ...f, position: ev.target.value }))}
            />
            <Select
              label="Departamento"
              value={form.departmentId}
              onChange={(ev) => setForm((f) => ({ ...f, departmentId: ev.target.value }))}
              options={departmentOptions}
              placeholder="Sin departamento"
            />

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
                {editingId ? 'Actualizar' : 'Guardar'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
