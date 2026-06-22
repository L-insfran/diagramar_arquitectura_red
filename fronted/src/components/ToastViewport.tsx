import { X } from 'lucide-react'
import { useToast, type Toast } from '../contexts/ToastContext'

function kindStyles(kind: Toast['kind']): { dot: string; title: string; bg: string; border: string } {
  switch (kind) {
    case 'success':
      return { dot: 'bg-emerald-500', title: 'text-emerald-100', bg: 'bg-emerald-950/80', border: 'border-emerald-700/40' }
    case 'info':
      return { dot: 'bg-sky-500', title: 'text-sky-100', bg: 'bg-slate-950/80', border: 'border-slate-700/60' }
    case 'warning':
      return { dot: 'bg-amber-500', title: 'text-amber-100', bg: 'bg-amber-950/70', border: 'border-amber-700/40' }
    case 'error':
      return { dot: 'bg-rose-500', title: 'text-rose-100', bg: 'bg-rose-950/70', border: 'border-rose-700/40' }
    default:
      return { dot: 'bg-slate-400', title: 'text-white', bg: 'bg-slate-950/80', border: 'border-slate-700/60' }
  }
}

export function ToastViewport() {
  const { toasts, dismiss } = useToast()

  if (!toasts.length) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {toasts.map((t) => {
        const s = kindStyles(t.kind)
        return (
          <div
            key={t.id}
            role="status"
            className={`rounded-xl border ${s.border} ${s.bg} backdrop-blur-md shadow-lg px-4 py-3`}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 size-2.5 rounded-full ${s.dot}`} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${s.title} truncate`}>{t.title}</p>
                {t.description && (
                  <p className="mt-0.5 text-xs text-slate-200/80 leading-snug break-words">
                    {t.description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                className="shrink-0 rounded-md p-1 text-slate-200/70 hover:text-slate-100 hover:bg-white/5 transition"
                aria-label="Cerrar"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

