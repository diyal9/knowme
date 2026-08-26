'use strict'

function hasFeishuMention(prompt = '') {
  // The built-in “会议总结” shortcut intentionally omits the connector name;
  // treat it as the Feishu meeting workflow so it still starts with candidate
  // discovery instead of falling through to an ungrounded generic answer.
  return /(飞书|feishu|lark|会议总结|会议纪要|会议记录|会后纪要|智能纪要|妙记|minutes)/i.test(String(prompt || ''))
}

// A concrete Feishu Docx/Wiki URL is already the user's locator.  It must not
// be downgraded into a broad meeting search just because the surrounding text
// says “会议记录” or “总结”.  The URL is the source of truth and should be
// read directly through feishu.read_doc.
function hasExplicitFeishuDocLocator(prompt = '') {
  return /https?:\/\/[^\s)]+\/(?:docx|wiki)\//i.test(String(prompt || ''))
    || /(?:^|[\s（(])(?:doc_token|document_token)\s*[=:：]/i.test(String(prompt || ''))
}

function isRelatedChatsIntent(prompt = '') {
  const text = String(prompt || '')
  if (!text) return false
  if (/(分析跟我相关的聊天|跟我相关的聊天|feishu\.related_chats|related_chats)/i.test(text)) return true
  return /(聊天|群聊|私聊|消息|会话)/.test(text) && /(@我|@\s*我|提到我|与我相关)/.test(text)
}

function isTodayPriorityIntent(prompt = '') {
  const text = String(prompt || '')
  if (!text) return false
  if (/(feishu\.today_priority|today_priority)/i.test(text)) return true
  if (/(今日优先级|今天优先级|今日优先)/.test(text)) return true
  return /(优先级助手|先做的\s*3\s*件事|先做哪\s*3)/.test(text)
}

function isDocKbSuggestIntent(prompt = '') {
  const text = String(prompt || '')
  if (!text) return false
  if (/(feishu\.doc_kb_suggest|doc_kb_suggest|查文档\/知识库|查文档和知识库)/i.test(text)) return true
  return /(查文档|查询飞书文档|飞书文档或知识库)/.test(text)
    && /(知识库|文件夹|个人记忆|最近.*编辑|最近.*阅读|doc_kb)/.test(text)
}

function detectFeishuIntent(prompt = '') {
  const text = String(prompt || '')
  const directDocRead = hasExplicitFeishuDocLocator(text)
  const asksRelatedChats = isRelatedChatsIntent(text)
  const asksTodayPriority = isTodayPriorityIntent(text)
  const asksDocKbSuggest = isDocKbSuggestIntent(text)
  const mentioned = hasFeishuMention(text) || asksRelatedChats || asksTodayPriority || asksDocKbSuggest
  if (!mentioned) {
    return {
      mentioned: false,
      needsSearch: false,
      needsContentRead: false,
      asksMinutes: false,
      directDocRead: false,
      asksRelatedChats: false,
      asksTodayPriority: false,
      asksDocKbSuggest: false,
    }
  }
  const asksMinutes = !directDocRead && /(妙记|minutes|会议总结|会议纪要|会议记录|会后纪要|智能纪要|智能纪要助手)/i.test(text)
    && !asksRelatedChats
    && !asksTodayPriority
    && !asksDocKbSuggest
  let needsContentRead = /(读取|read|详读|原文|全文|内容|摘要|总结|提炼|待办|行动项|结论|参会|发言|时间点)/i.test(text) || asksMinutes
  // IM digest / today-priority / doc-kb suggest are not Feishu document body.
  if (asksRelatedChats || asksTodayPriority || asksDocKbSuggest) needsContentRead = false
  const needsSearch = directDocRead
    ? false
    : (asksRelatedChats || asksTodayPriority || asksDocKbSuggest)
    ? false
    : (/(搜索|查询|查找|检索|找)/i.test(text) || needsContentRead)
  return {
    mentioned: true,
    needsSearch,
    needsContentRead,
    asksMinutes,
    directDocRead,
    asksRelatedChats,
    asksTodayPriority,
    asksDocKbSuggest,
  }
}

function safeJsonParse(text = '') {
  const src = String(text || '').trim()
  if (!src) return null
  try {
    return JSON.parse(src)
  } catch {
    return null
  }
}

