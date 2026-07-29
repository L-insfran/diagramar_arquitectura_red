import { useState } from 'react'
import type { FormEvent } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  UserIcon,
} from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { systemUsersService } from '../services/system-users.service'
import type { SystemUser } from '../types'

const roleOptions = [
  { value: 'admin', label: 'Administrador' },
  { value: 'operator', label: 'Operador' },
  { value: 'viewer', label: 'Visor' },
]

const ROLE_META: Record<
  SystemUser['role'],
  { label: string; color: string; icon: typeof Shield }
> = {
  admin: { label: 'Admin', color: 'bg-red-500/10 text-red-400', icon: ShieldCheck },
  operator: { label: 'Operador', color: 'bg-amber-500/10 text-amber-400', icon: Shield },
  viewer: { label: 'Visor', color: 'bg-blue-500/10 text-blue-400', icon: UserIcon },
}

const initialForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  role: 'viewer' as SystemUser['role'],
  isActive: true,
}

function formatError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string } } }
  return ax?.response?.data?.message || 'Ocurrió un error inesperado.'
}

export default function Users() {
  const { user: currentUser } = useAuth()
  const { activeCompanyId } = useCompany()
  const { data: users, isLoading, error, refetch } = useApi(
    () => systemUsersService.getAll(),
    [activeCompanyId]
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const openCreateModal = () => {
    setEditingId(null)
    setForm(initialForm)
    setShowPassword(false)
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (u: SystemUser) => {
    setEditingId(u.id)
    setForm({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      password: '',
      role: u.role,
      isActive: u.isActive,
    })
    setShowPassword(false)
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

    if (!activeCompanyId) return

    const firstName = form.firstName.trim()
    const lastName = form.lastName.trim()
    const email = form.email.trim()

    if (!firstName || !lastName || !email) {
      setFormError('Nombre, apellido y email son obligatorios.')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setFormError('Introduce un email válido.')
      return
    }

    if (!editingId && form.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (editingId && form.password && form.password.length < 8) {
      setFormError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    try {
      setIsSubmitting(true)
      if (editingId) {
        await systemUsersService.update(editingId, {
          firstName,
          lastName,
          email,
          role: form.role,
          isActive: form.isActive,
          ...(form.password ? { password: form.password } : {}),
        })
      } else {
        await systemUsersService.create({
          companyId: activeCompanyId,
          firstName,
          lastName,
          email,
          password: form.password,
          role: form.role,
          isActive: form.isActive,
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

  const handleDelete = async (u: SystemUser) => {
    if (u.id === currentUser?.id) {
      window.alert('No puedes eliminarte a ti mismo.')
      return
    }
    const ok = window.confirm(
      `¿Eliminar al usuario "${u.firstName} ${u.lastName}" (${u.email})? Esta acción no se puede deshacer.`
    )
    if (!ok) return
    try {
      await systemUsersService.delete(u.id)
      refetch()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const columns: Column<SystemUser>[] = [
    {
      key: 'name',
      header: 'Usuario',
      sortable: true,
      render: (u) => {
        const meta = ROLE_META[u.role]
        return (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {u.firstName.charAt(0)}
              {u.lastName.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-gray-900 dark:text-white truncate">
                {u.firstName} {u.lastName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{u.email}</p>
            </div>
            <span
              className={`ml-auto shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}
            >
              <meta.icon className="w-3 h-3" />
              {meta.label}
            </span>
          </div>
        )
      },
    },
    {
      key: 'role',
      header: 'Rol',
      render: (u) => {
        const meta = ROLE_META[u.role]
        return (
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${meta.color}`}
          >
            <meta.icon className="w-3 h-3" />
            {meta.label}
          </span>
        )
      },
    },
    {
      key: 'isActive',
      header: 'Estado',
      render: (u) =>
        u.isActive ? (
          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-xs font-medium">
            Activo
          </span>
        ) : (
          <span className="px-2 py-0.5 bg-gray-500/10 text-gray-400 rounded text-xs font-medium">
            Inactivo
          </span>
        ),
    },
    {
      key: 'createdAt',
      header: 'Creado',
      render: (u) => (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {new Date(u.createdAt).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (u) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Pencil className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              openEditModal(u)
            }}
            aria-label={`Editar ${u.firstName}`}
          >
            Editar
          </Button>
          {u.id !== currentUser?.id && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!p-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={(ev) => {
                ev.stopPropagation()
                void handleDelete(u)
              }}
              aria-label={`Eliminar ${u.firstName}`}
            >
              Eliminar
            </Button>
          )}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Usuarios del sistema"
        subtitle={`${users?.length || 0} usuarios registrados`}
        actions={
          <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={openCreateModal}>
            Nuevo usuario
          </Button>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Role legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
        {Object.entries(ROLE_META).map(([key, meta]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-medium ${meta.color}`}>
              <meta.icon className="w-3 h-3" />
              {meta.label}
            </span>
            <span>
              {key === 'admin' && '— Acceso total'}
              {key === 'operator' && '— Gestión operativa'}
              {key === 'viewer' && '— Solo lectura + credenciales propias'}
            </span>
          </div>
        ))}
      </div>

      <DataTable
        columns={columns}
        data={users || []}
        isLoading={isLoading}
        emptyMessage="No hay usuarios registrados"
      />

      {/* Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingId ? 'Editar usuario' : 'Nuevo usuario'}
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
            required
          />

          {/* Password with toggle */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contraseña
              {editingId && (
                <span className="text-gray-400 font-normal ml-1">
                  (dejar vacío para no cambiar)
                </span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(ev) => setForm((f) => ({ ...f, password: ev.target.value }))}
                autoComplete="new-password"
                minLength={8}
                required={!editingId}
                className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                tabIndex={-1}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Rol"
              value={form.role}
              onChange={(ev) =>
                setForm((f) => ({ ...f, role: ev.target.value as SystemUser['role'] }))
              }
              options={roleOptions}
            />
            <Select
              label="Estado"
              value={form.isActive ? 'true' : 'false'}
              onChange={(ev) =>
                setForm((f) => ({ ...f, isActive: ev.target.value === 'true' }))
              }
              options={[
                { value: 'true', label: 'Activo' },
                { value: 'false', label: 'Inactivo' },
              ]}
            />
          </div>

          {/* Role explanation */}
          <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50 p-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>
              <strong className="text-gray-700 dark:text-gray-300">Admin:</strong> acceso completo
              al sistema, gestión de empresas, tipos y usuarios.
            </p>
            <p>
              <strong className="text-gray-700 dark:text-gray-300">Operador:</strong> gestión
              operativa de dispositivos, topología, redes, empleados. No gestiona empresas ni
              tipos.
            </p>
            <p>
              <strong className="text-gray-700 dark:text-gray-300">Visor:</strong> solo lectura.
              Ve topología, redes, VLANs. Accede a sus propias credenciales de red. Puede cargar
              notebooks.
            </p>
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
              {editingId ? 'Actualizar' : 'Crear usuario'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
