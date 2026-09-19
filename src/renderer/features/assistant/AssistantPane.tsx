/**
 * 助手对话列：Virtuoso 虚拟列表 + 左侧主题目录跳转。
 * 不负责 Markdown 解析（见 AgentMessageBubble / ContentView）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { VirtuosoHandle } from 'react-virtuoso'
import { resolveAssistantModeId } from '../../../domain/assistant-modes'
import {
  selectActiveMessages,
  useAppStore,
} from '../../app/store'
import { isAssistantLaunchEmpty } from '../../../domain/agent-session'
import { AgentComposer } from './AgentComposer'
import { AgentArtifactCards } from './AgentArtifactCards'
import { selectActiveArtifacts } from './store-assistant-apply'
import { AssistantEmptyHome } from './AssistantEmptyHome'
import { AssistantMessageVirtuoso, ASSISTANT_VIRTUOSO_THRESHOLD } from './AssistantMessageVirtuoso'
import { AssistantSessionTabs } from './AssistantSessionTabs'
import { AssistantStreamStatus } from './AssistantStreamStatus'
import { GuidedRecoveryPanel } from './GuidedRecoveryPanel'
import { AssistantTopicNav } from './AssistantTopicNav'
import { PersonalAgentGrowthPanel, type GrowthTab } from './PersonalAgentGrowthPanel'

/** 停止滚动后多久藏起右侧细滚动条 */
const SCROLLBAR_HIDE_MS = 700
const SCROLL_FOLLOW_THRESHOLD_PX = 64

// AssistantPane is intentionally mounted only for the assistant route. Keep the
// view position outside the component so leaving and returning to the route does
// not discard the active session's reading position.
const assistantScrollTopBySession = new Map<string, number>()

function composerWrap(node: ReactNode, empty: boolean) {
  const foot = <div className="agent-col-foot">{node}</div>
  if (!empty) return foot
  return (
    <div className="agent-home-composer-mount" data-agent-composer-mount="" data-testid="assistant-empty-composer">
      {foot}
    </div>
  )
}

