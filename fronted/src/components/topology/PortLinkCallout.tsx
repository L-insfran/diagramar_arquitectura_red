import { ArrowRight, Link2, X } from 'lucide-react'
import { Panel } from '@xyflow/react'

export type PortLinkCalloutItem = {
  localDevice: string
  localPort: string
  remoteDevice: string
  remotePort: string
  mediumLabel?: string | null
}

type PortLinkCalloutProps = {
  items: PortLinkCalloutItem[]
  onDismiss: () => void
}

export function PortLinkCallout({ items, onDismiss }: PortLinkCalloutProps) {
  if (!items.length) return null

  return (
    <Panel
      position="bottom-center"
      className="!m-0 !mb-4 !w-full !max-w-lg !border-0 !bg-transparent !p-0 !shadow-none pointer-events-none"
    >
      <div
        role="status"
        className="pointer-events-auto w-full rounded-xl border border-slate-600/50 bg-slate-950/90 px-4 py-3 shadow-2xl shadow-black/40 backdrop-blur-md transition-all duration-300 dark:border-slate-500/40"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
            <Link2 className="size-4" aria-hidden strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Enlace de conexión
            </p>
            {items.map((item, index) => (
              <div key={`${item.localDevice}-${item.localPort}-${item.remoteDevice}-${index}`} className="space-y-1">
                <p className="text-sm font-medium leading-snug text-slate-100">
                  <span className="font-semibold text-white">{item.localDevice}</span>
                  <span className="text-slate-400"> · puerto </span>
                  <span className="font-mono text-amber-200/95">{item.localPort}</span>
                  <ArrowRight className="mx-1.5 inline size-3.5 -translate-y-px text-slate-500" aria-hidden />
                  <span className="font-semibold text-white">{item.remoteDevice}</span>
                  <span className="text-slate-400"> · puerto </span>
                  <span className="font-mono text-amber-200/95">{item.remotePort}</span>
                </p>
                {item.mediumLabel && (
                  <p className="text-[11px] text-slate-400">{item.mediumLabel}</p>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 rounded-md p-1 text-slate-400 transition hover:bg-white/5 hover:text-slate-200"
            aria-label="Cerrar"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </Panel>
  )
}
