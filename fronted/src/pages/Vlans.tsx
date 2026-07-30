import { useState } from 'react'
import { FileText, Pencil, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Modal } from '../components/Modal'
import { ObjectDocsPanel } from '../components/ObjectDocsPanel'
import { useApi } from '../hooks/useApi'
import { usePermissions } from '../hooks/usePermissions'
import { useProject } from '../contexts/ProjectContext'
import { vlansService } from '../services/vlans.service'
import type { Vlan } from '../types'

export default function Vlans() {
  const navigate = useNavigate()
  const { canMutate } = usePermissions()
  const { activeProjectId } = useProject()
  const { data: vlans, isLoading } = useApi(() => vlansService.getAll(), [activeProjectId])
  const [docsVlan, setDocsVlan] = useState<Vlan | null>(null)

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
        <span className="text-sm text-gray-500 dark:text-gray-400">{v.description || '—'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (v) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<FileText className="w-4 h-4" />}
            onClick={(event) => {
              event.stopPropagation()
              setDocsVlan(v)
            }}
          >
            Docs
          </Button>
          {canMutate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="!p-2"
              icon={<Pencil className="w-4 h-4" />}
              onClick={(event) => {
                event.stopPropagation()
                navigate(`/vlans/${v.id}/edit`)
              }}
              aria-label={`Edit ${v.name}`}
            >
              Edit
            </Button>
          )}
        </div>
      ),
    },
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

      <Modal
        isOpen={Boolean(docsVlan)}
        onClose={() => setDocsVlan(null)}
        title={docsVlan ? `Documentación — ${docsVlan.name}` : 'Documentación'}
        size="lg"
      >
        {docsVlan && (
          <ObjectDocsPanel attachableType="vlan" attachableId={docsVlan.id} title="VLAN" />
        )}
      </Modal>
    </div>
  )
}
