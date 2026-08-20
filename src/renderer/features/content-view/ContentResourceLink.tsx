import {
  classifyContentResource,
  normalizeLocalMarkdownPath,
  sourceFileUrl,
} from '../../../domain/content-resource-link'
import { useAppStore } from '../../app/store'

type ContentResourceLinkProps = {
  href: string
  label: string
  glyph?: string
  kindLabel?: string
  tone?: 'default' | 'feishu' | 'chat'
  openMode?: 'preview' | 'external'
  testId?: string
  resourceType?: string
}

/** 所有正文超链接的统一视觉与交互入口。 */
export function ContentResourceLink({
  href,
  label,
  glyph,
  kindLabel = '链接',
  tone = 'default',
  openMode = 'preview',
  testId = 'content-resource-link',
  resourceType,
}: ContentResourceLinkProps) {
  const openLinkPreview = useAppStore((s) => s.openLinkPreview)
  const openMarkdownPreview = useAppStore((s) => s.openMarkdownPreview)
  const openContextMenu = useAppStore((s) => s.openContextMenu)
  const showToast = useAppStore((s) => s.showToast)
  const activeSourceId = useAppStore((s) => s.activeSourceId)
  const source = useAppStore((s) => s.sources.find((item) => item.id === s.activeSourceId))
  const kind = classifyContentResource(href)
  const markdownPath = normalizeLocalMarkdownPath(href)
  const externalHref = markdownPath && source?.rootPath
    ? sourceFileUrl(source.rootPath, markdownPath)
    : (markdownPath ? null : href)
  const mark = glyph || (kind === 'markdown' ? 'MD' : '')
  const externalLabel = kind === 'markdown'
    ? '在系统中打开'
    : (tone === 'feishu' || tone === 'chat' ? '在飞书打开' : '在外部浏览器打开')

  async function openExternal() {
    if (!externalHref || (kind === 'markdown' && (!activeSourceId || !externalHref.startsWith('file:')))) {
      showToast('本地文档路径暂不可用')
      return
    }
    const opened = await window.api?.openExternal?.(externalHref)
    if (opened && opened.ok === false) showToast(opened.message || '无法打开链接')
  }

  function openPrimary() {
    if (openMode === 'external') {
      void openExternal()
      return
    }
    if (kind === 'markdown') {
      void openMarkdownPreview(href, label)
      return
    }
    openLinkPreview(href, label)
  }

  function copyLink() {
    window.api?.copyToClipboard?.(href)
    showToast('链接已复制')
  }

  const classes = [
    'content-resource-link',
    `is-${kind}`,
    tone !== 'default' ? `is-${tone}` : '',
    tone === 'feishu' ? 'feishu-doc-link' : '',
    tone === 'chat' ? 'feishu-chat-open' : '',
  ].filter(Boolean).join(' ')

  return (
    <a
      className={classes}
      href={href}
      data-resource-kind={kind}
      data-resource-type={resourceType}
      data-testid={testId}
      data-open-url={href}
      data-open-title={label}
      rel="noreferrer noopener"
      title={`${kindLabel} · 点击在右侧打开，右键查看更多操作`}
      onClick={(event) => {
        event.preventDefault()
        openPrimary()
      }}
      onContextMenu={(event) => {
        event.preventDefault()
        openContextMenu({
          x: event.clientX,
          y: event.clientY,
          items: [
            { id: 'external', label: externalLabel, onClick: () => { void openExternal() } },
            { id: 'copy', label: '复制链接', onClick: copyLink },
          ],
        })
      }}
    >
      {mark ? <span className="content-resource-link-mark" aria-hidden="true">{mark}</span> : null}
      <span className="content-resource-link-title">{label}</span>
      <span className="content-resource-link-open" aria-hidden="true">↗</span>
    </a>
  )
}