function extractSearchHitCount(text = '') {
  const src = String(text || '').trim()
  if (!src) return null
  const json = safeJsonParse(src)
  if (json && typeof json === 'object') {
    const candidates = [
      json.items,
      json.docs,
      json.documents,
      json.data?.items,
      json.data?.docs,
      json.data?.documents,
      json.results,
      json.data?.results,
    ]
    for (const list of candidates) {
      if (Array.isArray(list)) return list.length
    }
    if (Number.isFinite(json.total)) return Math.max(0, Number(json.total))
    if (Number.isFinite(json.count)) return Math.max(0, Number(json.count))
  }
  const m = src.match(/(?:共|命中|找到|检索到)\s*(\d+)\s*(?:条|项|份|个)?/i)
  if (m) return Math.max(0, Number(m[1]))
  if (/未找到|无结果|0\s*(?:条|项|份|个)/i.test(src)) return 0
  return null
}

function pickSearchItems(payload) {
  if (!payload || typeof payload !== 'object') return []
  const candidates = [
    payload.items,
    payload.docs,
    payload.documents,
    payload.data?.items,
    payload.data?.docs,
    payload.data?.documents,
    payload.results,
    payload.data?.results,
  ]
  for (const list of candidates) {
    if (Array.isArray(list)) return list
  }
  return []
}

function normalizeSearchCandidate(raw = {}) {
  if (!raw || typeof raw !== 'object') return null
  const stripHighlighted = (value = '') => String(value || '').replace(/<\/?h>/gi, '').trim()
  const pickTime = (...values) => {
    for (const value of values) {
      const text = String(value || '').trim()
      if (!text) continue
      return text
    }
    return ''
  }
  const resultMeta = raw.result_meta && typeof raw.result_meta === 'object' ? raw.result_meta : null
  const merged = {
    ...raw,
    ...(resultMeta || null),
    ...(raw.doc && typeof raw.doc === 'object' ? raw.doc : null),
    ...(raw.document && typeof raw.document === 'object' ? raw.document : null),
    ...(raw.node && typeof raw.node === 'object' ? raw.node : null),
  }
  const title = String(
    merged.title ||
    stripHighlighted(merged.title_highlighted) ||
    stripHighlighted(raw.title_highlighted) ||
    merged.name ||
    merged.doc_title ||
    merged.document_title ||
    merged.node_title ||
    ''
  ).trim()
  const token = String(
    merged.doc_token ||
    merged.node_token ||
    merged.token ||
    merged.obj_token ||
    merged.document_id ||
    merged.doc_id ||
    merged.id ||
    ''
  ).trim()
  const url = String(
    merged.url ||
    merged.doc_url ||
    merged.document_url ||
    merged.link ||
    merged.open_url ||
    ''
  ).trim()
  const updatedAt = pickTime(
    merged.update_time_iso,
    merged.updateTimeIso,
    merged.last_open_time_iso,
    merged.create_time_iso,
  )
  const editorName = String(
    merged.edit_user_name ||
    merged.editor_name ||
    merged.last_editor_name ||
    ''
  ).trim()
  const ownerName = String(merged.owner_name || '').trim()
  const summary = stripHighlighted(
    merged.summary_highlighted ||
    merged.summary ||
    merged.body ||
    ''
  )
  const meetingLike = MEETING_TITLE_SIGNAL.test(title) || MEETING_CONTENT_SIGNAL.test(summary)
  const minutesGenerated =
    MINUTES_OWNER_SIGNAL.test(editorName) ||
    MINUTES_OWNER_SIGNAL.test(ownerName) ||
    /^智能纪要[:：]/.test(title)
  if (!title && !token && !url) return null
  return {
    title: title || '未命名文档',
    token,
    url,
    updatedAt,
    editorName,
    ownerName,
    summary,
    meetingLike,
    minutesGenerated,
  }
}

