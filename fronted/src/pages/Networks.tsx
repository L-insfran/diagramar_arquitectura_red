import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { StatusBadge } from '../components/StatusBadge'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { useCompany } from '../contexts/CompanyContext'
import { networksService } from '../services/networks.service'
import type { Network } from '../types'

export default function Networks() {
  const navigate = useNavigate()
  const { canMutate, isAdmin } = usePermissions()
  const { activeCompanyId } = useCompany()
  const { data: networks, isLoading, refetch } = useApi(
    () => networksService.getAll(),
    [activeCompanyId]
  )
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = useCallback(
    async (network: Network) => {
      if (!canMutate || network.inUse) return
      const ok = window.confirm(
        `¿Eliminar la red "${network.name}"? Esta acción no se puede deshacer.`
      )
      if (!ok) return
      try {
        setDeletingId(network.id)
        await networksService.delete(network.id)
        refetch()
      } catch (error: unknown) {
        const message =
          (error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'No se pudo eliminar la red'
        window.alert(message)
      } finally {
        setDeletingId(null)
      }
    },
    [canMutate, refetch]
  )

  const columns: Column<Network>[] = [
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (n) => (
        <span className="font-medium text-gray-900 dark:text-white">{n.name}</span>
      ),
    },
    {
      key: 'subnet',
      header: 'Subnet',
      sortable: true,
      render: (n) => <span className="font-mono text-sm">{n.subnet}</span>,
    },
    {
      key: 'gateway',
      header: 'Gateway',
      render: (n) => (
        <span className="font-mono text-sm text-gray-500 dark:text-gray-400">
          {n.gateway || '—'}
        </span>
      ),
    },
    {
      key: 'vlan',
      header: 'VLAN',
      render: (n) =>
        n.vlan ? (
          <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
            VLAN {n.vlan.vlanId}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      key: 'dhcpEnabled',
      header: 'DHCP',
      render: (n) => (
        <StatusBadge status={n.dhcpEnabled ? 'online' : 'disabled'}>
          {n.dhcpEnabled ? 'Enabled' : 'Disabled'}
        </StatusBadge>
      ),
    },
    {
      key: 'inUse',
      header: 'Uso',
      render: (n) =>
        n.inUse ? (
          <span className="text-xs text-amber-500 dark:text-amber-400">En uso (VLAN en puertos)</span>
        ) : (
          <span className="text-xs text-gray-400">Libre</span>
        ),
    },
    ...(canMutate
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (n: Network) => (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant={'ghost' as const}
                  size={'sm' as const}
                  className="!p-2"
                  icon={<Pencil className="w-4 h-4" />}
                  onClick={(event: React.MouseEvent) => {
                    event.stopPropagation()
                    navigate(`/networks/${n.id}/edit`)
                  }}
                  aria-label={`Editar ${n.name}`}
                >
                  Editar
                </Button>
                {isAdmin && !n.inUse && (
                  <Button
                    type="button"
                    variant={'ghost' as const}
                    size={'sm' as const}
                    className="!p-2 text-red-500 hover:text-red-600 dark:text-red-400"
                    icon={<Trash2 className="w-4 h-4" />}
                    isLoading={deletingId === n.id}
                    disabled={deletingId !== null}
                    onClick={(event: React.MouseEvent) => {
                      event.stopPropagation()
                      void handleDelete(n)
                    }}
                    aria-label={`Eliminar ${n.name}`}
                  >
                    Eliminar
                  </Button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Networks"
        subtitle={`${networks?.length || 0} networks configured`}
        actions={
          canMutate ? (
            <Button
              icon={<Plus className="w-4 h-4" />}
              onClick={() => navigate('/networks/new')}
            >
              Agregar red
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={networks || []}
        isLoading={isLoading}
        emptyMessage="No networks configured yet"
        onRowClick={
          canMutate ? (network) => navigate(`/networks/${network.id}/edit`) : undefined
        }
      />
    </div>
  )
}
