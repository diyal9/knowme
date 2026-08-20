import { hubItemBadges, type HubCapabilityItem } from '../../../domain/capability-hub'
import { Icon } from '../../app/Icon'

export function HubStatusBadges({ item, omitInstallState = false, omitCategory = false }: { item: HubCapabilityItem; omitInstallState?: boolean; omitCategory?: boolean }) {
  const badges = hubItemBadges(item).filter((badge) => (
    (!omitInstallState || (badge.label !== '已添加' && badge.label !== '已安装'))
      && (!omitCategory || Boolean(badge.className))
  ))
  return (
    <div className="hub-badges">
      {badges.map((badge) => (
        <span key={`${badge.label}-${badge.className}`} className={`hub-badge${badge.className ? ` ${badge.className}` : ''}`}>
          {badge.className.includes('verified') ? <Icon name="check" /> : null}
          {badge.label === '已添加' || badge.label === '已安装' ? <Icon name="component" /> : null}
          {badge.label}
        </span>
      ))}
    </div>
  )
}
