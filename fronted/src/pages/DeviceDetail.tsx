import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Server, Cpu, MapPin, Hash, Clock, Pencil, Plus } from 'lucide-react'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { DataTable, type Column } from '../components/DataTable'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { devicesService } from '../services/devices.service'
import { portsService } from '../services/ports.service'
import type { Port } from '../types'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

const portTypeOptions: { value: Port['portType']; label: string }[] = [
  { value: 'ethernet', label: 'Ethernet' },
  { value: 'fiber', label: 'Fiber' },
  { value: 'serial', label: 'Serial' },
  { value: 'wireless', label: 'Wireless' },
  { value: 'wan', label: 'WAN' },
  { value: 'sfp', label: 'SFP' },
]

const portStatusOptions: { value: Port['status']; label: string }[] = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'disabled', label: 'Disabled' },
]

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canMutate, isViewer } = usePermissions()
  const { data: device, isLoading, refetch } = useApi(
    () => (id ? devicesService.getById(id) : Promise.reject(new Error('Missing device id'))),
    [id]
  )

  const [portModalOpen, setPortModalOpen] = useState(false)
  const [editingPortId, setEditingPortId] = useState<string | null>(null)
  const [portForm, setPortForm] = useState({
    name: '',
    portNumber: '',
    portType: 'ethernet' as Port['portType'],
    speed: '',
    status: 'down' as Port['status'],
    description: '',
  })
  const [portSubmitting, setPortSubmitting] = useState(false)
  const [portFormError, setPortFormError] = useState<string | null>(null)

  const portsSorted = useMemo(
    () => [...(device?.ports ?? [])].sort((a, b) => a.portNumber - b.portNumber),
    [device?.ports]
  )

  const resetPortForm = () => {
    setPortForm({
      name: '',
      portNumber: '',
      portType: 'ethernet',
      speed: '',
      status: 'down',
      description: '',
    })
    setPortFormError(null)
  }

  const closePortModal = () => {
    setPortModalOpen(false)
    setEditingPortId(null)
    resetPortForm()
  }

  const openAddPortModal = () => {
    setEditingPortId(null)
    resetPortForm()
    setPortModalOpen(true)
  }

  const openEditPortModal = (port: Port) => {
    setEditingPortId(port.id)
    setPortForm({
      name: port.name,
      portNumber: String(port.portNumber),
      portType: port.portType,
      speed: port.speed ?? '',
      status: port.status,
      description: port.description ?? '',
    })
    setPortFormError(null)
    setPortModalOpen(true)
  }

  const handlePortSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!device?.id) return

    const num = Number.parseInt(portForm.portNumber, 10)
    if (!portForm.name.trim() || Number.isNaN(num) || num < 1) {
      setPortFormError('Name and a valid port number (≥ 1) are required')
      return
    }

    try {
      setPortSubmitting(true)
      setPortFormError(null)
      if (editingPortId) {
        await portsService.update(editingPortId, {
          name: portForm.name.trim(),
          portNumber: num,
          portType: portForm.portType,
          speed: portForm.speed.trim() || null,
          status: portForm.status,
          description: portForm.description.trim() || undefined,
        })
      } else {
        await portsService.create({
          deviceId: device.id,
          name: portForm.name.trim(),
          portNumber: num,
          portType: portForm.portType,
          speed: portForm.speed.trim() || undefined,
          status: portForm.status,
          description: portForm.description.trim() || undefined,
        })
      }
      closePortModal()
      refetch()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      setPortFormError(message || (editingPortId ? 'Could not update port' : 'Could not create port'))
    } finally {
      setPortSubmitting(false)
    }
  }

  const portColumns: Column<Port>[] = [
    { key: 'name', header: 'Port', sortable: true },
    { key: 'portNumber', header: '#', sortable: true },
    {
      key: 'portType',
      header: 'Type',
      render: (p) => (
        <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">{p.portType}</span>
      ),
    },
    { key: 'speed', header: 'Speed', render: (p) => p.speed || '—' },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'description',
      header: 'Description',
      render: (p) => (
        <span className="text-gray-500 dark:text-gray-400 text-sm">{p.description || '—'}</span>
      ),
    },
    ...(canMutate
      ? [
          {
            key: 'actions',
            header: '',
            render: (p: Port) => (
              <Button
                type="button"
                variant={'ghost' as const}
                size={'sm' as const}
                className="!px-2"
                icon={<Pencil className="w-4 h-4" />}
                onClick={(e: React.MouseEvent) => {
                  e.stopPropagation()
                  openEditPortModal(p)
                }}
                aria-label={`Edit port ${p.name}`}
              >
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!device) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Device not found</p>
        <Button variant="ghost" onClick={() => navigate('/devices')} className="mt-4">
          Go back
        </Button>
      </div>
    )
  }

  const infoItems: { icon: LucideIcon; label: string; value: string | null | undefined }[] = [
    { icon: Server, label: 'Type', value: device.deviceType?.name },
    { icon: Hash, label: 'IP Address', value: device.ipAddress },
    {
      icon: Cpu,
      label: 'Model',
      value: `${device.manufacturer || ''} ${device.model || ''}`.trim() || undefined,
    },
    { icon: Hash, label: 'MAC Address', value: device.macAddress },
    { icon: Hash, label: 'Serial', value: device.serialNumber },
    { icon: MapPin, label: 'Location', value: device.location },
    { icon: Clock, label: 'Firmware', value: device.firmwareVersion },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => navigate('/devices')}
          icon={<ArrowLeft className="w-4 h-4" />}
        >
          Back
        </Button>
        {(canMutate || (isViewer && NOTEBOOK_NAMES.includes(device.deviceType?.name?.toLowerCase?.() ?? ''))) && (
          <Button
            variant="secondary"
            onClick={() => navigate(`/devices/${device.id}/edit`)}
            icon={<Pencil className="w-4 h-4" />}
          >
            Edit
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Server className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{device.name}</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {device.hostname || 'No hostname'}
              </p>
            </div>
          </div>
          <StatusBadge status={device.status} />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200 dark:border-gray-800">
          {infoItems.map((item, idx) => {
            const Icon = item.icon
            return (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                    {item.label}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  {item.value || '—'}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      {device.notes && (
        <Card title="Notes">
          <p className="text-sm text-gray-600 dark:text-gray-300">{device.notes}</p>
        </Card>
      )}

      {/* Ports */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ports ({portsSorted.length})
          </h2>
          {canMutate && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              icon={<Plus className="w-4 h-4" />}
              onClick={openAddPortModal}
            >
              Add port
            </Button>
          )}
        </div>
        <DataTable
          columns={portColumns}
          data={portsSorted}
          emptyMessage="No ports configured for this device"
        />
      </div>

      <Modal
        isOpen={portModalOpen}
        onClose={closePortModal}
        title={editingPortId ? 'Edit port' : 'Add port'}
        size="md"
      >
        <form className="space-y-4" onSubmit={handlePortSubmit}>
          {portFormError && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">
              {portFormError}
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Port name / label"
              value={portForm.name}
              onChange={(e) => setPortForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Gi0/1"
              required
            />
            <Input
              label="Port #"
              type="number"
              min={1}
              value={portForm.portNumber}
              onChange={(e) => setPortForm((p) => ({ ...p, portNumber: e.target.value }))}
              required
            />
            <Select
              label="Type"
              value={portForm.portType}
              onChange={(e) =>
                setPortForm((p) => ({ ...p, portType: e.target.value as Port['portType'] }))
              }
              options={portTypeOptions.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Select
              label="Status"
              value={portForm.status}
              onChange={(e) =>
                setPortForm((p) => ({ ...p, status: e.target.value as Port['status'] }))
              }
              options={portStatusOptions.map((o) => ({ value: o.value, label: o.label }))}
            />
            <Input
              label="Speed"
              value={portForm.speed}
              onChange={(e) => setPortForm((p) => ({ ...p, speed: e.target.value }))}
              placeholder="e.g. 1 Gbps"
              className="sm:col-span-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              value={portForm.description}
              onChange={(e) => setPortForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-colors resize-y min-h-[80px]"
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={closePortModal} disabled={portSubmitting}>
              Cancel
            </Button>
            <Button type="submit" isLoading={portSubmitting}>
              {editingPortId ? 'Save changes' : 'Create port'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Assigned Employees */}
      {device.employees && device.employees.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Assigned Employees
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {device.employees.map((emp) => (
              <div
                key={emp.id}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {emp.firstName.charAt(0)}
                  {emp.lastName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {emp.position || emp.email || '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
