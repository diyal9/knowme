/**
 * 飞书资源：会议使用信息卡片，文档类资源使用行内链接；chat 走外部打开。
 */
import type { FeishuCardModel } from '../../../domain/feishu-card-model'
import { useAppStore } from '../../app/store'
import { ContentResourceLink } from './ContentResourceLink'

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
      <ContentResourceLink
        href={card.href}
        label={card.title}
        kindLabel={card.kindLabel}
        tone="chat"
        openMode="external"
        testId="feishu-chat-open"
        resourceType={card.resourceType}
      />
    )
  }

  const meeting = card.resourceType === 'minutes'
  const kind = card.meeting ? `${card.kindLabel} · 第${card.meeting.session}场` : card.kindLabel

  const openPreview = () => { openLinkPreview(card.href, card.title) }
  const openResourceMenu = (x: number, y: number) => {
    openContextMenu({
      x,
      y,
      items: [
        {
          id: 'preview',
          label: '右侧预览',
          onClick: openPreview,
        },
        {
          id: 'external',
          label: meeting ? '在飞书打开' : '在外部打开',
          onClick: () => { void openExternal() },
        },
        {
          id: 'copy',
          label: '复制链接',
          onClick: copyLink,
        },
      ],
    })
  }

  if (!meeting) {
    return (
      <ContentResourceLink
        href={card.href}
        label={card.title}
        glyph={card.glyph}
        kindLabel={card.kindLabel}
        tone="feishu"
        openMode="external"
        testId="feishu-doc-link"
        resourceType={card.resourceType}
      />
    )
  }

  return (
    <a
      className="feishu-link-card feishu-meeting-card"
      href={card.href}
      data-resource-type={card.resourceType}
      data-testid="feishu-resource-card"
      data-open-url={card.href}
      data-open-title={card.title}
      rel="noreferrer noopener"
      title="点击在右侧预览，右键查看更多操作"
      onClick={(e) => {
        e.preventDefault()
        openPreview()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        openResourceMenu(e.clientX, e.clientY)
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
