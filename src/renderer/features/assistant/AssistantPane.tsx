/**
 * 助手对话列：Virtuoso 虚拟列表 + 左侧主题目录跳转。
 * 不负责 Markdown 解析（见 AgentMessageBubble / ContentView）。
 */
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
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

/** 停止滚动后多久藏起右侧细滚动条 */
const SCROLLBAR_HIDE_MS = 700

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
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const empty = isAssistantLaunchEmpty(messages)
  const activeSession = sessions.find((item) => item.id === activeSessionId)
  const modeId = resolveAssistantModeId(activeSession?.agentId || activeSession?.expertId)
  const artifacts = selectActiveArtifacts(sessions, activeSessionId)

  useEffect(() => {
    void loadAssistantSessions()
    void loadAssistantChrome()
  }, [loadAssistantSessions, loadAssistantChrome])

  useEffect(() => {
    const log = chatLogRef.current
    if (!log) return
    let hideTimer = 0
    const onScroll = () => {
      log.classList.add('is-scrolling')
      window.clearTimeout(hideTimer)
      hideTimer = window.setTimeout(() => log.classList.remove('is-scrolling'), SCROLLBAR_HIDE_MS)
    }
    log.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      log.removeEventListener('scroll', onScroll)
      window.clearTimeout(hideTimer)
      log.classList.remove('is-scrolling')
    }
  }, [empty, activeSessionId])

  const lastAssistantId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'assistant') return messages[i].id
    }
    return ''
  }, [messages])

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
      <aside className={`agent-col${empty ? ' agent-launch-state' : ''}`} id="agentCol" aria-label="助手对话">
      <div className="agent-col-head">
        <AssistantSessionTabs />
      </div>
      {empty ? null : (
        <AssistantTopicNav
          messages={messages}
          chatLogRef={chatLogRef}
          requestScrollToUserMsg={scrollToUserMessage}
        />
      )}
      <div className="agent-chat-body">
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
                <AgentArtifactCards artifacts={artifacts} />
              </>
            )}
          />
        )}
        </div>
      </div>
      {empty ? null : composerWrap(<AgentComposer />, false)}
      {imageViewerUrl ? (
        <div className="agent-image-viewer show" data-testid="agent-image-viewer" onClick={() => setImageViewer('')}>
          <button type="button" className="agent-image-viewer-close" aria-label="关闭图片" onClick={() => setImageViewer('')}>×</button>
          <img src={imageViewerUrl} alt="" />
        </div>
      ) : null}
    </aside>
    </>
  )
}
