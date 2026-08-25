import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TooltipProps {
  label: string
  children: ReactNode
  className?: string
  /** Muestra el tooltip solo si el contenido está truncado */
  onlyWhenTruncated?: boolean
  disabled?: boolean
}

export function Tooltip({
  label,
  children,
  className = '',
  onlyWhenTruncated = false,
  disabled = false,
}: TooltipProps) {
  const [hovered, setHovered] = useState(false)
  const [truncated, setTruncated] = useState(!onlyWhenTruncated)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const updateState = () => {
    const wrap = wrapRef.current
    if (!wrap) return

    const target = wrap.querySelector('[data-tooltip-target]') as HTMLElement | null
    const node = target ?? wrap
    const rect = node.getBoundingClientRect()

    setCoords({
      top: rect.top,
      left: rect.left,
      width: rect.width,
    })

    if (onlyWhenTruncated) {
      setTruncated(node.scrollWidth > node.clientWidth + 1)
    }
  }

  useEffect(() => {
    if (!onlyWhenTruncated) {
      setTruncated(true)
      return
    }

    const wrap = wrapRef.current
    if (!wrap) return

    const target = wrap.querySelector('[data-tooltip-target]') as HTMLElement | null
    const node = target ?? wrap

    const check = () => {
      setTruncated(node.scrollWidth > node.clientWidth + 1)
    }

    check()
    const observer = new ResizeObserver(check)
    observer.observe(node)
    return () => observer.disconnect()
  }, [label, onlyWhenTruncated, children])

  const visible = hovered && truncated && !disabled && label.trim().length > 0

  return (
    <>
      <div
        ref={wrapRef}
        className={`relative min-w-0 ${className}`}
        onMouseEnter={() => {
          updateState()
          setHovered(true)
        }}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => {
          updateState()
          setHovered(true)
        }}
        onBlur={() => setHovered(false)}
      >
        {children}
      </div>
      {visible && coords
        ? createPortal(
            <div
              role="tooltip"
              style={{
                position: 'fixed',
                top: coords.top - 6,
                left: coords.left,
                transform: 'translateY(-100%)',
                maxWidth: Math.min(288, coords.width + 120, window.innerWidth - 16),
              }}
              className="pointer-events-none z-[9999] rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium leading-snug text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-800"
            >
              {label}
            </div>,
            document.body
          )
        : null}
    </>
  )
}

interface TruncatedTextProps {
  text: string
  className?: string
  as?: 'span' | 'p'
}

export function TruncatedText({ text, className = '', as: Tag = 'span' }: TruncatedTextProps) {
  return (
    <Tooltip label={text} onlyWhenTruncated>
      <Tag data-tooltip-target className={`block truncate ${className}`}>
        {text}
      </Tag>
    </Tooltip>
  )
}
