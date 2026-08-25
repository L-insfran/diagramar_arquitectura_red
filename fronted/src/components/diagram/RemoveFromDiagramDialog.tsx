import { AlertTriangle } from 'lucide-react'
import { Modal } from '../Modal'
import { Button } from '../Button'
import { formatLinkCode } from '../../utils/diagram/linkLabel'

export type RemoveFromDiagramInfo = {
  label: string
  /** 'container' when removing a container subtree, 'device' when removing a single device. */
  kind: 'container' | 'device'
  childContainerCount: number
  deviceCount: number
  linkCodes: number[]
}

type Props = {
  isOpen: boolean
  info: RemoveFromDiagramInfo | null
  onClose: () => void
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
}

export function RemoveFromDiagramDialog({
  isOpen,
  info,
  onClose,
  onConfirm,
  isLoading = false,
}: Props) {
  if (!info) return null

  const hasLinks = info.linkCodes.length > 0
  const codesStr =
    info.linkCodes.length <= 8
      ? info.linkCodes.map((c) => formatLinkCode(c)).join(', ')
      : info.linkCodes
          .slice(0, 8)
          .map((c) => formatLinkCode(c))
          .join(', ') + ` y ${info.linkCodes.length - 8} más`

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => undefined : onClose}
      title={
        info.kind === 'container'
          ? `Quitar «${info.label}» del diagrama`
          : `Sacar «${info.label}» del diagrama`
      }
      size="sm"
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
            <AlertTriangle className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            {info.kind === 'container' && (
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Se quitará del diagrama
                {info.childContainerCount > 0 &&
                  ` junto con ${info.childContainerCount} contenedor(es) anidado(s)`}
                {info.deviceCount > 0 &&
                  ` y ${info.deviceCount} equipo(s)`}
                .
              </p>
            )}
            {hasLinks && (
              <p className="text-sm font-medium leading-relaxed text-red-600 dark:text-red-400">
                Se eliminarán {info.linkCodes.length} enlace(s) ({codesStr}) del{' '}
                <strong>proyecto completo</strong> (afecta todos los diagramas).
              </p>
            )}
            {!hasLinks && info.kind === 'device' && (
              <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                El equipo se sacará del diagrama. No tiene enlaces asociados.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            onClick={() => void onConfirm()}
            isLoading={isLoading}
          >
            {hasLinks ? 'Sacar y eliminar enlaces' : 'Quitar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