function extractSearchCandidates(text = '') {
  const json = safeJsonParse(String(text || '').trim())
  if (!json || typeof json !== 'object') return []
  const items = pickSearchItems(json)
  const out = []
  const seen = new Set()
  for (const item of items) {
    const normalized = normalizeSearchCandidate(item)
    if (!normalized) continue
    const key = `${normalized.token}::${normalized.url}::${normalized.title}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(normalized)
    if (out.length >= 5) break
  }
  return out
}

function isNotFoundText(text = '') {
  const src = String(text || '')
  return /(not[\s_-]?found|不存在|未找到|找不到|404|resource[_\s-]?not[_\s-]?found)/i.test(src)
}

function isToolFailureText(text = '') {
  const src = String(text || '')
  return /(error|失败|超时|timeout|invalid|unauthorized|forbidden|permission|拒绝)/i.test(src)
}

function hasFoundClaim(text = '') {
  const src = String(text || '')
  return /(检索到|已找到|找到(?:了)?\s*\d+|命中\s*\d+|共\s*\d+\s*(?:份|条|个)|以下(?:是)?文档|查看链接)/i.test(src)
}

function isFeishuToolName(name = '') {
  return /^(feishu\.|lark[._-]|lark$)/i.test(String(name || '').trim())
}

function hasReadableContentPayload(text = '') {
  const src = String(text || '').trim()
  if (!src || isToolFailureText(src)) return false
  const parsed = safeJsonParse(src)
  if (!parsed || typeof parsed !== 'object') return true
  const doc = parsed.doc && typeof parsed.doc === 'object' ? parsed.doc : parsed.data?.doc
  const candidates = [
    parsed.content, parsed.body, parsed.summary, parsed.plain_text,
    parsed.transcript, parsed.minutes, parsed.text,
    parsed.data?.content, parsed.data?.body, parsed.data?.summary,
    parsed.data?.plain_text, parsed.data?.transcript, parsed.data?.minutes,
    doc?.content, doc?.body, doc?.summary, doc?.plain_text,
    doc?.transcript, doc?.minutes,
  ]
  return candidates.some(value => {
    if (value == null) return false
    const body = typeof value === 'string' ? value.trim() : JSON.stringify(value)
    return body.length > 0 && !isToolFailureText(body)
  })
}

const MEETING_TITLE_SIGNAL = /(会议|纪要|妙记|minutes|meeting|会后纪要|周会|例会|评审会)/i
const MEETING_CONTENT_SIGNAL = /(参会|议题|结论|行动项|待办|主持|发言|会议时间|会议地点|会议纪要|会议记录|会后纪要|minutes|meeting)/i
const MINUTES_OWNER_SIGNAL = /(智能纪要助手|minutes\s*assistant)/i

function extractMeetingLikeReadEvidence(item = {}) {
  if (!item || item.status !== 'done') return { matched: false, titleMatched: false, contentMatched: false }
  const text = String(item.text || '').trim()
  if (!text) return { matched: false, titleMatched: false, contentMatched: false }
  const parsed = safeJsonParse(text)

  const titleCandidates = []
  // For structured connector responses, do not scan the entire JSON blob as
  // meeting content.  Titles, tokens and metadata commonly contain words
  // like “会议/纪要” even when the actual transcript/body was never returned.
  // Only body-bearing fields may establish meeting evidence.
  const contentCandidates = []
  if (parsed && typeof parsed === 'object') {
    const doc = parsed.doc && typeof parsed.doc === 'object' ? parsed.doc : parsed.data?.doc
    if (doc && typeof doc === 'object') {
      titleCandidates.push(doc.title, doc.name, doc.doc_title)
      contentCandidates.push(
        doc.content,
        doc.body,
        doc.summary,
        doc.plain_text,
        doc.transcript,
        doc.minutes,
      )
    }
    titleCandidates.push(parsed.title, parsed.name)
    contentCandidates.push(
      parsed.content,
      parsed.body,
      parsed.summary,
      parsed.plain_text,
      parsed.transcript,
      parsed.minutes,
      parsed.data?.content,
      parsed.data?.body,
      parsed.data?.summary,
      parsed.data?.plain_text,
      parsed.data?.transcript,
      parsed.data?.minutes,
    )
  } else {
    // Plain-text tool results have no separate metadata channel, so the whole
    // response is the only available body candidate.
    contentCandidates.push(text)
  }

  const titleText = titleCandidates.filter(Boolean).map(v => String(v)).join('\n')
  const contentText = contentCandidates.filter(Boolean).map(v => String(v)).join('\n')
  const titleMatched = MEETING_TITLE_SIGNAL.test(titleText)
  const contentMatched = MEETING_CONTENT_SIGNAL.test(contentText)
  return { matched: contentMatched, titleMatched, contentMatched }
}

// lark-cli surfaces the authoritative missing scopes both as a human hint
// ("required scope(s): a, b") and as a JSON array ("missing_scopes":["a"]).
// We prefer the structured `item.missingScopes` field when present, then fall
// back to parsing the raw tool text so we never lose the signal on truncation.
function extractScopesFromText(text = '') {
  const str = String(text || '')
  const scopes = new Set()
  const req = str.match(/required scope\(s\)\s*[:：]\s*([^\n"}\]]+)/i)
  if (req && req[1]) {
    req[1].split(/[,，、\s]+/).map(s => s.trim()).filter(Boolean).forEach(s => scopes.add(s))
  }
  const jsonArr = str.match(/"missing_scopes"\s*:\s*\[([^\]]*)\]/i)
  if (jsonArr && jsonArr[1]) {
    jsonArr[1].split(',').map(s => s.replace(/["'\s]/g, '')).filter(Boolean).forEach(s => scopes.add(s))
  }
  return Array.from(scopes)
}

function collectMissingScopes(failures = []) {
  const scopes = new Set()
  for (const item of (Array.isArray(failures) ? failures : [])) {
    const structured = Array.isArray(item?.missingScopes)
      ? item.missingScopes.map(s => String(s || '').trim()).filter(Boolean)
      : []
    if (structured.length) {
      structured.forEach(s => scopes.add(s))
    } else {
      extractScopesFromText(item?.text).forEach(s => scopes.add(s))
    }
  }
  return Array.from(scopes)
}

function analyzeFeishuToolEvidence(entries = []) {
  const list = Array.isArray(entries) ? entries : []
  const feishuList = list.filter(item => item && isFeishuToolName(item.toolName))
  const success = feishuList.filter(item => item.status === 'done')
  const failures = feishuList.filter(item => item.status === 'error')
  const searchSuccess = success.filter(item => item.toolName === 'feishu.search_docs')
  const meetingCandidateSuccess = success.filter(item => item.toolName === 'feishu.meeting_candidates')
  const relatedChatsSuccess = success.filter(item => item.toolName === 'feishu.related_chats')
  const todayPrioritySuccess = success.filter(item => item.toolName === 'feishu.today_priority')
  const docKbSuggestSuccess = success.filter(item => item.toolName === 'feishu.doc_kb_suggest')
  const readSuccess = success.filter(item => ['feishu.read_doc', 'feishu.get_wiki_node', 'feishu.meeting_read'].includes(item.toolName))
  const readFailures = feishuList.filter(item =>
    item.status === 'error' && ['feishu.read_doc', 'feishu.get_wiki_node', 'feishu.meeting_read'].includes(item.toolName)
  )
  let bestSearchHitCount = null
  for (const item of searchSuccess) {
    const count = extractSearchHitCount(item.text)
    if (!Number.isFinite(count)) continue
    bestSearchHitCount = bestSearchHitCount == null ? count : Math.max(bestSearchHitCount, count)
  }
  const hasSearchEvidence = searchSuccess.length > 0 && bestSearchHitCount !== null
  const hasSearchResults = Number.isFinite(bestSearchHitCount) && bestSearchHitCount > 0
  const hasContentRead = readSuccess.some(item => {
    const text = String(item.text || '').trim()
    // A successful tool envelope without a payload is not evidence. Treating
    // it as readable content lets the model invent details from a title/token.
    return hasReadableContentPayload(text)
  })
  const meetingReadSignals = readSuccess.map(extractMeetingLikeReadEvidence)
  const meetingLikeReadCount = meetingReadSignals.filter(s => s.matched).length
  const readNotFound = readFailures.some(item => isNotFoundText(item.text))
  const searchCandidates = searchSuccess.flatMap(item => extractSearchCandidates(item.text))
  const dedupCandidates = []
  const seenCandidates = new Set()
  for (const item of searchCandidates) {
    const key = `${item.token}::${item.url}::${item.title}`
    if (seenCandidates.has(key)) continue
    seenCandidates.add(key)
    dedupCandidates.push(item)
    if (dedupCandidates.length >= 5) break
  }
  const meetingCandidates = dedupCandidates.filter(item => item.meetingLike)
  const smartMinuteCandidates = meetingCandidates.filter(item => item.minutesGenerated)
  const joinedFailure = failures.map(item => `${item.code || ''}\n${item.text || ''}`.trim()).join('\n')
  const latestFailure = [...failures].reverse().find(item => String(item.text || item.message || '').trim())
  const latestFailureText = String(latestFailure?.text || latestFailure?.message || '').trim()
  const latestReadFailure = [...readFailures].reverse().find(item => String(item.text || item.message || '').trim())
  const readFailureText = String(latestReadFailure?.text || latestReadFailure?.message || '').trim()
  const minuteAclFailed = /No read permission for minute|没有查看权限|缺少可阅读权限|draft_minute_permission/i.test(
    `${readFailureText}\n${joinedFailure}`
  )
  // Avoid treating per-minute ACL errors or numeric codes like 1254403 as "auth missing".
  const authFailed = !minuteAclFailed && /未授权|auth_required|identity is missing|no token in keychain|(?:^|[^0-9])401(?:[^0-9]|$)|(?:^|[^0-9])403(?:[^0-9]|$)|权限不足|unauthorized|forbidden|(?:^|[^a-z])scope(?:[^a-z]|$)/i.test(joinedFailure)
  const unknownToolFailed = /unknown_tool|未注册工具|non[-_\s]?read|非只读飞书工具/i.test(joinedFailure)
  const invalidArgsFailed = /invalid_args|参数|需要|must provide|required/i.test(joinedFailure)
  const missingScopes = collectMissingScopes(failures)
  return {
    hasAny: success.length > 0,
    hasFailure: failures.length > 0,
    hasSearch: searchSuccess.length > 0,
    hasMeetingCandidates: meetingCandidateSuccess.length > 0,
    hasRelatedChats: relatedChatsSuccess.length > 0,
    hasTodayPriority: todayPrioritySuccess.length > 0,
    hasDocKbSuggest: docKbSuggestSuccess.length > 0,
    relatedChatsText: relatedChatsSuccess.at(-1)?.text || '',
    todayPriorityText: todayPrioritySuccess.at(-1)?.text || '',
    docKbSuggestText: docKbSuggestSuccess.at(-1)?.text || '',
    meetingCandidatesText: meetingCandidateSuccess.at(-1)?.text || '',
    hasSearchEvidence,
    hasSearchResults,
    searchHitCount: bestSearchHitCount,
    searchCandidates: dedupCandidates,
    meetingCandidates,
    smartMinuteCandidates,
    hasContentRead,
    meetingLikeReadCount,
    readAttempts: readSuccess.length + readFailures.length,
    readNotFound,
    readFailed: readFailures.length > 0,
    readFailureText,
    minuteAclFailed,
    authFailed,
    unknownToolFailed,
    invalidArgsFailed,
    latestFailureText,
    missingScopes,
  }
}

function formatSearchCandidates(candidates = []) {
  const list = Array.isArray(candidates) ? candidates : []
  if (!list.length) return ''
  return list.slice(0, 5).map((item, idx) => {
    const title = String(item.title || item.name || '未命名文档').trim()
    const tokenText = item.token ? `token: ${item.token}` : 'token: (缺失)'
    const urlText = item.url ? `[${title}](${item.url})` : '链接: (缺失)'
    const timeText = item.updatedAt ? `时间: ${item.updatedAt}` : '时间: (缺失)'
    return `【${idx + 1}】${urlText}\n   ${timeText}\n   ${tokenText}`
  }).join('\n')
}

function buildReadFailureNotice(evidence) {
  const reason = String(evidence.readFailureText || '').slice(0, 240)
  if (evidence.readNotFound) {
    return '我尝试读取飞书文档，但工具返回“文档不存在或未找到”。\n为避免乱答，我不会编造内容。请核对文档链接/token 是否正确，或确认你对该文档有访问权限后再试。'
  }
  if (evidence.minuteAclFailed) {
    return `我已按你选的会议调用 \`feishu.meeting_read\`，但飞书返回「没有这份妙记的查看权限」，所以读不到正文，也不会编造总结。\n${reason}\n如需我代你申请，回复「申请妙记权限」，我会先生成一条待你确认的申请；或你在飞书里自行申请「可阅读」后让我重试。`
  }
  // A missing-scope read failure is an authorization gap, not a bad token: offer
  // the just-in-time incremental authorization CTA instead of a generic error.
  if (Array.isArray(evidence.missingScopes) && evidence.missingScopes.length) {
    return buildAuthFailureNotice('读取飞书文档失败', null, evidence.missingScopes)
  }
  // A 401/403/unauthorized read failure without parseable scopes is still an auth
  // gap: offer generic re-authorization rather than a meeting-flavored dead-end.
  if (evidence.authFailed) {
    return buildAuthFailureNotice('读取飞书文档失败', '相关 scope', evidence.missingScopes)
  }
  return `我已按你选的会议调用读取工具，但飞书返回失败，因此不能输出会议摘要/行动项。\n失败原因：${reason || '工具未返回具体原因'}\n你可以让我重试、改选另一场会议，或直接给我妙记链接/token。`
}

