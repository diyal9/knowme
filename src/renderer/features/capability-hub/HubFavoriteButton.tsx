import type { HubCapabilityItem } from '../../../domain/capability-hub'
import { Icon } from '../../app/Icon'

type Props = {
  item: HubCapabilityItem
  onToggled: (favorite: boolean) => void
}

export function HubFavoriteButton({ item, onToggled }: Props) {
  const on = !!item.favorite

  async function toggle(event: React.MouseEvent) {
    event.stopPropagation()
    const result = await window.api?.capabilityFavoriteToggle?.({ id: item.id, kind: item.kind }) as { favorite?: boolean } | undefined
    onToggled(result?.favorite === true)
  }

  return (
    <button
      type="button"
      className={`hub-card-fav${on ? ' is-fav' : ''}`}
      title={on ? '取消收藏' : '收藏'}
      aria-label={on ? '取消收藏' : '收藏'}
      aria-pressed={on}
      onClick={(e) => void toggle(e)}
    >
      <Icon name="star" />
    </button>
  )
}
