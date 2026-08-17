import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { extractImageUrls } from '../../../domain/agent-session'
import { resolveAssistantModeId } from '../../../domain/assistant-modes'
import {
  selectActiveMessages,
  useAppStore,
} from '../../app/store'
import { isAssistantLaunchEmpty } from '../../../domain/agent-session'
import { INCOMPLETE_ASSISTANT_REPLY } from '../../../domain/agent-v2-runtime'
import { AgentComposer } from './AgentComposer'
import { AgentMessageBubble } from './AgentMessageBubble'
import { AgentArtifactCards } from './AgentArtifactCards'
import { selectActiveArtifacts } from './store-assistant-apply'
import { AssistantEmptyHome } from './AssistantEmptyHome'
import { AssistantSessionTabs } from './AssistantSessionTabs'
import { AssistantTopicNav } from './AssistantTopicNav'

const MESSAGE_PAGE = 32

function composerWrap(node: ReactNode, empty: boolean) {
  if (!empty) return <div className="agent-col-foot">{node}</div>
  return (
    <div className="agent-home-composer-mount" data-agent-composer-mount="" data-testid="assistant-empty-composer">
      <div className="agent-col-foot">{node}</div>
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
  const [visibleCount, setVisibleCount] = useState(MESSAGE_PAGE)
  const chatLogRef = useRef<HTMLDivElement>(null)
  const empty = isAssistantLaunchEmpty(messages)
  const activeSession = sessions.find((item) => item.id === activeSessionId)
  const modeId = resolveAssistantModeId(activeSession?.agentId || activeSession?.expertId)
  const artifacts = selectActiveArtifacts(sessions, activeSessionId)

  // 首屏不扇出 fileCatalog（@ / 文件侧栏再拉）；只拉会话与 chrome
  useEffect(() => {
    void loadAssistantSessions()
    void loadAssistantChrome()
  }, [loadAssistantSessions, loadAssistantChrome])

  useEffect(() => {
    setVisibleCount(MESSAGE_PAGE)
  }, [activeSessionId])

  const hiddenCount = Math.max(0, messages.length - visibleCount)
  const visibleMessages = hiddenCount > 0 ? messages.slice(-visibleCount) : messages
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

  return (
    <>
      {empty ? null : <AssistantTopicNav messages={messages} chatLogRef={chatLogRef} />}
      <aside className={`agent-col${empty ? ' agent-launch-state' : ''}`} id="agentCol" aria-label="助手对话">
      <div className="agent-col-head">
        <AssistantSessionTabs />
      </div>
      <div className="agent-chat-log" id="agentChatLog" data-testid="agent-chat-log" ref={chatLogRef}>
        {empty ? (
          <AssistantEmptyHome
            composer={composerWrap(<AgentComposer launchEmpty />, true)}
            modeId={modeId}
            expertId={activeSession?.expertId}
          />
        ) : (
          <>
            {hiddenCount > 0 ? (
              <button
                type="button"
                className="msg system"
                onClick={() => setVisibleCount((n) => Math.min(messages.length, n + MESSAGE_PAGE))}
                data-testid="agent-show-earlier"
              >
                … 更早 {Math.min(MESSAGE_PAGE, hiddenCount)} / 共隐 {hiddenCount} 条
              </button>
            ) : null}
            {visibleMessages.map((m) => {
              const images = extractImageUrls(m.text)
              const userIdx = m.role === 'user' ? messages.findIndex((row) => row.id === m.id) : undefined
              const role = m.role === 'user' ? 'user' : 'assistant'
              const isLastAssistant = m.id === lastAssistantId && m.role === 'assistant'
              return (
        <AgentMessageBubble
                  key={m.id}
                  role={role}
                  text={m.thinking && !m.text ? undefined : m.text}
                  userMsgIdx={userIdx}
                  streaming={m.streaming}
                  thinking={m.thinking && !m.text}
                  error={m.role === 'error'}
                  message={m.role === 'assistant' ? m : undefined}
                  modeId={modeId}
                  showFollowUps={isLastAssistant && !isGenerating && m.role !== 'error' && m.text !== INCOMPLETE_ASSISTANT_REPLY}
                  onFollowUp={runFollowUp}
                  onStructuredPick={runStructuredPick}
                >
                  {m.attachmentName ? (
                    <div className="agent-attachment">
                      <span className="attachment-name">{m.attachmentName}</span>
                    </div>
                  ) : null}
                  {images.map((url) => (
                    <button key={url} type="button" className="agent-msg-image" data-testid="agent-msg-image" onClick={() => setImageViewer(url)}>
                      <img src={url} alt="" />
                    </button>
                  ))}
                </AgentMessageBubble>
              )
            })}
            {!empty ? <AgentArtifactCards artifacts={artifacts} /> : null}
          </>
        )}
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
