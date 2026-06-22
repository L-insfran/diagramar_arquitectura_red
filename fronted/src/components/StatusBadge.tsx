import type { ReactNode } from 'react'

const statusStyles: Record<string, string> = {
  online: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  offline: 'bg-red-500/15 text-red-400 border-red-500/20',
  maintenance: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  unknown: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
  up: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  down: 'bg-red-500/15 text-red-400 border-red-500/20',
  disabled: 'bg-gray-500/15 text-gray-400 border-gray-500/20',
}

const dotStyles: Record<string, string> = {
  online: 'bg-emerald-400',
  offline: 'bg-red-400',
  maintenance: 'bg-amber-400',
  unknown: 'bg-gray-400',
  up: 'bg-emerald-400',
  down: 'bg-red-400',
  disabled: 'bg-gray-400',
}

interface StatusBadgeProps {
  status: string
  children?: ReactNode
}

export function StatusBadge({ status, children }: StatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.unknown
  const dot = dotStyles[status] || dotStyles.unknown
  const label = children || status.charAt(0).toUpperCase() + status.slice(1)

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {label}
    </span>
  )
}
