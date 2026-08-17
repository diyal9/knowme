import { useEffect, useMemo, useRef } from 'react'
import { buildConversationTopics } from '../../../domain/agent-topics'
import type { ChatMessage } from '../../../shared/api'

type Props = {
  messages: ChatMessage[]
  chatLogRef: React.RefObject<HTMLDivElement | null>
}

export function AssistantTopicNav({ messages, chatLogRef }: Props) {
  const topics = useMemo(() => buildConversationTopics(messages), [messages])
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    const log = chatLogRef.current
    if (!nav || !log) return
    const sync = () => {
      const overflow = log.scrollHeight - log.clientHeight > 1
      nav.hidden = !(topics.length > 2 && overflow)
    }
    sync()
    log.addEventListener('scroll', sync)
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(sync)
      observer.observe(log)
    }
    return () => {
      log.removeEventListener('scroll', sync)
      observer?.disconnect()
    }
  }, [chatLogRef, topics.length])

  if (topics.length <= 2) return null

  return (
    <nav ref={navRef} className="agent-topic-nav" id="agentTopicNav" aria-label="对话主题目录" data-testid="agent-topic-nav">
      <div className="agent-conversation-meta" aria-label="对话主题目录">
        <div className="agent-conversation-summary">{topics.length} 个主题</div>
        <div className="agent-conversation-list">
          {topics.map((topic, index) => (
            <button
              key={topic.key}
              type="button"
              className="agent-conversation-anchor"
              data-conversation-anchor
              data-user-msg-idx={topic.userMsgIdx}
              aria-label={`主题 ${index + 1}，点击跳转到第 ${topic.firstTurn} 轮首条输入。`}
              onClick={() => {
                const log = chatLogRef.current
                if (!log) return
                const target = log.querySelector(`[data-user-msg-idx="${topic.userMsgIdx}"]`)
                if (target instanceof HTMLElement) {
                  log.scrollTo({ top: Math.max(0, target.offsetTop - 8), behavior: 'smooth' })
                }
              }}
            >
              <span className="agent-conversation-chip">#{index + 1}</span>
              <span className="agent-conversation-goal">{topic.summary}</span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}
