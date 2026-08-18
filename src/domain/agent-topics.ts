/**
 * 对话主题分组：从用户消息启发式提取主题目录，供助理左轨导航。
 * 不负责持久化 topicId 或文档选区锚点。
 */
import type { ChatMessage } from '../shared/api'

export type ConversationTopic = {
  key: string
  summary: string
  /** 该主题首条 user 之后的第一条 assistant 摘要，供 hover 卡片 */
  preview: string
  userMsgIdx: number
  firstTurn: number
}

/** hover 卡片提问摘要最大字符数 */
const SUMMARY_MAX = 42
/** hover 卡片副标题最大字符数 */
const PREVIEW_MAX = 110
/** 固定左轨横线最小间距，避免长对话叠成一团 */
export const TOPIC_RAIL_MIN_GAP = 12
/** 轨上下内边距，避免贴顶/贴底裁切 */
const TOPIC_RAIL_PAD = 6

/** 虚拟列表无法量 DOM 时，用消息下标估算内容偏移 */
export function estimateTopicOffset(userMsgIdx: number, messageCount: number, scrollHeight: number): number {
  const n = Math.max(1, messageCount - 1)
  return (Math.max(0, userMsgIdx) / n) * Math.max(1, scrollHeight)
}

/**
 * 把内容偏移映射到固定轨高度；过近则推开，超出则从底部回压。
 * 轨钉在视口，不随气泡滚动。
 */
export function layoutTopicRailMarks(
  offsets: number[],
  scrollHeight: number,
  railHeight: number,
  minGap = TOPIC_RAIL_MIN_GAP,
): number[] {
  const sh = Math.max(1, scrollHeight)
  const usable = Math.max(1, railHeight - TOPIC_RAIL_PAD * 2)
  const ys = offsets.map((offset) => TOPIC_RAIL_PAD + (Math.max(0, offset) / sh) * usable)
  for (let i = 1; i < ys.length; i += 1) {
    if (ys[i] < ys[i - 1] + minGap) ys[i] = ys[i - 1] + minGap
  }
  const maxY = TOPIC_RAIL_PAD + usable
  if (ys.length > 0 && ys[ys.length - 1] > maxY) {
    ys[ys.length - 1] = maxY
    for (let i = ys.length - 2; i >= 0; i -= 1) {
      ys[i] = Math.min(ys[i], Math.max(TOPIC_RAIL_PAD, ys[i + 1] - minGap))
    }
  }
  return ys
}

/** 视口起点落在哪一段主题区间（含最后一段直到文末） */
export function resolveActiveTopicIndex(offsets: number[], scrollTop: number): number {
  if (offsets.length === 0) return -1
  const pos = Math.max(0, scrollTop)
  let active = 0
  for (let i = 0; i < offsets.length; i += 1) {
    if (offsets[i] <= pos + 8) active = i
  }
  return active
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
  return text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text
}

/** 取 user 消息之后、下一条 user 之前的首条 assistant 文本作预览 */
function assistantPreviewAfter(messages: ChatMessage[], userIdx: number): string {
  for (let i = userIdx + 1; i < messages.length; i += 1) {
    const msg = messages[i]
    if (msg.role === 'user') break
    if (msg.role !== 'assistant') continue
    const text = String(msg.text || '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    return text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text
  }
  return ''
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
        preview: assistantPreviewAfter(messages, i),
        userMsgIdx: i,
        firstTurn: userTurn,
      })
    }
    lastTopicKey = key
  }
  return topics
}
