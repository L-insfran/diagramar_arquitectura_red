type SegmentedOption<T extends string> = {
  value: T
  label: string
  title?: string
}

type Props<T extends string> = {
  value: T
  options: SegmentedOption<T>[]
  onChange: (value: T) => void
  ariaLabel?: string
  size?: 'sm' | 'md'
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'sm',
}: Props<T>) {
  const sizeClass = size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex rounded-md border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-600 dark:bg-slate-800"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            title={option.title ?? option.label}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
            className={`${sizeClass} rounded font-semibold transition-colors ${
              selected
                ? 'bg-white text-sky-700 shadow-sm dark:bg-slate-900 dark:text-sky-300'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
