/**
 * 助理右侧 KnowMe 浏览器：用 persist webview 预览飞书/http 链接。
 * 不负责文档审阅或飞书 CLI 权限草稿。
 */
import { useEffect, useRef } from 'react'
import '../../../secondary-dialog.css'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'
import { ContentView } from '../content-view/ContentView'

const PREVIEW_PARTITION = 'persist:knowme-preview'

const FEISHU_TITLE_SCRIPT = String.raw`(() => {
  const generic = /^(?:飞书|飞书云文档|飞书文档|飞书知识库|知识库|Feishu|Lark|分享|加载中|Loading)$/i;
  const read = (node) => String(node?.value || node?.getAttribute?.('value') || node?.textContent || '').replace(/\s+/g, ' ').trim();
  const usable = (value) => value && value.length <= 120 && !generic.test(value);
  const visible = (node) => {
    const rect = node?.getBoundingClientRect?.();
    return rect && rect.width > 20 && rect.height > 8;
  };
  const selectors = [
    '[data-testid="document-title"]',
    '[data-testid="doc-title"]',
    '[data-testid="wiki-title"]',
    '[data-qa="document-title"]',
    '[data-qa="doc-title"]',
    'input[class*="title"]',
    '[class*="title"] input',
    '[contenteditable="true"][class*="title"]',
    '[class*="title"][contenteditable="true"]',
    '[class*="title"][role="textbox"]'
  ];
  for (const selector of selectors) {
    for (const node of document.querySelectorAll(selector)) {
      const value = read(node);
      if (visible(node) && usable(value)) return value;
    }
  }
  for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]', 'meta[name="title"]']) {
    const value = String(document.querySelector(selector)?.getAttribute('content') || '').trim();
    if (usable(value)) return value;
  }
  return document.title || '';
})()`

type PreviewWebviewElement = HTMLElement & {
  executeJavaScript?: (code: string, userGesture?: boolean) => Promise<unknown>
}

export function LinkWebview({
  src,
  onTitle,
  titleOnly = false,
}: {
  src: string
  onTitle?: (title: string) => void
  titleOnly?: boolean
}) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const el = document.createElement('webview') as PreviewWebviewElement
    el.className = 'work-link-webview'
    if (titleOnly) el.setAttribute('aria-hidden', 'true')
    el.setAttribute('src', src)
    el.setAttribute('partition', PREVIEW_PARTITION)
    const handleTitle = (event: Event) => onTitle?.(String((event as Event & { title?: string }).title || ''))
    const timers = new Set<number>()
    async function readPageTitle() {
      if (!onTitle || typeof el.executeJavaScript !== 'function') return
      try {
        onTitle(String(await el.executeJavaScript(FEISHU_TITLE_SCRIPT) || ''))
      } catch { /* webview may be navigating */ }
    }
    function scheduleTitleReads() {
      for (const timer of timers) window.clearTimeout(timer)
      timers.clear()
      for (const delay of [0, 500, 1600, 3500, 7000]) {
        const timer = window.setTimeout(() => {
          timers.delete(timer)
          void readPageTitle()
        }, delay)
        timers.add(timer)
      }
    }
    const handlePageReady = () => scheduleTitleReads()
    if (onTitle) {
      el.addEventListener('page-title-updated', handleTitle)
      el.addEventListener('dom-ready', handlePageReady)
      el.addEventListener('did-stop-loading', handlePageReady)
      el.addEventListener('did-navigate-in-page', handlePageReady)
    }
    host.replaceChildren(el)
    return () => {
      el.removeEventListener('page-title-updated', handleTitle)
      el.removeEventListener('dom-ready', handlePageReady)
      el.removeEventListener('did-stop-loading', handlePageReady)
      el.removeEventListener('did-navigate-in-page', handlePageReady)
      for (const timer of timers) window.clearTimeout(timer)
      host.replaceChildren()
    }
  }, [onTitle, src, titleOnly])

  return (
    <div
      className={`work-link-viewport${titleOnly ? ' work-link-title-resolver' : ''}`}
      data-testid={titleOnly ? 'link-title-resolver' : 'link-preview-webview-host'}
      aria-hidden={titleOnly ? 'true' : undefined}
      ref={hostRef}
    />
  )
}

