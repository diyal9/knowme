import { hubItemBadges, type HubCapabilityItem } from '../../../domain/capability-hub'

export function HubStatusBadges({ item }: { item: HubCapabilityItem }) {
  const badges = hubItemBadges(item)
  return (
    <div className="hub-badges">
      {badges.map((badge) => (
        <span key={`${badge.label}-${badge.className}`} className={`hub-badge${badge.className ? ` ${badge.className}` : ''}`}>
          {badge.label}
        </span>
      ))}
    </div>
  )
}
