/**
 * 助理顶栏：会话 Tab、历史弹出、专家 / 更多菜单。
 * 不负责对话正文与输入框。
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { hasErrorMessage, lastErrorMessageText } from '../../../domain/agent-message-ui'
import { resolveAssistantModeId } from '../../../domain/assistant-modes'
import { sortSessionTabs, resolveSessionTabLabel } from '../../../domain/agent-session'
import { taskRelTime } from '../../../domain/run-projection'
import { selectActiveMessages, useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { AssistantTabContextMenu, ModeAvatarMark } from './AssistantTabContextMenu'

type MenuState = { id: string; x: number; y: number }

function SessionTabLabel({ text }: { text: string }) {
  const wrapRef = useRef<HTMLSpanElement>(null)
  const [overflowDistance, setOverflowDistance] = useState(0)

  useEffect(() => {
    const node = wrapRef.current
    if (!node) return undefined
    const measure = () => setOverflowDistance(Math.max(0, node.scrollWidth - node.clientWidth))
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(node)
    return () => observer?.disconnect()
  }, [text])

  return (
    <span className={`tab-label${overflowDistance > 0 ? ' is-overflowing' : ''}`} ref={wrapRef}>
      <span
        className="tab-label-text"
        style={overflowDistance > 0 ? { '--tab-label-shift': `${overflowDistance}px` } as CSSProperties : undefined}
      >
        {text}
      </span>
    </span>
  )
}

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const pad = 8
  return {
    left: Math.max(pad, Math.min(x, window.innerWidth - width - pad)),
    top: Math.max(pad, Math.min(y, window.innerHeight - height - pad)),
  }
}

export function AssistantSessionTabs({ onOpenGrowth }: { onOpenGrowth?: () => void }) {
  const sessions = useAppStore((s) => s.sessions)
  const history = useAppStore((s) => s.sessionHistory)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const sessionStates = useAppStore((s) => s.sessionStates)
  const messages = useAppStore(selectActiveMessages)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const selectSession = useAppStore((s) => s.selectSession)
  const newSession = useAppStore((s) => s.newSession)
  const renameSession = useAppStore((s) => s.renameSession)
  const forkSession = useAppStore((s) => s.forkSession)
  const closeSessionTab = useAppStore((s) => s.closeSessionTab)
  const copySessionTranscript = useAppStore((s) => s.copySessionTranscript)
  const showToast = useAppStore((s) => s.showToast)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [historyLimit, setHistoryLimit] = useState(10)
  const [renaming, setRenaming] = useState('')
  const orderedSessions = useMemo(() => sortSessionTabs(sessions), [sessions])
  const openIds = useMemo(() => new Set(sessions.map((item) => item.id)), [sessions])
  const canCopyError = hasErrorMessage(messages)

  useEffect(() => {
    function onClose() {
      setMenu(null)
      setHistoryOpen(false)
      setMoreOpen(false)
    }
    document.addEventListener('click', onClose)
    return () => document.removeEventListener('click', onClose)
  }, [])

  useEffect(() => {
    setHistoryLimit(10)
  }, [historyQuery])

  const historyItems = useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    return [...history]
      .sort((a, b) => {
        const at = Date.parse(String(b.updatedAt || '')) || 0
        const bt = Date.parse(String(a.updatedAt || '')) || 0
        if (at !== bt) return at - bt
        return resolveSessionTabLabel(a).localeCompare(resolveSessionTabLabel(b), 'zh')
      })
      .filter((item) => {
        if (!q) return true
        const label = resolveSessionTabLabel(item).toLowerCase()
        const title = String(item.title || item.id || '').toLowerCase()
        return label.includes(q) || title.includes(q)
      })
      .slice(0, historyLimit)
  }, [history, historyQuery, historyLimit])

  const matchingHistoryCount = useMemo(() => {
    const q = historyQuery.trim().toLowerCase()
    return history.filter((item) => {
      if (!q) return true
      const label = resolveSessionTabLabel(item).toLowerCase()
      const title = String(item.title || item.id || '').toLowerCase()
      return label.includes(q) || title.includes(q)
    }).length
  }, [history, historyQuery])

  async function handleTabCtxAction(action: string, sessionId: string) {
    setMenu(null)
    if (action === 'transcript') {
      await copySessionTranscript(sessionId)
      return
    }
    if (action === 'rename') {
      setRenaming(sessionId)
      return
    }
    if (action === 'close') await closeSessionTab(sessionId)
  }

  async function handleMoreAction(action: string) {
    setMoreOpen(false)
    const activeId = activeSessionId
    if (action === 'properties') {
      onOpenGrowth?.()
      return
    }
    if (action === 'copy-error') {
      const text = lastErrorMessageText(messages)
      if (!text) {
        showToast('当前没有错误信息')
        return
      }
      window.api?.copyToClipboard?.(text)
      showToast('已复制错误信息')
      return
    }
    if (action === 'fork') {
      if (isGenerating) {
        showToast('当前助手正在生成，请稍候')
        return
      }
      if (!activeId) return
      await forkSession(activeId)
      showToast('已在新对话继续')
      return
    }
    if (action === 'copy-summary') {
      if (!activeId) return
      try {
        const res = await window.api?.agentSessionSummary?.(activeId) as { ok?: boolean; text?: string; error?: string } | undefined
        const text = String(res?.text || '').trim()
        if (!text) {
          showToast('当前还没有可复制的总结')
          return
        }
        window.api?.copyToClipboard?.(text)
        showToast('已复制当前总结')
      } catch {
        showToast('复制失败')
      }
    }
  }

  function openContextMenu(sessionId: string, clientX: number, clientY: number) {
    const pos = clampMenuPosition(clientX, clientY, 196, 148)
    setMenu({ id: sessionId, x: pos.left, y: pos.top })
  }

  function openNewSession() {
    if (isGenerating) {
      showToast('当前助手正在生成，请稍候')
      return
    }
    newSession()
    setHistoryOpen(false)
    setMoreOpen(false)
  }

  return (
    <>
      <div className="agent-tab-scroll">
<div className="agent-session-tabs" role="tablist" aria-label="智能伙伴主题">
          {orderedSessions.map((s) => (
            renaming === s.id ? (
              <input
                key={s.id}
                className="agent-session-tab active"
                defaultValue={s.title || '对话'}
                aria-label="重命名会话"
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onBlur={(e) => { void renameSession(s.id, e.target.value); setRenaming('') }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { void renameSession(s.id, (e.target as HTMLInputElement).value); setRenaming('') }
                  if (e.key === 'Escape') setRenaming('')
                }}
              />
            ) : (
              <div
                key={s.id}
                role="tab"
                tabIndex={0}
                className={`agent-session-tab${s.id === activeSessionId ? ' active' : ''}${s.pinned ? ' pinned' : ''}`}
                aria-selected={s.id === activeSessionId}
                onClick={() => selectSession(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectSession(s.id)
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  openContextMenu(s.id, e.clientX, e.clientY)
                }}
              >
                {s.pinned ? (
                  <span className="tab-pin" aria-hidden="true">📌</span>
                ) : (
                  <span className="tab-state-icon" aria-hidden="true">
                    <Icon name={s.id === activeSessionId && isGenerating ? 'play' : sessionStates[s.id]?.messages.some((item) => item.role === 'assistant' && item.text.trim()) ? 'check' : 'chat'} />
                  </span>
                )}
                <SessionTabLabel text={resolveSessionTabLabel(s, {
                  firstUserText: sessionStates[s.id]?.messages.find((item) => item.role === 'user')?.text,
                })} />
                <button
                  type="button"
                  className="tab-close"
                  title="关闭"
                  aria-label="关闭"
                  onClick={(e) => {
                    e.stopPropagation()
                    void closeSessionTab(s.id)
                  }}
                >
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            )
          ))}
        </div>
      </div>
      <div className="agent-head-tools">
        <button
          type="button"
          className="agent-head-tool agent-expert-tool"
          id="agentExpertBtn"
          aria-label="新主题"
          title="新主题"
          onClick={(e) => { e.stopPropagation(); openNewSession() }}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className={`agent-head-tool${historyOpen ? ' is-open' : ''}`}
          id="agentHistoryBtn"
          title="历史会话"
          aria-label="历史"
          aria-expanded={historyOpen}
          onClick={(e) => { e.stopPropagation(); setHistoryOpen((open) => !open); setMoreOpen(false) }}
        >
          <Icon name="history" />
        </button>
        <button
          type="button"
          className="agent-head-tool"
          id="agentMoreBtn"
          title="更多"
          aria-label="更多"
          onClick={(e) => { e.stopPropagation(); setMoreOpen((open) => !open); setHistoryOpen(false) }}
        >
          <Icon name="moreHorizontal" />
        </button>
      </div>
      {moreOpen ? (
        <div className="agent-pop show" id="agentMorePop" data-testid="agent-more-pop" role="menu" aria-label="当前对话" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="agent-pop-item" onClick={() => void handleMoreAction('properties')}>
            <Icon name="properties" /><span>智能伙伴属性</span>
          </button>
          <div className="agent-pop-sep" />
          <button type="button" className="agent-pop-item" onClick={() => void handleMoreAction('fork')}>
            <Icon name="plus" /><span>在新对话继续</span>
          </button>
          <div className="agent-pop-sep" />
          <button type="button" className="agent-pop-item" onClick={() => void handleMoreAction('copy-summary')}>
            <Icon name="copy" /><span>复制当前总结</span>
          </button>
          {canCopyError ? (
            <button
              type="button"
              className="agent-pop-item"
              onClick={() => void handleMoreAction('copy-error')}
            >
              <Icon name="copy" /><span>复制错误信息</span>
            </button>
          ) : null}
        </div>
      ) : null}
      {historyOpen ? (
        <div className="agent-pop history-pop show" data-testid="agent-history-pop" role="menu" aria-label="历史会话" onClick={(e) => e.stopPropagation()}>
          <div className="history-pop-search">
            <input
              type="search"
              className="history-pop-query"
              placeholder="搜索历史会话"
              aria-label="搜索历史会话"
              value={historyQuery}
              onChange={(e) => setHistoryQuery(e.target.value)}
            />
          </div>
          <div className="history-pop-list">
            {historyItems.length === 0 ? (
              <div className="agent-pop-empty">暂无历史会话</div>
              ) : historyItems.map((item) => {
              const label = resolveSessionTabLabel(item)
              const when = taskRelTime(item.updatedAt)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`agent-pop-item${item.id === activeSessionId ? ' active' : ''}`}
                  title={label}
                  onClick={() => {
                    if (isGenerating && item.id !== activeSessionId) {
                      showToast('当前助手正在生成，请稍候')
                      return
                    }
                    selectSession(item.id)
                    setHistoryOpen(false)
                  }}
                >
                  <ModeAvatarMark modeId={resolveAssistantModeId(item.agentId || item.expertId)} />
                  <span className="pop-copy">
                    <span className="pop-label">{label}</span>
                    {item.summary ? <span className="pop-summary">{item.summary}</span> : null}
                    {when ? <span className="pop-when">{when}</span> : null}
                  </span>
                  {openIds.has(item.id) ? <span className="pop-meta">已打开</span> : null}
                </button>
              )
              })}
          </div>
          {historyItems.length < matchingHistoryCount ? (
            <button type="button" className="agent-pop-item history-pop-more" onClick={() => setHistoryLimit((limit) => limit + 10)}>
              <span>展开显示</span><span className="pop-meta">还有 {matchingHistoryCount - historyItems.length} 条</span>
            </button>
          ) : null}
        </div>
      ) : null}
      {menu ? (
        <AssistantTabContextMenu
          sessionId={menu.id}
          style={{ left: menu.x, top: menu.y }}
          onAction={(action, sessionId) => void handleTabCtxAction(action, sessionId)}
        />
      ) : null}
    </>
  )
}
