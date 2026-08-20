import type { ButtonHTMLAttributes } from 'react'
import { Icon } from './Icon'

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children' | 'aria-label'> & {
  label: string
  ariaLabel?: string
  compact?: boolean
  iconOnly?: boolean
}

/** KnowMe 全屏页、详情页与任务间共用的返回控件。 */
export function BackButton({
  label,
  ariaLabel,
  compact = false,
  iconOnly = false,
  className = '',
  ...props
}: Props) {
  return (
    <button
      type="button"
      className={`app-back-button${compact ? ' is-compact' : ''}${iconOnly ? ' is-icon-only' : ''}${className ? ` ${className}` : ''}`}
      aria-label={ariaLabel || label}
      title={iconOnly ? label : undefined}
      {...props}
    >
      <Icon name="chevronLeft" />
      {!iconOnly ? <span>{label}</span> : null}
    </button>
  )
}
