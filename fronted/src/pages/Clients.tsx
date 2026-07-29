import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Building2, Pencil, Plus, Trash2, Users } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Modal } from '../components/Modal'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { useCompany } from '../contexts/CompanyContext'
import { useToast } from '../contexts/ToastContext'
import { companiesService } from '../services/companies.service'
import { systemUsersService } from '../services/system-users.service'
import type { Company, SystemUser } from '../types'

const emptyForm = {
  name: '',
  domain: '',
  address: '',
  phone: '',
}

type MembershipDraft = {
  companyId: string
  role: 'admin' | 'operator' | 'viewer'
  isDefault: boolean
}

export default function Clients() {
  const toast = useToast()
  const { refreshCompanies, setActiveCompany, activeCompanyId } = useCompany()
  const { data: companies, isLoading, refetch } = useApi(() => companiesService.getAll())
  const { data: users } = useApi(() => systemUsersService.getAll())

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Company | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [membersModalOpen, setMembersModalOpen] = useState(false)
  const [membersUser, setMembersUser] = useState<SystemUser | null>(null)
  const [memberships, setMemberships] = useState<MembershipDraft[]>([])
  const [membersError, setMembersError] = useState<string | null>(null)
  const [membersSaving, setMembersSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError(null)
    setModalOpen(true)
  }

  const openEdit = (company: Company) => {
    setEditing(company)
    setForm({
      name: company.name ?? '',
      domain: company.domain ?? '',
      address: company.address ?? '',
      phone: company.phone ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.name.trim()) {
      setFormError('El nombre del cliente es obligatorio.')
      return
    }
    try {
      setSubmitting(true)
      const payload = {
        name: form.name.trim(),
        domain: form.domain.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
      }
      if (editing) {
        await companiesService.update(editing.id, payload)
        toast.success('Cliente actualizado')
      } else {
        const created = await companiesService.create(payload)
        toast.success('Cliente creado', 'Ya podés documentar su infraestructura.')
        setActiveCompany(created.id)
      }
      setModalOpen(false)
      await refetch()
      await refreshCompanies()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo guardar el cliente.'
      setFormError(message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (company: Company) => {
    if (company.id === activeCompanyId) {
      toast.error('No se puede eliminar', 'Cambiá a otro cliente antes de eliminar este.')
      return
    }
    const ok = window.confirm(
      `¿Eliminar el cliente "${company.name}"? Se borrarán dispositivos, VLANs, redes y topología asociados.`
    )
    if (!ok) return
    try {
      await companiesService.remove(company.id)
      toast.success('Cliente eliminado')
      await refetch()
      await refreshCompanies()
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudo eliminar el cliente.'
      toast.error('Error', message)
    }
  }

  const openMembers = async (user: SystemUser) => {
    setMembersUser(user)
    setMembersError(null)
    try {
      const list = await companiesService.getUserMemberships(user.id)
      setMemberships(
        list.map((m) => ({
          companyId: m.companyId,
          role: m.role,
          isDefault: m.isDefault,
        }))
      )
    } catch {
      setMemberships(
        user.companyId
          ? [{ companyId: user.companyId, role: user.role, isDefault: true }]
          : []
      )
    }
    setMembersModalOpen(true)
  }

  const toggleMembership = (companyId: string) => {
    setMemberships((prev) => {
      const exists = prev.find((m) => m.companyId === companyId)
      if (exists) {
        const next = prev.filter((m) => m.companyId !== companyId)
        if (next.length && !next.some((m) => m.isDefault)) {
          next[0] = { ...next[0], isDefault: true }
        }
        return next
      }
      return [
        ...prev,
        {
          companyId,
          role: 'operator',
          isDefault: prev.length === 0,
        },
      ]
    })
  }

  const setMembershipRole = (companyId: string, role: MembershipDraft['role']) => {
    setMemberships((prev) => prev.map((m) => (m.companyId === companyId ? { ...m, role } : m)))
  }

  const setDefaultMembership = (companyId: string) => {
    setMemberships((prev) =>
      prev.map((m) => ({ ...m, isDefault: m.companyId === companyId }))
    )
  }

  const saveMemberships = async () => {
    if (!membersUser) return
    if (!memberships.length) {
      setMembersError('El usuario debe pertenecer al menos a un cliente.')
      return
    }
    try {
      setMembersSaving(true)
      setMembersError(null)
      await companiesService.updateUserMemberships(membersUser.id, memberships)
      toast.success('Membresías actualizadas')
      setMembersModalOpen(false)
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'No se pudieron guardar las membresías.'
      setMembersError(message)
    } finally {
      setMembersSaving(false)
    }
  }

  const columns: Column<Company>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Cliente',
        render: (row) => (
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{row.name}</p>
            {row.domain && <p className="text-xs text-gray-500 truncate">{row.domain}</p>}
          </div>
        ),
      },
      {
        key: 'phone',
        header: 'Contacto',
        render: (row) => (
          <span className="text-sm text-gray-600 dark:text-gray-300">{row.phone || '—'}</span>
        ),
      },
      {
        key: 'isActive',
        header: 'Estado',
        render: (row) => (
          <span
            className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              row.isActive
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            {row.isActive ? 'Activo' : 'Inactivo'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        render: (row) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              icon={<Pencil className="w-4 h-4" />}
              onClick={() => openEdit(row)}
            >
              Editar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600 dark:text-red-400"
              icon={<Trash2 className="w-4 h-4" />}
              onClick={() => void handleDelete(row)}
            >
              Eliminar
            </Button>
          </div>
        ),
      },
    ],
    [activeCompanyId]
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        subtitle="Administrá las empresas/clientes y quién puede acceder a cada red"
        actions={
          <Button icon={<Plus className="w-4 h-4" />} onClick={openCreate}>
            Nuevo cliente
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={companies ?? []}
        isLoading={isLoading}
        emptyMessage="Todavía no hay clientes. Creá el primero para empezar a documentar redes."
      />

      <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-600" />
          <h3 className="font-semibold text-gray-900 dark:text-white">Asignar clientes a usuarios</h3>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Cada usuario puede pertenecer a varios clientes con un rol distinto en cada uno.
        </p>
        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {(users ?? []).map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {u.firstName} {u.lastName}
                </p>
                <p className="text-xs text-gray-500 truncate">{u.email}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={<Building2 className="w-4 h-4" />}
                onClick={() => void openMembers(u)}
              >
                Membresías
              </Button>
            </div>
          ))}
          {!users?.length && (
            <p className="py-6 text-center text-sm text-gray-500">No hay usuarios del sistema.</p>
          )}
        </div>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => !submitting && setModalOpen(false)}
        title={editing ? 'Editar cliente' : 'Nuevo cliente'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            placeholder="ej. Acme Corp"
          />
          <Input
            label="Dominio"
            value={form.domain}
            onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
            placeholder="ej. acme.local"
          />
          <Input
            label="Dirección"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <Input
            label="Teléfono"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          {formError && <p className="text-sm text-red-500">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={submitting}>
              {editing ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={membersModalOpen}
        onClose={() => !membersSaving && setMembersModalOpen(false)}
        title={membersUser ? `Membresías · ${membersUser.firstName} ${membersUser.lastName}` : 'Membresías'}
        size="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Marcá los clientes a los que este usuario puede acceder y definí su rol en cada uno.
          </p>
          <div className="max-h-80 overflow-y-auto space-y-2">
            {(companies ?? []).map((company) => {
              const membership = memberships.find((m) => m.companyId === company.id)
              const checked = Boolean(membership)
              return (
                <div
                  key={company.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 dark:border-gray-700 p-3 sm:flex-row sm:items-center"
                >
                  <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMembership(company.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="truncate font-medium">{company.name}</span>
                  </label>
                  {checked && membership && (
                    <div className="flex items-center gap-2">
                      <Select
                        label=""
                        className="!mb-0 min-w-[8rem]"
                        options={[
                          { value: 'admin', label: 'Admin' },
                          { value: 'operator', label: 'Operador' },
                          { value: 'viewer', label: 'Visualizador' },
                        ]}
                        value={membership.role}
                        onChange={(e) =>
                          setMembershipRole(company.id, e.target.value as MembershipDraft['role'])
                        }
                      />
                      <label className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <input
                          type="radio"
                          name="default-membership"
                          checked={membership.isDefault}
                          onChange={() => setDefaultMembership(company.id)}
                        />
                        Por defecto
                      </label>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          {membersError && <p className="text-sm text-red-500">{membersError}</p>}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setMembersModalOpen(false)}
              disabled={membersSaving}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={() => void saveMemberships()} isLoading={membersSaving}>
              Guardar membresías
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
