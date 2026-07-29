import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { useCompany } from '../contexts/CompanyContext'
import { networksService } from '../services/networks.service'
import { vlansService } from '../services/vlans.service'
import type { Vlan } from '../types'

interface NetworkFormState {
  name: string
  subnet: string
  gateway: string
  dnsPrimary: string
  dnsSecondary: string
  description: string
  vlanId: string
  dhcpEnabled: boolean
}

const initialFormState: NetworkFormState = {
  name: '',
  subnet: '',
  gateway: '',
  dnsPrimary: '',
  dnsSecondary: '',
  description: '',
  vlanId: '',
  dhcpEnabled: false,
}

export default function NetworkCreate() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user, isLoading: authLoading } = useAuth()
  const { activeCompanyId } = useCompany()
  const isEditMode = Boolean(id)
  const isAdmin = user?.role === 'admin'
  const { data: existingNetwork, isLoading: isLoadingNetwork } = useApi(
    () => (id ? networksService.getById(id) : Promise.resolve(null)),
    [id]
  )
  const { data: vlanData, isLoading: vlansLoading } = useApi<Vlan[]>(
    () => {
      if (!activeCompanyId) {
        return Promise.resolve([])
      }
      return vlansService.getAll(activeCompanyId)
    },
    [activeCompanyId]
  )
  const [form, setForm] = useState(initialFormState)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const vlans = vlanData ?? []

  useEffect(() => {
    if (authLoading) return
    if (!user || user.role !== 'admin') {
      navigate('/networks', { replace: true })
    }
  }, [authLoading, user, navigate])

  /** Misma instancia de componente para /new y /:id/edit: limpiar al entrar en “nueva red”. */
  useEffect(() => {
    if (id) return
    setForm(initialFormState)
  }, [location.key, id])

  /** VLAN 802.1Q 1 = nativa / por defecto */
  const nativeVlan = useMemo(() => vlans.find((v) => v.vlanId === 1), [vlans])
  const nativeVlanUuid = nativeVlan?.id ?? ''

  useEffect(() => {
    if (!existingNetwork) {
      return
    }

    setForm({
      name: existingNetwork.name ?? '',
      subnet: existingNetwork.subnet ?? '',
      gateway: existingNetwork.gateway ?? '',
      dnsPrimary: existingNetwork.dnsPrimary ?? '',
      dnsSecondary: existingNetwork.dnsSecondary ?? '',
      description: existingNetwork.description ?? '',
      vlanId: existingNetwork.vlanId ?? '',
      dhcpEnabled: existingNetwork.dhcpEnabled ?? false,
    })
  }, [existingNetwork])

  useEffect(() => {
    if (!existingNetwork || !isEditMode) return
    if (existingNetwork.vlanId) return
    if (!nativeVlanUuid) return
    setForm((prev) => ({ ...prev, vlanId: nativeVlanUuid }))
  }, [existingNetwork, isEditMode, nativeVlanUuid])

  const vlanIdFromQuery = searchParams.get('vlanId')

  useEffect(() => {
    if (isEditMode || !vlanIdFromQuery) {
      return
    }
    setForm((prev) => ({ ...prev, vlanId: vlanIdFromQuery }))
  }, [isEditMode, vlanIdFromQuery])

  useEffect(() => {
    if (isEditMode || vlanIdFromQuery || !nativeVlanUuid) return
    setForm((prev) => ({ ...prev, vlanId: nativeVlanUuid }))
  }, [isEditMode, vlanIdFromQuery, nativeVlanUuid])

  const hasRequiredFields = useMemo(
    () => form.name.trim().length > 0 && form.subnet.trim().length > 0,
    [form.name, form.subnet]
  )

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!user) {
      setFormError('Tu sesión ha caducado. Vuelve a iniciar sesión.')
      return
    }

    if (!isEditMode && !activeCompanyId) {
      setFormError('Selecciona un cliente activo antes de crear una red.')
      return
    }

    if (!hasRequiredFields) {
      setFormError('Nombre y subred son obligatorios.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        name: form.name.trim(),
        subnet: form.subnet.trim(),
        gateway: form.gateway.trim() || undefined,
        dnsPrimary: form.dnsPrimary.trim() || undefined,
        dnsSecondary: form.dnsSecondary.trim() || undefined,
        description: form.description.trim() || undefined,
        vlanId: form.vlanId || nativeVlanUuid || undefined,
        dhcpEnabled: form.dhcpEnabled,
      }

      if (id) {
        await networksService.update(id, payload)
      } else {
        await networksService.create({
          companyId: activeCompanyId,
          ...payload,
        })
      }
      navigate('/networks')
    } catch (error: any) {
      setFormError(
        error?.response?.data?.message ||
          error?.message ||
          `No se pudo ${isEditMode ? 'actualizar' : 'crear'} la red`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const goBack = () => navigate('/networks')

  const vlanOptions = useMemo(() => {
    const rest = vlans
      .filter((v) => v.vlanId !== 1)
      .sort((a, b) => a.vlanId - b.vlanId)
      .map((vlan) => ({
        label: `VLAN ${vlan.vlanId} · ${vlan.name}`,
        value: vlan.id,
      }))
    if (!nativeVlanUuid) {
      return rest
    }
    const nativeLabel = `VLAN 1 · ${nativeVlan?.name?.trim() || 'vlan default'}`
    return [{ label: nativeLabel, value: nativeVlanUuid }, ...rest]
  }, [vlans, nativeVlanUuid, nativeVlan?.name])

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (user && !isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-gray-500 dark:text-gray-400">
        Redirigiendo…
      </div>
    )
  }

  if (isEditMode && isLoadingNetwork && !existingNetwork) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? 'Editar red' : 'Agregar red'}
        subtitle={
          isEditMode
            ? 'Actualiza la configuración de la red'
            : 'Define una red dentro de tu VLAN'
        }
        actions={
          <Button variant="ghost" size="sm" onClick={goBack}>
            Cancelar
          </Button>
        }
      />

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <form className="space-y-6" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Input
              label="Nombre"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              required
            />
            <Input
              label="Subred"
              placeholder="192.168.10.0/24"
              value={form.subnet}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, subnet: event.target.value }))
              }
              required
            />
            <Select
              label="VLAN asociada"
              value={form.vlanId || nativeVlanUuid || ''}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, vlanId: event.target.value }))
              }
              options={vlanOptions}
              placeholder={vlansLoading ? 'Cargando VLANs...' : undefined}
              disabled={vlansLoading}
            />
            <Input
              label="Gateway"
              value={form.gateway}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, gateway: event.target.value }))
              }
            />
            <Input
              label="DNS primario"
              value={form.dnsPrimary}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dnsPrimary: event.target.value }))
              }
            />
            <Input
              label="DNS secundario"
              value={form.dnsSecondary}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dnsSecondary: event.target.value }))
              }
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              id="dhcpEnabled"
              type="checkbox"
              checked={form.dhcpEnabled}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, dhcpEnabled: event.target.checked }))
              }
              className="h-4 w-4 text-blue-600 border-gray-300 rounded bg-white dark:bg-gray-700 focus:ring-blue-500"
            />
            <label htmlFor="dhcpEnabled" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Habilitar DHCP
            </label>
            <span className="text-xs text-gray-400">(si está desactivado, deberás configurar IPs manualmente)</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-vertical min-h-[120px]"
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              rows={4}
            />
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="md" type="button" onClick={goBack}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting || !hasRequiredFields}>
              {isEditMode ? 'Actualizar red' : 'Guardar red'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
