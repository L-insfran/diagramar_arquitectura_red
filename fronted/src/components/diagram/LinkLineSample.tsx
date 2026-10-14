import type { LinkLineStyle } from '../../utils/diagram/linkTypeStyle'
import { linkLineStyleDef } from '../../utils/diagram/linkTypeStyle'

type Props = {
  lineStyle: LinkLineStyle | string | null | undefined
  color?: string
  width?: number
  title?: string
}

/** Muestra corta del estilo de trazo, en el color del tipo. */
export function LinkLineSample({
  lineStyle,
  color = '#3b82f6',
  width = 36,
  title,
}: Props) {
  const dash = linkLineStyleDef(lineStyle).strokeDasharray
  return (
    <svg
      width={width}
      height={10}
      viewBox={`0 0 ${width} 10`}
      className="shrink-0"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <line
        x1="1"
        y1="5"
        x2={width - 1}
        y2="5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash ?? undefined}
      />
    </svg>
  )
}
