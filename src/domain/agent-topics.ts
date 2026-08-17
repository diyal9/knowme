import type { ChatMessage } from '../shared/api'

export type ConversationTopic = {
  key: string
  summary: string
  userMsgIdx: number
  firstTurn: number
}

function normalizeTopicKey(raw = ''): string {
  return String(raw || '')
    .toLowerCase()
    .replace(/[，。！？、；：,.!?;:'"()[\]{}<>《》【】]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isLikelyContinuationTopic(text = ''): boolean {
  const s = String(text || '').replace(/\s+/g, ' ').trim().toLowerCase()
  if (!s) return true
  if (s.length <= 3) return /^(好|行|嗯|ok|收到|继续|再来|然后|下一步|同上|按这个|继续这个)$/.test(s)
  return /^(继续|然后|再|按上面|照这个|同上|下一步|沿用|基于上面)/.test(s)
}

function isMeaningfulTopic(text = ''): boolean {
  const raw = String(text || '').replace(/\s+/g, ' ').trim()
  if (!raw || isLikelyContinuationTopic(raw)) return false
  const normalized = normalizeTopicKey(raw)
  if (!normalized) return false
  if (/^(好|行|嗯|哦|ok|okay|收到|知道了|明白|谢谢|感谢|继续|再来|下一步|然后|同上|可以)$/.test(normalized)) {
    return false
  }
  return normalized.length >= 8
}

function topicSummaryFromUserText(raw = '', fallback = ''): string {
  const text = String(raw || '').replace(/\s+/g, ' ').trim() || fallback || '未命名主题'
  return text.length > 28 ? `${text.slice(0, 26)}…` : text
}

/** Mirrors baseline workspace-agent topic grouping. */
export function buildConversationTopics(messages: ChatMessage[]): ConversationTopic[] {
  const topics: ConversationTopic[] = []
  const byKey = new Map<string, boolean>()
  let lastTopicKey = ''
  let userTurn = 0
  for (let i = 0; i < messages.length; i += 1) {
    const msg = messages[i]
    if (msg.role !== 'user') continue
    userTurn += 1
    const raw = String(msg.text || '').trim()
    if (!isMeaningfulTopic(raw)) continue
    const summary = topicSummaryFromUserText(raw, `主题 ${topics.length + 1}`)
    let key = normalizeTopicKey(summary)
    if (isLikelyContinuationTopic(raw) && lastTopicKey) key = lastTopicKey
    if (!key) key = `topic-${userTurn}`
    if (!byKey.has(key)) {
      byKey.set(key, true)
      topics.push({
        key,
        summary,
        userMsgIdx: i,
        firstTurn: userTurn,
      })
    }
    lastTopicKey = key
  }
  return topics
}
