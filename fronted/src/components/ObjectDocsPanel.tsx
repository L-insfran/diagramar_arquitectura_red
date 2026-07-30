import { useCallback, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Link2,
  Plus,
  Trash2,
} from 'lucide-react'
import { Button } from './Button'
import { Input } from './Input'
import { Select } from './Select'
import { Modal } from './Modal'
import { documentationService } from '../services/documentation.service'
import { usePermissions } from '../hooks/usePermissions'
import { useProject } from '../contexts/ProjectContext'
import type {
  AttachableType,
  Attachment,
  AttachmentKind,
  ObjectSecret,
  SecretKind,
} from '../types'

type Tab = 'attachments' | 'secrets'

const KIND_OPTIONS: { value: AttachmentKind; label: string }[] = [
  { value: 'file', label: 'Archivo' },
  { value: 'pdf', label: 'PDF' },
  { value: 'plan', label: 'Plano' },
  { value: 'photo', label: 'Foto' },
  { value: 'diagram', label: 'Diagrama' },
  { value: 'link', label: 'Link' },
  { value: 'note', label: 'Nota' },
  { value: 'other', label: 'Otro' },
]

const SECRET_KIND_OPTIONS: { value: SecretKind; label: string }[] = [
  { value: 'password', label: 'Password' },
  { value: 'api_key', label: 'API key' },
  { value: 'snmp', label: 'SNMP' },
  { value: 'wifi', label: 'Wi‑Fi' },
  { value: 'console', label: 'Consola' },
  { value: 'other', label: 'Otro' },
]

function formatError(err: unknown): string {
  const ax = err as { response?: { data?: { message?: string } } }
  return ax?.response?.data?.message || 'Ocurrió un error inesperado.'
}

