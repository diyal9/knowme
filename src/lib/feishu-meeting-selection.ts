'use strict'

/**
 * Parse Feishu meeting/doc candidate lists and rewrite a pure index reply
 * ("1") into a grounded meeting_read / read_doc instruction.
 * Node tests: require('./lib/feishu-meeting-selection')
 * Browser: <script> → window.FeishuMeetingSelection
 */
;(function (root, factory) {
  const meetingSelectionApi = factory()
  if (typeof module === 'object' && module.exports) module.exports = meetingSelectionApi
  if (root) root.FeishuMeetingSelection = meetingSelectionApi
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function normalizeZhDigit(text = '') {
    const map = new Map([
      ['一', 1], ['二', 2], ['三', 3], ['四', 4], ['五', 5],
      ['六', 6], ['七', 7], ['八', 8], ['九', 9], ['十', 10],
    ])
    return map.get(String(text || '').trim()) || 0
  }

  function parseSelectionIndex(text = '') {
    const src = String(text || '').trim()
    const pure = src.match(/^(?:第?\s*(\d{1,2})\s*(?:条|项|个|号)?|(\d{1,2}))$/)
    if (pure) return Number(pure[1] || pure[2] || 0)
    const rich =
      src.match(/(?:读取|打开|查看|看|选|选择|用|继续|总结)\s*第?\s*(\d{1,2})\s*(?:条|项|个|号)?/i) ||
      src.match(/(?:读取|打开|查看|看|选|选择|用|继续|总结)\s*第?\s*([一二三四五六七八九十])\s*(?:条|项|个|号)?/i)
    if (!rich) return 0
    const n = Number(rich[1])
    if (Number.isFinite(n) && n > 0) return n
    return normalizeZhDigit(rich[1])
  }

  function extractMinuteTokenFromUrl(value = '') {
    const match = String(value || '').match(/\/(?:minutes?|minutedetail)\/([A-Za-z0-9_-]+)/i)
    return match ? String(match[1] || '').trim() : ''
  }

  function extractFeishuSearchCandidatesFromText(text = '') {
    const lines = String(text || '').split(/\r?\n/)
    const out = []
    let current = null
    const pushCurrent = () => {
      if (current && (current.token || current.minuteToken || current.url)) out.push(current)
    }
    for (const raw of lines) {
      const line = String(raw || '')
      const meetingCardMatch = line.match(
        /^\s*\[(\d{1,2})\.\s*(.+?)｜([^｜\]]+)(?:｜组织者：([^\]]+))?\]\((https?:\/\/[^)\s]+)\)\s*$/
      )
      if (meetingCardMatch) {
        pushCurrent()
        const url = String(meetingCardMatch[5] || '').trim()
        current = {
          index: Number(meetingCardMatch[1] || 0),
          title: String(meetingCardMatch[2] || '').trim(),
          time: String(meetingCardMatch[3] || '').trim(),
          organizer: String(meetingCardMatch[4] || '').trim(),
          token: '',
          minuteToken: extractMinuteTokenFromUrl(url),
          url,
        }
        continue
      }
      const entryMatch =
        line.match(/^\s*(?:\*\*)?(\d{1,2})\.\s*(.+?)(?:\*\*)?\s*$/) ||
        line.match(/^\s*(?:【(\d{1,2})】|(\d{1,2})[.)])\s*(.+)\s*$/)
      if (entryMatch) {
        pushCurrent()
        const index = Number(entryMatch[1] || entryMatch[2] || 0)
        const title = String(entryMatch[entryMatch.length - 1] || '')
          .replace(/\*\*/g, '')
          .trim()
        current = { index, title, token: '', minuteToken: '', url: '' }
        continue
      }
      if (!current) continue
      const minuteMatch = line.match(/minute[_ ]?token:\s*`?([A-Za-z0-9_-]+)`?/i)
      if (minuteMatch) {
        current.minuteToken = String(minuteMatch[1] || '').trim()
        continue
      }
      const tokenMatch = line.match(/(?:^|\s)token:\s*`?([A-Za-z0-9_-]+)`?/i)
      if (tokenMatch) {
        const token = String(tokenMatch[1] || '').trim()
        if (token && !/^\(缺失\)$/i.test(token)) current.token = token
        continue
      }
      const urlMatch = line.match(/(?:^|\s|-)\s*url:\s*(.+)\s*$/i)
      if (urlMatch) {
        const url = String(urlMatch[1] || '').trim().replace(/[)）]+$/, '')
        if (url && !/^\(缺失\)$/i.test(url)) current.url = url
        continue
      }
      const mdLink = line.match(/\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/)
      if (mdLink && !current.url) {
        current.url = String(mdLink[1] || '').trim()
        current.minuteToken = current.minuteToken || extractMinuteTokenFromUrl(current.url)
      }
      const backtickToken = line.match(/`([A-Za-z0-9_-]{8,})`/)
      if (backtickToken && !current.minuteToken && !current.token) {
        current.minuteToken = String(backtickToken[1] || '').trim()
      }
    }
    pushCurrent()
    return out
  }

  function rewriteFeishuCandidateSelection(prompt = '', assistantText = '') {
    const src = String(prompt || '').trim()
    const index = parseSelectionIndex(src)
    if (!Number.isFinite(index) || index < 1) return src
    const text = String(assistantText || '')
    if (!text) return src
    const looksLikeMeeting =
      /minute_token:|打开飞书纪要|回复序号|会议候选|参与的会议|飞书妙记|第\s*\d+\s*场|智能纪要/i.test(text)
    const looksLikeDocSearch = /token:/i.test(text)
    if (!looksLikeMeeting && !looksLikeDocSearch) return src
    const fallbackMeetingRead = () => `我选择第${index}场会议。
请立刻调用 \`feishu.meeting_candidates\` 获取最近会议候选（优先 days=3；若序号越界可扩展到 days=7 重试一次）。
拿到候选后按序号读取第${index}条，优先取其 \`minute_token\` 并调用 \`feishu.meeting_read\`。
读取成功后输出结构化会议总结：
1) 议题
2) 结论
3) 待办（责任人、时间点如有）
4) 简要分析（对我相关的事项、风险/阻塞、建议下一步）
若读取失败是权限问题，说明可调用 \`feishu.draft_minute_permission\` 生成待确认的权限申请；不要编造正文。`
    const candidates = extractFeishuSearchCandidatesFromText(text)
    if (!candidates.length) {
      if (looksLikeMeeting) return fallbackMeetingRead()
      return src
    }
    const picked = candidates.find(item => item.index === index) || candidates[index - 1]
    if (!picked) {
      if (looksLikeMeeting) return fallbackMeetingRead()
      return src
    }
    const minuteToken = String(picked.minuteToken || '').trim()
    const url = String(picked.url || '').trim()
    const docToken = String(picked.token || '').trim()
    const title = picked.title || '未命名会议'
    if (looksLikeMeeting || minuteToken || /\/minutes\//i.test(url)) {
      const locator = minuteToken
        ? `minute_token=${minuteToken}`
        : (url ? `url=${url}` : '')
      if (!locator) return fallbackMeetingRead()
      return `我选择第${index}条会议：${title}。
请立刻使用 \`feishu.meeting_read\` 读取该会议妙记正文（${locator}）。
读取成功后输出结构化会议总结：
1) 议题
2) 结论
3) 待办（责任人、时间点如有）
4) 简要分析（对我相关的事项、风险/阻塞、建议下一步）
若读取失败是权限问题，说明可调用 \`feishu.draft_minute_permission\` 生成待确认的权限申请；不要编造正文。`
    }
    const locator = docToken || url
    if (!locator) return src
    return `我选择第${index}条候选会议文档：${title}。
请立刻使用 \`feishu.read_doc\`（必要时 \`feishu.get_wiki_node\`）读取该文档原文，定位标识：${locator}。
读取成功后再输出会议总结（议题、结论、待办、责任人与时间点）和简要分析；若读取失败请返回具体报错并给出下一步。`
  }

  function extractLatestMinuteToken(text = '') {
    const src = String(text || '')
    const explicit = src.match(/minute[_ ]?token\s*[=:：]\s*`?([A-Za-z0-9_-]{6,})`?/i)
    if (explicit) return String(explicit[1] || '').trim()
    const inline = src.match(/妙记（([A-Za-z0-9_-]{6,})）/)
    if (inline) return String(inline[1] || '').trim()
    return extractMinuteTokenFromUrl(src)
  }

  function rewriteMinutePermissionRequest(prompt = '', assistantText = '') {
    const src = String(prompt || '').trim()
    // Only short, unambiguous asks: a long sentence may carry other intent.
    if (src.length > 24 || !/申请/.test(src) || !/权限/.test(src)) return src
    const token = extractLatestMinuteToken(assistantText)
    if (!token) return src
    return `请调用 \`feishu.draft_minute_permission\`（minute_token=${token}）生成一条待我确认的妙记查看权限申请。
先把申请内容展示给我，等我明确确认后才可发送；不要直接发出，也不要编造纪要正文。`
  }

  return {
    parseSelectionIndex,
    extractFeishuSearchCandidatesFromText,
    extractLatestMinuteToken,
    rewriteFeishuCandidateSelection,
    rewriteMinutePermissionRequest,
  }
})
