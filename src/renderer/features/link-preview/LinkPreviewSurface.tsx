/**
 * 助理右侧 KnowMe 浏览器：用 persist webview 预览飞书/http 链接。
 * 不负责文档审阅或飞书 CLI 权限草稿。
 */
import { useEffect, useRef } from 'react'
import { Icon } from '../../app/Icon'
import { useAppStore } from '../../app/store'

const PREVIEW_PARTITION = 'persist:knowme-preview'

function LinkWebview({ src }: { src: string }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const el = document.createElement('webview')
    el.className = 'work-link-webview'
    el.setAttribute('src', src)
    el.setAttribute('partition', PREVIEW_PARTITION)
    host.replaceChildren(el)
    return () => {
      host.replaceChildren()
    }
  }, [src])

  return <div className="work-link-viewport" data-testid="link-preview-webview-host" ref={hostRef} />
}

export function LinkPreviewSurface() {
  const linkPreview = useAppStore((s) => s.linkPreview)
  const linkFullscreen = useAppStore((s) => s.linkFullscreen)
  const setLinkFullscreen = useAppStore((s) => s.setLinkFullscreen)
  const closeLinkPreview = useAppStore((s) => s.closeLinkPreview)
  const showToast = useAppStore((s) => s.showToast)

  useEffect(() => {
    if (!linkFullscreen) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setLinkFullscreen(false)
    }
    // webview 内焦点时仍尽量在捕获阶段接到 Esc；工具栏退出是主路径。
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [linkFullscreen, setLinkFullscreen])

  if (!linkPreview) return null

  const canEmbed = linkPreview.protocol === 'https:' || linkPreview.protocol === 'http:'
  const openLabel = linkPreview.protocol === 'mailto:'
    ? '使用邮箱打开'
    : (linkPreview.isFeishu ? '在飞书打开' : '在浏览器打开')
  const fullscreenTitle = linkFullscreen ? '退出全屏预览（Esc）' : '全屏打开预览'

  async function openExternal() {
    const opened = await window.api?.openExternal?.(linkPreview!.href)
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
        <span className="ws-mode-pill" id="workSurfaceModePill">预览</span>
        <span className="ws-art-title" id="workSurfaceArtTitle">{linkPreview.title}</span>
        <div className="ws-bar-actions" aria-label="预览操作">
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
            title="关闭预览"
            aria-label="关闭预览"
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
              {canEmbed ? (
                <LinkWebview src={linkPreview.href} />
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