const FEISHU_AUTH_ACTION_URL = 'knowme://feishu/auth'

/**
 * Auth guidance is only actionable when the connector really needs authorizing.
 * `authReady` defaults to true so a missing status never fabricates an auth problem.
 */
function buildAuthTail(context = {}) {
  if (context.authReady !== false) return ''
  return `\n飞书 user 授权尚未完成，点下面的按钮即可授权，我会在授权后自动继续这次提问。\n[一键授权飞书](${FEISHU_AUTH_ACTION_URL})`
}

function requiredFeishuToolsForIntent(intent = {}) {
  if (intent.asksRelatedChats) return ['feishu.related_chats']
  if (intent.asksTodayPriority) return ['feishu.today_priority']
  if (intent.asksDocKbSuggest) return ['feishu.doc_kb_suggest']
  if (intent.directDocRead) return ['feishu.read_doc']
  if (intent.asksMinutes) return ['feishu.meeting_candidates', 'feishu.meeting_read']
  const required = []
  if (intent.needsSearch) required.push('feishu.search_docs')
  if (intent.needsContentRead) required.push('feishu.read_doc')
  return required
}

function buildConnectorReadinessHint(intent = {}, context = {}) {
  const required = requiredFeishuToolsForIntent(intent)
  if (!required.length) return ''
  if (context.connectorEnabled === false) {
    return `当前飞书连接器还未启用，所以这轮没法投影所需工具（${required.join('、')}）。\n请先到“设置 → 连接器”启用飞书，再让我继续读取或润色。`
  }
  if (context.authReady === false) {
    return `当前飞书连接器已启用，但 user 身份尚未授权，所以还不能调用 ${required.join('、')}。${buildAuthTail(context)}`
  }
  const allowlist = Array.isArray(context.projectedAllowlist)
    ? context.projectedAllowlist
    : (Array.isArray(context.allowlist) ? context.allowlist : null)
  if (!allowlist) return ''
  const missing = required.filter(name => !allowlist.includes(name))
  if (!missing.length) return ''
  const reason = allowlist.length
    ? `当前 allowlist 未放行所需工具：${missing.join('、')}`
    : `当前 allowlist 为空，未放行所需工具：${missing.join('、')}`
  return `${reason}。\n所以模型这轮实际上“看不到”对应飞书工具，不能直接声称已读取文档。\n请到“设置 → 连接器”放行后重试。`
}

