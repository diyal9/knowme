import type { HubCapabilityItem } from '../../../domain/capability-hub'
import { resolveHubIcon } from '../../../domain/capability-hub'
import { expertAvatarIcon } from '../../../domain/expert-present'
import { Icon } from '../../app/Icon'
import { resolveExpertAvatarUrl } from '../../lib/resolve-expert-avatar'

type Props = {
  item: HubCapabilityItem
  className: string
}

function expertIcon(item: HubCapabilityItem): string {
  if (item.kind === 'expert') return expertAvatarIcon(item)
  return resolveHubIcon(item)
}

export function HubCapabilityIcon({ item, className }: Props) {
  if (item.kind === 'expert') {
    const src = resolveExpertAvatarUrl(item)
    if (src) {
      return (
        <div className={`${className} has-photo`} aria-hidden="true">
          <img className="hub-avatar-photo" src={src} alt="" decoding="async" />
        </div>
      )
    }
    return (
      <div className={className} aria-hidden="true">
        <Icon name={expertIcon(item)} />
      </div>
    )
  }
  return (
    <div className={className} aria-hidden="true">
      <Icon name={resolveHubIcon(item)} />
    </div>
  )
}
