import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { PageHeader } from '../components/PageHeader'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../contexts/AuthContext'
import { usePermissions } from '../hooks/usePermissions'
import { devicesService } from '../services/devices.service'
import { deviceTypesService } from '../services/device-types.service'
import type { DeviceType } from '../types'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

const statusOptions = [
  { value: 'online', label: 'Online' },
  { value: 'offline', label: 'Offline' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'unknown', label: 'Unknown' },
]

interface DeviceFormState {
  name: string
  deviceTypeId: string
  status: 'online' | 'offline' | 'maintenance' | 'unknown'
  hostname: string
  ipAddress: string
  macAddress: string
  manufacturer: string
  model: string
  serialNumber: string
  firmwareVersion: string
  location: string
  notes: string
}

const initialFormState: DeviceFormState = {
  name: '',
  deviceTypeId: '',
  status: 'unknown',
  hostname: '',
  ipAddress: '',
  macAddress: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  firmwareVersion: '',
  location: '',
  notes: '',
}

export default function DeviceCreate() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const { isViewer } = usePermissions()
  const isEditMode = Boolean(id)
  const { data: existingDevice, isLoading: isLoadingDevice } = useApi(
    () => (id ? devicesService.getById(id) : Promise.resolve(null)),
    [id]
  )
  const { data: allDeviceTypes, isLoading: typesLoading } = useApi<DeviceType[]>(
    () => deviceTypesService.getAll()
  )

  const deviceTypes = useMemo(() => {
    if (!allDeviceTypes) return null
    if (isViewer) return allDeviceTypes.filter((t) => NOTEBOOK_NAMES.includes(t.name.toLowerCase()))
    return allDeviceTypes
  }, [allDeviceTypes, isViewer])

  const preselectedType = searchParams.get('type')
  const [form, setForm] = useState(() => ({
    ...initialFormState,
    ...(preselectedType ? { deviceTypeId: preselectedType } : {}),
  }))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!existingDevice) {
      return
    }

    setForm({
      name: existingDevice.name ?? '',
      deviceTypeId: existingDevice.deviceTypeId ?? '',
      status: existingDevice.status ?? 'unknown',
      hostname: existingDevice.hostname ?? '',
      ipAddress: existingDevice.ipAddress ?? '',
      macAddress: existingDevice.macAddress ?? '',
      manufacturer: existingDevice.manufacturer ?? '',
      model: existingDevice.model ?? '',
      serialNumber: existingDevice.serialNumber ?? '',
      firmwareVersion: existingDevice.firmwareVersion ?? '',
      location: existingDevice.location ?? '',
      notes: existingDevice.notes ?? '',
    })
  }, [existingDevice])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(null)

    if (!user) {
      setFormError('Tu sesión ha caducado. Vuelve a iniciar sesión.')
      return
    }

    if (!form.name.trim() || !form.deviceTypeId) {
      setFormError('El nombre del dispositivo y el tipo son obligatorios.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        deviceTypeId: form.deviceTypeId,
        name: form.name.trim(),
        hostname: form.hostname.trim() || undefined,
        ipAddress: form.ipAddress.trim() || undefined,
        macAddress: form.macAddress.trim() || undefined,
        manufacturer: form.manufacturer.trim() || undefined,
        model: form.model.trim() || undefined,
        serialNumber: form.serialNumber.trim() || undefined,
        firmwareVersion: form.firmwareVersion.trim() || undefined,
        location: form.location.trim() || undefined,
        status: form.status,
        notes: form.notes.trim() || undefined,
      }

      if (id) {
        await devicesService.update(id, payload)
      } else {
        await devicesService.create({
          companyId: user.companyId,
          ...payload,
        })
      }
      navigate('/devices')
    } catch (error: any) {
      setFormError(
        error?.response?.data?.message ||
          error?.message ||
          `No se pudo ${isEditMode ? 'actualizar' : 'crear'} el dispositivo`
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const backToList = () => navigate('/devices')

  if (isEditMode && isLoadingDevice && !existingDevice) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={isEditMode ? 'Editar dispositivo' : 'Agregar dispositivo'}
        subtitle={
          isEditMode
            ? 'Actualiza la información del hardware en tu inventario'
            : 'Registra hardware nuevo y mantén tu inventario al día'
        }
        actions={
          <Button variant="ghost" onClick={backToList} size="sm">
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
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
            <Select
              label="Tipo de dispositivo"
              value={form.deviceTypeId}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, deviceTypeId: event.target.value }))
              }
              options={(deviceTypes || []).map((type) => ({ value: type.id, label: type.name }))}
              placeholder={typesLoading ? 'Cargando tipos...' : 'Selecciona un tipo'}
              disabled={typesLoading || !(deviceTypes && deviceTypes.length > 0)}
              required
            />
            <Select
              label="Estado"
              value={form.status}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, status: event.target.value as DeviceFormState['status'] }))
              }
              options={statusOptions}
            />
            <Input
              label="Dirección IP"
              value={form.ipAddress}
              onChange={(event) => setForm((prev) => ({ ...prev, ipAddress: event.target.value }))}
            />
            <Input
              label="Hostname"
              value={form.hostname}
              onChange={(event) => setForm((prev) => ({ ...prev, hostname: event.target.value }))}
            />
            <Input
              label="MAC Address"
              value={form.macAddress}
              onChange={(event) => setForm((prev) => ({ ...prev, macAddress: event.target.value }))}
            />
            <Input
              label="Fabricante"
              value={form.manufacturer}
              onChange={(event) => setForm((prev) => ({ ...prev, manufacturer: event.target.value }))}
            />
            <Input
              label="Modelo"
              value={form.model}
              onChange={(event) => setForm((prev) => ({ ...prev, model: event.target.value }))}
            />
            <Input
              label="Número de serie"
              value={form.serialNumber}
              onChange={(event) => setForm((prev) => ({ ...prev, serialNumber: event.target.value }))}
            />
            <Input
              label="Versión de firmware"
              value={form.firmwareVersion}
              onChange={(event) => setForm((prev) => ({ ...prev, firmwareVersion: event.target.value }))}
            />
            <Input
              label="Ubicación"
              value={form.location}
              onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notas</label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-vertical min-h-[120px]"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              rows={4}
            />
          </div>

          {formError && <p className="text-sm text-red-500">{formError}</p>}

          <div className="flex justify-end gap-3">
            <Button variant="ghost" size="md" onClick={backToList} type="button">
              Cancelar
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting || !form.name.trim() || !form.deviceTypeId}
            >
              {isEditMode ? 'Actualizar dispositivo' : 'Guardar dispositivo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
