/**
 * feishu-cli/im — @我 消息检索与 related_chats 工作流。
 * 不负责：消息发送（见 write）或今日优先级编排（见 calendar）。
 */
'use strict'

const {
  runLarkCli,
  parseCliJsonOutput,
  normalizeCliErrorMessage,
  addDays,
} = require('./core')
const { resolveCurrentUserIdentity } = require('./scopes')
const { listFeishuChats } = require('./write')

/** Local ISO-8601 with timezone offset for im +messages-search --start/--end. */
function formatIsoLocal(date, endOfDay = false) {
  const d = date instanceof Date ? date : new Date(date)
  const pad = n => String(n).padStart(2, '0')
  const offsetMin = -d.getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const oh = pad(Math.floor(abs / 60))
  const om = pad(abs % 60)
  const time = endOfDay ? '23:59:59' : '00:00:00'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${time}${sign}${oh}:${om}`
}

function buildMessagesSearchAtMeArgs({ start, end, pageSize = 20, pageToken = '' } = {}) {
  const argv = [
    'im', '+messages-search',
    '--as', 'user',
    '--is-at-me',
    '--start', String(start),
    '--end', String(end),
    '--page-size', String(Math.max(1, Math.min(50, Number(pageSize) || 20))),
    '--format', 'json',
  ]
  if (pageToken) argv.push('--page-token', String(pageToken))
  return argv
}

function pickMessageSearchItems(payload) {
  if (!payload || typeof payload !== 'object') return []
  const list =
    payload.data?.messages ||
    payload.messages ||
    payload.data?.items ||
    payload.items ||
    payload.data?.list ||
    []
  return Array.isArray(list) ? list : []
}

function extractMessageBody(item = {}) {
  const body = item.body || item.message?.body || item.content || {}
  if (typeof body === 'string') return body.trim()
  const text = body.text || body.content || body.title || ''
  if (typeof text === 'string' && text.trim()) return text.trim()
  try {
    if (body.content && typeof body.content === 'string') {
      const parsed = JSON.parse(body.content)
      if (parsed && typeof parsed === 'object') {
        if (parsed.text) return String(parsed.text).trim()
        if (Array.isArray(parsed.content)) {
          return parsed.content.map(block => {
            if (typeof block === 'string') return block
            if (Array.isArray(block)) {
              return block.map(span => (span && span.text) || '').join('')
            }
            return (block && block.text) || ''
          }).join('').trim()
        }
      }
    }
  } catch { /* ignore */ }
  const raw = item.text || item.preview || item.summary || ''
  return String(raw || '').trim()
}

function buildFeishuChatOpenUrl(chatId) {
  const id = String(chatId || '').trim()
  if (!id || !/^oc_/i.test(id)) return ''
  return `https://applink.feishu.cn/client/chat/open?openChatId=${encodeURIComponent(id)}`
}

