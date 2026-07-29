import type { ReactNode } from 'react'

interface CardProps {
  title?: string
  subtitle?: ReactNode
  icon?: ReactNode
  value?: string | number
  children?: ReactNode
  className?: string
  compact?: boolean
  onClick?: () => void
}

export function Card({ title, subtitle, icon, value, children, className = '', compact = false, onClick }: CardProps) {
  if (compact) {
    return (
      <div
        className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg px-3 py-2 ${onClick ? 'cursor-pointer hover:border-blue-500/50 transition-colors' : ''} ${className}`}
        onClick={onClick}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {title && <h3 className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate leading-tight">{title}</h3>}
            {subtitle != null && subtitle !== '' && (
              <div className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 truncate leading-tight">{subtitle}</div>
            )}
          </div>
          {value !== undefined && (
            <p className="text-lg font-bold tabular-nums text-gray-900 dark:text-white shrink-0 leading-none">{value}</p>
          )}
        </div>
        {children}
      </div>
    )
  }

  return (
    <div
      className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-6 ${onClick ? 'cursor-pointer hover:border-blue-500/50 transition-colors' : ''} ${className}`}
      onClick={onClick}
    >
      {(title || icon) && (
        <div className="flex items-center justify-between mb-4">
          <div>
            {title && <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</h3>}
            {subtitle != null && subtitle !== '' && (
              <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</div>
            )}
          </div>
          {icon && (
            <div className="p-2.5 bg-blue-500/10 rounded-lg text-blue-400">
              {icon}
            </div>
          )}
        </div>
      )}
      {value !== undefined && (
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
      )}
      {children}
    </div>
  )
}
