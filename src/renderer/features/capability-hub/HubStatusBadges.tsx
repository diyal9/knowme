import { hubItemBadges, type HubCapabilityItem } from '../../../domain/capability-hub'
import { Icon } from '../../app/Icon'

export function HubStatusBadges({ item, omitInstallState = false, omitCategory = false, compact = false }: { item: HubCapabilityItem; omitInstallState?: boolean; omitCategory?: boolean; compact?: boolean }) {
  const badges = hubItemBadges(item).filter((badge) => (
    (!omitInstallState || (badge.label !== '已添加' && badge.label !== '已安装'))
      && (!omitCategory || Boolean(badge.className))
  ))
  return (
    <div className="hub-badges">
      {badges.map((badge) => (
        <span
          key={`${badge.label}-${badge.className}`}
          className={`hub-badge${badge.className ? ` ${badge.className}` : ''}${compact && (badge.className.includes('verified') || badge.label === '已添加' || badge.label === '已安装') ? ' icon-only' : ''}`}
          title={compact ? badge.label : undefined}
          aria-label={compact ? badge.label : undefined}
        >
          {badge.className.includes('verified') ? <Icon name="badgeCheck" /> : null}
          {badge.label === '已添加' || badge.label === '已安装' ? <Icon name="wrench" /> : null}
          {!(compact && (badge.className.includes('verified') || badge.label === '已添加' || badge.label === '已安装')) ? badge.label : null}
        </span>
      ))}
    </div>
  )
}