/** Strip Feishu markup noise so summaries stay readable. */
function sanitizeImMessageText(raw = '') {
  return String(raw || '')
    .replace(/:Lark_Emoji_[A-Za-z0-9_]+:/g, '')
    .replace(/<\/?at\b[^>]*>/gi, ' ')
    .replace(/<\/?u>/gi, '')
    .replace(/<\/?[a-z][a-z0-9]*\b[^>]*>/gi, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function inferMentionTheme(text = '') {
  const cleaned = sanitizeImMessageText(text)
  if (!cleaned) return '（无文本内容）'
  const cut = cleaned.split(/[。！？\n]/)[0] || cleaned
  const theme = cut.trim().slice(0, 48)
  return theme.length < cut.trim().length ? `${theme}…` : theme
}

function inferHandlingSuggestion(text = '', raw = '') {
  const t = sanitizeImMessageText(text)
  const source = `${raw || ''} ${t}`
  if (/报名|参赛|征集|截止|报名截止/.test(t)) {
    return '确认是否参与；需要则打开飞书原会话回复，并留意截止时间'
  }
  if (/丢失|寻物|捡到|耳机|钥匙|钱包/.test(t)) {
    return '如有线索可在群里回复；无关可忽略'
  }
  if (/@all|user_id=["']all["']|所有人|全员/.test(source)) {
    return '群发通知，按兴趣选择性关注；非直接责任可不回复'
  }
  if (/请看|帮忙|确认|回复|跟进|评审|审批|尽快/.test(t)) {
    return '建议打开飞书阅读上下文后回复或给出结论'
  }
  return '先看主题判断是否需要回复；必要时再打开飞书阅读全文'
}

function mdChatLink(label, chatId) {
  const name = String(label || chatId || '会话').trim() || '会话'
  const url = buildFeishuChatOpenUrl(chatId)
  if (!url) return name
  // Escape brackets in label for Markdown safety
  const safe = name.replace(/[\[\]]/g, '')
  return `[${safe}](${url})`
}

function normalizeMentionMessage(item = {}) {
  const id = String(item.message_id || item.msg_id || item.id || '').trim()
  const chatId = String(item.chat_id || item.chatId || item.chat?.chat_id || '').trim()
  const chatName = String(
    item.chat_name ||
    item.chatName ||
    item.chat?.name ||
    item.chat?.chat_name ||
    chatId ||
    '未命名会话'
  ).trim()
  const sender = String(
    item.sender_name ||
    item.sender?.name ||
    item.sender?.sender_id ||
    item.sender_id ||
    '未知发送人'
  ).trim()
  const createTime = String(
    item.create_time ||
    item.created_at ||
    item.createTime ||
    item.timestamp ||
    ''
  ).trim()
  const rawText = extractMessageBody(item).slice(0, 500)
  const text = sanitizeImMessageText(rawText).slice(0, 280)
  if (!id && !rawText && !text) return null
  const openUrl = buildFeishuChatOpenUrl(chatId)
  const theme = inferMentionTheme(rawText)
  const suggestion = inferHandlingSuggestion(rawText, rawText)
  return {
    id,
    chatId,
    chatName,
    sender,
    createTime,
    text,
    rawText,
    theme,
    suggestion,
    openUrl,
    atMe: true,
  }
}

function formatRelatedChats(mentions = [], chats = [], days = 1, identity = null) {
  const who = identity && identity.userName ? `（授权用户：${identity.userName}）` : ''
  const dayLabel = days === 1 ? '今天' : `最近 **${days}** 个自然日`
  const lines = [
    `${dayLabel}与你相关的飞书聊天摘要${who}：`,
    '',
    '说明：会话名可点击跳转飞书；@我 已提炼主题与建议，仅在需要完整上下文时再打开原文。',
    '',
  ]

  lines.push(`## @我 的消息（${mentions.length}）`)
  if (!mentions.length) {
    lines.push('- 未找到明确 @你 的消息。')
  } else {
    mentions.forEach((item, index) => {
      const when = item.createTime || '时间未知'
      const chatLink = mdChatLink(item.chatName, item.chatId)
      const openHint = item.openUrl
        ? `[在飞书打开原文](${item.openUrl})`
        : '（无会话链接）'
      lines.push(
        `### ${index + 1}. ${chatLink}`,
        `- 发送人：${item.sender} · ${when}`,
        `- 主题：${item.theme || inferMentionTheme(item.text)}`,
        `- 要点：${item.text || '(无文本内容)'}`,
        `- 建议处理：${item.suggestion || inferHandlingSuggestion(item.text, item.rawText)}`,
        `- 需要全文时：${openHint}`,
        '',
      )
    })
  }

  const p2p = chats.filter(c => /p2p|private|单聊|私聊/i.test(String(c.mode || '')))
  const groups = chats.filter(c => !/p2p|private|单聊|私聊/i.test(String(c.mode || '')))
  lines.push('', `## 今日相关会话主题（私聊 ${p2p.length} / 群聊 ${groups.length}，共 ${chats.length}）`)
  if (!chats.length) {
    lines.push('- 未能列出近期私聊/群聊主题（可能缺权限或暂无会话）。')
  } else {
    lines.push(`### 私聊（${p2p.length}）`)
    if (!p2p.length) {
      lines.push('- 无')
    } else {
      p2p.slice(0, 16).forEach((chat) => {
        lines.push(`- \`私聊\` ${mdChatLink(chat.name || chat.id, chat.id)}`)
      })
    }
    lines.push(`### 群聊 / 话题群（${groups.length}）`)
    if (!groups.length) {
      lines.push('- 无')
    } else {
      groups.slice(0, 16).forEach((chat) => {
        const kind = /topic/i.test(String(chat.mode || '')) ? '话题群' : '群聊'
        lines.push(`- \`${kind}\` ${mdChatLink(chat.name || chat.id, chat.id)}`)
      })
    }
  }

  lines.push(
    '',
    '请基于以上真实结果分析并输出给用户：',
    '1. 保留每个会话的可点击 Markdown 链接（不要改成纯文本会话名）',
    '2. @我 用「主题 + 建议处理」呈现，不要原文照搬标签或长文',
    '3. 「在飞书打开」只在需要阅读完整上下文时作为次要动作提示',
    '4. 汇总待回应事项与建议下一步；不要编造未出现的聊天；不要索要飞书文档 token',
    '5. 输出风格必须克制专业：默认不使用 emoji、颜文字或装饰性图标，避免夸张语气和拟人化措辞',
    '6. 状态表达统一使用纯文本标签（如「[需确认]」「[高优先级]」「[可延后]」），不要堆叠图标',
    '7. 若引用消息原文，必须保留原文内容；仅对助手自己生成的结构和说明遵循上述风格',
  )
  return lines.filter(Boolean).join('\n')
}

async function executeRelatedChats(args = {}, opts = {}) {
  const days = Math.max(1, Math.min(30, Math.floor(Number(args.days == null ? 1 : args.days) || 1)))
  const now = new Date()
  const startDay = addDays(now, -(days - 1))
  const start = formatIsoLocal(new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate()), false)
  const end = formatIsoLocal(now, true)
  const identity = await resolveCurrentUserIdentity(opts)

  const mentions = []
  const seenIds = new Set()
  const seenPageTokens = new Set()
  let pageToken = ''
  for (let page = 0; page < 4; page++) {
    const res = await runLarkCli(buildMessagesSearchAtMeArgs({
      start,
      end,
      pageSize: 20,
      pageToken,
    }), opts)
    if (!res.ok) {
      return { ...res, message: normalizeCliErrorMessage(res.message, res.text, 'feishu.related_chats') }
    }
    const payload = parseCliJsonOutput(res.text)
    for (const item of pickMessageSearchItems(payload)) {
      const normalized = normalizeMentionMessage(item)
      if (!normalized) continue
      const key = normalized.id || `${normalized.chatId}:${normalized.createTime}:${normalized.text.slice(0, 40)}`
      if (seenIds.has(key)) continue
      seenIds.add(key)
      mentions.push(normalized)
    }
    const nextToken = String(payload?.data?.page_token || payload?.page_token || '').trim()
    const hasMore = Boolean(payload?.data?.has_more ?? payload?.has_more)
    if (!hasMore || !nextToken || seenPageTokens.has(nextToken)) break
    seenPageTokens.add(nextToken)
    pageToken = nextToken
  }

  const chatList = await listFeishuChats({
    types: 'p2p,group',
    sort: 'active_time',
    page_size: 20,
  }, opts)
  const chats = chatList.ok ? (chatList.items || []).slice(0, 16) : []

  return {
    ok: true,
    text: formatRelatedChats(mentions.slice(0, 30), chats, days, identity),
    meta: {
      workflow: 'related_chats',
      days,
      mentions: mentions.slice(0, 30),
      chats,
      identity,
    },
  }
}

module.exports = {
  formatIsoLocal,
  buildMessagesSearchAtMeArgs,
  pickMessageSearchItems,
  sanitizeImMessageText,
  inferMentionTheme,
  inferHandlingSuggestion,
  buildFeishuChatOpenUrl,
  normalizeMentionMessage,
  formatRelatedChats,
  executeRelatedChats,
}
