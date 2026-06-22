import { Pencil, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { vlansService } from '../services/vlans.service'
import type { Vlan } from '../types'

export default function Vlans() {
  const navigate = useNavigate()
  const { canMutate } = usePermissions()
  const { data: vlans, isLoading } = useApi(() => vlansService.getAll())

  const columns: Column<Vlan>[] = [
    {
      key: 'vlanId',
      header: 'VLAN ID',
      sortable: true,
      render: (v) => (
        <span className="font-mono font-semibold text-blue-500">{v.vlanId}</span>
      ),
    },
    {
      key: 'name',
      header: 'Name',
      sortable: true,
      render: (v) => (
        <span className="font-medium text-gray-900 dark:text-white">{v.name}</span>
      ),
    },
    {
      key: 'description',
      header: 'Description',
      render: (v) => (
        <span className="text-gray-500 dark:text-gray-400">{v.description || '—'}</span>
      ),
    },
    {
      key: 'networks',
      header: 'Networks',
      render: (v) => {
        const count = v.networks?.length ?? 0
        if (!canMutate) {
          return (
            <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
              {count}
            </span>
          )
        }
        return (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-xs font-medium hover:bg-blue-500/20 transition-colors"
            title="Las subredes (IP) se definen en Redes. Clic para añadir una red a esta VLAN."
            onClick={(event) => {
              event.stopPropagation()
              navigate(`/networks/new?vlanId=${v.id}`)
            }}
          >
            <span>{count}</span>
            <Plus className="w-3 h-3 opacity-80" aria-hidden />
          </button>
        )
      },
    },
    ...(canMutate
      ? [
          {
            key: 'actions',
            header: 'Actions',
            render: (v: Vlan) => (
              <Button
                type="button"
                variant={'ghost' as const}
                size={'sm' as const}
                className="!p-2"
                icon={<Pencil className="w-4 h-4" />}
                onClick={(event: React.MouseEvent) => {
                  event.stopPropagation()
                  navigate(`/vlans/${v.id}/edit`)
                }}
                aria-label={`Edit ${v.name}`}
              >
                Edit
              </Button>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="VLANs"
        subtitle={`${vlans?.length || 0} VLANs configured`}
        actions={
          canMutate ? (
            <Button icon={<Plus className="w-4 h-4" />} onClick={() => navigate('/vlans/new')}>
              Add VLAN
            </Button>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        data={vlans || []}
        isLoading={isLoading}
        emptyMessage="No VLANs configured yet"
        onRowClick={canMutate ? (vlan) => navigate(`/vlans/${vlan.id}/edit`) : undefined}
      />
    </div>
  )
}
