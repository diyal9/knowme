/**
 * 飞书资源卡片：左键右侧 KnowMe 浏览器预览；chat 走外部打开。
 */
import type { FeishuCardModel } from '../../../domain/feishu-card-model'
import { useAppStore } from '../../app/store'

export function FeishuResourceCard({ card }: { card: FeishuCardModel }) {
  const openLinkPreview = useAppStore((s) => s.openLinkPreview)
  const openContextMenu = useAppStore((s) => s.openContextMenu)
  const showToast = useAppStore((s) => s.showToast)

  async function openExternal() {
    const opened = await window.api?.openExternal?.(card.href)
    if (opened && opened.ok === false) showToast(opened.message || '无法打开链接')
  }

  function copyLink() {
    window.api?.copyToClipboard?.(card.href)
    showToast('链接已复制')
  }

  if (card.resourceType === 'chat') {
    return (
      <a
        href={card.href}
        className="feishu-chat-open"
        data-testid="feishu-chat-open"
        rel="noreferrer noopener"
        title="在飞书打开会话"
        onClick={(e) => {
          e.preventDefault()
          void openExternal()
        }}
      >
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
      data-open-url={card.href}
      data-open-title={card.title}
      rel="noreferrer noopener"
      title="点击在右侧预览，右键查看更多操作"
      onClick={(e) => {
        e.preventDefault()
        openLinkPreview(card.href, card.title)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        openContextMenu({
          x: e.clientX,
          y: e.clientY,
          items: [
            {
              id: 'preview',
              label: '右侧预览',
              onClick: () => { openLinkPreview(card.href, card.title) },
            },
            {
              id: 'external',
              label: card.resourceType === 'minutes' || Boolean(card.meeting) ? '在飞书打开' : '在外部打开',
              onClick: () => { void openExternal() },
            },
            {
              id: 'copy',
              label: '复制链接',
              onClick: copyLink,
            },
          ],
        })
      }}
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