function formatBytes(n: number | null): string {
  if (n == null || n <= 0) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

export function ObjectDocsPanel({
  attachableType,
  attachableId,
  title = 'Documentación',
}: {
  attachableType: AttachableType
  attachableId: string
  title?: string
}) {
  const { canMutate } = usePermissions()
  const { activeProjectId } = useProject()
  const [tab, setTab] = useState<Tab>('attachments')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [secrets, setSecrets] = useState<ObjectSecret[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [attModal, setAttModal] = useState(false)
  const [attForm, setAttForm] = useState({
    title: '',
    kind: 'file' as AttachmentKind,
    description: '',
    url: '',
  })
  const [attFile, setAttFile] = useState<File | null>(null)
  const [attBusy, setAttBusy] = useState(false)
  const [attError, setAttError] = useState<string | null>(null)

  const [secModal, setSecModal] = useState(false)
  const [secForm, setSecForm] = useState({
    label: '',
    kind: 'password' as SecretKind,
    username: '',
    value: '',
    notes: '',
  })
  const [secBusy, setSecBusy] = useState(false)
  const [secError, setSecError] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [atts, secs] = await Promise.all([
        documentationService.listAttachments(attachableType, attachableId),
        documentationService.listSecrets(attachableType, attachableId),
      ])
      setAttachments(atts)
      setSecrets(secs)
    } catch (e) {
      setError(formatError(e))
    } finally {
      setLoading(false)
    }
  }, [attachableType, attachableId])

  useEffect(() => {
    void reload()
  }, [reload])

  const submitAttachment = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeProjectId) {
      setAttError('Selecciona un proyecto activo.')
      return
    }
    const titleVal = attForm.title.trim()
    if (!titleVal) {
      setAttError('El título es obligatorio.')
      return
    }
    if (attForm.kind === 'link' && !attForm.url.trim()) {
      setAttError('El link requiere una URL.')
      return
    }
    setAttBusy(true)
    setAttError(null)
    try {
      await documentationService.createAttachment({
        projectId: activeProjectId,
        attachableType,
        attachableId,
        kind: attForm.kind,
        title: titleVal,
        description: attForm.description.trim() || null,
        url: attForm.url.trim() || null,
        file: attFile,
      })
      setAttModal(false)
      setAttForm({ title: '', kind: 'file', description: '', url: '' })
      setAttFile(null)
      await reload()
    } catch (e) {
      setAttError(formatError(e))
    } finally {
      setAttBusy(false)
    }
  }

  const submitSecret = async (event: FormEvent) => {
    event.preventDefault()
    if (!activeProjectId) {
      setSecError('Selecciona un proyecto activo.')
      return
    }
    if (!secForm.label.trim() || !secForm.value) {
      setSecError('Etiqueta y valor son obligatorios.')
      return
    }
    setSecBusy(true)
    setSecError(null)
    try {
      await documentationService.createSecret({
        projectId: activeProjectId,
        attachableType,
        attachableId,
        kind: secForm.kind,
        label: secForm.label.trim(),
        username: secForm.username.trim() || null,
        value: secForm.value,
        notes: secForm.notes.trim() || null,
      })
      setSecModal(false)
      setSecForm({ label: '', kind: 'password', username: '', value: '', notes: '' })
      await reload()
    } catch (e) {
      setSecError(formatError(e))
    } finally {
      setSecBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Archivos, links y secretos cifrados del objeto
          </p>
        </div>
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden text-xs">
          <button
            type="button"
            className={`px-3 py-1.5 ${tab === 'attachments' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-600 dark:text-gray-300'}`}
            onClick={() => setTab('attachments')}
          >
            Adjuntos ({attachments.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 ${tab === 'secrets' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-600 dark:text-gray-300'}`}
            onClick={() => setTab('secrets')}
          >
            Secretos ({secrets.length})
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {error && (
          <p className="text-sm text-red-500" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === 'attachments' ? (
          <>
            {canMutate && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setAttError(null)
                    setAttModal(true)
                  }}
                >
                  Agregar
                </Button>
              </div>
            )}
            {attachments.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                Sin adjuntos todavía
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
                {attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center gap-3 px-3 py-2.5 text-sm"
                  >
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {att.title}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {att.kind}
                        {att.originalFilename ? ` · ${att.originalFilename}` : ''}
                        {att.sizeBytes ? ` · ${formatBytes(att.sizeBytes)}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {att.url && (
                        <a
                          href={att.url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                          title="Abrir link"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      {att.hasFile && (
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                          title="Descargar"
                          onClick={() =>
                            void documentationService.downloadAttachment(
                              att.id,
                              att.originalFilename || att.title
                            )
                          }
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                      {canMutate && (
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                          title="Eliminar"
                          onClick={() => {
                            if (!window.confirm(`¿Eliminar "${att.title}"?`)) return
                            void documentationService
                              .deleteAttachment(att.id)
                              .then(reload)
                              .catch((e) => window.alert(formatError(e)))
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <>
            {canMutate && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  icon={<Plus className="w-4 h-4" />}
                  onClick={() => {
                    setSecError(null)
                    setSecModal(true)
                  }}
                >
                  Agregar secreto
                </Button>
              </div>
            )}
            {secrets.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                Sin secretos documentados
              </p>
            ) : (
              <ul className="divide-y divide-gray-200 dark:divide-gray-800 rounded-lg border border-gray-200 dark:border-gray-800">
                {secrets.map((sec) => (
                  <li key={sec.id} className="flex items-start gap-3 px-3 py-2.5 text-sm">
                    <KeyRound className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {sec.label}
                      </p>
                      <p className="text-xs text-gray-500">
                        {sec.kind}
                        {sec.username ? ` · ${sec.username}` : ''}
                      </p>
                      {revealed[sec.id] && (
                        <p className="mt-1 font-mono text-xs break-all bg-gray-100 dark:bg-gray-950 px-2 py-1 rounded">
                          {revealed[sec.id]}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {canMutate && (
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"
                          title={revealed[sec.id] ? 'Ocultar' : 'Revelar'}
                          onClick={() => {
                            if (revealed[sec.id]) {
                              setRevealed((prev) => {
                                const next = { ...prev }
                                delete next[sec.id]
                                return next
                              })
                              return
                            }
                            void documentationService
                              .revealSecret(sec.id)
                              .then((r) =>
                                setRevealed((prev) => ({ ...prev, [sec.id]: r.value }))
                              )
                              .catch((e) => window.alert(formatError(e)))
                          }}
                        >
                          {revealed[sec.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      {canMutate && (
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-red-500/10 text-red-500"
                          title="Eliminar"
                          onClick={() => {
                            if (!window.confirm(`¿Eliminar secreto "${sec.label}"?`)) return
                            void documentationService
                              .deleteSecret(sec.id)
                              .then(reload)
                              .catch((e) => window.alert(formatError(e)))
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {!canMutate && secrets.length > 0 && (
              <p className="text-xs text-gray-500">
                Los secretos solo pueden revelarse con rol de edición.
              </p>
            )}
          </>
        )}
      </div>

      <Modal
        isOpen={attModal}
        onClose={() => !attBusy && setAttModal(false)}
        title="Nuevo adjunto"
        size="md"
      >
        <form className="space-y-3" onSubmit={submitAttachment}>
          <Input
            label="Título"
            value={attForm.title}
            onChange={(e) => setAttForm((p) => ({ ...p, title: e.target.value }))}
            required
          />
          <Select
            label="Tipo"
            options={KIND_OPTIONS}
            value={attForm.kind}
            onChange={(e) =>
              setAttForm((p) => ({ ...p, kind: e.target.value as AttachmentKind }))
            }
          />
          {(attForm.kind === 'link' || attForm.url) && (
            <Input
              label="URL"
              value={attForm.url}
              onChange={(e) => setAttForm((p) => ({ ...p, url: e.target.value }))}
              placeholder="https://…"
            />
          )}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Descripción / nota
            </label>
            <textarea
              value={attForm.description}
              onChange={(e) => setAttForm((p) => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm resize-none"
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Archivo (opcional)
            </label>
            <input
              type="file"
              onChange={(e) => setAttFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white"
            />
            <p className="text-xs text-gray-500 flex items-center gap-1">
              <Link2 className="w-3 h-3" /> Máx. 20 MB · PDF, imágenes, office, zip…
            </p>
          </div>
          {attError && <p className="text-sm text-red-500">{attError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={attBusy} onClick={() => setAttModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={attBusy}>
              Guardar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={secModal}
        onClose={() => !secBusy && setSecModal(false)}
        title="Nuevo secreto"
        size="md"
      >
        <form className="space-y-3" onSubmit={submitSecret}>
          <Input
            label="Etiqueta"
            value={secForm.label}
            onChange={(e) => setSecForm((p) => ({ ...p, label: e.target.value }))}
            placeholder="ej. SNMP community, Wi‑Fi guest…"
            required
          />
          <Select
            label="Tipo"
            options={SECRET_KIND_OPTIONS}
            value={secForm.kind}
            onChange={(e) => setSecForm((p) => ({ ...p, kind: e.target.value as SecretKind }))}
          />
          <Input
            label="Usuario (opcional)"
            value={secForm.username}
            onChange={(e) => setSecForm((p) => ({ ...p, username: e.target.value }))}
          />
          <Input
            label="Valor"
            type="password"
            value={secForm.value}
            onChange={(e) => setSecForm((p) => ({ ...p, value: e.target.value }))}
            required
            autoComplete="new-password"
          />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Notas
            </label>
            <textarea
              value={secForm.notes}
              onChange={(e) => setSecForm((p) => ({ ...p, notes: e.target.value }))}
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg text-sm resize-none"
            />
          </div>
          {secError && <p className="text-sm text-red-500">{secError}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={secBusy} onClick={() => setSecModal(false)}>
              Cancelar
            </Button>
            <Button type="submit" isLoading={secBusy}>
              Guardar cifrado
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
