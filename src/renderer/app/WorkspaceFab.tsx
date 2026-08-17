/**
 * 工作台右下角通知铃铛：展开面板、拖动纵向位置、按页面让开叠压控件。
 * 不负责桌面 attention-toast 窗（见 ipc/attention-notify）。
 */
import { useEffect, useRef, useState } from 'react'
import { attentionKicker } from '../../domain/attention'
import { Icon } from './Icon'
import { useAppStore } from './store'

const FAB_POS_KEY = 'knowme.fab.pos.v3'
/** 对齐重构前 RIGHT_MARGIN / MARGIN */
const FAB_EDGE = 6
/** 与 #km-fab-btn 热区边长一致，供拖动夹紧 */
const FAB_SIZE = 34
/** 编排画布 `.wb-studio-nav` 高度 + 边距，避免与缩放条叠压 */
const STUDIO_NAV_CLEARANCE = 52

export type FabInset = { right: number; bottom: number }

/** 按路由/表面计算铃铛边距：水平始终贴右；仅编排画布抬高底边。 */
export function resolveFabInset(
  route: string,
  surface: string,
): FabInset {
  if (route === 'workbench' && surface === 'studio') {
    return { right: FAB_EDGE, bottom: STUDIO_NAV_CLEARANCE }
  }
  return { right: FAB_EDGE, bottom: FAB_EDGE }
}

function readFabTop(): number | null {
  try {
    const raw = localStorage.getItem(FAB_POS_KEY)
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  } catch {
    return null
  }
}

function saveFabTop(top: number) {
  try {
    localStorage.setItem(FAB_POS_KEY, String(Math.round(top)))
  } catch {
    /* ignore */
  }
}

