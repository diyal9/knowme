import type { ExpertLike } from '../../../domain/expert-present'
import { expertAvatarIcon } from '../../../domain/expert-present'
import { Icon } from '../../app/Icon'
import { resolveExpertAvatarUrl } from '../../lib/resolve-expert-avatar'

export function ExpertAvatarMark({
  agent,
  className,
  imgClassName,
  size = 38,
}: {
  agent: ExpertLike
  className: string
  imgClassName?: string
  size?: number
}) {
  const src = resolveExpertAvatarUrl(agent)
  if (src) {
    return (
      <span className={`${className} has-photo`} aria-hidden="true">
        <img className={imgClassName} src={src} alt="" width={size} height={size} decoding="async" />
      </span>
    )
  }
  return (
    <span className={className} aria-hidden="true">
      <Icon name={expertAvatarIcon(agent)} />
    </span>
  )
}
