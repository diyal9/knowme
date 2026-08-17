import { useEffect, useMemo, useState } from 'react'
import { hasErrorMessage, lastErrorMessageText } from '../../../domain/agent-message-ui'
import { readAgentPresenceEnabled, toggleAgentPresenceEnabled } from '../../../domain/agent-presence'
import { BUILTIN_ASSISTANT_MODES, resolveAssistantModeId } from '../../../domain/assistant-modes'
import { sortSessionTabs, resolveSessionTabLabel } from '../../../domain/agent-session'
import { selectActiveMessages, useAppStore } from '../../app/store'
import { Icon } from '../../app/Icon'
import { AssistantTabContextMenu, ModeAvatarMark } from './AssistantTabContextMenu'

type MenuState = { id: string; x: number; y: number }

function clampMenuPosition(x: number, y: number, width: number, height: number) {
  const pad = 8
  return {
    left: Math.max(pad, Math.min(x, window.innerWidth - width - pad)),
    top: Math.max(pad, Math.min(y, window.innerHeight - height - pad)),
  }
}

export function AssistantSessionTabs() {
  const sessions = useAppStore((s) => s.sessions)
  const history = useAppStore((s) => s.sessionHistory)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const messages = useAppStore(selectActiveMessages)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const selectSession = useAppStore((s) => s.selectSession)
  const newSession = useAppStore((s) => s.newSession)
  const renameSession = useAppStore((s) => s.renameSession)
  const pinSession = useAppStore((s) => s.pinSession)
  const forkSession = useAppStore((s) => s.forkSession)
  const closeSessionTab = useAppStore((s) => s.closeSessionTab)
  const closeSessionTabs = useAppStore((s) => s.closeSessionTabs)
  const copySessionTranscript = useAppStore((s) => s.copySessionTranscript)
  const startAssistantMode = useAppStore((s) => s.startAssistantMode)
  const showToast = useAppStore((s) => s.showToast)
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [expertOpen, setExpertOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [historyQuery, setHistoryQuery] = useState('')
  const [renaming, setRenaming] = useState('')
  const [presenceEnabled, setPresenceEnabled] = useState(() => readAgentPresenceEnabled())
  const activeModeId = resolveAssistantModeId(
    sessions.find((item) => item.id === activeSessionId)?.agentId
      || sessions.find((item) => item.id === activeSessionId)?.expertId,
  )

  const orderedSessions = useMemo(() => sortSessionTabs(sessions), [sessions])
  const openIds = useMemo(() => new Set(sessions.map((item) => item.id)), [sessions])
  const canCopyError = hasErrorMessage(messages)

  useEffect(() => {
    function onClose() {
      setMenu(null)
      setHistoryOpen(false)
      setExpertOpen(false)
      setMoreOpen(false)
    }
    document.addEventListener('click', onClose)
    return () => document.removeEventListener('click', onClose)
  }, [])

  const historyItems = [...history]
    .sort((a, b) => String(b.title || '').localeCompare(String(a.title || '')))
    .filter((item) => {
      const q = historyQuery.trim().toLowerCase()
      if (!q) return true
      return String(item.title || item.id || '').toLowerCase().includes(q)
    })
    .slice(0, 30)

  async function handleTabCtxAction(action: string, sessionId: string) {
    setMenu(null)
    const orderedIds = orderedSessions.map((item) => item.id)
    const currentIndex = orderedIds.indexOf(sessionId)
    const leftIds = currentIndex > 0 ? orderedIds.slice(0, currentIndex) : []
    const rightIds = currentIndex >= 0 ? orderedIds.slice(currentIndex + 1) : []
    const otherIds = orderedIds.filter((id) => id !== sessionId)

    if (action === 'manage') {
      if (isGenerating && activeSessionId !== sessionId) {
        showToast('当前助手正在生成，请稍候')
        return
      }
      if (activeSessionId !== sessionId) selectSession(sessionId)
      setMoreOpen(true)
      return
    }
    if (action === 'transcript') {
      await copySessionTranscript(sessionId)
      return
    }
    if (action === 'rename') {
      setRenaming(sessionId)
      return
    }
    if (action === 'pin') {
      const pinned = sessions.find((item) => item.id === sessionId)?.pinned === true
      await pinSession(sessionId, !pinned)
      showToast(pinned ? '已取消 Pin' : '已 Pin')
      return
    }
    if (action === 'fork') {
      await forkSession(sessionId)
      return
    }
    if (action === 'close') {
      await closeSessionTab(sessionId)
      return
    }
    if (action === 'close-left') {
      await closeSessionTabs(leftIds)
      showToast('已关闭左侧会话')
      return
    }
    if (action === 'close-right') {
      await closeSessionTabs(rightIds)
      showToast('已关闭右侧会话')
      return
    }
    if (action === 'close-others') {
      await closeSessionTabs(otherIds)
      showToast('已关闭其他会话')
    }
  }

  async function handleMoreAction(action: string) {
    setMoreOpen(false)
    const activeId = activeSessionId
    if (action === 'toggle-presence') {
      const enabled = toggleAgentPresenceEnabled()
      setPresenceEnabled(enabled)
      showToast(enabled ? '已开启动作表现' : '已关闭动作表现')
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
      return
    }
    if (action === 'rename') {
      if (!activeId) return
      setRenaming(activeId)
      return
    }
    if (action === 'close') {
      if (!activeId) return
      await closeSessionTab(activeId)
    }
  }

  function openContextMenu(sessionId: string, clientX: number, clientY: number) {
    const pos = clampMenuPosition(clientX, clientY, 196, 220)
    setMenu({ id: sessionId, x: pos.left, y: pos.top })
  }

  function openNewSession() {
    if (isGenerating) {
      showToast('当前助手正在生成，请稍候')
      return
    }
    newSession()
    setExpertOpen(false)
    setHistoryOpen(false)
    setMoreOpen(false)
  }

  return (
    <>
      <div className="agent-tab-scroll">
        <div className="agent-session-tabs" role="tablist" aria-label="助手会话">
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
                  <ModeAvatarMark
                    modeId={resolveAssistantModeId(s.agentId || s.expertId)}
                    size={16}
                    className="tab-agent-avatar"
                  />
                )}
                <span className="tab-label">{resolveSessionTabLabel(s)}</span>
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
          aria-label="我的专家"
          title="我的专家"
          onClick={(e) => { e.stopPropagation(); setExpertOpen((open) => !open); setHistoryOpen(false); setMoreOpen(false) }}
        >
          <Icon name="plus" />
        </button>
        <button
          type="button"
          className="agent-head-tool"
          id="agentHistoryBtn"
          title="历史 Session"
          aria-label="历史"
          onClick={(e) => { e.stopPropagation(); setHistoryOpen((open) => !open); setExpertOpen(false); setMoreOpen(false) }}
        >
          <Icon name="history" />
        </button>
        <button
          type="button"
          className="agent-head-tool"
          id="agentMoreBtn"
          title="更多"
          aria-label="更多"
          onClick={(e) => { e.stopPropagation(); setMoreOpen((open) => !open); setHistoryOpen(false); setExpertOpen(false) }}
        >
          <Icon name="moreHorizontal" />
        </button>
      </div>
      {expertOpen ? (
        <div className="agent-pop expert-pop show" id="agentExpertPop" data-testid="agent-expert-menu" role="menu" aria-label="选择助手模式" onClick={(e) => e.stopPropagation()}>
          {BUILTIN_ASSISTANT_MODES.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`agent-pop-item agent-expert-item${item.id === activeModeId ? ' active' : ''}`}
              onClick={() => { void startAssistantMode(item.id); setExpertOpen(false) }}
            >
              <ModeAvatarMark modeId={item.id} />
              <span className="expert-copy">
                <span className="expert-name">{item.name}</span>
                <span className="expert-desc">{item.description}</span>
              </span>
            </button>
          ))}
        </div>
      ) : null}
      {moreOpen ? (
        <div className="agent-pop show" id="agentMorePop" data-testid="agent-more-pop" role="menu" aria-label="助手管理" onClick={(e) => e.stopPropagation()}>
          <button type="button" className="agent-pop-item" onClick={() => void handleMoreAction('copy-summary')}>
            <Icon name="copy" /><span>复制当前总结</span>
          </button>
          <button
            type="button"
            className="agent-pop-item"
            data-testid="agent-new-chat-btn"
            onClick={() => { setMoreOpen(false); openNewSession() }}
          >
            <Icon name="chat" /><span>新对话</span>
          </button>
          <button type="button" className="agent-pop-item" onClick={() => void handleMoreAction('fork')}>
            <Icon name="plus" /><span>在新对话继续</span>
          </button>
          <button type="button" className="agent-pop-item" onClick={() => void handleMoreAction('rename')}>
            <Icon name="edit" /><span>重命名</span>
          </button>
          <div className="agent-pop-sep" />
          <button
            type="button"
            className="agent-pop-item"
            aria-pressed={presenceEnabled}
            onClick={() => void handleMoreAction('toggle-presence')}
          >
            <Icon name="optimize" /><span>{`动作表现：${presenceEnabled ? '已开启' : '已关闭'}`}</span>
          </button>
          <button
            type="button"
            className="agent-pop-item"
            disabled={!canCopyError}
            onClick={() => void handleMoreAction('copy-error')}
          >
            <Icon name="copy" /><span>复制错误信息</span>
          </button>
          <button type="button" className="agent-pop-item" onClick={() => void handleMoreAction('close')}>
            <Icon name="close" /><span>关闭 Tab</span>
          </button>
        </div>
      ) : null}
      {historyOpen ? (
        <div className="agent-pop history-pop show" data-testid="agent-history-pop" role="menu" aria-label="历史 Session" onClick={(e) => e.stopPropagation()}>
          <input
            type="search"
            placeholder="搜索历史会话"
            aria-label="搜索历史会话"
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
          />
          {historyItems.length === 0 ? (
            <div className="agent-pop-empty">暂无历史 Session</div>
          ) : historyItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`agent-pop-item${item.id === activeSessionId ? ' active' : ''}`}
              onClick={() => {
                if (isGenerating && item.id !== activeSessionId) {
                  showToast('当前助手正在生成，请稍候')
                  return
                }
                selectSession(item.id)
                setHistoryOpen(false)
              }}
            >
              <Icon name="chat" />
              <span>{item.title || item.id}</span>
              <span className="pop-meta">{openIds.has(item.id) ? '已打开' : ''}</span>
            </button>
          ))}
        </div>
      ) : null}
      {menu ? (
        <AssistantTabContextMenu
          sessionId={menu.id}
          sessions={orderedSessions}
          style={{ left: menu.x, top: menu.y }}
          onAction={(action, sessionId) => void handleTabCtxAction(action, sessionId)}
        />
      ) : null}
    </>
  )
}
