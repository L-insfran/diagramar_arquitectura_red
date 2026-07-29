import { useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
  User,
} from 'lucide-react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { Modal } from '../components/Modal'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { employeesService } from '../services/employees.service'
import { employeeCredentialsService } from '../services/employee-credentials.service'
import type { EmployeeCredential, EmployeeCredentialKind } from '../types'

const KIND_LABELS: Record<EmployeeCredentialKind, string> = {
  file_server: 'Servidor de Archivos',
  vpn: 'VPN',
  email: 'Correo',
  rdp: 'Escritorio Remoto',
  other: 'Otro',
}

const KIND_COLORS: Record<EmployeeCredentialKind, string> = {
  file_server: 'bg-blue-500/10 text-blue-400',
  vpn: 'bg-green-500/10 text-green-400',
  email: 'bg-purple-500/10 text-purple-400',
  rdp: 'bg-orange-500/10 text-orange-400',
  other: 'bg-gray-500/10 text-gray-400',
}

const kindOptions = (Object.keys(KIND_LABELS) as EmployeeCredentialKind[]).map((k) => ({
  value: k,
  label: KIND_LABELS[k],
}))

const initialForm = {
  kind: 'file_server' as EmployeeCredentialKind,
  label: '',
  username: '',
  password: '',
  notes: '',
}