function buildMissingEvidenceNotice(subject, toolName, context = {}) {
  return `我还没有拿到${subject}，不能编造结果。\n请允许我先调用 \`${toolName}\`。${buildAuthTail(context)}`
}

// Encode the exact missing scopes onto the CTA so the in-chat button can request
// incremental authorization for only what this task needs (just-in-time authz).
function buildAuthCtaUrl(missingScopes = []) {
  const list = (Array.isArray(missingScopes) ? missingScopes : [])
    .map(s => String(s || '').trim()).filter(Boolean)
  if (!list.length) return FEISHU_AUTH_ACTION_URL
  return `${FEISHU_AUTH_ACTION_URL}?scopes=${encodeURIComponent(list.join(','))}`
}

function describeMissingScopeLabels(missingScopes = []) {
  try {
    // Lazy require keeps this pure-function module free of load-time deps.
    const { describeScopeCapabilities } = require('./connectors/feishu-auth')
    const labels = describeScopeCapabilities(missingScopes)
    if (Array.isArray(labels) && labels.length) return labels
  } catch { /* ignore */ }
  return []
}

/**
 * The tool itself reported insufficient permission, so re-authorizing is always
 * actionable here. When lark-cli told us the exact missing scopes, we ask only
 * for those (friendly capability names) and encode them onto the CTA so the
 * in-chat button can trigger incremental authorization and auto-resume.
 */
