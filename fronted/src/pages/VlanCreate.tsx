import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useProject } from '../contexts/ProjectContext'
import { vlansService } from '../services/vlans.service'

interface VlanFormState {
  vlanId: string
  name: string
  description: string
}

const initialFormState: VlanFormState = {
  vlanId: '',
  name: '',
  description: '',
}

export default function VlanCreate() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { activeProjectId } = useProject()
  const isEditMode = Boolean(id)
  const { data: existingVlan, isLoading: isLoadingVlan } = useApi(
    () => (id ? vlansService.getById(id) : Promise.resolve(null)),
    [id]
  )
  const [form, setForm] = useState(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!existingVlan) {
      return
    }

    setForm({
      vlanId: String(existingVlan.vlanId),
      name: existingVlan.name ?? '',
      description: existingVlan.description ?? '',
    })
  }, [existingVlan])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!user) {
      setFormError('Tu sesión ha caducado. Vuelve a iniciar sesión.')
      return
    }

    if (!isEditMode && !activeProjectId) {
      setFormError('Selecciona un proyecto activo antes de crear una VLAN.')
      return
    }

    if (!form.vlanId.trim() || !form.name.trim()) {
      setFormError('El ID y el nombre de la VLAN son obligatorios.')
      return
    }

    const vlanIdNumber = Number(form.vlanId)
    if (!Number.isInteger(vlanIdNumber) || vlanIdNumber < 1 || vlanIdNumber > 4094) {
      setFormError('El ID de VLAN debe ser un número entero entre 1 y 4094.')
      return
    }

    try {
      setIsSubmitting(true)
      if (id) {
        await vlansService.update(id, {
          vlanId: vlanIdNumber,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        })
      } else {
        await vlansService.create({
          projectId: activeProjectId,
          vlanId: vlanIdNumber,
          name: form.name.trim(),
          description: form.description.trim() || undefined,
        })
      }
      navigate('/vlans')
    } catch (error: any) {
      setFormError(
        error?.response?.data?.message ||
          error?.message ||
          `No se pudo ${isEditMode ? 'actualizar' : 'crear'} la VLAN`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const goBack = () => navigate('/vlans')

  if (isEditMode && isLoadingVlan && !existingVlan) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? 'Editar VLAN' : 'Agregar VLAN'}
        subtitle={
          isEditMode
            ? 'Actualiza la configuración del segmento lógico'
            : 'Define segmentos de red lógicos para tu proyecto'
        }
        actions={
          <Button variant="ghost" size="sm" onClick={goBack}>
            Cancelar
          </Button>
        }
      />

      {!isEditMode && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
          <p>
            Las <strong>subredes IP</strong> (por ejemplo <code className="text-xs">192.168.10.0/24</code>) no se
            definen en esta pantalla. Después de crear la VLAN, ve a{' '}
            <Link to="/networks/new" className="text-blue-500 hover:underline font-medium">
              Redes → Agregar red
            </Link>{' '}
            y elige la VLAN en el campo &quot;VLAN asociada&quot;.
          </p>
        </div>
      )}

      {isEditMode && id && (
        <div className="rounded-lg border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50 px-4 py-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Redes IP en esta VLAN</h2>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => navigate(`/networks/new?vlanId=${id}`)}
            >
              Añadir red
            </Button>
          </div>
          {existingVlan?.networks && existingVlan.networks.length > 0 ? (
            <ul className="text-sm space-y-2">
              {existingVlan.networks.map((net) => (
                <li key={net.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-white">{net.name}</span>
                  <span className="font-mono text-gray-500 dark:text-gray-400">{net.subnet}</span>
                  <Link
                    to={`/networks/${net.id}/edit`}
                    className="text-blue-500 hover:underline text-xs font-medium"
                  >
                    Editar
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Aún no hay redes vinculadas. Usa &quot;Añadir red&quot; para registrar la subred y gateway.
            </p>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Input
              label="ID de VLAN"
              type="number"
              min={1}
              max={4094}
              value={form.vlanId}
              onChange={(event) => setForm((prev) => ({ ...prev, vlanId: event.target.value }))}
              required
            />
            <Input
              label="Nombre"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-vertical min-h-[120px]"
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={4}
            />
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="md" type="button" onClick={goBack}>
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !form.vlanId.trim() || !form.name.trim()}
            >
              {isEditMode ? 'Actualizar VLAN' : 'Guardar VLAN'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
