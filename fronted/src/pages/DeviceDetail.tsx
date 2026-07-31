import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowLeft, Server, Cpu, MapPin, Hash, Clock, Pencil, Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { DataTable, type Column } from '../components/DataTable'
import { Card } from '../components/Card'
import { Modal } from '../components/Modal'
import { Input } from '../components/Input'
import { Select } from '../components/Select'
import { ObjectDocsPanel } from '../components/ObjectDocsPanel'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { useProject } from '../contexts/ProjectContext'
import { useToast } from '../contexts/ToastContext'
import { devicesService } from '../services/devices.service'
import { portsService } from '../services/ports.service'
import { portTypesService } from '../services/port-types.service'
import { vlansService } from '../services/vlans.service'
import type { Port, PortType, Vlan } from '../types'

const NOTEBOOK_NAMES = ['notebook', 'notebock']

const FALLBACK_PORT_TYPES: { value: string; label: string }[] = [
  { value: 'ethernet', label: 'Ethernet' },
  { value: 'fiber', label: 'Fiber' },
  { value: 'serial', label: 'Serial' },
  { value: 'wireless', label: 'Wireless' },
  { value: 'wan', label: 'WAN' },
  { value: 'sfp', label: 'SFP' },
  { value: 'coaxial', label: 'Coaxil' },
]

const portStatusOptions: { value: Port['status']; label: string }[] = [
  { value: 'up', label: 'Up' },
  { value: 'down', label: 'Down' },
  { value: 'disabled', label: 'Disabled' },
]

type PortVlanFormRow = { vlanId: string; isTagged: boolean }