function buildAuthFailureNotice(subject, scopeHint, missingScopes = []) {
  const list = (Array.isArray(missingScopes) ? missingScopes : [])
    .map(s => String(s || '').trim()).filter(Boolean)
  const url = buildAuthCtaUrl(list)
  if (list.length) {
    const labels = describeMissingScopeLabels(list)
    const capability = labels.length ? labels.join('、') : '相关能力'
    return `${subject}：还差一项飞书授权就能继续——需要开通「${capability}」。\n点下面的按钮一键补齐，我会在授权后自动继续这次提问。\n[补齐授权并继续](${url})`
  }
  const scope = scopeHint ? `（需要 ${scopeHint}）` : ''
  return `${subject}：当前身份或权限不足${scope}。\n点下面的按钮重新授权即可补齐权限，我会在授权后自动继续这次提问。\n[重新授权飞书](${url})`
}

function buildFeishuGroundingHint(prompt = '', entries = [], answerText = '', context = {}) {
  const intent = detectFeishuIntent(prompt)
  if (!intent.mentioned) return ''
  const evidence = analyzeFeishuToolEvidence(entries)
  const readinessHint = buildConnectorReadinessHint(intent, context)
  // A follow-up that only re-slices facts already on screen (counts, ranking,
  // keywords) must not be blocked for "no tool result this round".
  if (context.priorFeishuFacts === true && !evidence.hasAny && !evidence.hasFailure) return ''
  // Related-chats IM workflow is complete once feishu.related_chats returns.
  if (intent.asksRelatedChats && evidence.hasRelatedChats) return ''
  if (intent.asksRelatedChats && !evidence.hasAny) {
    if (evidence.hasFailure) {
      if (evidence.authFailed) {
        return buildAuthFailureNotice('飞书聊天分析失败', 'IM 相关 scope', evidence.missingScopes)
      }
      if (evidence.latestFailureText) {
        return `飞书聊天分析失败：${evidence.latestFailureText.slice(0, 180)}\n请按报错修正后重试。`
      }
      return '飞书聊天分析失败，本轮没有可用返回结果。\n请检查连接器状态后重试。'
    }
    return buildMissingEvidenceNotice('飞书聊天工具返回结果', 'feishu.related_chats', context)
  }
  // Today-priority workflow is complete once feishu.today_priority returns.
  if (intent.asksTodayPriority && evidence.hasTodayPriority) return ''
  if (intent.asksTodayPriority && !evidence.hasAny) {
    if (evidence.hasFailure) {
      if (evidence.authFailed) {
        return buildAuthFailureNotice('今日优先级事实拉取失败', 'calendar / task scope', evidence.missingScopes)
      }
      if (evidence.latestFailureText) {
        return `今日优先级事实拉取失败：${evidence.latestFailureText.slice(0, 180)}\n请按报错修正后重试。`
      }
      return '今日优先级事实拉取失败，本轮没有可用返回结果。\n请检查连接器状态后重试。'
    }
    return buildMissingEvidenceNotice('今日优先级工具返回结果', 'feishu.today_priority', context)
  }
  // Doc/KB suggest workflow is complete once feishu.doc_kb_suggest returns.
  if (intent.asksDocKbSuggest && evidence.hasDocKbSuggest) return ''
  if (intent.asksDocKbSuggest && !evidence.hasAny) {
    if (evidence.hasFailure) {
      if (evidence.authFailed) {
        return buildAuthFailureNotice('飞书文档/知识库整理失败', 'docs / drive / wiki scope', evidence.missingScopes)
      }
      if (evidence.latestFailureText) {
        return `飞书文档/知识库整理失败：${evidence.latestFailureText.slice(0, 180)}\n请按报错修正后重试。`
      }
      return '飞书文档/知识库整理失败，本轮没有可用返回结果。\n请检查连接器状态后重试。'
    }
    return buildMissingEvidenceNotice('飞书文档/知识库候选工具返回结果', 'feishu.doc_kb_suggest', context)
  }
  // A failed read is the most specific signal we have: surface its real cause
  // before any generic scope guidance, which misdiagnoses per-minute ACL denials.
  if (evidence.readFailed && !evidence.hasContentRead) return buildReadFailureNotice(evidence)
  if (!evidence.hasAny) {
    if (evidence.hasFailure) {
      if (evidence.minuteAclFailed) {
        const reason = (evidence.readFailureText || evidence.latestFailureText || '').slice(0, 240)
        return `我已按你选的会议调用 \`feishu.meeting_read\`，但飞书返回「没有该妙记的查看权限」，所以读不到正文，也不会编造总结。\n${reason}\n如需我代你申请，回复「申请妙记权限」，我会先生成一条待你确认的申请；或你在飞书里自行申请「可阅读」后让我重试。`
      }
      if (evidence.authFailed) {
        return buildAuthFailureNotice('飞书工具调用失败', '相关 scope', evidence.missingScopes)
      }
      if (evidence.unknownToolFailed) {
        return '飞书工具调用失败：当前会话未注册所需飞书工具能力。\n请改为“搜索文档/知识库”或提供可读取的文档链接（token）后重试。'
      }
      if (evidence.invalidArgsFailed) {
        return '飞书工具调用失败：参数不完整或格式不匹配。\n请补充查询关键词，或直接提供文档链接/token，我再继续处理。'
      }
      if (evidence.latestFailureText) {
        return `飞书工具调用失败：${evidence.latestFailureText.slice(0, 180)}\n请按报错修正后重试，我再基于真实返回继续。`
      }
      return '飞书工具调用失败，本轮没有可用返回结果。\n请检查连接器状态与调用参数后重试。'
    }
    if (readinessHint) return readinessHint
    return `我还没有拿到任何飞书工具返回结果，不能给你编造“已查询到”的内容。\n请允许我先调用飞书只读工具查询。${buildAuthTail(context)}`
  }
  // Even if intent detection missed, never ask for doc tokens after related_chats / today_priority / doc_kb_suggest succeeded.
  if ((evidence.hasRelatedChats || evidence.hasTodayPriority || evidence.hasDocKbSuggest) && !intent.asksMinutes && !evidence.hasSearch && !evidence.hasContentRead) {
    return ''
  }
  if (evidence.hasDocKbSuggest && !intent.asksMinutes && !evidence.hasContentRead) {
    return ''
  }
  if (evidence.readNotFound) {
    return '我尝试读取飞书文档，但工具返回“文档不存在或未找到”。\n为避免乱答，我不会编造内容。请核对文档链接/token 是否正确，或确认你对该文档有访问权限后再试。'
  }
  if (intent.needsSearch && evidence.hasSearch && !evidence.hasSearchEvidence) {
    return '我调用了飞书搜索工具，但没有拿到可核验的检索结果结构。\n为避免误报“已找到文档”，请重试搜索，或改为提供明确文档链接/token 让我直接读取。'
  }
  if (intent.needsSearch && evidence.hasSearchEvidence && evidence.searchHitCount === 0) {
    return '这次飞书检索结果为 0 条，我不能编造“已找到文档”的结论。\n请换关键词、确认搜索范围，或直接提供文档链接/token。'
  }
  if (intent.needsContentRead && !evidence.hasContentRead) {
    if (intent.asksMinutes && evidence.hasMeetingCandidates) {
      return evidence.meetingCandidatesText || '确定性会议 Workflow 未返回候选文档。'
    }
    if (intent.asksMinutes && evidence.hasSearch) {
      if (evidence.smartMinuteCandidates.length > 0) {
        const candidates = formatSearchCandidates(evidence.smartMinuteCandidates)
        return `我目前仅完成了检索，还没读取会议正文，不能直接总结。\n已筛出“智能纪要助手/会议记录”候选文档，请回复序号（1-5）或粘贴链接/token，我再读取原文：\n${candidates}`
      }
      if (evidence.meetingCandidates.length > 0) {
        const candidates = formatSearchCandidates(evidence.meetingCandidates)
        return `我检索到了“会议相关文档”，但当前未识别到明确由“智能纪要助手”生成的会议记录。\n按你的要求我不会用无关文档做总结。若你同意，我可先从以下会议相关候选读取：\n${candidates}\n或请直接提供智能纪要文档链接/token。`
      }
      return '本轮检索未命中“智能纪要助手生成的会议记录文档”，我不会用无关结果编造会议总结。\n请提供目标智能纪要文档链接/token，或让我继续仅用“智能纪要助手/会议纪要/会议记录”关键词扩大时间范围重试。'
    }
    if (evidence.readAttempts > 0) {
      return '我调用了读取工具，但返回的正文为空，因此不能输出会议摘要/行动项等结论。\n请核对文档链接/token 与权限后重试，我会基于真实正文再总结。'
    }
    if (evidence.hasSearch) {
      const candidates = formatSearchCandidates(evidence.searchCandidates)
      if (candidates) {
        return `我目前只有飞书搜索结果，还没有读取到文档正文，因此不能输出会议摘要/参会人/行动项等细节。\n你可以直接回复要读取的序号（1-5）或粘贴链接/token，我将继续用 \`feishu.read_doc\`（或 \`feishu.get_wiki_node\`）读取原文：\n${candidates}`
      }
      return '我目前只有飞书搜索结果，还没有读取到文档正文，因此不能输出会议摘要/参会人/行动项等细节。\n请给我要读取的文档链接或 token，我将用 `feishu.read_doc`（或 `feishu.get_wiki_node`）读取原文后再总结。'
    }
    return '我还没有读取到飞书文档正文，不能直接给出会议内容结论。\n请提供文档链接或 token，我会先读取原文再输出结论。'
  }
  if (intent.asksMinutes && !evidence.hasContentRead) {
    return '你提到的是飞书妙记/会议纪要场景。当前我需要先读取对应文档原文，才能给出准确摘要。\n如果记录在「智能纪要助手」会话里，请先点开纪要卡片里的云文档并提供链接/token；我再基于真实内容整理。'
  }
  if (intent.asksMinutes && evidence.hasContentRead && evidence.meetingLikeReadCount === 0) {
    return '我虽然读取到了飞书正文，但当前已读内容没有明确“会议纪要/会议记录/妙记”证据，不能把它当作会议记录来总结。\n请让我继续检索更精确关键词（智能纪要/智能纪要助手/会议纪要/会议记录/会后纪要/妙记/minutes），或直接提供目标会议文档链接/token。'
  }
  if (evidence.hasSearchEvidence && evidence.searchHitCount === 0 && hasFoundClaim(answerText)) {
    return '飞书搜索结果显示 0 条命中，但当前回答出现了“已找到文档”的表述。\n为避免误导，我先不输出该结论；请调整关键词或提供准确文档链接/token。'
  }
  return ''
}

module.exports = {
  FEISHU_AUTH_ACTION_URL,
  hasFeishuMention,
  isTodayPriorityIntent,
  detectFeishuIntent,
  hasExplicitFeishuDocLocator,
  requiredFeishuToolsForIntent,
  analyzeFeishuToolEvidence,
  buildFeishuGroundingHint,
  extractScopesFromText,
  collectMissingScopes,
  buildAuthCtaUrl,
  buildAuthFailureNotice,
}