export function LinkPreviewSurface() {
  const linkPreview = useAppStore((s) => s.linkPreview)
  const linkFullscreen = useAppStore((s) => s.linkFullscreen)
  const setLinkFullscreen = useAppStore((s) => s.setLinkFullscreen)
  const closeLinkPreview = useAppStore((s) => s.closeLinkPreview)
  const updateLinkPreviewTitle = useAppStore((s) => s.updateLinkPreviewTitle)
  const showToast = useAppStore((s) => s.showToast)

  useEffect(() => {
    if (!linkFullscreen) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      if (linkPreview?.presentation === 'overlay') closeLinkPreview()
      else setLinkFullscreen(false)
    }
    // webview 内焦点时仍尽量在捕获阶段接到 Esc；工具栏退出是主路径。
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [closeLinkPreview, linkFullscreen, linkPreview?.presentation, setLinkFullscreen])

  if (!linkPreview) return null

  const canEmbed = linkPreview.protocol === 'https:' || linkPreview.protocol === 'http:'
  const isMarkdown = linkPreview.kind === 'markdown'
  const isOverlay = linkPreview.presentation === 'overlay'
  const openLabel = isMarkdown
    ? '在系统中打开'
    : linkPreview.protocol === 'mailto:'
    ? '使用邮箱打开'
    : (linkPreview.isFeishu ? '在飞书打开' : '在浏览器打开')
  const fullscreenTitle = linkFullscreen ? '退出全屏预览（Esc）' : '全屏打开预览'

  async function openExternal() {
    const target = linkPreview!.externalHref || linkPreview!.href
    if (isMarkdown && !linkPreview!.externalHref) {
      showToast('本地文档路径暂不可用')
      return
    }
    const opened = await window.api?.openExternal?.(target)
    if (opened && opened.ok === false) showToast(opened.message || '无法打开链接')
  }

  function copyLink() {
    window.api?.copyToClipboard?.(linkPreview!.href)
    showToast('链接已复制')
  }

  return (
    <div
      className="pane-wrap surface-link"
      id="workSurfaceWrap"
      data-testid="link-preview-surface"
      aria-label="链接预览"
    >
      <div className="work-surface-bar" id="workSurfaceBar" aria-label="工作面模式">
        <span className="ws-mode-pill" id="workSurfaceModePill">{isOverlay ? '管线文档' : '预览'}</span>
        <span className="ws-art-title" id="workSurfaceArtTitle">{linkPreview.title}</span>
        <div className="ws-bar-actions" aria-label="预览操作">
          {!isOverlay ? (
            <button
              type="button"
              className="ws-bar-btn"
              id="btnToggleLinkFullscreen"
              title={fullscreenTitle}
              aria-label={fullscreenTitle}
              aria-pressed={linkFullscreen}
              onClick={() => setLinkFullscreen(!linkFullscreen)}
            >
              <Icon name="maximize" />
            </button>
          ) : null}
          <button
            type="button"
            className="ws-bar-btn"
            id="btnOpenLinkExternal"
            title={openLabel}
            aria-label={openLabel}
            onClick={() => void openExternal()}
          >
            <Icon name="externalLink" />
          </button>
          <button
            type="button"
            className="ws-bar-btn"
            id="btnCopyLinkTop"
            title="复制链接"
            aria-label="复制链接"
            onClick={copyLink}
          >
            <Icon name="copy" />
          </button>
          <button
            type="button"
            className="ws-bar-btn"
            id="btnBackToDoc"
            title={isOverlay ? '返回管线服务' : '关闭预览'}
            aria-label={isOverlay ? '返回管线服务' : '关闭预览'}
            onClick={closeLinkPreview}
          >
            <Icon name="circleX" />
          </button>
        </div>
      </div>
      <div className="work-review" id="workReview" aria-label="链接预览内容">
        <div className="work-review-body" id="workReviewBody">
          <div className="work-link-preview">
            <section className="work-link-shell">
              {isMarkdown ? (
                <article className="work-link-document" data-testid="markdown-preview-document">
                  {linkPreview.loading ? <p className="work-link-preview-note">正在读取文档…</p> : null}
                  {linkPreview.error ? <p className="work-link-preview-note is-error">{linkPreview.error}</p> : null}
                  {!linkPreview.loading && !linkPreview.error ? (
                    <ContentView source={linkPreview.content || ''} />
                  ) : null}
                </article>
              ) : canEmbed ? (
                <LinkWebview src={linkPreview.href} onTitle={linkPreview.resolveTitle ? updateLinkPreviewTitle : undefined} />
              ) : (
                <p className="work-link-preview-note">
                  该链接不适合在应用内预览，请在系统浏览器或默认应用中打开。
                </p>
              )}
            </section>
          </div>
        </div>
        <div className="work-review-actions" id="workReviewActions" />
      </div>
    </div>
  )
}
