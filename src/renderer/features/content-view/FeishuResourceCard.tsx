import type { FeishuCardModel } from '../../../domain/feishu-card-model'

export function FeishuResourceCard({ card }: { card: FeishuCardModel }) {
  if (card.resourceType === 'chat') {
    return (
      <a href={card.href} className="feishu-chat-open" target="_blank" rel="noreferrer noopener">
        {card.title}
        <span className="feishu-chat-open-mark" aria-hidden="true">↗</span>
      </a>
    )
  }
  const meeting = Boolean(card.meeting)
  const kind = meeting ? `${card.kindLabel} · 第${card.meeting?.session}场` : card.kindLabel
  return (
    <a
      className={`feishu-link-card${meeting ? ' feishu-meeting-card' : ''}`}
      href={card.href}
      data-resource-type={card.resourceType}
      data-testid="feishu-resource-card"
      target="_blank"
      rel="noreferrer noopener"
      title="打开飞书资源"
    >
      <span className="feishu-link-mark" aria-hidden="true">{card.glyph}</span>
      <span className="feishu-link-copy">
        <span className="feishu-link-kind">{kind}</span>
        <span className="feishu-link-title">{card.title}</span>
        {card.meeting?.meta ? <span className="feishu-link-meta">{card.meeting.meta}</span> : null}
      </span>
      <span className="feishu-link-open">
        <span className="feishu-link-open-label">预览</span>
        <span aria-hidden="true">↗</span>
      </span>
    </a>
  )
}
