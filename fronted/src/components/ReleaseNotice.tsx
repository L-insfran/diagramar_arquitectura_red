import { Button } from './Button'
import { Modal } from './Modal'
import type { ReleaseNote } from '../services/releases.service'

interface ReleaseNoticeProps {
  isOpen: boolean
  mode: 'unseen' | 'history'
  releases: ReleaseNote[]
  isAcking?: boolean
  onClose: () => void
}

export function ReleaseNotice({ isOpen, mode, releases, isAcking, onClose }: ReleaseNoticeProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'history' ? 'Historial de versiones' : 'Novedades'}
      size="md"
    >
      <div className="space-y-5">
        {releases.map((release) => (
          <section key={release.version} className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{release.title}</h3>
              <span className="shrink-0 text-xs font-medium text-slate-500 dark:text-slate-400">
                v{release.version}
              </span>
            </div>
            {release.highlights.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
                {release.highlights.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        {mode === 'unseen' && (
          <div className="flex justify-end pt-1">
            <Button type="button" onClick={onClose} isLoading={isAcking}>
              Entendido
            </Button>
          </div>
        )}
      </div>
    </Modal>
  )
}
