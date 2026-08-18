/**
 * 对话主题左轨：固定目录短横线，点击跳到主题起点；hover 出预览卡片。
 * 不负责滚动条（右侧 overlay，见 agent-chrome / AssistantPane）。
 */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  buildConversationTopics,
  estimateTopicOffset,
  resolveActiveTopicIndex,
} from '../../../domain/agent-topics'
import type { ChatMessage } from '../../../shared/api'
import { ASSISTANT_VIRTUOSO_THRESHOLD } from './AssistantMessageVirtuoso'

type Props = {
  messages: ChatMessage[]
  chatLogRef: React.RefObject<HTMLDivElement | null>
  requestScrollToUserMsg: (userMsgIdx: number) => void
}

function contentOffsetForTopic(
  log: HTMLElement,
  userMsgIdx: number,
  messageCount: number,
  useIndexRatio: boolean,
): number {
  if (!useIndexRatio) {
    const el = log.querySelector(`.agent-bubble.user[data-user-msg-idx="${userMsgIdx}"]`)
    if (el instanceof HTMLElement) {
      return el.getBoundingClientRect().top - log.getBoundingClientRect().top + log.scrollTop
    }
  }
  return estimateTopicOffset(userMsgIdx, messageCount, log.scrollHeight)
}

/** 钉在侧栏与正文/输入框左缘之间空白的水平中点 */
function placeRailInLeftGutter(nav: HTMLElement) {
  const col = nav.closest('.agent-col')
  if (!(col instanceof HTMLElement)) return
  const content =
    col.querySelector('.agent-composer') ||
    col.querySelector('.agent-bubble') ||
    col.querySelector('.agent-chat-body')
  if (!(content instanceof HTMLElement)) return
  const gutter = content.getBoundingClientRect().left - col.getBoundingClientRect().left
  nav.style.left = `${Math.max(20, gutter / 2)}px`
}

export function AssistantTopicNav({ messages, chatLogRef, requestScrollToUserMsg }: Props) {
  const topics = useMemo(() => buildConversationTopics(messages), [messages])
  const navRef = useRef<HTMLElement>(null)
  const [activeKey, setActiveKey] = useState('')

  const measure = useCallback(() => {
    const log = chatLogRef.current
    const nav = navRef.current
    if (nav) placeRailInLeftGutter(nav)
    if (!log || topics.length === 0) return
    const useIndexRatio = messages.length > ASSISTANT_VIRTUOSO_THRESHOLD
    const offsets = topics.map((topic) => (
      contentOffsetForTopic(log, topic.userMsgIdx, messages.length, useIndexRatio)
    ))
    const active = resolveActiveTopicIndex(offsets, log.scrollTop)
    setActiveKey(topics[active]?.key ?? '')
  }, [chatLogRef, messages.length, topics])

  useLayoutEffect(() => {
    measure()
  }, [measure, messages.length])

  useEffect(() => {
    const log = chatLogRef.current
    const nav = navRef.current
    if (!log) return
    log.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    let observer: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(log)
      const col = nav?.closest('.agent-col')
      if (col instanceof HTMLElement) observer.observe(col)
      const body = col instanceof HTMLElement ? col.querySelector('.agent-chat-body') : null
      if (body instanceof HTMLElement) observer.observe(body)
    }
    return () => {
      log.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [chatLogRef, measure])

  if (topics.length === 0) return null

  return (
    <nav
      ref={navRef}
      className="agent-topic-nav"
      id="agentTopicNav"
      aria-label="对话主题目录"
      data-testid="agent-topic-nav"
    >
      <div className="agent-conversation-list">
        {topics.map((topic, index) => (
          <button
            key={topic.key}
            type="button"
            className={`agent-conversation-anchor${activeKey === topic.key ? ' is-active' : ''}`}
            data-conversation-anchor
            data-topic-user-idx={topic.userMsgIdx}
            aria-label={`主题 ${index + 1}：${topic.summary}。点击跳转到第 ${topic.firstTurn} 轮。`}
            onClick={() => requestScrollToUserMsg(topic.userMsgIdx)}
          >
            <span className="agent-conversation-marker" aria-hidden="true" />
            <span className="agent-conversation-card">
              <span className="agent-conversation-goal">{topic.summary}</span>
              <span className="agent-conversation-preview">{topic.preview || '暂无回复预览'}</span>
            </span>
          </button>
        ))}
      </div>
    </nav>
  )
}