export function AssistantPane() {
  const messages = useAppStore(selectActiveMessages)
  const sessions = useAppStore((s) => s.sessions)
  const activeSessionId = useAppStore((s) => s.activeSessionId)
  const loadAssistantSessions = useAppStore((s) => s.loadAssistantSessions)
  const loadAssistantChrome = useAppStore((s) => s.loadAssistantChrome)
  const isGenerating = useAppStore((s) => s.isGenerating)
  const imageViewerUrl = useAppStore((s) => s.imageViewerUrl)
  const setImageViewer = useAppStore((s) => s.setImageViewer)
  const setComposer = useAppStore((s) => s.setComposer)
  const sendMessage = useAppStore((s) => s.sendMessage)
  const chatLogRef = useRef<HTMLDivElement>(null)
  const composerDockRef = useRef<HTMLDivElement>(null)
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const [growthOpen, setGrowthOpen] = useState(false)
  const [growthTab, setGrowthTab] = useState<GrowthTab>('core')
  const restoredSessionRef = useRef('')
  const messageSnapshotRef = useRef<{ sessionId: string; count: number; lastTextLength: number } | null>(null)
  const nearBottomRef = useRef(true)
  const empty = isAssistantLaunchEmpty(messages)
  const activeSession = sessions.find((item) => item.id === activeSessionId)
  const modeId = resolveAssistantModeId(activeSession?.agentId || activeSession?.expertId)
  const artifacts = selectActiveArtifacts(sessions, activeSessionId)

  useLayoutEffect(() => {
    const log = chatLogRef.current
    const dock = composerDockRef.current
    if (!log || !dock) return
    const measure = () => {
      const atBottom = log.scrollHeight - log.clientHeight - log.scrollTop <= SCROLL_FOLLOW_THRESHOLD_PX
      log.style.setProperty('--assistant-composer-height', `${dock.getBoundingClientRect().height}px`)
      if (atBottom) log.scrollTop = log.scrollHeight
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure)
    observer?.observe(dock)
    return () => {
      observer?.disconnect()
      log.style.removeProperty('--assistant-composer-height')
    }
  }, [empty, growthOpen])

  useEffect(() => {
    void loadAssistantSessions()
    void loadAssistantChrome()
  }, [loadAssistantSessions, loadAssistantChrome])

  useEffect(() => {
    const openGrowth = (event: Event) => {
      const requestedTab = (event as CustomEvent<{ tab?: GrowthTab }>).detail?.tab
      setGrowthTab(requestedTab || 'core')
      setGrowthOpen(true)
    }
    window.addEventListener('knowme:open-personal-growth', openGrowth)
    return () => window.removeEventListener('knowme:open-personal-growth', openGrowth)
  }, [])

  useEffect(() => {
    const log = chatLogRef.current
    const sessionId = activeSessionId
    if (!log || !sessionId) return
    let hideTimer = 0
    const onScroll = () => {
      const distanceFromBottom = log.scrollHeight - log.clientHeight - log.scrollTop
      assistantScrollTopBySession.set(sessionId, Math.max(0, log.scrollTop))
      nearBottomRef.current = distanceFromBottom <= SCROLL_FOLLOW_THRESHOLD_PX
      log.classList.add('is-scrolling')
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => log.classList.remove('is-scrolling'), SCROLLBAR_HIDE_MS)
    }
    log.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      assistantScrollTopBySession.set(sessionId, Math.max(0, log.scrollTop))
      log.removeEventListener('scroll', onScroll)
      window.clearTimeout(hideTimer)
      log.classList.remove('is-scrolling')
    }
  }, [empty, activeSessionId])

  // Restore a session only once after its messages are present. This is kept
  // separate from the new-message follow logic so hydration/session switching
  // cannot be mistaken for a new response.
  useLayoutEffect(() => {
    if (empty || !messages.length || !activeSessionId || restoredSessionRef.current === activeSessionId) return
    const log = chatLogRef.current
    if (!log) return
    const savedTop = assistantScrollTopBySession.get(activeSessionId)
    const restore = () => {
      const currentLog = chatLogRef.current
      if (!currentLog) return
      const maxTop = Math.max(0, currentLog.scrollHeight - currentLog.clientHeight)
      const top = savedTop == null ? maxTop : Math.min(Math.max(0, savedTop), maxTop)
      currentLog.scrollTop = top
      nearBottomRef.current = maxTop - top <= SCROLL_FOLLOW_THRESHOLD_PX
    }
    restore()
    const frame = requestAnimationFrame(restore)
    restoredSessionRef.current = activeSessionId
    return () => cancelAnimationFrame(frame)
  }, [activeSessionId, empty, messages.length])

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return ''
  }, [messages])

  const lastMessageTextLength = messages.length
    ? String(messages[messages.length - 1]?.text || '').length
    : 0

  useEffect(() => {
    const snapshot = {
      sessionId: activeSessionId,
      count: messages.length,
      lastTextLength: lastMessageTextLength,
    }
    const previous = messageSnapshotRef.current
    messageSnapshotRef.current = snapshot
    if (empty || !messages.length || !previous || previous.sessionId !== activeSessionId) return
    const hasNewContent = previous.count !== snapshot.count || previous.lastTextLength !== snapshot.lastTextLength
    if (!hasNewContent || !nearBottomRef.current) return
    const frame = requestAnimationFrame(() => {
      const log = chatLogRef.current
      if (log) {
        const top = log.scrollHeight
        log.scrollTop = top
        nearBottomRef.current = true
        // The list footer includes the fixed composer's clearance. Follow the
        // scroll parent's end, not the last row hidden behind the composer.
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [activeSessionId, empty, isGenerating, lastMessageTextLength, messages.length])

  const runFollowUp = useCallback((prompt: string) => {
    setComposer(prompt)
    sendMessage(prompt)
  }, [setComposer, sendMessage])

  const runStructuredPick = useCallback((payload: string, needsInput: boolean) => {
    setComposer(payload)
    if (!needsInput) sendMessage(payload)
  }, [setComposer, sendMessage])

  const scrollToUserMessage = useCallback((userMsgIdx: number) => {
    if (messages.length > ASSISTANT_VIRTUOSO_THRESHOLD) {
      virtuosoRef.current?.scrollToIndex({
        index: userMsgIdx,
        align: 'start',
        behavior: 'smooth',
      })
      return
    }
    const log = chatLogRef.current
    if (!log) return
    const target = log.querySelector(`.agent-bubble.user[data-user-msg-idx="${userMsgIdx}"]`)
    if (target instanceof HTMLElement) {
      const top = target.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop
      log.scrollTo({ top: Math.max(0, top - 8), behavior: 'smooth' })
    }
  }, [messages.length])

  return (
    <>
      <aside className={`agent-col conversation-surface${empty ? ' agent-launch-state' : ''}`} id="agentCol" aria-label="助手对话">
      {!growthOpen ? (
        <div className="agent-col-head">
          <AssistantSessionTabs onOpenGrowth={() => setGrowthOpen(true)} />
        </div>
      ) : null}
      {growthOpen ? (
        <PersonalAgentGrowthPanel initialTab={growthTab} onClose={() => setGrowthOpen(false)} />
      ) : null}
      {!growthOpen && !empty ? (
        <AssistantTopicNav
          messages={messages}
          chatLogRef={chatLogRef}
          requestScrollToUserMsg={scrollToUserMessage}
        />
      ) : null}
      {!growthOpen ? <div className="agent-chat-body">
        <div className="agent-chat-log" id="agentChatLog" data-testid="agent-chat-log" ref={chatLogRef}>
        {empty ? (
          <AssistantEmptyHome
            composer={composerWrap(<AgentComposer launchEmpty />, true)}
            modeId={modeId}
            expertId={activeSession?.expertId}
          />
        ) : (
          <AssistantMessageVirtuoso
            ref={virtuosoRef}
            messages={messages}
            chatLogRef={chatLogRef}
            lastAssistantId={lastAssistantId}
            isGenerating={isGenerating}
            modeId={modeId}
            onFollowUp={runFollowUp}
            onStructuredPick={runStructuredPick}
            onImageOpen={setImageViewer}
            footer={(
              <>
                <AssistantStreamStatus />
                <GuidedRecoveryPanel />
                <AgentArtifactCards artifacts={artifacts} onImageOpen={setImageViewer} />
                <div className="assistant-composer-clearance" aria-hidden="true" />
              </>
            )}
          />
        )}
        </div>
        {empty ? null : (
          <div className="assistant-composer-dock" ref={composerDockRef}>
            {composerWrap(<AgentComposer />, false)}
          </div>
        )}
      </div> : null}
      {imageViewerUrl ? (
        <div className="agent-image-viewer show" data-testid="agent-image-viewer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setImageViewer('') }}>
          <section className="agent-image-viewer-dialog" role="dialog" aria-modal="true" aria-label="图片预览" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="agent-image-viewer-close" aria-label="关闭图片" onClick={() => setImageViewer('')}>×</button>
            <img src={imageViewerUrl} alt="图片预览" />
          </section>
        </div>
      ) : null}
    </aside>
    </>
  )
}