export default function DeviceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { canMutate, isViewer } = usePermissions()
  const { activeProjectId } = useProject()
  const toast = useToast()
  const { data: device, isLoading, refetch } = useApi(
    () => (id ? devicesService.getById(id) : Promise.reject(new Error('Missing device id'))),
    [id]
  )
  const { data: companyVlans } = useApi(
    () => {
      const projectId = device?.projectId || activeProjectId
      return projectId ? vlansService.getAll(projectId) : Promise.resolve([] as Vlan[])
    },
    [device?.projectId, activeProjectId]
  )
  const { data: catalogPortTypes } = useApi(() => portTypesService.getAll(), [])

  const [portModalOpen, setPortModalOpen] = useState(false)
  const [editingPortId, setEditingPortId] = useState<string | null>(null)
  const [portForm, setPortForm] = useState({
    name: '',
    portNumber: '',
    portType: 'ethernet',
    speed: '',
    status: 'down' as Port['status'],
    description: '',
    isPassthrough: false,
  })
  const [portVlanAssignments, setPortVlanAssignments] = useState<PortVlanFormRow[]>([])
  const [portSubmitting, setPortSubmitting] = useState(false)
  const [portFormError, setPortFormError] = useState<string | null>(null)
  const [bulkStatusSubmitting, setBulkStatusSubmitting] = useState<'up' | 'down' | null>(null)
  const [bulkPassthroughSubmitting, setBulkPassthroughSubmitting] = useState(false)

  const portsSorted = useMemo(
    () => [...(device?.ports ?? [])].sort((a, b) => a.portNumber - b.portNumber),
    [device?.ports]
  )

  const vlanOptions = useMemo(
    () =>
      [...(companyVlans ?? [])].sort(
        (a, b) => a.vlanId - b.vlanId || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      ),
    [companyVlans]
  )

  const portTypeOptions = useMemo(() => {
    if (catalogPortTypes?.length) {
      return [...catalogPortTypes]
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        .map((t: PortType) => ({ value: t.code, label: t.name }))
    }
    return FALLBACK_PORT_TYPES
  }, [catalogPortTypes])

  const portTypeLabel = (code: string) =>
    portTypeOptions.find((o) => o.value === code)?.label ?? code

  const resetPortForm = () => {
    setPortForm({
      name: '',
      portNumber: '',
      portType: portTypeOptions[0]?.value ?? 'ethernet',
      speed: '',
      status: 'down',
      description: '',
      isPassthrough: false,
    })
    setPortVlanAssignments([])
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
      isPassthrough: !!port.isPassthrough,
    })
    setPortVlanAssignments(
      (port.vlans ?? []).map((vlan) => ({
        vlanId: vlan.id,
        isTagged: !!vlan.isTagged,
      }))
    )
    setPortFormError(null)
    setPortModalOpen(true)
  }

  const togglePortVlan = (vlanId: string) => {
    setPortVlanAssignments((prev) => {
      const exists = prev.some((a) => a.vlanId === vlanId)
      if (exists) return prev.filter((a) => a.vlanId !== vlanId)
      const next = [...prev, { vlanId, isTagged: prev.length >= 1 }]
      // Access (1 VLAN) = untagged; trunk (2+) = tagged by default
      if (next.length === 1) return [{ vlanId: next[0].vlanId, isTagged: false }]
      return next.map((a) => ({ ...a, isTagged: true }))
    })
  }

  const togglePortVlanTagged = (vlanId: string) => {
    setPortVlanAssignments((prev) =>
      prev.map((a) => (a.vlanId === vlanId ? { ...a, isTagged: !a.isTagged } : a))
    )
  }

  const handlePortSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!device?.id) return

    const num = Number.parseInt(portForm.portNumber, 10)
    if (!portForm.name.trim() || Number.isNaN(num) || num < 1) {
      setPortFormError('Name and a valid port number (≥ 1) are required')
      return
    }

    const vlanAssignments = portVlanAssignments.map((a) => ({
      vlanId: a.vlanId,
      isTagged: a.isTagged,
    }))

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
          isPassthrough: portForm.isPassthrough,
          vlanAssignments,
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
          isPassthrough: portForm.isPassthrough,
          vlanAssignments,
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

  const handleBulkPortStatus = async (status: 'up' | 'down') => {
    if (!device?.id || portsSorted.length === 0) return

    const label = status === 'up' ? 'Up' : 'Down'
    const ok = window.confirm(
      `¿Poner los ${portsSorted.length} puertos de este dispositivo en ${label}?`
    )
    if (!ok) return

    try {
      setBulkStatusSubmitting(status)
      const result = await portsService.bulkUpdateStatus(device.id, status)
      toast.success(
        `Puertos en ${label}`,
        `Se actualizaron ${result.updatedCount} puerto${result.updatedCount === 1 ? '' : 's'}.`
      )
      refetch()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error('No se pudo actualizar el status', message || 'Intenta de nuevo.')
    } finally {
      setBulkStatusSubmitting(null)
    }
  }

  const handleBulkPassthrough = async (isPassthrough: boolean) => {
    if (!device?.id || portsSorted.length === 0) return
    const label = isPassthrough ? 'puente (front/rear)' : 'normal (1 cara)'
    const ok = window.confirm(
      `¿Marcar los ${portsSorted.length} puertos de este dispositivo como ${label}?`
    )
    if (!ok) return

    try {
      setBulkPassthroughSubmitting(true)
      const result = await portsService.bulkUpdatePassthrough(device.id, isPassthrough)
      toast.success(
        isPassthrough ? 'Puertos puente' : 'Marca puente quitada',
        `Se actualizaron ${result.updatedCount} puerto${result.updatedCount === 1 ? '' : 's'}.`
      )
      refetch()
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined
      toast.error('No se pudo actualizar passthrough', message || 'Intenta de nuevo.')
    } finally {
      setBulkPassthroughSubmitting(false)
    }
  }

  const portColumns: Column<Port>[] = [
    { key: 'name', header: 'Port', sortable: true },
    { key: 'portNumber', header: '#', sortable: true },
    {
      key: 'portType',
      header: 'Type',
      render: (p) => (
        <span className="inline-flex flex-wrap items-center gap-1">
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-xs">
            {portTypeLabel(p.portType)}
          </span>
          {p.isPassthrough ? (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
              Puente
            </span>
          ) : null}
        </span>
      ),
    },
    { key: 'speed', header: 'Speed', render: (p) => p.speed || '—' },
    { key: 'status', header: 'Status', render: (p) => <StatusBadge status={p.status} /> },
    {
      key: 'vlans',
      header: 'VLANs',
      render: (p) =>
        p.vlans?.length ? (
          <div className="flex flex-wrap gap-1">
            {p.vlans.map((vlan) => (
              <span
                key={vlan.id}
                className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-300"
                title={vlan.isTagged ? 'Tagged (trunk)' : 'Untagged (access)'}
              >
                {vlan.name} · {vlan.vlanId}
                {vlan.isTagged ? ' T' : ''}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-gray-400">—</span>
        ),
    },
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
    {
      icon: Cpu,
      label: 'Template',
      value: device.deviceTemplate?.name || undefined,
    },
    { icon: Hash, label: 'IP Address', value: device.ipAddress },
    {
      icon: Cpu,
      label: 'Model',
      value: `${device.manufacturer || ''} ${device.model || ''}`.trim() || undefined,
    },
    {
      icon: Hash,
      label: 'Rack units',
      value:
        device.deviceTemplate?.rackUnits != null
          ? `${device.deviceTemplate.rackUnits}U`
          : undefined,
    },
    {
      icon: MapPin,
      label: 'Sitio / Área',
      value:
        [device.site?.name, device.area?.name].filter(Boolean).join(' › ') ||
        device.location ||
        undefined,
    },
    {
      icon: Server,
      label: 'Rack',
      value: device.rack
        ? `${device.rack.name} · U${device.rackUnitStart ?? '?'}${
            device.deviceTemplate?.rackUnits
              ? `–${(device.rackUnitStart ?? 1) + device.deviceTemplate.rackUnits - 1}`
              : ''
          } (${device.rackFace ?? 'front'})`
        : undefined,
    },
    { icon: Hash, label: 'MAC Address', value: device.macAddress },
    { icon: Hash, label: 'Serial', value: device.serialNumber },
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

      {device.notes && (
        <Card title="Notes">
          <p className="text-sm text-gray-600 dark:text-gray-300">{device.notes}</p>
        </Card>
      )}

      <ObjectDocsPanel
        attachableType="device"
        attachableId={device.id}
        title="Documentación del dispositivo"
      />

      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Ports ({portsSorted.length})
          </h2>
          {canMutate && (
            <div className="flex flex-wrap items-center gap-2">
              {portsSorted.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    icon={<ArrowUp className="w-4 h-4" />}
                    isLoading={bulkStatusSubmitting === 'up'}
                    disabled={bulkStatusSubmitting !== null || bulkPassthroughSubmitting}
                    onClick={() => handleBulkPortStatus('up')}
                  >
                    All Up
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    icon={<ArrowDown className="w-4 h-4" />}
                    isLoading={bulkStatusSubmitting === 'down'}
                    disabled={bulkStatusSubmitting !== null || bulkPassthroughSubmitting}
                    onClick={() => handleBulkPortStatus('down')}
                  >
                    All Down
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    isLoading={bulkPassthroughSubmitting}
                    disabled={bulkStatusSubmitting !== null || bulkPassthroughSubmitting}
                    onClick={() => void handleBulkPassthrough(true)}
                  >
                    Marcar todos puente
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                icon={<Plus className="w-4 h-4" />}
                onClick={openAddPortModal}
              >
                Add port
              </Button>
            </div>
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
        <form className="space-y-4 max-h-[75vh] overflow-y-auto pr-1" onSubmit={handlePortSubmit}>
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
                setPortForm((p) => ({ ...p, portType: e.target.value }))
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
          <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/40 px-3 py-2.5">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
              checked={portForm.isPassthrough}
              onChange={(e) =>
                setPortForm((p) => ({ ...p, isPassthrough: e.target.checked }))
              }
            />
            <span className="text-sm text-gray-800 dark:text-gray-100">
              <span className="font-medium">Puerto puente (front/rear)</span>
              <span className="block text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Patch panel / jack passthrough: admite una conexión física por cara.
              </span>
            </span>
          </label>
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

          <div className="rounded-xl border border-violet-200/80 bg-violet-50/40 p-4 dark:border-violet-900/50 dark:bg-violet-950/20 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                VLANs del puerto
              </p>
              <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                Estas VLANs se muestran en topología y en la tabla de conexiones. Access = 1 VLAN
                untagged; Trunk = varias (tagged).
              </p>
            </div>
            {vlanOptions.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                No hay VLANs en el inventario. Creá VLANs en el menú VLANs y volvé a editar el puerto.
              </p>
            ) : (
              <ul className="max-h-48 space-y-2 overflow-y-auto pr-1">
                {vlanOptions.map((vlan) => {
                  const selected = portVlanAssignments.find((a) => a.vlanId === vlan.id)
                  return (
                    <li
                      key={vlan.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-gray-700 dark:bg-gray-900"
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm text-gray-800 dark:text-gray-100">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                          checked={!!selected}
                          onChange={() => togglePortVlan(vlan.id)}
                        />
                        <span className="truncate">
                          {vlan.name} <span className="text-gray-500">#{vlan.vlanId}</span>
                        </span>
                      </label>
                      {selected ? (
                        <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                          <input
                            type="checkbox"
                            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                            checked={selected.isTagged}
                            onChange={() => togglePortVlanTagged(vlan.id)}
                          />
                          Tagged
                        </label>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
            {portVlanAssignments.length > 0 ? (
              <p className="text-[11px] text-violet-700 dark:text-violet-300">
                {portVlanAssignments.length === 1 && !portVlanAssignments[0].isTagged
                  ? 'Modo access (1 VLAN untagged)'
                  : `Modo trunk · ${portVlanAssignments.length} VLAN(s)`}
              </p>
            ) : null}
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
