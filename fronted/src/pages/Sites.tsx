import { useState } from 'react'
import type { FormEvent } from 'react'
import { Plus, Pencil, Trash2, MapPin, Building2, FileText } from 'lucide-react'
import { PageHeader } from '../components/PageHeader'
import { DataTable, type Column } from '../components/DataTable'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { Modal } from '../components/Modal'
import { ObjectDocsPanel } from '../components/ObjectDocsPanel'
import { useApi } from '../hooks/useApi'
import { useProject } from '../contexts/ProjectContext'
import { sitesService } from '../services/sites.service'
import type { Area, Site } from '../types'

const initialSiteForm = { name: '', address: '', notes: '' }
const initialAreaForm = { name: '', notes: '' }

function formatError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string } } }
  return ax?.response?.data?.message || 'Ocurrió un error inesperado.'
}

export default function Sites() {
  const { activeProjectId } = useProject()
  const {
    data: sites,
    isLoading,
    error,
    refetch,
  } = useApi(() => sitesService.getAll(), [activeProjectId])

  const [siteModalOpen, setSiteModalOpen] = useState(false)
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null)
  const [siteForm, setSiteForm] = useState(initialSiteForm)
  const [siteError, setSiteError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [areasModalOpen, setAreasModalOpen] = useState(false)
  const [areasSite, setAreasSite] = useState<Site | null>(null)
  const [areas, setAreas] = useState<Area[]>([])
  const [areaForm, setAreaForm] = useState(initialAreaForm)
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null)
  const [areaError, setAreaError] = useState<string | null>(null)
  const [areasLoading, setAreasLoading] = useState(false)

  const [docsSite, setDocsSite] = useState<Site | null>(null)

  const openCreateSite = () => {
    setEditingSiteId(null)
    setSiteForm(initialSiteForm)
    setSiteError(null)
    setSiteModalOpen(true)
  }

  const openEditSite = (site: Site) => {
    setEditingSiteId(site.id)
    setSiteForm({
      name: site.name,
      address: site.address || '',
      notes: site.notes || '',
    })
    setSiteError(null)
    setSiteModalOpen(true)
  }

  const closeSiteModal = () => {
    if (isSubmitting) return
    setSiteModalOpen(false)
    setEditingSiteId(null)
    setSiteForm(initialSiteForm)
    setSiteError(null)
  }

  const handleSiteSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSiteError(null)
    const name = siteForm.name.trim()
    if (!name) {
      setSiteError('El nombre es obligatorio.')
      return
    }
    if (!activeProjectId) {
      setSiteError('Selecciona un proyecto activo.')
      return
    }

    try {
      setIsSubmitting(true)
      const payload = {
        name,
        address: siteForm.address.trim() || null,
        notes: siteForm.notes.trim() || null,
      }
      if (editingSiteId) {
        await sitesService.update(editingSiteId, payload)
      } else {
        await sitesService.create({ projectId: activeProjectId, ...payload })
      }
      refetch()
      closeSiteModal()
    } catch (e) {
      setSiteError(formatError(e))
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteSite = async (site: Site) => {
    const ok = window.confirm(
      `¿Eliminar el sitio "${site.name}"? Debe estar sin áreas ni dispositivos activos.`
    )
    if (!ok) return
    try {
      await sitesService.delete(site.id)
      refetch()
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const openAreasModal = async (site: Site) => {
    setAreasSite(site)
    setAreas(site.areas ?? [])
    setAreaForm(initialAreaForm)
    setEditingAreaId(null)
    setAreaError(null)
    setAreasModalOpen(true)
    setAreasLoading(true)
    try {
      const list = await sitesService.getAreas(site.id)
      setAreas(list)
    } catch (e) {
      setAreaError(formatError(e))
    } finally {
      setAreasLoading(false)
    }
  }

  const closeAreasModal = () => {
    setAreasModalOpen(false)
    setAreasSite(null)
    setAreas([])
    setEditingAreaId(null)
    setAreaForm(initialAreaForm)
    setAreaError(null)
    refetch()
  }

  const startEditArea = (area: Area) => {
    setEditingAreaId(area.id)
    setAreaForm({ name: area.name, notes: area.notes || '' })
    setAreaError(null)
  }

  const handleAreaSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!areasSite) return
    setAreaError(null)
    const name = areaForm.name.trim()
    if (!name) {
      setAreaError('El nombre del área es obligatorio.')
      return
    }
    const payload = { name, notes: areaForm.notes.trim() || null }
    try {
      if (editingAreaId) {
        await sitesService.updateArea(areasSite.id, editingAreaId, payload)
      } else {
        await sitesService.createArea(areasSite.id, payload)
      }
      const list = await sitesService.getAreas(areasSite.id)
      setAreas(list)
      setEditingAreaId(null)
      setAreaForm(initialAreaForm)
    } catch (e) {
      setAreaError(formatError(e))
    }
  }

  const handleDeleteArea = async (area: Area) => {
    if (!areasSite) return
    const ok = window.confirm(`¿Eliminar el área "${area.name}"?`)
    if (!ok) return
    try {
      await sitesService.deleteArea(areasSite.id, area.id)
      setAreas((prev) => prev.filter((a) => a.id !== area.id))
    } catch (e) {
      window.alert(formatError(e))
    }
  }

  const columns: Column<Site>[] = [
    {
      key: 'name',
      header: 'Sitio',
      sortable: true,
      render: (site) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
            <Building2 className="w-4 h-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 dark:text-white truncate">{site.name}</p>
            {site.address && (
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{site.address}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'areas',
      header: 'Áreas',
      render: (site) => (
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {site.areas?.length ?? 0}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Acciones',
      render: (site) => (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<FileText className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              setDocsSite(site)
            }}
          >
            Docs
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<MapPin className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              void openAreasModal(site)
            }}
          >
            Áreas
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2"
            icon={<Pencil className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              openEditSite(site)
            }}
          >
            Editar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="!p-2 text-red-500 hover:text-red-600 hover:bg-red-500/10"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={(ev) => {
              ev.stopPropagation()
              void handleDeleteSite(site)
            }}
          >
            Eliminar
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sitios y áreas"
        subtitle={`${sites?.length || 0} sitios · inventario físico (no confundir con zonas del diagrama)`}
        actions={
          <Button type="button" icon={<Plus className="w-4 h-4" />} onClick={openCreateSite}>
            Nuevo sitio
          </Button>
        }
      />

      {error && <p className="text-sm text-red-500">No se pudieron cargar los sitios.</p>}

      <DataTable
        columns={columns}
        data={sites || []}
        isLoading={isLoading}
        emptyMessage="No hay sitios. Crea sedes o edificios para ubicar equipos."
      />

      <Modal
        isOpen={siteModalOpen}
        onClose={closeSiteModal}
        title={editingSiteId ? 'Editar sitio' : 'Nuevo sitio'}
      >
        <form className="space-y-4" onSubmit={handleSiteSubmit}>
          <Input
            label="Nombre"
            value={siteForm.name}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, name: e.target.value }))}
            required
            placeholder="Sede Central"
          />
          <Input
            label="Dirección"
            value={siteForm.address}
            onChange={(e) => setSiteForm((prev) => ({ ...prev, address: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notas
            </label>
            <textarea
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm min-h-[80px]"
              value={siteForm.notes}
              onChange={(e) => setSiteForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
            />
          </div>
          {siteError && <p className="text-sm text-red-500">{siteError}</p>}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={closeSiteModal}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              {editingSiteId ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={areasModalOpen}
        onClose={closeAreasModal}
        title={areasSite ? `Áreas — ${areasSite.name}` : 'Áreas'}
        size="lg"
      >
        <div className="space-y-4">
          {areasLoading ? (
            <p className="text-sm text-gray-500">Cargando áreas…</p>
          ) : (
            <ul className="divide-y divide-gray-200 dark:divide-gray-800 max-h-48 overflow-y-auto">
              {areas.length === 0 && (
                <li className="py-2 text-sm text-gray-500">Sin áreas. Agrega plantas, salas, etc.</li>
              )}
              {areas.map((area) => (
                <li key={area.id} className="py-2 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                      {area.name}
                    </p>
                    {area.notes && (
                      <p className="text-xs text-gray-500 truncate">{area.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!p-2"
                      icon={<Pencil className="w-3.5 h-3.5" />}
                      onClick={() => startEditArea(area)}
                    >
                      Editar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="!p-2 text-red-500"
                      icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => void handleDeleteArea(area)}
                    >
                      Borrar
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form
            className="space-y-3 border-t border-gray-200 dark:border-gray-800 pt-4"
            onSubmit={handleAreaSubmit}
          >
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {editingAreaId ? 'Editar área' : 'Agregar área'}
            </p>
            <Input
              label="Nombre"
              value={areaForm.name}
              onChange={(e) => setAreaForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              placeholder="Piso 2 / Sala de servidores"
            />
            <Input
              label="Notas"
              value={areaForm.notes}
              onChange={(e) => setAreaForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
            {areaError && <p className="text-sm text-red-500">{areaError}</p>}
            <div className="flex justify-end gap-2">
              {editingAreaId && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setEditingAreaId(null)
                    setAreaForm(initialAreaForm)
                  }}
                >
                  Cancelar edición
                </Button>
              )}
              <Button type="submit">{editingAreaId ? 'Actualizar área' : 'Agregar área'}</Button>
            </div>
          </form>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(docsSite)}
        onClose={() => setDocsSite(null)}
        title={docsSite ? `Documentación — ${docsSite.name}` : 'Documentación'}
        size="lg"
      >
        {docsSite && (
          <ObjectDocsPanel
            attachableType="site"
            attachableId={docsSite.id}
            title="Sitio"
          />
        )}
      </Modal>
    </div>
  )
}