function formatError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string } } }
  return ax?.response?.data?.message || 'Ocurrió un error inesperado.'
}

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { activeCompanyId } = useCompany()

  const {
    data: employee,
    isLoading: loadingEmployee,
  } = useApi(
    () => (id ? employeesService.getById(id) : Promise.reject(new Error('No id'))),
    [id, activeCompanyId]
  )

  const {
    data: credentials,
    isLoading: loadingCreds,
    refetch: refetchCreds,
  } = useApi(
    () => (id ? employeeCredentialsService.getByEmployee(id) : Promise.resolve([])),
    [id, activeCompanyId]
  )

  // Modal state
  const [modalOpen, setModalOpen] = useState(false)
  const [editingCredId, setEditingCredId] = useState<string | null>(null)
  const [form, setForm] = useState(initialForm)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Revealed passwords per credential id
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [revealing, setRevealing] = useState<Record<string, boolean>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const canManage = user?.role === 'admin' || user?.role === 'operator'

  // ── Modal helpers ──────────────────────────────────────────────
  const openAddModal = () => {
    setEditingCredId(null)
    setForm(initialForm)
    setShowPassword(false)
    setFormError(null)
    setModalOpen(true)
  }

  const openEditModal = (cred: EmployeeCredential) => {
    setEditingCredId(cred.id)
    setForm({
      kind: cred.kind,
      label: cred.label ?? '',
      username: cred.username,
      password: '',
      notes: cred.notes ?? '',
    })
    setShowPassword(false)
    setFormError(null)
    setModalOpen(true)
  }

  const closeModal = () => {
    if (isSubmitting) return
    setModalOpen(false)
    setEditingCredId(null)
    setForm(initialForm)
    setFormError(null)
  }

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)

    if (!activeCompanyId || !id) return

    if (!form.username.trim()) {
      setFormError('El usuario es obligatorio.')
      return
    }
    if (!editingCredId && !form.password) {
      setFormError('La contraseña es obligatoria al crear.')
      return
    }

    try {
      setIsSubmitting(true)
      if (editingCredId) {
        await employeeCredentialsService.update(editingCredId, {
          kind: form.kind,
          label: form.label.trim() || null,
          username: form.username.trim(),
          ...(form.password ? { password: form.password } : {}),
          notes: form.notes.trim() || null,
        })
        // Clear any cached reveal for this credential
        setRevealed((prev) => {
          const copy = { ...prev }
          delete copy[editingCredId]
          return copy
        })
      } else {
        await employeeCredentialsService.create({
          employeeId: id,
          companyId: activeCompanyId,
          kind: form.kind,
          label: form.label.trim() || undefined,
          username: form.username.trim(),
          password: form.password,
          notes: form.notes.trim() || undefined,
        })
      }
      refetchCreds()
      closeModal()
    } catch (e) {
      setFormError(formatError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────
  const handleDelete = async (cred: EmployeeCredential) => {
    const ok = window.confirm(
      `¿Eliminar la credencial "${cred.label || cred.username}" (${KIND_LABELS[cred.kind]})? Esta acción no se puede deshacer.`
    )
    if (!ok) return
    try {
      await employeeCredentialsService.delete(cred.id)
      setRevealed((prev) => {
        const copy = { ...prev }
        delete copy[cred.id]
        return copy
      })
      refetchCreds()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  // ── Reveal password ────────────────────────────────────────────
  const handleReveal = async (cred: EmployeeCredential) => {
    if (revealed[cred.id]) {
      setRevealed((prev) => {
        const copy = { ...prev }
        delete copy[cred.id]
        return copy
      })
      return
    }
    setRevealing((prev) => ({ ...prev, [cred.id]: true }))
    try {
      const password = await employeeCredentialsService.reveal(cred.id)
      setRevealed((prev) => ({ ...prev, [cred.id]: password }))
    } catch (e) {
      window.alert(formatError(e))
    } finally {
      setRevealing((prev) => ({ ...prev, [cred.id]: false }))
    }
  }

  // ── Copy to clipboard ──────────────────────────────────────────
  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      /* silently fail */
    }
  }

  // ── Loading / not found ────────────────────────────────────────
  if (loadingEmployee) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Employee not found</p>
        <Button variant="ghost" onClick={() => navigate('/employees')} className="mt-4">
          Volver
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button
        variant="ghost"
        onClick={() => navigate('/employees')}
        icon={<ArrowLeft className="w-4 h-4" />}
      >
        Empleados
      </Button>

      {/* Employee info card */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0">
            {employee.firstName.charAt(0)}
            {employee.lastName.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {employee.firstName} {employee.lastName}
            </h1>
            {employee.position && (
              <p className="text-sm text-gray-500 dark:text-gray-400">{employee.position}</p>
            )}
          </div>
          {employee.department && (
            <span className="px-2.5 py-1 bg-purple-500/10 text-purple-400 rounded-lg text-xs font-medium">
              {employee.department.name}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          {employee.email && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <User className="w-4 h-4 shrink-0" />
              {employee.email}
            </div>
          )}
          {employee.phone && (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <KeyRound className="w-4 h-4 shrink-0" />
              {employee.phone}
            </div>
          )}
        </div>
      </div>

      {/* Credentials section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Credenciales de red
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Accesos a sistemas: servidor de archivos, VPN, correo, escritorio remoto
            </p>
          </div>
          {canManage && (
            <Button
              type="button"
              icon={<Plus className="w-4 h-4" />}
              onClick={openAddModal}
            >
              Agregar
            </Button>
          )}
        </div>

        {loadingCreds ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !credentials || credentials.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-10 text-center">
            <KeyRound className="w-8 h-8 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No hay credenciales registradas para este empleado
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {credentials.map((cred) => (
              <CredentialCard
                key={cred.id}
                credential={cred}
                revealedPassword={revealed[cred.id]}
                isRevealing={revealing[cred.id] ?? false}
                copiedKey={copied}
                canManage={canManage}
                onReveal={handleReveal}
                onCopy={handleCopy}
                onEdit={openEditModal}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title={editingCredId ? 'Editar credencial' : 'Nueva credencial de red'}
        size="md"
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Select
            label="Tipo de sistema"
            value={form.kind}
            onChange={(ev) =>
              setForm((f) => ({ ...f, kind: ev.target.value as EmployeeCredentialKind }))
            }
            options={kindOptions}
          />
          <Input
            label="Etiqueta (opcional)"
            placeholder='ej. "Servidor Contabilidad"'
            value={form.label}
            onChange={(ev) => setForm((f) => ({ ...f, label: ev.target.value }))}
          />
          <Input
            label="Usuario"
            value={form.username}
            onChange={(ev) => setForm((f) => ({ ...f, username: ev.target.value }))}
            autoComplete="off"
            required
          />
          {/* Password with toggle */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Contraseña{editingCredId && (
                <span className="text-gray-400 font-normal ml-1">(dejar vacío para no cambiar)</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={(ev) => setForm((f) => ({ ...f, password: ev.target.value }))}
                autoComplete="new-password"
                className="w-full px-3.5 py-2.5 pr-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors"
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
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notas (opcional)
            </label>
            <textarea
              value={form.notes}
              onChange={(ev) => setForm((f) => ({ ...f, notes: ev.target.value }))}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-none"
              placeholder="Dominio, share, observaciones..."
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
              {editingCredId ? 'Actualizar' : 'Guardar'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ── Credential card component ──────────────────────────────────────────────────

interface CredentialCardProps {
  credential: EmployeeCredential
  revealedPassword: string | undefined
  isRevealing: boolean
  copiedKey: string | null
  canManage: boolean
  onReveal: (cred: EmployeeCredential) => void
  onCopy: (text: string, key: string) => void
  onEdit: (cred: EmployeeCredential) => void
  onDelete: (cred: EmployeeCredential) => void
}

function CredentialCard({
  credential,
  revealedPassword,
  isRevealing,
  copiedKey,
  canManage,
  onReveal,
  onCopy,
  onEdit,
  onDelete,
}: CredentialCardProps) {
  const isVisible = Boolean(revealedPassword)
  const copyKeyUser = `user-${credential.id}`
  const copyKeyPass = `pass-${credential.id}`

  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span
            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${KIND_COLORS[credential.kind]}`}
          >
            {KIND_LABELS[credential.kind]}
          </span>
          {credential.label && (
            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
              {credential.label}
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => onEdit(credential)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Editar"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void onDelete(credential)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-500/10 transition-colors"
              aria-label="Eliminar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Username row */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 mb-0.5">Usuario</p>
          <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
            {credential.username}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onCopy(credential.username, copyKeyUser)}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors shrink-0"
          aria-label="Copiar usuario"
        >
          {copiedKey === copyKeyUser ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <Copy className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Password row */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-gray-400 mb-0.5">Contraseña</p>
          <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
            {isVisible ? revealedPassword : '••••••••••'}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {isVisible && (
            <button
              type="button"
              onClick={() => void onCopy(revealedPassword!, copyKeyPass)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Copiar contraseña"
            >
              {copiedKey === copyKeyPass ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => onReveal(credential)}
            disabled={isRevealing}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
            aria-label={isVisible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          >
            {isRevealing ? (
              <div className="w-3.5 h-3.5 border border-current border-t-transparent rounded-full animate-spin" />
            ) : isVisible ? (
              <EyeOff className="w-3.5 h-3.5" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Notes */}
      {credential.notes && (
        <p className="text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2">
          {credential.notes}
        </p>
      )}
    </div>
  )
}