export function WorkspaceFab() {
  const route = useAppStore((s) => s.route)
  const surface = useAppStore((s) => s.workbenchSurface)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const items = useAppStore((s) => s.attentionItems)
  const attentionPulse = useAppStore((s) => s.attentionPulse)
  const activateAttention = useAppStore((s) => s.activateAttention)
  const setAttentionPulse = useAppStore((s) => s.setAttentionPulse)
  const [open, setOpen] = useState(false)
  const [top, setTop] = useState<number | null>(() => readFabTop())
  const rootRef = useRef<HTMLDivElement>(null)
  const movedRef = useRef(false)

  const inset = resolveFabInset(route, surface)
  const hasItems = items.length > 0
  const hasInput = items.some((item) => item.urgency === 'input')

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  function clampTop(next: number, bottomInset = inset.bottom) {
    const min = FAB_EDGE
    const max = Math.max(min, window.innerHeight - FAB_SIZE - bottomInset)
    return Math.min(max, Math.max(min, next))
  }

  // 切到有底边避让的页面时，把拖过的位置夹回安全区
  useEffect(() => {
    setTop((prev) => {
      if (prev == null) return prev
      const max = Math.max(FAB_EDGE, window.innerHeight - FAB_SIZE - inset.bottom)
      const clamped = Math.min(max, Math.max(FAB_EDGE, prev))
      if (clamped === prev) return prev
      saveFabTop(clamped)
      return clamped
    })
  }, [inset.bottom])

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0) return
    movedRef.current = false
    const startY = e.clientY
    const base = rootRef.current?.getBoundingClientRect().top
      ?? top
      ?? window.innerHeight - FAB_SIZE - inset.bottom
    const onMove = (ev: PointerEvent) => {
      const dy = ev.clientY - startY
      if (!movedRef.current && Math.abs(dy) > 4) {
        movedRef.current = true
        setOpen(false)
      }
      if (movedRef.current) {
        setTop(clampTop(base + dy))
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (movedRef.current && rootRef.current) {
        saveFabTop(rootRef.current.getBoundingClientRect().top)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const style = {
    right: `${inset.right}px`,
    ...(top != null
      ? { top: `${top}px`, bottom: 'auto' as const }
      : { bottom: `${inset.bottom}px` }),
  }
  const ariaLabel = hasInput ? '通知，有待处理事项' : '通知'

  return (
    <div
      ref={rootRef}
      id="km-fab-root"
      className={`km-fab-root${open ? ' open' : ''}${isGenerating ? ' processing' : ''}${attentionPulse && hasInput ? ' needs-attention' : ''}`}
      style={style}
      data-fab-right={inset.right}
      data-fab-bottom={inset.bottom}
      aria-hidden="false"
    >
      <div id="km-fab-panel" className="km-fab-panel" role="menu" aria-label="通知">
        <div className="km-fab-head">
          <span className="km-fab-avatar" aria-hidden="true">
            {/* 几何与品牌母版同坐标，viewBox 裁到标记包围盒 */}
            <svg viewBox="79 87 865 820">
              <path className="km-fab-mark-line" d="M173 190 L173 805 L559 508" />
              <path className="km-fab-mark-line" d="M559 508 L850 181" />
              <path className="km-fab-mark-line" d="M559 508 L850 813" />
              <circle className="km-fab-mark-node" cx="173" cy="805" r="94" />
              <circle className="km-fab-mark-node" cx="559" cy="508" r="108" />
              <circle className="km-fab-mark-node" cx="850" cy="181" r="94" />
              <circle className="km-fab-mark-node" cx="850" cy="813" r="94" />
              <circle className="km-fab-mark-origin" cx="173" cy="190" r="75" />
            </svg>
          </span>
          <div>
            <div className="km-fab-title">通知</div>
            <div className="km-fab-sub">提醒与快捷入口</div>
          </div>
        </div>
        {hasItems ? (
          <div id="km-fab-notify" aria-live="polite" data-testid="km-fab-notify">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="km-fab-notify-item"
                data-attention-id={item.id}
                data-testid="km-fab-notify-item"
                onClick={(e) => {
                  e.stopPropagation()
                  activateAttention(item.id)
                  setOpen(false)
                }}
              >
                <div className="km-fab-notify-kicker">{attentionKicker(item)}</div>
                <div className="km-fab-notify-title">{item.title}</div>
                {item.body ? <div className="km-fab-notify-body">{item.body}</div> : null}
              </button>
            ))}
          </div>
        ) : (
          <div id="km-fab-notify" hidden />
        )}
        <div className="km-fab-actions" role="group" aria-label="功能">
          <button
            type="button"
            className="km-fab-action"
            id="km-fab-logs"
            role="menuitem"
            title="日志中心 · 运行/LLM/MCP"
            aria-label="日志中心"
            onClick={() => { window.api?.openLogsWindow?.(); setOpen(false) }}
          >
            <span className="km-fab-ico" aria-hidden="true"><Icon name="terminal" /></span>
          </button>
          <button
            type="button"
            className="km-fab-action"
            id="km-fab-logs-dir"
            role="menuitem"
            title="日志目录"
            aria-label="日志目录"
            onClick={() => { window.api?.openLogsDir?.(); setOpen(false) }}
          >
            <span className="km-fab-ico" aria-hidden="true"><Icon name="folder" /></span>
          </button>
        </div>
      </div>
      <button
        type="button"
        id="km-fab-btn"
        title="通知"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onPointerDown={onPointerDown}
        onClick={(e) => {
          e.stopPropagation()
          if (movedRef.current) {
            movedRef.current = false
            return
          }
          if (!open) setAttentionPulse(false)
          setOpen((v) => !v)
        }}
      >
        <span className="km-fab-glyph" aria-hidden="true">
          <svg className="km-fab-bell" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10.27 21a2 2 0 0 0 3.46 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M3.26 15.33A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.67C19.41 13.96 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.41 5.96-2.74 7.33" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span className="km-fab-badge" id="km-fab-badge" hidden={!hasItems} aria-hidden={!hasItems} />
      </button>
    </div>
  )
}
